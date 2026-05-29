/* === Huddle — Twitch === */

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
