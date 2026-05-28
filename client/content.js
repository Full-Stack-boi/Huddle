/* ============================================
   HUDDLE — Content Script (Chrome Extension)
   Real-time video sync with Twitch integration
   ============================================ */

/* ---------- Configuration ---------- */
const HUDDLE_CONFIG = {
  syncServerUrl: "https://huddle-productions.up.railway.app", // Railway Production URL
  twitchClientId: "", // TODO: Set your Twitch Client ID
  twitchRedirectUri: "", // TODO: Set your Vercel OAuth redirect URL
  heartbeatInterval: 1000, // 1 second (faster sync)
  seekThreshold: 0.5, // 0.5 seconds difference before force-sync (tighter sync)
  reconnectGracePeriod: 30000, // 30 seconds
  toastDuration: 4000, // 4 seconds
};

/* ---------- State ---------- */
let videoPlayer = null;
let adTimer = null;
let mySocketId = null;
let currentRoomCode = null;
let currentHostVideoUrl = null;
let currentHostName = "";
let isHost = false;
let displayName = "";
let viewersInRoom = [];
let viewersExpanded = true;
let isConnectedToTwitch = false;
let twitchAccessToken = null;
let twitchUserInfo = null;
let twitchLiveStatus = null;
let currentPage = "main"; // 'main' | 'twitch' | 'room'
let heartbeatTimer = null;
let lastSyncedState = { time: 0, paused: true };

/* ---------- Socket Connection ---------- */
const socket = io(HUDDLE_CONFIG.syncServerUrl, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

/* ---------- Socket: Connection Events ---------- */
socket.on("whoami", ({ id }) => {
  mySocketId = id;
});

socket.on("connect", () => {
  console.log("[Huddle] Connected to sync server");
  // If we were in a room before disconnect, try to reclaim/rejoin
  if (currentRoomCode && isHost) {
    socket.emit("reclaimRoom", {
      roomCode: currentRoomCode,
      hostName: displayName,
    });
    showToast("Reconnecting to room...", "info");
  } else if (currentRoomCode && !isHost) {
    socket.emit("joinRoom", { roomCode: currentRoomCode, name: displayName });
    showToast("Reconnecting to room...", "info");
  }
});

socket.on("disconnect", () => {
  console.log("[Huddle] Disconnected from sync server");
  showToast("Connection lost. Reconnecting...", "warning");
});

socket.on("reconnect_failed", () => {
  showToast("Could not reconnect. Please refresh the page.", "error");
});

/* ---------- Socket: Room Events ---------- */
socket.on("roomCreated", ({ roomCode }) => {
  currentRoomCode = roomCode;
  isHost = true;
  currentHostName = displayName; // Host is the current host
  showPage("room");
  renderRoomView();
  startVideoSync();
  openSidebar(); // Auto-open sidebar so user knows room is ready
  showToast(`Room created! Code: ${roomCode}`, "success");
});

socket.on(
  "joinSuccess",
  ({ roomCode, hostName, videoUrl, videoTitle, viewers }) => {
    currentRoomCode = roomCode;
    currentHostVideoUrl = videoUrl;
    currentHostName = hostName; // Store the Host's display name
    viewersInRoom = viewers || [];
    showPage("room");
    renderRoomView();
    startVideoSync();
    openSidebar(); // Auto-open sidebar so user knows they joined successfully
    showToast(`Joined ${hostName}'s room!`, "success");
  },
);

socket.on("joinError", ({ message }) => {
  showToast(message, "error");
});

socket.on("viewerJoined", ({ name, viewerCount }) => {
  if (!viewersInRoom.includes(name)) {
    viewersInRoom.push(name);
  }
  renderViewersList();
  showToast(`${name} joined! 🎉`, "info");
});

socket.on("viewerLeft", ({ name, viewerCount }) => {
  viewersInRoom = viewersInRoom.filter((v) => v !== name);
  renderViewersList();
});

socket.on("roomDissolved", () => {
  currentRoomCode = null;
  isHost = false;
  currentHostName = "";
  viewersInRoom = [];
  stopVideoSync();
  showPage("main");
  renderMainView();
  openSidebar(); // Force sidebar open to notify the viewer that the room was closed
  showToast("Room has been closed by the host.", "warning");
});

socket.on("hostReconnected", () => {
  showToast("Host reconnected! ✨", "success");
});

/* ---------- Socket: Video Sync ---------- */
socket.on("videoSync", ({ hostTime, isHostPaused, type }) => {
  if (isHost || !videoPlayer) return;

  // Sync play/pause state
  if (isHostPaused && !videoPlayer.paused) {
    videoPlayer.pause();
  } else if (!isHostPaused && videoPlayer.paused) {
    videoPlayer.play().catch(() => {});
  }

  // Sync seek position
  const timeDiff = videoPlayer.currentTime - hostTime;
  if (Math.abs(timeDiff) > HUDDLE_CONFIG.seekThreshold) {
    videoPlayer.currentTime = hostTime;
  }
});

/* ---------- Video Player Detection ---------- */
function detectVideoPlayer() {
  // Check for ads first (YouTube specific)
  const adElement = document.querySelector(".ad-cta-wrapper");
  if (adElement) {
    adTimer = setTimeout(detectVideoPlayer, 500);
    return;
  }

  const video = document.querySelector("video");
  if (video) {
    videoPlayer = video;
    videoPlayer.removeAttribute("autoplay");
    attachVideoListeners();
    console.log("[Huddle] Video player detected");
  } else {
    adTimer = setTimeout(detectVideoPlayer, 500);
  }
}

function attachVideoListeners() {
  if (!videoPlayer || !isHost) return;

  videoPlayer.addEventListener("play", () => {
    emitVideoSync("play");
  });

  videoPlayer.addEventListener("pause", () => {
    emitVideoSync("pause");
  });

  videoPlayer.addEventListener("seeked", () => {
    emitVideoSync("seek");
  });
}

function emitVideoSync(type) {
  if (!isHost || !videoPlayer || !currentRoomCode) return;

  const state = {
    hostTime: videoPlayer.currentTime,
    isHostPaused: videoPlayer.paused,
    type: type,
  };

  socket.emit("videoSync", state);
  lastSyncedState = { time: state.hostTime, paused: state.isHostPaused };
}

function startVideoSync() {
  detectVideoPlayer();

  // Heartbeat for drift correction (host only)
  if (isHost) {
    heartbeatTimer = setInterval(() => {
      emitVideoSync("heartbeat");
    }, HUDDLE_CONFIG.heartbeatInterval);
  }
}

function stopVideoSync() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (adTimer) {
    clearTimeout(adTimer);
    adTimer = null;
  }
}

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
        const savedName =
          autoJoinName || displayName || "Viewer";
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

