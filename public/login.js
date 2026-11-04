// ==========================================
// DRIV-EN LOGIN SCRIPT
// ==========================================

function togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    const toggleLabel = document.getElementById("password-toggle-icon");
    if (!passwordInput || !toggleLabel) return;

    const isVisible = passwordInput.type === "password";
    passwordInput.type = isVisible ? "text" : "password";
    toggleLabel.textContent = isVisible ? "HIDE" : "SHOW";

    const toggleButton = toggleLabel.closest("button");
    if (toggleButton) {
        toggleButton.setAttribute("aria-pressed", String(isVisible));
        toggleButton.setAttribute(
            "aria-label",
            isVisible ? "Hide password" : "Show password"
        );
    }
}

async function loadComponent(id, file) {
    const el = document.getElementById(id);
    if (!el) return;

    try {
        const response = await fetch(file);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        el.innerHTML = await response.text();
    } catch (error) {
        console.error("Component failed to load:", id, file, error);
    }
}

async function readJsonResponse(response) {
    try {
        const data = await response.json();
        return data && typeof data === "object" ? data : null;
    } catch {
        return null;
    }
}

function getSafeRedirectPath(target) {
    if (typeof target !== "string" || !target.trim()) return null;

    try {
        const url = new URL(target, window.location.origin);
        if (url.origin !== window.location.origin) return null;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return null;
    }
}

function getDefaultRedirect(user) {
    if (user?.org_id === "org_dsi" && user?.role_id === "RO-Founder") {
        return "/app/dashboard/owner-dashboard.html";
    }

    if (user?.role_id === "RO-admin") {
        return "/app/dashboard/admin.html";
    }

    return "/app/dashboard/employee-dashboard.html";
}

