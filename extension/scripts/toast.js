/* === Huddle — Toast === */

/* ---------- Toast Notifications ---------- */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `huddle-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, HUDDLE_CONFIG.toastDuration);
}
