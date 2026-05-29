<![CDATA[<div align="center">

# 🎬 Huddle

### Watch Together. Sync Perfectly.

A **Chrome Extension** that lets you watch videos with friends in perfect real-time sync — across YouTube, Netflix, Disney+, Prime Video, and Twitch Clips.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/Full-Stack-boi/Huddle)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-FF6D00?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)

---

<img src="https://img.shields.io/badge/version-2.0.0-8B5CF6?style=flat-square" alt="Version" />
<img src="https://img.shields.io/badge/license-ISC-06B6D4?style=flat-square" alt="License" />
<img src="https://img.shields.io/badge/status-Active-10B981?style=flat-square" alt="Status" />

</div>

---

## 🎯 What is Huddle?

Huddle turns any video streaming session into a **shared experience**. Create a room, share the code, and everyone's video syncs automatically — play, pause, and seek in perfect harmony.

No more counting down *"3… 2… 1… play!"*

---

## ✨ Features

### 🔄 Real-Time Video Sync
- **Event-driven architecture** — play, pause, and seek sync instantly via WebSocket events
- **1-second heartbeat** — continuous drift correction keeps everyone within 0.5 seconds
- **Host-controlled** — the Host's playback state is the source of truth

### 🌐 Multi-Platform Support
| Platform | Status | Notes |
|----------|--------|-------|
| YouTube | ✅ Supported | Full thumbnail & metadata extraction |
| Netflix | ✅ Supported | Works on `/watch` pages |
| Disney+ / Hotstar | ✅ Supported | `disneyplus.com` & `hotstar.com` |
| Prime Video | ✅ Supported | Amazon Prime Video |
| Twitch Clips | ✅ Supported | `clips.twitch.tv` |

### 🎨 Dynamic Brand Theming
The sidebar **automatically adapts** its color palette and logo to match whichever platform you're watching on:
- **YouTube** → Soft Coral Red theme
- **Netflix** → Crimson theme
- **Disney+** → Royal Blue theme
- **Prime Video** → Sky Blue theme
- **Twitch** → Purple theme

When you join someone's room, your sidebar transitions to match **their** platform's branding!

### 🟣 Twitch Streamer Integration
- **OAuth Login** — connect your Twitch account securely
- **Live Status** — see if you're currently live with viewer count
- **Share to Chat** — send your Huddle room link directly to your Twitch chat so viewers can join your watch party

### 🏠 Room System
- **Unique Room Codes** — auto-generated `HUD-XXXX` codes (easy to read and share)
- **One-Click Copy** — click the room code to copy it to clipboard
- **Auto-Join via Link** — share a URL with `#huddle_room=CODE` and friends join instantly
- **Landing Page** — a beautiful web page where friends can preview the room before joining

### 👥 Viewers Experience
- **Host Crown** 👑 — the host is highlighted at the top of the list
- **Self Indicator** — your name is marked with `(You)` and a distinct style
- **Expand/Collapse** — toggle the viewers list with a smooth animation
- **Room Dissolution** — when the host closes the room, viewers are notified immediately

