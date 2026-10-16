// ============================================================================
// AUTH CHECK — Shared auth protection script (v8 — Role ID & Multi-Tenant Fix)
// ============================================================================

(async function() {
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", arguments.callee);
    return;
  }
  try {
    var response = await fetch("/auth/session");
    if (!response.ok) throw new Error("Session check failed: " + response.status);
    var data = await response.json();

    if (!data.authenticated) {
      var requiredRole = document.body.getAttribute("data-required-role");
      if (requiredRole === "DRIV-EN Founder") {
        window.location.href = "/app/auth/founder-login.html";
      } else {
        window.location.href = "/public/login.html";
      }
      return;
    }

    window.drivenUser = data.user;

    // Flexible Role Extraction supporting role_id & normalized variants
    var rawRole = (data.user && (data.user.role_id || data.user.role)) ? String(data.user.role_id || data.user.role).trim().toLowerCase() : "";
    
    var isAdminRole = [
      "admin", 
      "administrator", 
      "ro-admin", 
      "ro - admin", 
      "ro-founder", 
      "driv-en founder"
    ].indexOf(rawRole) !== -1 || rawRole.indexOf("founder") !== -1 || rawRole.indexOf("admin") !== -1;

    if (!isAdminRole) {
      document.querySelectorAll(".driven-admin-only").forEach(function(el) {
        el.style.display = "none";
      });
    }

    var requiredRole = document.body.getAttribute("data-required-role");
    if (requiredRole) {
      var reqLower = requiredRole.trim().toLowerCase();
      var matchesReq = (rawRole === reqLower) || (reqLower === "admin" && isAdminRole);
      if (!isAdminRole && !matchesReq) {
        window.location.href = "/app/auth/no-access.html";
        return;
      }
    }

    var requiredTask = document.body.getAttribute("data-required-task");
    if (requiredTask) {
      if (!isAdminRole) {
        var hasTask = await checkUserAssignedTask(data.user, requiredTask);
        if (!hasTask) {
          window.location.href = "/app/auth/no-access.html";
          return;
        }
      }
    }

    var requiredPermission = document.body.getAttribute("data-required-permission");
    if (requiredPermission) {
      if (!isAdminRole) {
        var userPerms = (data.user && data.user.permissions) ? data.user.permissions : [];
        var hasPermission = userPerms.some(function(p) {
          return String(p).toLowerCase() === requiredPermission.toLowerCase();
        });
        if (!hasPermission) {
          window.location.href = "/app/auth/no-access.html";
          return;
        }
      }
    }
  } catch (e) {
    console.error("Auth check error:", e.message);
    var requiredRole = document.body.getAttribute("data-required-role");
    if (requiredRole === "DRIV-EN Founder") {
      window.location.href = "/app/auth/founder-login.html";
    } else {
      window.location.href = "/public/login.html";
    }
  }
})();

async function checkUserAssignedTask(user, taskName) {
  var orgId = user.org_id || localStorage.getItem("driven_org_id");
  if (!user || !user.email || !orgId) return false;
  
  try {
    var response = await fetch("/api/onboarding/key-personnel/list?customerId=" + encodeURIComponent(orgId), {
      headers: {
        "x-org-id": orgId
      }
    });
    var data = await response.json();
    if (!data.success || !data.keyPersonnel) return false;
    
    var userEmail = user.email.toLowerCase().trim();
    var foundUser = data.keyPersonnel.find(function(kp) {
      return kp.email && kp.email.toLowerCase().trim() === userEmail;
    });
    
    if (!foundUser || !foundUser.roles) return false;
    return foundUser.roles.some(function(r) { 
      var taskVal = r.task_name || r.role || "";
      return String(taskVal).trim().toLowerCase() === taskName.trim().toLowerCase(); 
    });
  } catch (e) {
    console.error("Task assignment check error:", e.message);
    return false;
  }
}
