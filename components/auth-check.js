// ==========================================
// AUTH CHECK — Shared auth protection script
// ==========================================
// HOW IT WORKS:
//   1. Add this line to any page that needs protection:
//      <script src="/components/auth-check.js"></script>
//   2. The script checks /auth/session to see if the user is logged in.
//   3. If not logged in, it redirects to /public/login.html.
//   4. If the page has data-required-role="Admin" on the <body> tag,
//      it also checks that the user has the Admin role.
//   5. Founder accounts (jblood@digitalsafetyinspection.com / RO-Founder)
//      bypass all role, task, and permission restrictions.
//   6. User info is stored in window.drivenUser and dispatches 'dashSessionLoaded'.
// ==========================================

(async function() {
  try {
    var response = await fetch("/auth/session");
    if (!response.ok) {
      window.location.href = "/public/login.html";
      return;
    }

    var data = await response.json();

    if (!data || !data.authenticated || !data.user) {
      window.location.href = "/public/login.html";
      return;
    }

    // Identify founder account
    var userEmail = (data.user.email || "").toLowerCase().trim();
    var userRole = (data.user.role || "").toString();
    var userRoleId = (data.user.role_id || "").toString();

    var isFounder = userEmail === "jblood@digitalsafetyinspection.com" ||
                    userRoleId === "RO-Founder" ||
                    userRole.toLowerCase().indexOf("founder") !== -1;

    // Enforce org_dsi fallback for founder if org is missing or default
    if (isFounder && (!data.user.org_id || data.user.org_id === "default_org")) {
      data.user.org_id = "org_dsi";
    }

    // Store user info globally for other scripts to use
    window.drivenUser = data.user;
    window.dashUser = data.user;
    if (data.user.org_id) {
      localStorage.setItem("driven_customer_id", data.user.org_id);
    }

    // Notify any listening dashboard scripts that the session is verified
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: data.user }));

    var isAdminRole = isFounder ||
                      ["admin", "administrator"].indexOf(userRole.toLowerCase()) !== -1;

    // Hide admin-only UI elements for standard users
    if (!isAdminRole) {
      document.querySelectorAll(".driven-admin-only").forEach(function(el) {
        el.style.display = "none";
      });
    }

    // If user is founder, allow immediate access to all routes
    if (isFounder) {
      return;
    }

    // Check required role for standard users
    var requiredRole = document.body ? document.body.getAttribute("data-required-role") : null;
    if (requiredRole) {
      if (!isAdminRole && userRole.toLowerCase() !== requiredRole.toLowerCase()) {
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

    // Check required onboarding task
    var requiredTask = document.body ? document.body.getAttribute("data-required-task") : null;
    if (requiredTask && !isAdminRole) {
      var hasTask = await checkUserAssignedTask(data.user, requiredTask);
      if (!hasTask) {
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

    // Check required permission
    var requiredPermission = document.body ? document.body.getAttribute("data-required-permission") : null;
    if (requiredPermission && !isAdminRole) {
      var userPerms = data.user.permissions || [];
      var hasPermission = userPerms.some(function(p) {
        return p.toLowerCase() === requiredPermission.toLowerCase();
      });
      if (!hasPermission) {
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

  } catch (e) {
    console.error("Auth check error:", e.message);
    window.location.href = "/public/login.html";
  }
})();

/* ==========================================
   CHECK IF USER IS ASSIGNED A TASK
   ========================================== */
async function checkUserAssignedTask(user, taskName) {
  if (!user || !user.email || !user.org_id) return false;

  try {
    var response = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(user.org_id));
    var data = await response.json();

    if (!data || !data.success || !data.keyPersonnel) return false;

    var targetEmail = user.email.toLowerCase().trim();
    var foundUser = data.keyPersonnel.find(function(kp) {
      return kp.email && kp.email.toLowerCase().trim() === targetEmail;
    });

    if (!foundUser || !foundUser.roles) return false;

    return foundUser.roles.some(function(r) { return r.role === taskName; });
  } catch (e) {
    console.error("Task assignment check error:", e.message);
    return false;
  }
}
