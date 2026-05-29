/* === Huddle — Config === */
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
