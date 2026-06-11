document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const loginBtn = document.getElementById("loginBtn");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const status = document.getElementById("loginStatus");

  function clearAdminAuth(){
    [localStorage, sessionStorage].forEach((store) => {
      try {
        ["cvAdminSession", "cvAdminApiToken", "adminToken", "token", "authToken", "adminSession"].forEach(k => store.removeItem(k));
      } catch (_) {}
    });
  }
  function saveAdminAuth(data){
    const user = data && data.user;
    const token = data && data.token;
    if(token){
      [localStorage, sessionStorage].forEach((store) => {
        try {
          store.setItem("cvAdminApiToken", token);
          store.setItem("adminToken", token);
          store.setItem("token", token);
          store.setItem("authToken", token);
        } catch (_) {}
      });
    }
    if(user){
      const userJson = JSON.stringify(user);
      [localStorage, sessionStorage].forEach((store) => {
        try {
          store.setItem("cvAdminSession", userJson);
          store.setItem("adminSession", userJson);
        } catch (_) {}
      });
    }
  }

  clearAdminAuth();

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
        clearAdminAuth();
        status.textContent = data.error || "Invalid login.";
        status.className = "admin-save-status error";
        return;
      }

      saveAdminAuth(data);
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
