/* === Huddle — Initialization === */

/* ---------- Auto-Join via URL Hash ---------- */
function checkAutoJoin() {
  const hash = window.location.hash;
  const match = hash.match(/#huddle_room=([A-Z0-9-]+)/i);
  if (match) {
    const roomCode = match[1].toUpperCase();

    // Parse name if present
    const nameMatch = hash.match(/name=([^&]+)/i);
    let autoJoinName = null;
    if (nameMatch) {
      autoJoinName = decodeURIComponent(nameMatch[1]);
      saveDisplayName(autoJoinName);
    }

    // Clean the hash so it doesn't persist
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );

    // Wait for socket connection then join
    const tryJoin = () => {
      if (mySocketId) {
        const savedName = autoJoinName || displayName || "Viewer";
        displayName = savedName;
        socket.emit("joinRoom", { roomCode, name: displayName });
      } else {
        setTimeout(tryJoin, 200);
      }
    };
    tryJoin();
  }
}

/* ---------- Extension Detection Marker ---------- */
function injectExtensionMarker() {
  const marker = document.createElement("div");
  marker.id = "huddle-ext-installed";
  marker.style.display = "none";
  marker.setAttribute("data-version", "2.0.0");
  document.documentElement.appendChild(marker);

  // Also respond to postMessage queries from Landing Page
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "HUDDLE_EXT_CHECK") {
      window.postMessage({ type: "HUDDLE_EXT_PRESENT", version: "2.0.0" }, "*");
    }
  });
}

/* ---------- Initialize ---------- */
function init() {
  injectExtensionMarker();
  restoreTwitchToken();

  loadDisplayName(() => {
    buildSidebar();
    checkAutoJoin();
  });
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
