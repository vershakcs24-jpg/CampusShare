document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get("resetToken");
    if (Auth.isLoggedIn() && !resetToken) {
        window.location.href = "marketplace.html";
        return;
    }
    const loginCard = $("loginCard");
    const signupCard = $("signupCard");
    const forgotCard = $("forgotCard");
    const resetCard = $("resetCard");
    const goToSignup = $("goToSignup");
    const goToLogin = $("goToLogin");
    const goToForgot = $("goToForgot");
    const allCards = [loginCard, signupCard, forgotCard, resetCard];
    function showCard(card) {
        allCards.forEach(c => c.classList.add("hidden"));
        card.classList.remove("hidden");
    }
    if (resetToken) showCard(resetCard);

    const navLinks = [
        [goToSignup, signupCard], [goToLogin, loginCard], [goToForgot, forgotCard],
        [$("backToLoginFromForgot"), loginCard], [$("backToLoginFromReset"), loginCard]
    ];
    navLinks.forEach(([link, card]) => link.addEventListener("click", (e) => {
        e.preventDefault();
        showCard(card);
    }));

    const forgotSubmitBtn = $("forgotSubmitBtn");
    const forgotError = $("forgotError");
    forgotSubmitBtn.addEventListener("click", async () => {
        const email = $("forgotEmail").value.trim().toLowerCase();
        forgotError.textContent = "";
        if (!email) {
            forgotError.textContent = "Please enter your email address.";
            return;
        }
        forgotSubmitBtn.disabled = true;
        forgotSubmitBtn.textContent = "Sending...";
        try {
            const res = await apiFetch("/auth/forgot-password", { method: "POST", body: { email } });
            forgotError.style.color = "#276749";
            forgotError.textContent = res.message || "If an account exists for that email, a reset link has been sent.";
        } catch (err) {
            forgotError.style.color = "";
            forgotError.textContent = err.message;
        } finally {
            forgotSubmitBtn.disabled = false;
            forgotSubmitBtn.textContent = "Send Reset Link";
        }
    });

    const resetSubmitBtn = $("resetSubmitBtn");
    const resetError = $("resetError");
    if (resetSubmitBtn) {
        resetSubmitBtn.addEventListener("click", async () => {
            const newPassword = $("resetNewPassword").value;
            const confirmPassword = $("resetConfirmPassword").value;
            resetError.textContent = "";
            if (!newPassword || !confirmPassword) {
                resetError.textContent = "Please fill in both fields.";
                return;
            }
            if (newPassword.length < 6) {
                resetError.textContent = "Password must be at least 6 characters.";
                return;
            }
            if (newPassword !== confirmPassword) {
                resetError.textContent = "Passwords do not match.";
                return;
            }
            resetSubmitBtn.disabled = true;
            resetSubmitBtn.textContent = "Resetting...";
            try {
                await apiFetch(`/auth/reset-password/${resetToken}`, { method: "PUT", body: { newPassword } });
                resetError.style.color = "#276749";
                resetError.textContent = "Password reset! Redirecting to login...";
                setTimeout(() => { window.location.href = "auth.html"; }, 1500);
            } catch (err) {
                resetError.style.color = "";
                resetError.textContent = err.message;
                resetSubmitBtn.disabled = false;
                resetSubmitBtn.textContent = "Reset Password";
            }
        });
    }

    const loginSubmitBtn = $("loginSubmitBtn");
    const loginError = $("loginError");
    loginSubmitBtn.addEventListener("click", async () => {
        const email = $("loginEmail").value.trim().toLowerCase();
        const password = $("loginPassword").value;
        loginError.textContent = "";
        if (!email || !password) {
            loginError.textContent = "Please fill in both fields.";
            return;
        }
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = "Signing in...";
        try {
            const res = await apiFetch("/auth/login", { method: "POST", body: { email, password } });
            Auth.setSession(res.data);
            window.location.href = "marketplace.html";
        } catch (err) {
            loginError.textContent = err.message;
        } finally {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = "Login";
        }
    });

    const signupSubmitBtn = $("signupSubmitBtn");
    const signupError = $("signupError");
    const detectLocationBtn = $("detectLocationBtn");
    if (detectLocationBtn) {
        detectLocationBtn.addEventListener("click", () => {
            if (!navigator.geolocation) {
                signupError.textContent = "Geolocation isn't supported by this browser.";
                return;
            }
            detectLocationBtn.textContent = "📍 Detecting...";
            navigator.geolocation.getCurrentPosition(
                () => { detectLocationBtn.textContent = "✅ Location Detected"; },
                () => {
                    detectLocationBtn.textContent = "📍 Detect Location";
                    signupError.textContent = "Couldn't detect location. You can still sign up.";
                }
            );
        });
    }

    signupSubmitBtn.addEventListener("click", async () => {
        const name = $("signupName").value.trim();
        const email = $("signupEmail").value.trim().toLowerCase();
        const password = $("signupPassword").value;
        const confirmPassword = $("signupConfirmPassword").value;
        signupError.textContent = "";
        if (!name || !email || !password || !confirmPassword) {
            signupError.textContent = "Please fill in all required fields.";
            return;
        }
        if (!email.endsWith("@nitj.ac.in")) {
            signupError.textContent = "Access Denied. Only official @nitj.ac.in emails are allowed.";
            return;
        }
        if (password !== confirmPassword) {
            signupError.textContent = "Passwords do not match.";
            return;
        }
        if (password.length < 6) {
            signupError.textContent = "Password must be at least 6 characters.";
            return;
        }
        signupSubmitBtn.disabled = true;
        signupSubmitBtn.textContent = "Creating account...";
        try {
            const res = await apiFetch("/auth/signup", { method: "POST", body: { name, email, password } });
            Auth.setSession(res.data);
            window.location.href = "marketplace.html";
        } catch (err) {
            signupError.textContent = err.message;
        } finally {
            signupSubmitBtn.disabled = false;
            signupSubmitBtn.textContent = "Sign Up";
        }
    });
});
