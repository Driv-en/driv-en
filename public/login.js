// ==========================================
// DRIV-EN LOGIN SCRIPT
// ==========================================

/**
 * Toggle password field visibility between hidden and plain text
 */
function togglePasswordVisibility() {
    var passwordInput = document.getElementById("password");
    var toggleLabel = document.getElementById("password-toggle-icon");
    if (!passwordInput || !toggleLabel) return;

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleLabel.textContent = "HIDE";
    } else {
        passwordInput.type = "password";
        toggleLabel.textContent = "SHOW";
    }
}

/**
 * Load HTML components dynamically (Header & Footer)
 */
async function loadComponent(id, file) {
    try {
        const el = document.getElementById(id);
        if (!el) return;
        const html = await fetch(file).then(r => r.text());
        el.innerHTML = html;
    } catch (e) {
        console.error("Component failed:", id, file, e);
    }
}

// Initialize components and page handlers on DOM Content Loaded
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Load Header and Footer components
    await loadComponent("header", "/components/header.html");
    await loadComponent("footer", "/components/footer.html");

    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // 2. Forgot Password handler
    const forgotLink = document.getElementById("forgot-link");
    if (forgotLink) {
        forgotLink.addEventListener("click", async () => {
            const emailEl = document.getElementById("email");
            const email = emailEl ? emailEl.value.trim() : "";
            if (!email) {
                alert("Please enter your email address first, then click Forgot Password.");
                return;
            }
            try {
                const resp = await fetch("/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email })
                });
                const data = await resp.json();
                if (data.success) {
                    alert("If an account exists for " + email + ", a password reset link has been sent to that email.");
                } else {
                    alert("Could not process request: " + (data.error || "Unknown error"));
                }
            } catch (e) {
                alert("Could not process request. Please try again.");
            }
        });
    }

    // 3. Login Form Submit handler
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("email");
            const password = document.getElementById("password");
            const remember = document.getElementById("remember");
            const errorBanner = document.getElementById("error-banner");
            const referrerBanner = document.getElementById("referrer-redirect-banner");

            if (email) email.classList.remove("error");
            if (password) password.classList.remove("error");
            if (errorBanner) errorBanner.style.display = "none";

            try {
                const response = await fetch("/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        email: email.value.trim(),
                        password: password.value, // Untrimmed password
                        remember: remember.checked
                    })
                });

                const result = await response.json();

                if (!result.success) {
                    if (result.error === "referrer_account") {
                        if (errorBanner) errorBanner.style.display = "none";
                        if (referrerBanner) referrerBanner.style.display = "block";
                        if (email) email.classList.add("error");
                        return;
                    }
                    if (errorBanner) {
                        errorBanner.textContent = result.error || "Invalid credentials.";
                        errorBanner.style.display = "block";
                    }
                    if (email) email.classList.add("error");
                    if (password) password.classList.add("error");
                    return;
                }

                // Authentication token is stored in Secure, HttpOnly, SameSite cookies via backend response.
                // Non-sensitive context can be saved for initial rendering.
                if (result.user && result.user.org_id) {
                    localStorage.setItem("driven_customer_id", result.user.org_id);
                    localStorage.setItem("driven_org_id", result.user.org_id);
                }

                if (result.must_change_password) {
                    window.location.replace("/public/change-password.html");
                    return;
                }

                // Determine target path strictly verifying org_id === "org_dsi" and role_id === "RO-Founder"
                let targetPath = "";
                const isFounder = result.user && result.user.org_id === "org_dsi" && result.user.role_id === "RO-Founder";

                if (isFounder) {
                    targetPath = "/app/dashboard/owner-dashboard.html";
                } else if (result.redirect) {
                    targetPath = result.redirect;
                } else if (result.user && result.user.role_id === "RO-admin") {
                    targetPath = "/app/dashboard/admin.html";
                } else {
                    targetPath = "/app/dashboard/employee-dashboard.html";
                }

                setTimeout(() => {
                    window.location.replace(targetPath);
                }, 50);

            } catch (err) {
                console.error("Login submission error:", err);
                if (errorBanner) {
                    errorBanner.textContent = "A network error occurred. Please try again.";
                    errorBanner.style.display = "block";
                }
            }
        });
    }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
            console.log('[DRIV-EN] Service worker registered:', reg.scope);
        }).catch(function(err) {
            console.warn('[DRIV-EN] SW registration failed:', err);
        });
    });
}
