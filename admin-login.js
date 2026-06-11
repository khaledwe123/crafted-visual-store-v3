document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const loginBtn = document.getElementById("loginBtn");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const status = document.getElementById("loginStatus");

  // Remove old prototype data that used to downgrade admin@craftedvisual.com to role=admin.
  try {
    localStorage.removeItem("cvAdminUsers");
    sessionStorage.removeItem("cvAdminSession");
  } catch (_) {}

  async function doLogin(event) {
    if (event) event.preventDefault();
    if (!emailInput || !passwordInput || !status) return;

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    status.textContent = "Signing in...";
    status.className = "admin-save-status";

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        status.textContent = data.error || "Invalid login.";
        status.className = "admin-save-status error";
        return;
      }

      if (data.token) {
        localStorage.setItem("cvAdminApiToken", data.token);
        sessionStorage.setItem("cvAdminApiToken", data.token);
        localStorage.setItem("adminToken", data.token);
        sessionStorage.setItem("adminToken", data.token);
      }
      sessionStorage.setItem("cvAdminSession", JSON.stringify(data.user));
      localStorage.setItem("cvAdminSession", JSON.stringify(data.user));

      window.location.href = "/admin.html";
    } catch (err) {
      console.error("Admin login failed", err);
      status.textContent = "Login failed. Please try again.";
      status.className = "admin-save-status error";
    }
  }

  if (form) form.addEventListener("submit", doLogin);
  if (loginBtn) loginBtn.addEventListener("click", doLogin);
});
