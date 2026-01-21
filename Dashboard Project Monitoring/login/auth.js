// ===================================
// AUTHENTICATION CHECK - IMMEDIATE
// This runs BEFORE the page loads to prevent any flash
// ===================================

// Immediate check - runs synchronously before page render
(function immediateAuthCheck() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const userEmail = localStorage.getItem("userEmail");

  if (!isLoggedIn || !userEmail) {
    // Not logged in - redirect immediately
    // Use absolute path for Netlify compatibility
    window.location.replace("/login/login.html");
    // Stop script execution
    throw new Error("Not authenticated - redirecting to login");
  } else {
    // User is authenticated - show the page
    document.addEventListener("DOMContentLoaded", function () {
      document.body.classList.add("authenticated");
    });
  }
})();

// ===================================
// DISPLAY USER INFO AFTER PAGE LOADS
// ===================================

document.addEventListener("DOMContentLoaded", function () {
  const userName = localStorage.getItem("userName");
  const userEmail = localStorage.getItem("userEmail");

  if (userName) {
    displayUserInfo(userName);
  } else if (userEmail) {
    // Fallback jika nama tidak ada, gunakan email
    displayUserInfo(userEmail);
  }
});

// Display user information in header with welcome message
function displayUserInfo(name) {
  const userEmailElement = document.getElementById("userEmail");
  if (userEmailElement) {
    userEmailElement.innerHTML = `Selamat datang <strong>${escapeHtml(name)}</strong> di dashboard monitoring project`;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===================================
// HANDLE LOGOUT
// ===================================

function handleLogout() {
  // Show confirmation dialog
  if (confirm("Apakah Anda yakin ingin logout?")) {
    // Clear localStorage
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");

    // Redirect to login page using replace to prevent back button
    // Use absolute path for Netlify compatibility
    window.location.replace("/login/login.html");
  }
}