/* ---------- Get Video Metadata ---------- */
function getVideoMetadata() {
  const url = window.location.href;
  let source = "unknown";
  let title = document.title || "Untitled Video";
  let thumbnail = "";

  if (url.includes("youtube.com")) {
    source = "YouTube";
    // Try to get YouTube thumbnail
    const videoId = new URL(url).searchParams.get("v");
    if (videoId) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } else if (url.includes("netflix.com")) {
    source = "Netflix";
  } else if (url.includes("hotstar.com")) {
    source = "Disney+ Hotstar";
  } else if (url.includes("primevideo.com")) {
    source = "Prime Video";
  } else if (url.includes("clips.twitch.tv")) {
    source = "Twitch Clip";
  }

  return {
    videoUrl: url.split("#")[0], // Remove hash
    videoTitle: title,
    videoThumbnail: thumbnail,
    source: source,
    videoDuration: videoPlayer ? videoPlayer.duration : 0,
  };
}

/* ---------- Twitch OAuth ---------- */
function startTwitchOAuth() {
  const scopes = "user:read:email chat:write moderator:read:chatters";
  const authUrl =
    `https://id.twitch.tv/oauth2/authorize` +
    `?client_id=${HUDDLE_CONFIG.twitchClientId}` +
    `&redirect_uri=${encodeURIComponent(HUDDLE_CONFIG.twitchRedirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scopes)}`;

  // Open OAuth popup
  const popup = window.open(
    authUrl,
    "Huddle Twitch Login",
    "width=500,height=700",
  );

  // Listen for token from popup
  window.addEventListener("message", function handler(event) {
    if (event.data && event.data.type === "HUDDLE_TWITCH_TOKEN") {
      twitchAccessToken = event.data.accessToken;
      chrome.storage.local.set({ huddle_twitch_token: twitchAccessToken });
      fetchTwitchUserInfo();
      window.removeEventListener("message", handler);
      if (popup && !popup.closed) popup.close();
    }
  });
}

