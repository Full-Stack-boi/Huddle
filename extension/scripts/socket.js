/* === Huddle — Socket === */

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
socket.on("roomCreated", ({ roomCode, viewers }) => {
  saveRoomSession(roomCode, true);
  currentHostName = displayName; // Host is the current host
  if (viewers) {
    viewersInRoom = viewers; // Restore viewers list upon reclaiming room
  }
  showPage("room");
  renderRoomView();
  startVideoSync();
  openSidebar(); // Auto-open sidebar so user knows room is ready
  applyDynamicTheme(getVideoMetadata().source); // Match theme to current platform
  showToast(`Room created! Code: ${roomCode}`, "success");
});

socket.on(
  "joinSuccess",
  ({ roomCode, assignedName, hostName, videoUrl, videoTitle, viewers, source, hostTime, isHostPaused }) => {
    saveRoomSession(roomCode, false);
    if (assignedName) {
      displayName = assignedName; // Save de-duplicated name assigned by server
    }
    currentHostVideoUrl = videoUrl;
    currentHostName = hostName; // Store the Host's display name
    viewersInRoom = viewers || [];
    showPage("room");
    renderRoomView();
    startVideoSync();
    openSidebar(); // Auto-open sidebar so user knows they joined successfully
    applyDynamicTheme(source); // Match theme to host's video platform!

    // Check if the current video URL is different from the host's video URL
    const cleanCurrentUrl = getVideoMetadata().videoUrl;
    if (!areUrlsSameVideo(cleanCurrentUrl, videoUrl)) {
      showToast(`Host is watching a different video. Redirecting...`, "info");

      const separator = videoUrl.indexOf("#") !== -1 ? "&" : "#";
      const redirectUrl = videoUrl + separator + "huddle_room=" + encodeURIComponent(roomCode);
      window.location.href = redirectUrl;
      return;
    }

    // Immediately sync player to host's time/state if player is already detected
    if (videoPlayer && typeof hostTime === "number" && typeof isHostPaused === "boolean") {
      if (isHostPaused) {
        videoPlayer.pause();
      }
      videoPlayer.currentTime = hostTime;
      if (!isHostPaused) {
        videoPlayer.play().catch(() => {});
      }
    } else if (typeof hostTime === "number" && typeof isHostPaused === "boolean") {
      // If videoPlayer is not yet detected, queue it for detectVideoPlayer()
      pendingInitialSync = { hostTime, isHostPaused };
    }

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
  clearRoomSession();
  currentHostName = "";
  viewersInRoom = [];
  stopVideoSync();
  showPage("main");
  renderMainView();
  openSidebar(); // Force sidebar open to notify the viewer that the room was closed
  applyDynamicTheme(getVideoMetadata().source); // Reset to local page platform
  showToast("Room has been closed by the host.", "warning");
});

socket.on("hostReconnected", () => {
  showToast("Host reconnected! ✨", "success");
});

socket.on("updateRoomMeta", ({ videoUrl, videoTitle, videoThumbnail, source, videoDuration }) => {
  if (isHost) return;

  showToast(`Host changed video to: ${videoTitle || "New Video"}. Redirecting...`, "info");

  // Format dynamic URL with roomCode hash for auto-joining on the new page
  const separator = videoUrl.indexOf("#") !== -1 ? "&" : "#";
  const redirectUrl = videoUrl + separator + "huddle_room=" + encodeURIComponent(currentRoomCode);

  // Redirect the viewer to the new video URL
  window.location.href = redirectUrl;
});

/* ---------- Socket: Video Sync ---------- */
socket.on("videoSync", ({ hostTime, isHostPaused, type }) => {
  if (isHost || !videoPlayer) return;

  // Skip synchronization if Joiner is currently watching an ad
  if (isAdPlaying()) return;

  // 1. Sync play/pause state
  if (isHostPaused && !videoPlayer.paused) {
    videoPlayer.pause();
  } else if (!isHostPaused && videoPlayer.paused) {
    videoPlayer.play().catch((err) => {
      console.warn(`[Huddle Joiner] ⚠️ Failed to play local video:`, err);
    });
  }

  // 2. Determine seek threshold dynamically to prevent micro-seeks
  // Explicit seeks from the Host require tight syncing (0.4s threshold)
  // Heartbeats and play/pause events use a wider tolerance (2.0s threshold) to prevent browser buffering spinners
  let threshold = 2.0; 
  if (type === "seek") {
    threshold = 0.4;
  }

  // 3. Sync seek position if drift exceeds dynamic threshold
  if (videoPlayer.seeking) return;

  const timeDiff = videoPlayer.currentTime - hostTime;
  if (Math.abs(timeDiff) > threshold) {
    videoPlayer.currentTime = hostTime;
  }
});