### 🔁 Reliability
- **Auto-Reconnect** — up to 10 reconnection attempts with exponential backoff
- **Host Grace Period** — 30-second window for host to reconnect without losing the room
- **Cross-Origin Names** — display names persist across all websites via `chrome.storage`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                Chrome Extension                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │content.js │  │ style.css│  │ manifest.json│  │
│  │(1154 lines)│  │(920 lines)│  │  (MV3)      │  │
│  └─────┬─────┘  └──────────┘  └──────────────┘  │
│        │ Socket.IO                                │
└────────┼─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐     ┌──────────────────────┐
│   Sync Server       │     │   Twitch API Server  │
│   (Railway)         │     │   (Vercel)           │
│                     │     │                      │
│  • Room Registry    │◄────│  • OAuth Handler     │
│  • Video Sync       │     │  • Chat Proxy        │
│  • Host Management  │     │  • Room Metadata API │
│  • Viewer Tracking  │     │  • Landing Page      │
│                     │     │                      │
│  Node.js + Express  │     │  Serverless Functions│
│  + Socket.IO        │     │  + Static HTML       │
└─────────────────────┘     └──────────────────────┘
```

---

## 📁 Project Structure

```
Huddle/
├── client/                  # Chrome Extension
│   ├── manifest.json        # Extension config (Manifest V3)
│   ├── content.js           # Main extension logic
│   ├── style.css            # UI styles & design system
│   ├── background.js        # Service worker
│   └── socketioclient.js    # Socket.IO client bundle
│
├── server.js                # Sync Server (Railway)
├── package.json             # Server dependencies
│
├── api/                     # Vercel Serverless Functions
│   ├── twitch/
│   │   ├── oauth.js         # Twitch OAuth handler
│   │   └── chat.js          # Twitch chat proxy
│   └── room/
│       └── [code].js        # Room metadata API
│
├── public/                  # Vercel Static Assets
│   └── room.html            # Landing Page
│
├── vercel.json              # Vercel routing config
└── docs/
    └── adr/                 # Architecture Decision Records
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 16.0.0
- A **Chromium-based browser** (Chrome, Edge, Brave, etc.)
- *(Optional)* A [Twitch Developer App](https://dev.twitch.tv/console) for streamer features

### 1. Clone & Install

```bash
git clone https://github.com/Full-Stack-boi/Huddle.git
cd Huddle
npm install
```

### 2. Start the Sync Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server runs on port `4000` by default (or `$PORT` environment variable).

### 3. Load the Extension

1. Open `chrome://extensions/` in your browser
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** → select the `client/` folder
4. You'll see the Huddle icon in your toolbar! 🎬

### 4. Configure (Optional)

Edit the config in `client/content.js`:

```javascript
const HUDDLE_CONFIG = {
  syncServerUrl: "http://localhost:4000",       // Your server URL
  twitchClientId: "YOUR_TWITCH_CLIENT_ID",      // For Twitch features
  twitchRedirectUri: "YOUR_VERCEL_OAUTH_URL",   // For Twitch OAuth
};
```

---

## 🎮 How to Use

### As a Host
1. Open a video on any supported platform
2. Click the 🎬 floating button to open the sidebar
3. Enter your display name
4. Click **"🎬 Start New Room"**
5. Share the room code (e.g., `HUD-A1B2`) with friends!

### As a Viewer
1. Get the room code from the host
2. Click the 🎬 button on any page
3. Enter your name and the room code
4. Click **"🚪 Join Room"** → you'll be synced automatically!

### Via Share Link
Hosts can share a direct link like:
```
https://youtube.com/watch?v=VIDEO_ID#huddle_room=HUD-A1B2&name=Friend
```
Friends who click this link **auto-join the room** instantly!

---

## 🌐 Deployment

### Sync Server → Railway

1. Connect the GitHub repo to [Railway](https://railway.app)
2. Railway auto-detects `package.json` and runs `npm start`
3. The `PORT` env variable is set automatically

### Twitch API + Landing Page → Vercel

1. Connect the same repo to [Vercel](https://vercel.com)
2. Vercel auto-detects `vercel.json` for routing
3. Set environment variables:
   - `TWITCH_CLIENT_ID` — Your Twitch app Client ID
   - `SYNC_SERVER_URL` — Your Railway server URL

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Extension | Vanilla JS, CSS, Manifest V3 | Client-side UI & video sync |
| Sync Server | Node.js, Express, Socket.IO | Real-time room management |
| API Server | Vercel Serverless Functions | Twitch OAuth & chat proxy |
| Landing Page | Static HTML/CSS/JS | Room preview & auto-join |
| Communication | WebSocket (Socket.IO) | Bi-directional real-time events |
| Storage | `chrome.storage.local` | Cross-origin persistent data |

---

## 📡 Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `createRoom` | Client → Server | Host creates a new room |
| `joinRoom` | Client → Server | Viewer joins with room code |
| `leaveRoom` | Client → Server | Viewer explicitly leaves |
| `closeRoom` | Client → Server | Host dissolves the room |
| `videoSync` | Client ↔ Server | Play/pause/seek/heartbeat sync |
| `reclaimRoom` | Client → Server | Host reclaims after disconnect |
| `roomCreated` | Server → Client | Room created confirmation |
| `joinSuccess` | Server → Client | Join confirmed with room data |
| `viewerJoined` | Server → Clients | New viewer notification |
| `viewerLeft` | Server → Clients | Viewer departure notification |
| `roomDissolved` | Server → Clients | Room closed by host |

---

## 🎓 Academic Project

> **Note:** This project was developed as a **University Project** to demonstrate skills in full-stack development, real-time bidirectional communication, browser extension architecture, and modern web design.

---

## 📝 License

This project is licensed under the **ISC License**.

---

<div align="center">

**Made with ❤️ by [Full-Stack-boi](https://github.com/Full-Stack-boi)**

*Because watching alone is overrated.*

</div>
]]>