async function fetchTwitchUserInfo() {
  if (!twitchAccessToken) return;

  try {
    const res = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${twitchAccessToken}`,
        "Client-Id": HUDDLE_CONFIG.twitchClientId,
      },
    });

    if (!res.ok) {
      twitchAccessToken = null;
      chrome.storage.local.remove("huddle_twitch_token");
      showToast("Twitch token expired. Please reconnect.", "error");
      renderTwitchView();
      return;
    }

    const data = await res.json();
    if (data.data && data.data.length > 0) {
      twitchUserInfo = data.data[0];
      isConnectedToTwitch = true;
      showToast(`Connected as ${twitchUserInfo.display_name}!`, "success");
      checkTwitchLiveStatus();
      renderTwitchView();
    }
  } catch (err) {
    console.error("[Huddle] Twitch user info error:", err);
    showToast("Failed to fetch Twitch info.", "error");
  }
}

async function checkTwitchLiveStatus() {
  if (!twitchAccessToken || !twitchUserInfo) return;

  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${twitchUserInfo.id}`,
      {
        headers: {
          Authorization: `Bearer ${twitchAccessToken}`,
          "Client-Id": HUDDLE_CONFIG.twitchClientId,
        },
      },
    );

    const data = await res.json();
    twitchLiveStatus = data.data && data.data.length > 0 ? data.data[0] : null;
    renderTwitchView();
  } catch (err) {
    console.error("[Huddle] Live status check error:", err);
  }
}

