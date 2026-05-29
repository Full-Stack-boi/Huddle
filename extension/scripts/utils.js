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
