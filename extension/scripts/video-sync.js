/* === Huddle — Video Sync === */

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

  // Do not emit sync events if Host is currently watching an ad
  if (isAdPlaying()) return;

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

  // Clear any existing heartbeat timer first to prevent duplicate loops
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

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
