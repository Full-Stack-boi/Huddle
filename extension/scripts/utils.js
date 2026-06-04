/* === Huddle — Utils === */

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
  } else if (url.includes("hotstar.com") || url.includes("disneyplus.com")) {
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

/* ---------- Persistent Cross-Origin Display Name Helpers ---------- */
function loadDisplayName(callback) {
  try {
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
  } catch (err) {
    handleInvalidatedContext(err);
    displayName = localStorage.getItem("huddle_display_name") || "";
    if (callback) callback();
  }
}

function saveDisplayName(name) {
  displayName = name;
  localStorage.setItem("huddle_display_name", name);
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ huddle_display_name: name });
    }
  } catch (err) {
    handleInvalidatedContext(err);
  }
}

/* ---------- Room Session State Helpers ---------- */
function saveRoomSession(roomCode, hostStatus) {
  currentRoomCode = roomCode;
  isHost = hostStatus;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: "HUDDLE_SET_SESSION",
        roomCode: roomCode,
        isHost: hostStatus
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Huddle] Failed to save session to background:", chrome.runtime.lastError.message);
        }
      });
    }
  } catch (err) {
    handleInvalidatedContext(err);
  }
}

function clearRoomSession() {
  currentRoomCode = null;
  isHost = false;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: "HUDDLE_CLEAR_SESSION" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Huddle] Failed to clear session from background:", chrome.runtime.lastError.message);
        }
      });
    }
  } catch (err) {
    handleInvalidatedContext(err);
  }
}

function restoreRoomSession(callback) {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: "HUDDLE_GET_SESSION" }, (result) => {
        if (chrome.runtime.lastError) {
          console.warn("[Huddle] Failed to get session from background:", chrome.runtime.lastError.message);
          if (callback) callback();
          return;
        }
        if (result && result.roomCode) {
          currentRoomCode = result.roomCode;
          isHost = !!result.isHost;
          console.log("[Huddle] Restored tab session:", result);
        }
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  } catch (err) {
    handleInvalidatedContext(err);
    if (callback) callback();
  }
}

/* ---------- Graceful Invalidated Context Handler ---------- */
function handleInvalidatedContext(err) {
  console.warn("[Huddle] Extension context invalidated (Extension was updated/reloaded).", err);
  // Show a non-blocking toast warning that tells the user to refresh their page
  showToast("⚠️ Extension updated! Please refresh this page to continue.", "error");
}

/* ---------- Compare URLs for Same Video ---------- */
function areUrlsSameVideo(url1, url2) {
  if (!url1 || !url2) return false;

  const clean1 = url1.split("#")[0];
  const clean2 = url2.split("#")[0];

  if (clean1 === clean2) return true;

  // Check YouTube video ID equality to prevent redundant redirects on query parameter differences
  if (clean1.includes("youtube.com/watch") && clean2.includes("youtube.com/watch")) {
    try {
      const v1 = new URL(clean1).searchParams.get("v");
      const v2 = new URL(clean2).searchParams.get("v");
      return v1 && v2 && v1 === v2;
    } catch (e) {
      return false;
    }
  }

  return false;
}

/* ---------- Check if YouTube Ad is Playing ---------- */
function isAdPlaying() {
  const ytAdShowing = document.querySelector(".ad-showing, .ad-interrupting");
  const ytAdOverlay = document.querySelector(".ytp-ad-player-overlay, .ad-cta-wrapper, .ytp-ad-text");
  return !!(ytAdShowing || ytAdOverlay);
}
