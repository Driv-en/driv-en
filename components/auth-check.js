// ==========================================
// AUTH CHECK — Shared auth protection script (Updated v12)
// ==========================================

(async function() {
  try {
    var response = await fetch("/auth/session", {
      headers: { "Accept": "application/json" },
      credentials: "include"
    });

    if (!response.ok) {
      console.warn("[AuthCheck] /auth/session returned non-OK status:", response.status);
      window.location.href = "/public/login.html";
      return;
    }

    var data = await response.json();

    if (!data || !data.authenticated || !data.user) {
      console.warn("[AuthCheck] User is not authenticated");
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

    // Enforce org_dsi and RO-Founder override for founder
    if (isFounder) {
      if (!data.user.org_id || data.user.org_id === "default_org") {
        data.user.org_id = "org_dsi";
      }
      data.user.role_id = "RO-Founder";
      data.user.role = "DRIV-EN Founder";
    }

    // Store user info globally for other scripts to use
    window.drivenUser = data.user;
    window.dashUser = data.user;
    if (data.user.org_id) {
      localStorage.setItem("driven_customer_id", data.user.org_id);
    }

    // Notify any listening dashboard scripts that the session is verified
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: data.user }));

    // Page Specific Enforcement — Owner Dashboard Access
    var isOwnerDashboard = window.location.pathname.indexOf("owner-dashboard") !== -1;
    if (isOwnerDashboard && !isFounder) {
      console.warn("[AuthCheck] Unauthorized access attempt to Owner Dashboard");
      window.location.href = "/app/auth/no-access.html";
      return;
    }

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
    console.error("[AuthCheck] Exception error:", e.message);
    window.location.href = "/public/login.html";
  }
})();

/* ==========================================
   CHECK IF USER IS ASSIGNED A TASK
   ========================================== */
async function checkUserAssignedTask(user, taskName) {
  if (!user || !user.email || !user.org_id) return false;

  try {
    var response = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(user.org_id), {
      credentials: "include"
    });
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