document.addEventListener("DOMContentLoaded", () => {
    Promise.all([
        loadComponent("header", "/components/header.html"),
        loadComponent("footer", "/components/footer.html")
    ]).then(() => {
        const yearEl = document.getElementById("footer-year");
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    });

    const errorBanner = document.getElementById("error-banner");
    const referrerBanner = document.getElementById("referrer-redirect-banner");
    const loginForm = document.getElementById("login-form");
    const twoFactorStep = document.getElementById("twofa-step");
    const twoFactorCode = document.getElementById("login-2fa-code");
    const verifyTwoFactorButton = document.getElementById("verify-2fa-btn");
    const backToLoginButton = document.getElementById("back-to-login");

    let loginChallengeToken = null;

    function showError(message) {
        if (!errorBanner) return;
        errorBanner.textContent = message;
        errorBanner.style.display = "block";
    }

    function hideError() {
        if (errorBanner) errorBanner.style.display = "none";
    }

    function completeLogin(result) {
        // These values are for client-side display only, not authorization.
        if (result.user?.org_id) {
            try {
                localStorage.setItem("driven_customer_id", result.user.org_id);
                localStorage.setItem("driven_org_id", result.user.org_id);
            } catch (error) {
                console.warn(
                    "Could not save client-side organization context:",
                    error
                );
            }
        }

        if (result.must_change_password || result.user?.must_change_password) {
            window.location.replace("/public/change-password.html");
            return;
        }

        const targetPath =
            getSafeRedirectPath(result.redirect) ||
            getDefaultRedirect(result.user);

        window.location.replace(targetPath);
    }

    function returnToPasswordLogin() {
        loginChallengeToken = null;

        if (twoFactorCode) twoFactorCode.value = "";
        if (twoFactorStep) twoFactorStep.hidden = true;
        if (loginForm) loginForm.hidden = false;
    }

    const forgotLink = document.getElementById("forgot-link");
    if (forgotLink) {
        forgotLink.addEventListener("click", async (event) => {
            event.preventDefault();

            const emailEl = document.getElementById("email");
            const email = emailEl?.value.trim() || "";

            if (!email) {
                alert(
                    "Please enter your email address first, then click Forgot Password."
                );
                emailEl?.focus();
                return;
            }

            try {
                const response = await fetch("/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });

                if (response.ok) {
                    alert(
                        `If an account exists for ${email}, a password reset link has been sent.`
                    );
                } else {
                    alert("Could not process the request. Please try again later.");
                }
            } catch (error) {
                console.error("Forgot password error:", error);
                alert(
                    "Could not process the request. Please check your connection and try again."
                );
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const email = document.getElementById("email");
            const password = document.getElementById("password");
            const remember = document.getElementById("remember");
            const submitButton = document.getElementById("submit-btn");

            if (!email || !password) {
                console.error("Login form is missing its email or password field.");
                showError(
                    "The login form is unavailable. Please reload the page."
                );
                return;
            }

            email.classList.remove("error");
            password.classList.remove("error");
            hideError();

            if (referrerBanner) {
                referrerBanner.style.display = "none";
            }

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Authenticating...";
            }

            try {
                const response = await fetch("/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        email: email.value.trim(),
                        password: password.value,
                        remember: Boolean(remember?.checked)
                    })
                });

                const result = await readJsonResponse(response);

                if (!response.ok || !result?.success) {
                    if (result?.error === "referrer_account") {
                        if (referrerBanner) {
                            referrerBanner.style.display = "block";
                        }
                        email.classList.add("error");
                        return;
                    }

                    showError(
                        result?.error ||
                        "Invalid credentials. Please try again."
                    );
                    email.classList.add("error");
                    password.classList.add("error");
                    return;
                }

                if (result.requires_2fa) {
                    if (
                        typeof result.challenge_token !== "string" ||
                        !result.challenge_token
                    ) {
                        showError(
                            "Two-factor sign-in could not be started. Please try again."
                        );
                        return;
                    }

                    if (!twoFactorStep || !twoFactorCode || !verifyTwoFactorButton) {
                        console.error(
                            "Two-factor login response received, but the verification form is missing."
                        );
                        showError(
                            "Two-factor sign-in is unavailable on this page. Please reload and try again."
                        );
                        return;
                    }

                    loginChallengeToken = result.challenge_token;
                    password.value = "";
                    loginForm.hidden = true;
                    twoFactorStep.hidden = false;

                    // Backup codes contain hexadecimal letters as well as digits.
                    twoFactorCode.inputMode = "text";
                    twoFactorCode.autocapitalize = "none";
                    twoFactorCode.spellcheck = false;
                    twoFactorCode.focus();
                    return;
                }

                completeLogin(result);
            } catch (error) {
                console.error("Login submission error:", error);
                showError(
                    "A network error occurred. Please check your internet connection and try again."
                );
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "Login";
                }
            }
        });
    }

    async function submitTwoFactorCode() {
        if (!loginChallengeToken) {
            returnToPasswordLogin();
            showError("Your verification session expired. Please log in again.");
            document.getElementById("email")?.focus();
            return;
        }

        const code = twoFactorCode?.value.trim();
        if (!code) {
            showError("Enter your authenticator or backup code.");
            twoFactorCode?.focus();
            return;
        }

        hideError();

        verifyTwoFactorButton.disabled = true;
        verifyTwoFactorButton.textContent = "Verifying...";

        try {
            const response = await fetch("/auth/login-2fa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    challenge_token: loginChallengeToken,
                    // TOTP codes are numeric; lowercasing also supports hex backup codes.
                    code: code.toLowerCase()
                })
            });

            const result = await readJsonResponse(response);

            if (!response.ok || !result?.success) {
                const message =
                    result?.error ||
                    "Invalid verification code. Please try again.";

                if (/challenge/i.test(message)) {
                    returnToPasswordLogin();
                } else {
                    twoFactorCode?.select();
                }

                showError(message);
                return;
            }

            loginChallengeToken = null;
            completeLogin(result);
        } catch (error) {
            console.error("Two-factor verification error:", error);
            showError(
                "A network error occurred. Please check your connection and try again."
            );
        } finally {
            verifyTwoFactorButton.disabled = false;
            verifyTwoFactorButton.textContent = "Verify and sign in";
        }
    }

    if (verifyTwoFactorButton) {
        verifyTwoFactorButton.addEventListener("click", submitTwoFactorCode);
    }

    if (twoFactorCode) {
        twoFactorCode.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                submitTwoFactorCode();
            }
        });
    }

    if (backToLoginButton) {
        backToLoginButton.addEventListener("click", () => {
            returnToPasswordLogin();
            hideError();
            document.getElementById("email")?.focus();
        });
    }
});

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
            .then((registration) => {
                console.log(
                    "[DRIV-EN] Service worker registered:",
                    registration.scope
                );
            })
            .catch((error) => {
                console.warn(
                    "[DRIV-EN] Service worker registration failed:",
                    error
                );
            });
    });
}
