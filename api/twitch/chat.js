/**
 * Twitch Chat Message Proxy (Stateless)
 *
 * POST /api/twitch/chat
 *
 * Body: {
 *   accessToken:    string – Twitch OAuth user token (never stored)
 *   broadcasterId:  string – Twitch user-id of the streamer
 *   message:        string – Custom message from the streamer
 *   videoUrl:       string – URL of the video being watched
 *   roomUrl:        string – Landing Page URL for Twitch Viewers to join
 * }
 *
 * Flow:
 *  1. Verify the streamer is currently live.
 *  2. Compose the final chat message.
 *  3. Send it via the Twitch Helix chat/messages endpoint.
 *  4. Return success or a descriptive error.
 */

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;

export default async function handler(req, res) {
  // ── Only accept POST ──────────────────────────────────────────────
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ── Parse & validate body ─────────────────────────────────────────
  const { accessToken, broadcasterId, message, videoUrl, roomUrl } =
    req.body || {};

  if (!accessToken || !broadcasterId || !videoUrl || !roomUrl) {
    return res.status(400).json({
      error:
        "Missing required fields: accessToken, broadcasterId, videoUrl, roomUrl",
    });
  }

  if (!TWITCH_CLIENT_ID) {
    console.error("TWITCH_CLIENT_ID environment variable is not set");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const headers = {
    "Client-Id": TWITCH_CLIENT_ID,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // ── Step 1: Verify the streamer is live ───────────────────────────
    const streamRes = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`,
      {
        headers: {
          "Client-Id": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!streamRes.ok) {
      const errBody = await streamRes.text();
      console.error("Twitch streams API error:", streamRes.status, errBody);
      return res
        .status(502)
        .json({ error: "Failed to verify stream status", detail: errBody });
    }

    const streamData = await streamRes.json();

    if (!streamData.data || streamData.data.length === 0) {
      return res.status(422).json({
        error:
          "Streamer is not currently live. Share to Chat requires an active stream.",
      });
    }

    // ── Step 2: Compose chat message ──────────────────────────────────
    const parts = [];
    if (message && message.trim()) {
      parts.push(message.trim());
    }
    parts.push(`🎬 ${videoUrl}`);
    parts.push(`👉 Join the watch party: ${roomUrl}`);
    const composedMessage = parts.join(" | ");

    // ── Step 3: Send to Twitch chat ───────────────────────────────────
    // The sender_id must match the token owner, so we fetch the token owner first.
    const usersRes = await fetch("https://api.twitch.tv/helix/users", {
      headers,
    });
    if (!usersRes.ok) {
      const errBody = await usersRes.text();
      console.error("Twitch users API error:", usersRes.status, errBody);
      return res
        .status(502)
        .json({ error: "Failed to identify token owner", detail: errBody });
    }
    const usersData = await usersRes.json();
    const senderId = usersData.data?.[0]?.id;

    if (!senderId) {
      return res
        .status(502)
        .json({ error: "Could not determine sender ID from token" });
    }

    const chatRes = await fetch("https://api.twitch.tv/helix/chat/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        broadcaster_id: broadcasterId,
        sender_id: senderId,
        message: composedMessage,
      }),
    });

    if (!chatRes.ok) {
      const errBody = await chatRes.text();
      console.error("Twitch chat API error:", chatRes.status, errBody);
      return res
        .status(502)
        .json({ error: "Failed to send chat message", detail: errBody });
    }

    const chatData = await chatRes.json();

    // ── Step 4: Respond with success ──────────────────────────────────
    return res.status(200).json({
      success: true,
      message: composedMessage,
      twitchResponse: chatData,
    });
  } catch (err) {
    console.error("Unexpected error in /api/twitch/chat:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