async function shareToTwitchChat() {
  if (!twitchAccessToken || !twitchUserInfo || !currentRoomCode) return;
  if (!twitchLiveStatus) {
    showToast("You must be live on Twitch to share!", "error");
    return;
  }

  const messageInput = document.getElementById("huddle-twitch-message");
  const customMessage = messageInput
    ? messageInput.value
    : "Come watch with me!";
  const meta = getVideoMetadata();

  // Compose message: custom text + video URL + room URL
  const roomUrl = `${HUDDLE_CONFIG.twitchRedirectUri.replace("/api/twitch/oauth", "")}/room/${currentRoomCode}`;
  const fullMessage = `${customMessage} 🎬 ${meta.videoUrl} 🔗 ${roomUrl}`;

  try {
    const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${twitchAccessToken}`,
        "Client-Id": HUDDLE_CONFIG.twitchClientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        broadcaster_id: twitchUserInfo.id,
        sender_id: twitchUserInfo.id,
        message: fullMessage,
      }),
    });

    if (res.ok) {
      showToast("Shared to Twitch Chat! ✨", "success");
    } else {
      const err = await res.json();
      showToast(`Failed: ${err.message || "Unknown error"}`, "error");
    }
  } catch (err) {
    console.error("[Huddle] Share to chat error:", err);
    showToast("Failed to send chat message.", "error");
  }
}

/* ---------- Restore Twitch Token on Load ---------- */
function restoreTwitchToken() {
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.local.get("huddle_twitch_token", (result) => {
      if (result.huddle_twitch_token) {
        twitchAccessToken = result.huddle_twitch_token;
        fetchTwitchUserInfo();
      }
    });
  }
}

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

/* ---------- UI Sidebar Visibility Helpers ---------- */
function openSidebar() {
  const s = document.getElementById("huddle-sidebar");
  const b = document.getElementById("huddle-open-btn");
  if (s && b) {
    s.classList.add("huddle-visible");
    b.classList.add("sidebar-open");
  }
}

function closeSidebar() {
  const s = document.getElementById("huddle-sidebar");
  const b = document.getElementById("huddle-open-btn");
  if (s && b) {
    s.classList.remove("huddle-visible");
    b.classList.remove("sidebar-open");
  }
}

/* ---------- UI: Build Sidebar ---------- */
function buildSidebar() {
  if (document.getElementById("huddle-sidebar")) return;

  // Sidebar container (built first so openBtn closure can reference it)
  const sidebar = document.createElement("div");
  sidebar.className = "huddle-sidebar"; // Starts closed by default via CSS (translateX 100%)
  sidebar.id = "huddle-sidebar";

  // Header
  const header = document.createElement("div");
  header.className = "huddle-header";
  header.innerHTML = `
    <div class="huddle-logo">
      <span class="huddle-logo-icon">🎬</span>
      <span class="huddle-logo-text">Huddle</span>
    </div>
  `;

  const closeBtn = document.createElement("div");
  closeBtn.className = "huddle-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", closeSidebar);
  header.appendChild(closeBtn);
  sidebar.appendChild(header);

  // Pages Container
  const mainPage = document.createElement("div");
  mainPage.className = "huddle-page active";
  mainPage.id = "huddle-page-main";
  sidebar.appendChild(mainPage);

  const twitchPage = document.createElement("div");
  twitchPage.className = "huddle-page";
  twitchPage.id = "huddle-page-twitch";
  sidebar.appendChild(twitchPage);

  const roomPage = document.createElement("div");
  roomPage.className = "huddle-page";
  roomPage.id = "huddle-page-room";
  sidebar.appendChild(roomPage);

  // Open/toggle button
  const openBtn = document.createElement("div");
  openBtn.className = "huddle-open-btn";
  openBtn.id = "huddle-open-btn";
  openBtn.textContent = "🎬";

  // Apply saved visibility preference
  if (localStorage.getItem("huddle_show_floating_btn") === "false") {
    openBtn.style.display = "none";
  }

  openBtn.addEventListener("click", () => {
    sidebar.classList.toggle("huddle-visible");
    openBtn.classList.toggle("sidebar-open");
  });

  // Extension Icon Click Listener (from background.js)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "HUDDLE_TOGGLE_SIDEBAR") {
      const s = document.getElementById("huddle-sidebar");
      const b = document.getElementById("huddle-open-btn");
      if (s && b) {
        s.classList.toggle("huddle-visible");
        b.classList.toggle("sidebar-open");
      }
    }
  });

  // Append both to DOM together to avoid reflow between inserts
  document.body.appendChild(sidebar);
  document.body.appendChild(openBtn);

  // Render initial view
  renderMainView();
}

/* ---------- UI: Page Navigation ---------- */
function showPage(page) {
  currentPage = page;
  document
    .querySelectorAll(".huddle-page")
    .forEach((p) => p.classList.remove("active"));
  const target = document.getElementById(`huddle-page-${page}`);
  if (target) target.classList.add("active");
}

/* ---------- UI: Main Page ---------- */
function renderMainView() {
  const page = document.getElementById("huddle-page-main");
  if (!page) return;

  const savedName = localStorage.getItem("huddle_display_name") || "";
  const showFloating =
    localStorage.getItem("huddle_show_floating_btn") !== "false";

  page.innerHTML = `
    <div class="huddle-card">
      <div class="huddle-card-title">👤 Display Name</div>
      <input class="huddle-input" id="huddle-name-input" type="text" 
             placeholder="What should we call you?" value="${savedName}" />
    </div>

    <button class="huddle-btn huddle-btn-primary" id="huddle-create-room-btn" style="margin-top: 16px;">
      🎬 Start New Room
    </button>

    <div class="huddle-divider" style="margin: 16px 0;">or join a room</div>

    <div class="huddle-card">
      <div class="huddle-card-title">🔑 Room Code</div>
      <input class="huddle-input" id="huddle-room-input" type="text" 
             placeholder="e.g. HUD-A1B2" style="text-transform: uppercase;" />
      <button class="huddle-btn huddle-btn-secondary huddle-btn-small" 
              id="huddle-join-btn" style="margin-top: 10px;">
        🚪 Join Room
      </button>
    </div>

    <button class="huddle-btn huddle-btn-twitch" id="huddle-twitch-nav-btn" style="margin-top: 16px;">
      🟣 Twitch Integration
    </button>

    <div class="huddle-divider" style="margin: 16px 0;">settings</div>
    <div class="huddle-card" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px;">
      <span style="font-size: 13px; font-weight: 600; color: var(--hud-text-muted);">Show floating 🎬 button</span>
      <label class="huddle-switch">
        <input type="checkbox" id="huddle-toggle-floating" ${showFloating ? "checked" : ""}>
        <span class="huddle-switch-slider"></span>
      </label>
    </div>
  `;

  // Event listeners
  document
    .getElementById("huddle-create-room-btn")
    .addEventListener("click", handleCreateRoom);
  document
    .getElementById("huddle-join-btn")
    .addEventListener("click", handleJoinRoom);
  document
    .getElementById("huddle-twitch-nav-btn")
    .addEventListener("click", () => {
      showPage("twitch");
      renderTwitchView();
    });

  // Floating button toggle listener
  document
    .getElementById("huddle-toggle-floating")
    .addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      localStorage.setItem(
        "huddle_show_floating_btn",
        isChecked ? "true" : "false",
      );
      const openBtn = document.getElementById("huddle-open-btn");
      if (openBtn) {
        openBtn.style.display = isChecked ? "block" : "none";
      }
    });
}

/* ---------- UI: Room Page ---------- */
function renderRoomView() {
  const page = document.getElementById("huddle-page-room");
  if (!page) return;

  let isOnHostVideo = true;
  if (currentHostVideoUrl) {
    try {
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(currentHostVideoUrl);
      if (currentUrl.hostname.includes("youtube.com") && targetUrl.hostname.includes("youtube.com")) {
        isOnHostVideo = currentUrl.searchParams.get("v") === targetUrl.searchParams.get("v");
      } else {
        isOnHostVideo = currentUrl.origin + currentUrl.pathname === targetUrl.origin + targetUrl.pathname;
      }
    } catch(e) {}
  }

  page.innerHTML = `
    <div class="huddle-room-code" id="huddle-room-code-display" title="Click to copy">
      ${currentRoomCode}
    </div>
    <div class="huddle-room-code-hint">Click to copy • Share this code!</div>

    ${
      !isHost && currentHostVideoUrl && !isOnHostVideo
        ? `
      <button class="huddle-btn huddle-btn-twitch" id="huddle-open-host-video-btn" style="background: var(--hud-primary); margin-bottom: 15px;">
        📺 Open Host's Video
      </button>
    `
        : ""
    }

    <div class="huddle-card" style="padding: 12px 16px;">
      <div class="huddle-card-title" id="huddle-viewers-toggle" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
        <span>👥 Viewers (${viewersInRoom.length + 1})</span>
        <span id="huddle-viewers-arrow" style="font-size: 10px; transition: transform var(--hud-transition); transform: ${viewersExpanded ? "rotate(90deg)" : "rotate(0deg)"};">▶</span>
      </div>
      <div class="huddle-viewers-list" id="huddle-viewers-list" style="display: ${viewersExpanded ? "flex" : "none"}; margin-top: 10px;">
      </div>
    </div>

    ${
      isHost
        ? `
      <button class="huddle-btn huddle-btn-twitch" id="huddle-room-twitch-btn">
        🟣 Share on Twitch
      </button>
    `
        : ""
    }

    <button class="huddle-btn huddle-btn-accent" id="huddle-leave-room-btn">
      ${isHost ? "🔴 Close Room" : "🚪 Leave Room"}
    </button>
  `;

  renderViewersList();

  // Viewers list toggle expand/collapse
  const viewersToggle = document.getElementById("huddle-viewers-toggle");
  if (viewersToggle) {
    viewersToggle.addEventListener("click", () => {
      viewersExpanded = !viewersExpanded;
      const list = document.getElementById("huddle-viewers-list");
      const arrow = document.getElementById("huddle-viewers-arrow");
      if (list) list.style.display = viewersExpanded ? "flex" : "none";
      if (arrow) arrow.style.transform = viewersExpanded ? "rotate(90deg)" : "rotate(0deg)";
    });
  }

  // Copy room code
  document
    .getElementById("huddle-room-code-display")
    .addEventListener("click", () => {
      navigator.clipboard.writeText(currentRoomCode).then(() => {
        showToast("Room code copied!");
      });
    });

  // Open host video
  const openHostBtn = document.getElementById("huddle-open-host-video-btn");
  if (openHostBtn) {
    openHostBtn.addEventListener("click", () => {
      try {
        const targetUrl = new URL(currentHostVideoUrl);
        targetUrl.hash = `huddle_room=${currentRoomCode}&name=${encodeURIComponent(displayName)}`;
        window.open(targetUrl.toString(), "_blank");
        // Leave room in current tab to prevent duplicates
        handleLeaveRoom();
      } catch (e) {
        console.error("Invalid host URL", e);
      }
    });
  }

  // Leave/close room
  document
    .getElementById("huddle-leave-room-btn")
    .addEventListener("click", handleLeaveRoom);

  // Twitch share button (host only)
  const twitchBtn = document.getElementById("huddle-room-twitch-btn");
  if (twitchBtn) {
    twitchBtn.addEventListener("click", () => {
      showPage("twitch");
      renderTwitchView();
    });
  }
}

function renderViewersList() {
  const list = document.getElementById("huddle-viewers-list");
  if (!list) return;

  // 1. Host item is always at the top!
  const hostIsMe = isHost || (displayName === currentHostName);
  let html = `
    <div class="huddle-viewer-item host" title="Room Host">
      <span class="huddle-viewer-dot" style="background: var(--hud-primary);"></span>
      <strong>${currentHostName || "Host"}</strong> ${hostIsMe ? '<small style="color: var(--hud-text-muted); font-weight:normal;">(You)</small>' : ""}
      <span style="margin-left: auto;">👑</span>
    </div>
  `;

  // 2. Render other viewers
  viewersInRoom.forEach((name) => {
    // Skip host in the viewers loop to prevent duplicate display
    if (name === currentHostName) return;

    const isMe = name === displayName;
    html += `
      <div class="huddle-viewer-item ${isMe ? "me" : ""}">
        <span class="huddle-viewer-dot" style="background: ${isMe ? "var(--hud-secondary)" : "var(--hud-success)"};"></span>
        <span>${name} ${isMe ? '<small style="color: var(--hud-text-muted); font-weight:normal;">(You)</small>' : ""}</span>
      </div>
    `;
  });

  list.innerHTML = html;

  // Update counter inside the header span
  const counterSpan = document.querySelector("#huddle-viewers-toggle span");
  if (counterSpan) {
    counterSpan.textContent = `👥 Viewers (${viewersInRoom.length + 1})`;
  }
}

/* ---------- UI: Twitch Page ---------- */
function renderTwitchView() {
  const page = document.getElementById("huddle-page-twitch");
  if (!page) return;

  let html = `
    <button class="huddle-back-btn" id="huddle-twitch-back">
      ← Back to ${currentRoomCode ? "Room" : "Menu"}
    </button>

    <div style="text-align: center; margin-bottom: 8px;">
      <span style="font-size: 28px;">🟣</span>
      <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">Twitch Integration</div>
    </div>
  `;

  if (!isConnectedToTwitch) {
    // Not connected
    html += `
      <div class="huddle-empty">
        <span class="huddle-empty-icon">🔗</span>
        <span class="huddle-empty-text">Connect your Twitch account to share clips with your viewers</span>
      </div>
      <button class="huddle-btn huddle-btn-twitch" id="huddle-twitch-connect">
        🟣 Connect Twitch
      </button>
    `;
  } else {
    // Connected
    html += `
      <div class="huddle-twitch-status connected">
        🟢 Connected as <strong>${twitchUserInfo?.display_name || "Unknown"}</strong>
      </div>
    `;

    // Live status
    if (twitchLiveStatus) {
      html += `
        <div class="huddle-twitch-status live">
          <span class="huddle-live-dot"></span>
          LIVE — ${twitchLiveStatus.viewer_count || 0} viewers
        </div>
      `;
    } else {
      html += `
        <div class="huddle-twitch-status offline">
          ⚫ Offline — Go live to share clips
        </div>
      `;
    }

    // Refresh status button
    html += `
      <button class="huddle-btn huddle-btn-secondary huddle-btn-small" id="huddle-twitch-refresh">
        🔄 Refresh Status
      </button>
    `;

    // Share to chat section (only if in a room)
    if (currentRoomCode && isHost) {
      html += `
        <div class="huddle-divider">share to chat</div>
        <div class="huddle-card">
          <div class="huddle-card-title">💬 Custom Message</div>
          <textarea class="huddle-textarea" id="huddle-twitch-message" 
                    placeholder="Come watch with me! 🎬">${localStorage.getItem("huddle_twitch_msg") || "Come watch with me! 🎬"}</textarea>
        </div>
        <button class="huddle-btn huddle-btn-accent" id="huddle-twitch-share" 
                ${!twitchLiveStatus ? "disabled" : ""}>
          📤 Share to Twitch Chat
        </button>
        ${!twitchLiveStatus ? '<div class="huddle-room-code-hint">⚠️ You must be live to share</div>' : ""}
      `;
    } else if (!currentRoomCode) {
      html += `
        <div class="huddle-empty">
          <span class="huddle-empty-icon">🏠</span>
          <span class="huddle-empty-text">Create a room first to share on Twitch</span>
        </div>
      `;
    }

    // Disconnect button
    html += `
      <button class="huddle-btn huddle-btn-secondary huddle-btn-small" id="huddle-twitch-disconnect" style="margin-top: 8px;">
        🔌 Disconnect Twitch
      </button>
    `;
  }

  page.innerHTML = html;

  // Event listeners
  document
    .getElementById("huddle-twitch-back")
    ?.addEventListener("click", () => {
      showPage(currentRoomCode ? "room" : "main");
      if (currentRoomCode) renderRoomView();
      else renderMainView();
    });

  document
    .getElementById("huddle-twitch-connect")
    ?.addEventListener("click", startTwitchOAuth);
  document
    .getElementById("huddle-twitch-refresh")
    ?.addEventListener("click", checkTwitchLiveStatus);

  document
    .getElementById("huddle-twitch-share")
    ?.addEventListener("click", () => {
      const msgInput = document.getElementById("huddle-twitch-message");
      if (msgInput) localStorage.setItem("huddle_twitch_msg", msgInput.value);
      shareToTwitchChat();
    });

  document
    .getElementById("huddle-twitch-disconnect")
    ?.addEventListener("click", () => {
      twitchAccessToken = null;
      twitchUserInfo = null;
      twitchLiveStatus = null;
      isConnectedToTwitch = false;
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.remove("huddle_twitch_token");
      }
      renderTwitchView();
      showToast("Twitch disconnected", "info");
    });
}

/* ---------- UI: Handlers ---------- */
function handleCreateRoom() {
  const nameInput = document.getElementById("huddle-name-input");
  if (!nameInput || !nameInput.value.trim()) {
    showToast("Please enter your display name!", "warning");
    return;
  }

  const meta = getVideoMetadata();
  if (meta.source === "unknown") {
    showToast("You can only Host a room on a supported video page (e.g. a YouTube video)!", "error");
    return;
  }

  // Also verify that we are on a valid video watch page (not homepages or search pages)
  const url = window.location.href;
  let isValidVideoPage = false;
  if (url.includes("youtube.com/watch")) isValidVideoPage = true;
  else if (url.includes("netflix.com/watch")) isValidVideoPage = true;
  else if (url.includes("clips.twitch.tv")) isValidVideoPage = true;
  else if (url.includes("twitch.tv/videos")) isValidVideoPage = true;
  else if (document.querySelector("video")) isValidVideoPage = true; // Fallback if a video tag is already present

  if (!isValidVideoPage) {
    showToast("Please navigate to an actual video page before hosting!", "error");
    return;
  }

  displayName = nameInput.value.trim();
  saveDisplayName(displayName);

  socket.emit("createRoom", {
    hostName: displayName,
    videoUrl: meta.videoUrl,
    videoTitle: meta.videoTitle,
    videoThumbnail: meta.videoThumbnail,
    source: meta.source,
    videoDuration: meta.videoDuration,
    isTwitchRoom: isConnectedToTwitch,
    twitchChannel: twitchUserInfo?.login || "",
  });
}

function handleJoinRoom() {
  const nameInput = document.getElementById("huddle-name-input");
  const roomInput = document.getElementById("huddle-room-input");

  if (!nameInput || !nameInput.value.trim()) {
    showToast("Please enter your display name!", "warning");
    return;
  }
  if (!roomInput || !roomInput.value.trim()) {
    showToast("Please enter a room code!", "warning");
    return;
  }

  displayName = nameInput.value.trim();
  saveDisplayName(displayName);

  const roomCode = roomInput.value.trim().toUpperCase();
  socket.emit("joinRoom", { roomCode, name: displayName });
}

function handleLeaveRoom() {
  if (isHost) {
    socket.emit("closeRoom", { roomCode: currentRoomCode });
  } else {
    socket.emit("leaveRoom", { roomCode: currentRoomCode, name: displayName });
  }

  currentRoomCode = null;
  isHost = false;
  viewersInRoom = [];
  stopVideoSync();
  showPage("main");
  renderMainView();
  showToast("Left the room", "info");
}

/* ---------- Persistent Cross-Origin Display Name Helpers ---------- */
function loadDisplayName(callback) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("huddle_display_name", (result) => {
      if (result.huddle_display_name) {
        displayName = result.huddle_display_name;
        localStorage.setItem("huddle_display_name", displayName);
      } else {
        const localName = localStorage.getItem("huddle_display_name");
        if (localName) {
          displayName = localName;
          chrome.storage.local.set({ huddle_display_name: displayName });
        }
      }
      if (callback) callback();
    });
  } else {
    displayName = localStorage.getItem("huddle_display_name") || "";
    if (callback) callback();
  }
}

function saveDisplayName(name) {
  displayName = name;
  localStorage.setItem("huddle_display_name", name);
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ huddle_display_name: name });
  }
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
