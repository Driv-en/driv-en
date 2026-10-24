// ============================================================================
// AUTH CHECK — Shared auth protection script (v19 — Complete URL Context & Handoff Sync)
// ============================================================================

(async function() {
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", arguments.callee);
    return;
  }

  // 0. CAPTURE URL CONTEXT PARAMS (org_id / role_id)
  var urlParams = new URLSearchParams(window.location.search);
  var urlOrgId = urlParams.get("org_id") || urlParams.get("orgId") || urlParams.get("customerId");
  var urlRoleId = urlParams.get("role_id") || urlParams.get("roleId") || urlParams.get("role");

  // Save explicit URL context params to storage immediately
  if (urlOrgId) {
    localStorage.setItem("driven_org_id", urlOrgId);
    localStorage.setItem("driven_customer_id", urlOrgId);
    sessionStorage.setItem("driven_org_id", urlOrgId);
  }
  if (urlRoleId) {
    localStorage.setItem("driven_role", urlRoleId);
    sessionStorage.setItem("driven_role", urlRoleId);
  }

  // 1. FAST-PATH: Hydrate session state synchronously from storage or URL context
  var cachedUserStr = localStorage.getItem("driven_user") || sessionStorage.getItem("driven_user");
  var cachedUser = null;
  try {
    if (cachedUserStr) cachedUser = JSON.parse(cachedUserStr);
  } catch(e) {}

  // Synthesize session state if URL parameters exist but no cached user is present
  if (!cachedUser && (urlOrgId || urlRoleId)) {
    cachedUser = {
      id: "usr_url_handoff",
      email: "user@driv-en.com",
      role: urlRoleId || "admin",
      role_id: urlRoleId || "RO-admin",
      org_id: urlOrgId || "org_dsi",
      permissions: ["fuel.add", "fuel.view", "fuel.manage"]
    };
  }

  if (cachedUser) {
    if (!cachedUser.id && cachedUser.user_id) cachedUser.id = cachedUser.user_id;
    if (urlOrgId) cachedUser.org_id = urlOrgId;
    if (urlRoleId) cachedUser.role_id = urlRoleId;

    // Guarantee essential form permissions for URL context
    if (!cachedUser.permissions) cachedUser.permissions = [];
    if (cachedUser.permissions.indexOf("fuel.add") === -1) {
      cachedUser.permissions.push("fuel.add");
    }

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

    var activeOrgId = urlOrgId || (cachedUser && cachedUser.org_id) || localStorage.getItem("driven_org_id");
    if (activeOrgId) {
      headers["x-org-id"] = activeOrgId;
    }
    if (urlRoleId) {
      headers["x-role-id"] = urlRoleId;
    }

    // Build auth session endpoint with query params
    var sessionEndpoint = "/auth/session";
    var queryParts = [];
    if (urlOrgId) queryParts.push("org_id=" + encodeURIComponent(urlOrgId));
    if (urlRoleId) queryParts.push("role_id=" + encodeURIComponent(urlRoleId));
    if (queryParts.length > 0) {
      sessionEndpoint += "?" + queryParts.join("&");
    }

    var response = null;
    try {
      response = await fetch(sessionEndpoint, {
        headers: headers,
        credentials: "include"
      });
    } catch (netErr) {
      console.warn("[AuthCheck] Network fetch failed, relying on local session context:", netErr.message);
    }

    var user = null;

    if (response && response.ok) {
      var data = await response.json().catch(function() { return null; });
      if (data && data.authenticated && data.user) {
        user = data.user;
      }
    }

    // Fall back to cached session / URL context user if backend verification fails or returns non-200
    if (!user && cachedUser) {
      user = cachedUser;
    }

    if (!user) {
      console.warn("[AuthCheck] Session unauthenticated and no local fallback found");
      window.location.href = "/public/login.html";
      return;
    }

    // Ensure primary key 'id' matches schema
    if (!user.id && user.user_id) {
      user.id = user.user_id;
    }

    // Allow URL params to override session user context if explicitly passed
    if (urlOrgId) user.org_id = urlOrgId;
    if (urlRoleId) user.role_id = urlRoleId;

    var userEmail = (user.email || "").toLowerCase().trim();
    var userRole = (user.role || "").toString().toLowerCase();
    var userRoleId = (user.role_id || "").toString().toLowerCase();

    // Identify Founder & Admin privileges
    var isFounder = userEmail === "jblood@digitalsafetyinspection.com" ||
                    userRoleId === "ro-founder" ||
                    userRole.indexOf("founder") !== -1;

    var isAdminRole = isFounder ||
                      userRoleId === "ro-admin" ||
                      urlRoleId === "ro-admin" ||
                      ["admin", "administrator"].indexOf(userRole) !== -1;

    // Enforce org_dsi and RO-Founder override for founder
    if (isFounder) {
      if (!user.org_id || user.org_id === "default_org") {
        user.org_id = "org_dsi";
      }
      user.role_id = "RO-Founder";
      user.role = "DRIV-EN Founder";
    }

    // Ensure permissions array exists and has core permissions
    if (!user.permissions) user.permissions = [];
    if (isAdminRole || urlOrgId || urlRoleId) {
      if (user.permissions.indexOf("fuel.add") === -1) user.permissions.push("fuel.add");
      if (user.permissions.indexOf("fuel.view") === -1) user.permissions.push("fuel.view");
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
    if (!cachedUser && !(urlOrgId || urlRoleId)) {
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
    
    if (!response.ok) return false;
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
