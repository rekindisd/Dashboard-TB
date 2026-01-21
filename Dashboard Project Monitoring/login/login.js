// ===================================
// ALLOWED EMAILS LIST
// ===================================
const ALLOWED_EMAILS = [
  "edi.sukro@gmail.com",
  "ishlahuddin@gmail.com",
  "zahrul.bjalil@gmail.com",
  "destyanainggit@gmail.com",
  "salyonoys@gmail.com",
  "kikun.h@gmail.com",
  "digitalisasitb@gmail.com",
  "rizaldy.alifiansyah27@gmail.com",
  "stwnakbr710@gmail.com"
];

// ===================================
// CHECK IF ALREADY LOGGED IN
// ===================================
(function checkExistingLogin() {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const userEmail = localStorage.getItem('userEmail');

  if (isLoggedIn && userEmail) {
    // Already logged in, redirect to dashboard
    // Use absolute path for Netlify compatibility
    window.location.href = '/dashboard/index.html';
  }
})();

// ===================================
// HANDLE GOOGLE LOGIN RESPONSE
// ===================================
function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  const email = payload.email.toLowerCase();
  const name = payload.name || payload.given_name || email.split('@')[0]; // Get name from Google

  if (ALLOWED_EMAILS.includes(email)) {
    // Email is allowed, save login state
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userName", name); // Save user's name

    // Redirect to dashboard
    // Use absolute path for Netlify compatibility
    window.location.href = '/dashboard/index.html';
  } else {
    // Email not allowed
    document.getElementById("error-msg").innerText = "Akses ditolak. Email tidak terdaftar.";
  }
}

// ===================================
// PARSE JWT TOKEN
// ===================================
function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}