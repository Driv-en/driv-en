// AUTH CHECK — Shared auth protection script v3
// Checks /auth/session, redirects to login if not authenticated.
// Hides elements with class "driven-admin-only" for non-admins.
// Checks data-required-role and data-required-task on body tag.
(async function() {
  try {
    var response = await fetch("/auth/session");
    var data = await response.json();
    if (!data.authenticated) { window.location.href = "/public/login.html"; return; }
    window.drivenUser = data.user;
    var userRole = (data.user && data.user.role) ? data.user.role : "";
    if (userRole !== "Admin") { document.querySelectorAll(".driven-admin-only").forEach(function(el) { el.style.display = "none"; }); }
    var requiredRole = document.body.getAttribute("data-required-role");
    if (requiredRole && userRole !== requiredRole) { window.location.href = "/public/no-access.html"; return; }
    var requiredTask = document.body.getAttribute("data-required-task");
    if (requiredTask && userRole !== "Admin") {
      var hasTask = await checkUserAssignedTask(data.user, requiredTask);
      if (!hasTask) { window.location.href = "/public/no-access.html"; return; }
    }
  } catch (e) { window.location.href = "/public/login.html"; }
})();
async function checkUserAssignedTask(user, taskName) {
  if (!user || !user.email || !user.org_id) return false;
  try {
    var response = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(user.org_id));
    var data = await response.json();
    if (!data.success || !data.keyPersonnel) return false;
    var userEmail = user.email.toLowerCase().trim();
    var foundUser = data.keyPersonnel.find(function(kp) { return kp.email && kp.email.toLowerCase().trim() === userEmail; });
    if (!foundUser || !foundUser.roles) return false;
    return foundUser.roles.some(function(r) { return r.role === taskName; });
  } catch (e) { return false; }
}
