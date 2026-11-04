// ==========================================
// DRIV-EN LOGIN SCRIPT
// ==========================================

/**
 * Toggle password field visibility between hidden and plain text
 */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    const toggleLabel = document.getElementById("password-toggle-icon");
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
        const res = await fetch(file);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const html = await res.text();
        el.innerHTML = html;
    } catch (e) {
        console.error("Component failed to load:", id, file, e);
    }
}

// Initialize components and page handlers on DOM Content Loaded
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Load Header and Footer components concurrently
    await Promise.all([
        loadComponent("header", "/components/header.html"),
        loadComponent("footer", "/components/footer.html")
    ]);

    const yearEl = document.getElementById("footer-year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // 2. Forgot Password handler
    const forgotLink = document.getElementById("forgot-link");
    if (forgotLink) {
        forgotLink.addEventListener("click", async () => {
            const emailEl = document.getElementById("email");
            const email = emailEl ? emailEl.value.trim() : "";
            if (!email) {
                alert("Please enter your email address first, then click Forgot Password.");
                if (emailEl) emailEl.focus();
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
                    alert("If an account exists for " + email + ", a password reset link has been sent.");
                } else {
                    alert("Could not process request: " + (data.error || "Unknown error"));
                }
            } catch (e) {
                console.error("Forgot password error:", e);
                alert("Could not process request. Please check your connection and try again.");
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
            const submitBtn = document.getElementById("submit-btn");

            // Reset field states
            if (email) email.classList.remove("error");
            if (password) password.classList.remove("error");
            if (errorBanner) errorBanner.style.display = "none";
            if (referrerBanner) referrerBanner.style.display = "none";

            // UI Loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Authenticating...";
            }

            try {
                const response = await fetch("/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        email: email.value.trim(),
                        password: password.value, // Untrimmed password preserved
                        remember: remember ? remember.checked : false
                    })
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    if (result.error === "referrer_account") {
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

                // Context saved for client-side visual rendering
                if (result.user && result.user.org_id) {
                    localStorage.setItem("driven_customer_id", result.user.org_id);
                    localStorage.setItem("driven_org_id", result.user.org_id);
                }

                if (result.must_change_password) {
                    window.location.replace("/public/change-password.html");
                    return;
                }

                // Determine redirect path (Server-provided redirect given priority)
                let targetPath = result.redirect;

                if (!targetPath) {
                    const isFounder = result.user && result.user.org_id === "org_dsi" && result.user.role_id === "RO-Founder";
                    if (isFounder) {
                        targetPath = "/app/dashboard/owner-dashboard.html";
                    } else if (result.user && result.user.role_id === "RO-admin") {
                        targetPath = "/app/dashboard/admin.html";
                    } else {
                        targetPath = "/app/dashboard/employee-dashboard.html";
                    }
                }

                window.location.replace(targetPath);

            } catch (err) {
                console.error("Login submission error:", err);
                if (errorBanner) {
                    errorBanner.textContent = "A network error occurred. Please check your internet connection.";
                    errorBanner.style.display = "block";
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Login";
                }
            }
        });
    }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[DRIV-EN] Service worker registered:', reg.scope))
            .catch(err => console.warn('[DRIV-EN] Service worker registration failed:', err));
    });
}
