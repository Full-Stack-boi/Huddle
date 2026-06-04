/* === Huddle — State === */

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
let lastSyncedVideoUrl = "";
let pendingInitialSync = null;
