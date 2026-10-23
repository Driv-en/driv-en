// ============================================================================
// AUTH CHECK — Shared auth protection script (v16 — Full Safety & Sync)
// ============================================================================

(async function() {
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", arguments.callee);
    return;
  }

  // 1. FAST-PATH: Immediately hydrate session state from storage to avoid navigation flickering
  var cachedUserStr = localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user");
  var cachedUser = null;
  try {
    if (cachedUserStr) cachedUser = JSON.parse(cachedUserStr);
  } catch(e) {}

  if (cachedUser) {
    if (!cachedUser.id && cachedUser.user_id) cachedUser.id = cachedUser.user_id;
    window.drivenUser = cachedUser;
    window.dashUser = cachedUser;
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: cachedUser }));
  }

  try {
    var storedToken = localStorage.getItem("driven_session_token") || sessionStorage.getItem("driven_session_token");
    var headers = { "Accept": "application/json" };
    if (storedToken) {
      headers["Authorization"] = "Bearer " + storedToken;
    }

    var response = await fetch("/auth/session", {
      headers: headers,
      credentials: "include"
    });

    var user = null;

    if (response.ok) {
      var data = await response.json();
      if (data && data.authenticated && data.user) {
        user = data.user;
      }
    }

    // Fall back to cached session if network verification is delayed or offline
    if (!user && cachedUser) {
      user = cachedUser;
    }

    if (!user) {
      console.warn("[AuthCheck] Session unauthenticated or user payload missing");
      window.location.href = "/public/login.html";
      return;
    }

    // Ensure primary key 'id' matches 'users' table schema
    if (!user.id && user.user_id) {
      user.id = user.user_id;
    }

    var userEmail = (user.email || "").toLowerCase().trim();
    var userRole = (user.role || "").toString().toLowerCase();
    var userRoleId = (user.role_id || "").toString().toLowerCase();

    // Identify Founder & Admin privileges
    var isFounder = userEmail === "jblood@digitalsafetyinspection.com" ||
                    userRoleId === "ro-founder" ||
                    userRole.indexOf("founder") !== -1;

    var isAdminRole = isFounder ||
                      userRoleId === "ro-admin" ||
                      ["admin", "administrator"].indexOf(userRole) !== -1;

    // Enforce org_dsi and RO-Founder override for founder
    if (isFounder) {
      if (!user.org_id || user.org_id === "default_org") {
        user.org_id = "org_dsi";
      }
      user.role_id = "RO-Founder";
      user.role = "DRIV-EN Founder";
    }

    // Store user info in storage & globally for downstream scripts
    var userStr = JSON.stringify(user);
    var targetOrg = user.org_id || localStorage.getItem("driven_org_id") || "org_dsi";
    var activeRole = user.role_id || user.role || "RO-admin";

    localStorage.setItem("driven_user", userStr);
    localStorage.setItem("driven_org_id", targetOrg);
    localStorage.setItem("driven_customer_id", targetOrg);
    localStorage.setItem("driven_role", activeRole);
    if (user.id) localStorage.setItem("driven_user_id", user.id);

    sessionStorage.setItem("driven_user", userStr);
    sessionStorage.setItem("driven_org_id", targetOrg);
    sessionStorage.setItem("driven_role", activeRole);
    if (user.id) sessionStorage.setItem("driven_user_id", user.id);

    window.drivenUser = user;
    window.dashUser = user;

    // Dispatch event to notify dashboard modules
    document.dispatchEvent(new CustomEvent("dashSessionLoaded", { detail: user }));

    // Hide admin-only UI elements for standard users
    if (!isAdminRole) {
      document.querySelectorAll(".driven-admin-only").forEach(function(el) {
        el.style.display = "none";
      });
    }

    // Page Specific Enforcement
    var currentPath = window.location.pathname.toLowerCase();
    var isOwnerDashboard = currentPath.indexOf("owner-dashboard") !== -1;
    var isAdminDashboard = currentPath.indexOf("admin") !== -1 && !isOwnerDashboard;

    // Founder bypasses all route and attribute checks
    if (isFounder) {
      return;
    }

    // Check Owner Dashboard Access (Requires Founder)
    if (isOwnerDashboard && !isFounder) {
      console.warn("[AuthCheck] Unauthorized access attempt to Owner Dashboard");
      window.location.href = "/app/auth/no-access.html";
      return;
    }

    // Check Admin Dashboard Access (Requires Admin)
    if (isAdminDashboard && !isAdminRole) {
      console.warn("[AuthCheck] Unauthorized access attempt to Admin Dashboard");
      window.location.href = "/app/auth/no-access.html";
      return;
    }

    // Check required role for standard users (Supports comma-separated lists)
    var requiredRole = document.body ? document.body.getAttribute("data-required-role") : null;
    if (requiredRole && !isAdminRole) {
      var reqRoles = requiredRole.toLowerCase().split(",").map(function(r) { return r.trim(); });
      var matchesRole = reqRoles.some(function(req) {
        return userRole === req || userRoleId === req || userRole.indexOf(req) !== -1;
      });
      if (!matchesRole) {
        console.warn("[AuthCheck] User role", userRole, "does not match required role(s):", requiredRole);
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

    // Check required onboarding task for standard users
    var requiredTask = document.body ? document.body.getAttribute("data-required-task") : null;
    if (requiredTask && !isAdminRole) {
      var hasTask = await checkUserAssignedTask(user, requiredTask);
      if (!hasTask) {
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

    // Check required permission for standard users
    var requiredPermission = document.body ? document.body.getAttribute("data-required-permission") : null;
    if (requiredPermission && !isAdminRole) {
      var userPerms = user.permissions || [];
      var hasPermission = userPerms.some(function(p) {
        return String(p).toLowerCase() === requiredPermission.toLowerCase();
      });
      if (!hasPermission) {
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

  } catch (e) {
    console.error("[AuthCheck] Exception error:", e.message);
    if (!cachedUser) {
      window.location.href = "/public/login.html";
    }
  }
})();

/* ==========================================
   CHECK IF USER IS ASSIGNED A TASK
   ========================================== */
async function checkUserAssignedTask(user, taskName) {
  var orgId = user.org_id || localStorage.getItem("driven_customer_id") || localStorage.getItem("driven_org_id");
  if (!user || !user.email || !orgId) return false;

  try {
    var storedToken = localStorage.getItem("driven_session_token") || sessionStorage.getItem("driven_session_token");
    var headers = { "x-org-id": orgId };
    if (storedToken) headers["Authorization"] = "Bearer " + storedToken;

    var response = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(orgId), {
      headers: headers,
      credentials: "include"
    });
    var data = await response.json();

    if (!data || !data.success || !data.keyPersonnel) return false;

    var targetEmail = user.email.toLowerCase().trim();
    var foundUser = data.keyPersonnel.find(function(kp) {
      return kp.email && kp.email.toLowerCase().trim() === targetEmail;
    });

    if (!foundUser || !foundUser.roles) return false;

    return foundUser.roles.some(function(r) { 
      var taskVal = r.task_name || r.role || "";
      return String(taskVal).trim().toLowerCase() === taskName.trim().toLowerCase();
    });
  } catch (e) {
    console.error("[AuthCheck] Task assignment check error:", e.message);
    return false;
  }
}
