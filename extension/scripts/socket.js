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
socket.on("roomCreated", ({ roomCode }) => {
  saveRoomSession(roomCode, true);
  currentHostName = displayName; // Host is the current host
  showPage("room");
  renderRoomView();
  startVideoSync();
  openSidebar(); // Auto-open sidebar so user knows room is ready
  applyDynamicTheme(getVideoMetadata().source); // Match theme to current platform
  showToast(`Room created! Code: ${roomCode}`, "success");
});

socket.on(
  "joinSuccess",
  ({ roomCode, hostName, videoUrl, videoTitle, viewers, source }) => {
    saveRoomSession(roomCode, false);
    currentHostVideoUrl = videoUrl;
    currentHostName = hostName; // Store the Host's display name
    viewersInRoom = viewers || [];
    showPage("room");
    renderRoomView();
    startVideoSync();
    openSidebar(); // Auto-open sidebar so user knows they joined successfully
    applyDynamicTheme(source); // Match theme to host's video platform!
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
