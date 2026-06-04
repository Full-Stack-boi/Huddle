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

  // Clear legacy global room keys to prevent conflicts with tab-isolated storage
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(["huddle_room_code", "huddle_is_host"]);
    }
  } catch (err) {
    console.warn("[Huddle] Failed to clear legacy storage keys on init:", err);
  }

  loadDisplayName(() => {
    restoreRoomSession(() => {
      buildSidebar();
      checkAutoJoin();

      // Listen for client-side SPA routing hash changes
      window.addEventListener("hashchange", checkAutoJoin);

      // Reconnect/Reclaim room automatically if session is restored
      if (currentRoomCode) {
        const tryReclaimOrJoin = () => {
          if (mySocketId) {
            const savedName = displayName || "Viewer";
            displayName = savedName;
            if (isHost) {
              console.log("[Huddle] Restored Host session. Reclaiming room:", currentRoomCode);
              socket.emit("reclaimRoom", { roomCode: currentRoomCode, hostName: displayName });
            } else {
              console.log("[Huddle] Restored Guest session. Joining room:", currentRoomCode);
              socket.emit("joinRoom", { roomCode: currentRoomCode, name: displayName });
            }
          } else {
            setTimeout(tryReclaimOrJoin, 200);
          }
        };
        tryReclaimOrJoin();
      }
    });
  });
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
