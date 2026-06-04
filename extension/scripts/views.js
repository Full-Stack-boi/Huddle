/* === Huddle — Views === */

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
      if (
        currentUrl.hostname.includes("youtube.com") &&
        targetUrl.hostname.includes("youtube.com")
      ) {
        isOnHostVideo =
          currentUrl.searchParams.get("v") === targetUrl.searchParams.get("v");
      } else {
        isOnHostVideo =
          currentUrl.origin + currentUrl.pathname ===
          targetUrl.origin + targetUrl.pathname;
      }
    } catch (e) {}
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
      if (arrow)
        arrow.style.transform = viewersExpanded
          ? "rotate(90deg)"
          : "rotate(0deg)";
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
  const hostIsMe = isHost || displayName === currentHostName;
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
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove("huddle_twitch_token");
        }
      } catch (err) {
        handleInvalidatedContext(err);
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
    showToast(
      "You can only Host a room on a supported video page (e.g. a YouTube video)!",
      "error",
    );
    return;
  }

  // Also verify that we are on a valid video watch page (not homepages or search pages)
  const url = window.location.href;
  let isValidVideoPage = false;
  if (url.includes("youtube.com/watch")) isValidVideoPage = true;
  else if (url.includes("netflix.com/watch")) isValidVideoPage = true;
  else if (url.includes("clips.twitch.tv")) isValidVideoPage = true;
  else if (url.includes("twitch.tv/videos")) isValidVideoPage = true;
  else if (url.includes("hotstar.com") || url.includes("disneyplus.com"))
    isValidVideoPage = true;
  else if (url.includes("primevideo.com")) isValidVideoPage = true;
  else if (document.querySelector("video")) isValidVideoPage = true; // Fallback if a video tag is already present

  if (!isValidVideoPage) {
    showToast(
      "Please navigate to an actual video page before hosting!",
      "error",
    );
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

  clearRoomSession();
  viewersInRoom = [];
  stopVideoSync();
  showPage("main");
  renderMainView();
  applyDynamicTheme(getVideoMetadata().source); // Reset to local page platform
  showToast("Left the room", "info");
}
