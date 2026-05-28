# WeWatch 🎬

WeWatch is a browser extension and backend server application that allows users to watch videos together in perfect sync with their friends. 

## 🎓 Academic Project

**Note:** This project was developed specifically as a **University Project**. It was created to demonstrate skills in full-stack development, real-time bidirectional communication, and browser extension development.

## ✨ Features

- **Real-Time Video Sync**: Synchronize video playback, pausing, and seeking across multiple users in real-time.
- **Room System**: Create or join private rooms to watch videos together securely with friends.
- **Browser Extension**: A seamless client-side extension (`/client`) that interacts directly with the video player on the webpage.
- **Real-Time Backend**: A robust server built with Node.js and Socket.io to manage room states, handle user connections, and broadcast synchronization events.

## 🛠️ Technologies Used

- **Backend:** Node.js, Express.js
- **Real-Time Communication:** Socket.io
- **Frontend/Client:** Vanilla JavaScript, HTML/CSS (Browser Extension Manifest V3/V2)

## 📁 Project Structure

- `/client`: Contains the browser extension files (`manifest.json`, `content.js`, `style.css`, etc.).
- `server.js`: The main entry point for the Node.js backend server handling WebSockets.
- `package.json`: Backend project dependencies and scripts.

## 🚀 Getting Started

### 1. Setting up the Server

First, navigate to the root directory and install the backend dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```
The server will run on port `4000` by default (or the `PORT` environment variable).

### 2. Setting up the Extension

1. Open your Chromium-based browser (Chrome, Edge, Brave, etc.).
2. Go to the extensions page (`chrome://extensions/`).
3. Enable **Developer mode** (usually a toggle in the top right corner).
4. Click **Load unpacked** and select the `client` folder inside this project directory.
5. The extension will be installed and you should see its icon in your browser toolbar.

## 👥 How to Use

1. Ensure the backend server is running.
2. Ensure the browser extension is loaded and active.
3. Open a video page that you want to watch with friends.
4. Open the extension popup, and either create a new room or enter a room ID to join your friends.
5. Once connected, video playback will be synchronized for everyone in the room!
