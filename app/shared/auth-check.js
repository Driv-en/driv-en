// ==========================================
// AUTH CHECK — Shared auth protection script
// ==========================================
// HOW IT WORKS:
//   1. Add this line to any page that needs protection:
//      <script src="/app/shared/auth-check.js"></script>
//   2. The script checks /auth/session to see if the user is logged in.
//   3. If not logged in, it redirects to the login page.
//   4. If the page has data-required-role="Admin" on the <body> tag,
//      it also checks that the user has the Admin role.
//      If they don't, they are redirected to a "no access" page.
//   5. If the page has data-required-task="Employees" (or any task name)
//      on the <body> tag, it checks that the user is either an Admin
//      OR a Key Personnel assigned that task. If not, they are redirected
//      to the no-access page.
//   6. User info is stored in window.drivenUser for other scripts to use.
//
// HOW TO REQUIRE ADMIN ACCESS ON A PAGE:
//   Add this attribute to the <body> tag:
//      <body data-page-title="..." data-required-role="Admin">
//
// HOW TO REQUIRE A SPECIFIC ONBOARDING TASK ON A PAGE:
//   Add this attribute to the <body> tag:
//      <body data-page-title="..." data-required-task="Employees">
//   Admins always pass. Non-admins must be assigned the named task
//   in the key_personnel_roles table.
// ==========================================

(async function() {
  try {
    var response = await fetch("/auth/session");
    var data = await response.json();

    if (!data.authenticated) {
      // Not logged in — redirect to the correct login page based on role
      var requiredRole = document.body.getAttribute("data-required-role");
      if (requiredRole === "DRIV-EN Founder") {
        window.location.href = "/app/auth/founder-login.html";
      } else {
        window.location.href = "/public/login.html";
      }
      return;
    }

    // Store user info globally for other scripts to use
    window.drivenUser = data.user;

    // ===== HIDE ADMIN-ONLY ELEMENTS FOR NON-ADMINS =====
    // Any HTML element with class "driven-admin-only" is hidden if the
    // current user is NOT an admin. This is used for back buttons
    // (e.g., "Return to Admin Dashboard") that should only appear
    // for admins. Key Personnel should not see admin navigation.
    var userRole = (data.user && data.user.role) ? String(data.user.role) : "";
    // Case-insensitive admin check — handles "Admin", "admin", "ADMIN"
    // Also handles null/undefined role (treats as non-admin)
    if (userRole.toLowerCase() !== "admin") {
      document.querySelectorAll(".driven-admin-only").forEach(function(el) {
        el.style.display = "none";
      });
    }

    // Check if this page requires a specific role
    var requiredRole = document.body.getAttribute("data-required-role");
    if (requiredRole) {
      if (userRole.toLowerCase() !== requiredRole.toLowerCase()) {
        // User doesn't have the required role — redirect to no-access page
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

    // Check if this page requires a specific onboarding task
    // Admins always pass. Non-admins must be assigned the task.
    var requiredTask = document.body.getAttribute("data-required-task");
    if (requiredTask) {
      // Admins can access any page (case-insensitive check)
      if (userRole.toLowerCase() !== "admin") {
        // Non-admin: check if they're assigned this task
        var hasTask = await checkUserAssignedTask(data.user, requiredTask);
        if (!hasTask) {
          window.location.href = "/app/auth/no-access.html";
          return;
        }
      }
    }
  } catch (e) {
    console.error("Auth check error:", e.message);
    // On error, redirect to the correct login page based on role
    var requiredRole = document.body.getAttribute("data-required-role");
    if (requiredRole === "DRIV-EN Founder") {
      window.location.href = "/app/auth/founder-login.html";
    } else {
      window.location.href = "/public/login.html";
    }
  }
})();

/* ==========================================
   CHECK IF USER IS ASSIGNED A TASK
   Fetches the key personnel list from the API,
   finds the current user by email, and checks
   if they have the given task in their roles.
   Returns true if assigned, false otherwise.
   ========================================== */
async function checkUserAssignedTask(user, taskName) {
  if (!user || !user.email || !user.org_id) return false;

  try {
    var response = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(user.org_id));
    var data = await response.json();

    if (!data.success || !data.keyPersonnel) return false;

    var userEmail = user.email.toLowerCase().trim();
    var foundUser = data.keyPersonnel.find(function(kp) {
      return kp.email && kp.email.toLowerCase().trim() === userEmail;
    });

    if (!foundUser || !foundUser.roles) return false;

    return foundUser.roles.some(function(r) { return r.role === taskName; });
  } catch (e) {
    console.error("Task assignment check error:", e.message);
    return false;
  }
}
