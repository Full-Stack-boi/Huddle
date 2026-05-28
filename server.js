// ============================================================================
// Huddle Sync Server
// Real-time video synchronization server using Socket.IO
// ============================================================================

const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 4000;

// ============================================================================
// Room Registry
// In-memory store: roomCode -> Room object
// ============================================================================

const rooms = new Map();

/**
 * Room schema:
 * {
 *   hostId:           string   – persistent host identifier (socket ID at creation)
 *   hostSocketId:     string   – current socket ID of the host (may change on reconnect)
 *   hostName:         string   – display name of the host
 *   videoUrl:         string   – URL of the video being watched
 *   videoTitle:       string   – title of the video
 *   videoThumbnail:   string   – thumbnail URL
 *   source:           string   – video source platform (youtube, twitch, etc.)
 *   hostTime:         number   – last known playback time (seconds)
 *   videoDuration:    number   – total duration of the video (seconds)
 *   isHostPaused:     boolean  – whether the host's player is paused
 *   isTwitchRoom:     boolean  – whether this is a Twitch live room
 *   twitchChannel:    string   – Twitch channel name (if applicable)
 *   createdAt:        string   – ISO timestamp of room creation
 *   viewers:          Set      – set of viewer names currently in the room
 *   disconnectTimer:  Timeout  – handle for the 30-second host disconnect grace period
 * }
 */

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a random room code in the format "HUD-XXXX".
 * Uses alphanumeric characters (uppercase + digits).
 * Retries if the code already exists (extremely unlikely collision).
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed ambiguous: I,1,O,0
  let code;
  do {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = 'HUD-' + suffix;
  } while (rooms.has(code));
  return code;
}

/**
 * Build a sanitized room metadata object safe for client consumption.
 */
function getRoomMeta(room, roomCode) {
  return {
    roomCode: roomCode,
    hostName: room.hostName,
    videoUrl: room.videoUrl,
    videoTitle: room.videoTitle,
    videoThumbnail: room.videoThumbnail,
    source: room.source,
    hostTime: room.hostTime,
    videoDuration: room.videoDuration,
    isHostPaused: room.isHostPaused,
    isTwitchRoom: room.isTwitchRoom,
    twitchChannel: room.twitchChannel,
    viewerCount: room.viewers.size,
    viewers: Array.from(room.viewers),
    createdAt: room.createdAt,
  };
}

// ============================================================================
// HTTP Routes
// ============================================================================

// CORS middleware for HTTP routes
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health-check / landing
app.get('/', function (req, res) {
  res.json({
    name: 'Huddle Sync Server',
    status: 'running',
    activeRooms: rooms.size,
  });
});

/**
 * GET /api/room/:code
 * Returns room metadata as JSON.
 * Used by the Landing Page to look up a room before joining.
 */
app.get('/api/room/:code', function (req, res) {
  var code = req.params.code.toUpperCase();
  var room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ error: 'Room not found', roomCode: code });
  }

  res.json(getRoomMeta(room, code));
});

// ============================================================================
// Socket.IO – Connection Handling
// ============================================================================

io.on('connection', function (socket) {
  console.log('[connect] socket=%s', socket.id);

  // --------------------------------------------------
  // whoami – immediately tell the client its socket ID
  // --------------------------------------------------
  socket.emit('whoami', { id: socket.id });

  // --------------------------------------------------
  // createRoom – host creates a new watch room
  // --------------------------------------------------
  socket.on('createRoom', function (data) {
    var roomCode = generateRoomCode();

    var room = {
      hostId: socket.id,          // persistent identifier for this host session
      hostSocketId: socket.id,    // current socket (may change on reconnect)
      hostName: data.hostName || 'Host',
      videoUrl: data.videoUrl || '',
      videoTitle: data.videoTitle || '',
      videoThumbnail: data.videoThumbnail || '',
      source: data.source || '',
      hostTime: 0,
      videoDuration: data.videoDuration || 0,
      isHostPaused: true,
      isTwitchRoom: data.isTwitchRoom || false,
      twitchChannel: data.twitchChannel || '',
      createdAt: new Date().toISOString(),
      viewers: new Set(),
      disconnectTimer: null,
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    // Tag this socket so we know which room it hosts
    socket.data = socket.data || {};
    socket.data.hostedRoom = roomCode;
    socket.data.name = data.hostName || 'Host';

    console.log('[createRoom] room=%s host=%s (%s)', roomCode, room.hostName, socket.id);

    socket.emit('roomCreated', { roomCode: roomCode });
  });

  // --------------------------------------------------
  // joinRoom – viewer joins an existing room
  // --------------------------------------------------
  socket.on('joinRoom', function (data) {
    var code = (data.roomCode || '').toUpperCase();
    var room = rooms.get(code);

    if (!room) {
      socket.emit('joinError', { message: 'Room "' + code + '" does not exist.' });
      return;
    }

    var viewerName = data.name || 'Viewer';

    // Add viewer to the room
    room.viewers.add(viewerName);
    socket.join(code);

    // Tag this socket with viewer info
    socket.data = socket.data || {};
    socket.data.joinedRoom = code;
    socket.data.name = viewerName;

    console.log('[joinRoom] room=%s viewer=%s (%s) viewers=%d',
      code, viewerName, socket.id, room.viewers.size);

    // Acknowledge the viewer
    socket.emit('joinSuccess', {
      roomCode: code,
      hostName: room.hostName,
      videoUrl: room.videoUrl,
      videoTitle: room.videoTitle,
      videoThumbnail: room.videoThumbnail,
      source: room.source,
      hostTime: room.hostTime,
      videoDuration: room.videoDuration,
      isHostPaused: room.isHostPaused,
      isTwitchRoom: room.isTwitchRoom,
      twitchChannel: room.twitchChannel,
      viewers: Array.from(room.viewers),
    });

    // Notify the entire room (including host)
    io.to(code).emit('viewerJoined', {
      name: viewerName,
      viewerCount: room.viewers.size,
    });
  });

  // --------------------------------------------------
  // videoSync – host broadcasts play/pause/seek/heartbeat
  // --------------------------------------------------
  socket.on('videoSync', function (data) {
    var code = socket.data && socket.data.hostedRoom;
    if (!code) return;

    var room = rooms.get(code);
    if (!room) return;

    // Only the current host socket can sync
    if (room.hostSocketId !== socket.id) return;

    // Update the room's authoritative state
    if (typeof data.hostTime === 'number') {
      room.hostTime = data.hostTime;
    }
    if (typeof data.isHostPaused === 'boolean') {
      room.isHostPaused = data.isHostPaused;
    }

    // Broadcast to all viewers in the room (excluding the host)
    socket.to(code).emit('videoSync', {
      hostTime: room.hostTime,
      isHostPaused: room.isHostPaused,
      type: data.type || 'heartbeat',
    });
  });

  // --------------------------------------------------
  // updateRoomMeta – host changes the video mid-session
  // --------------------------------------------------
  socket.on('updateRoomMeta', function (data) {
    var code = (data.roomCode || '').toUpperCase();
    var room = rooms.get(code);
    if (!room) return;

    // Only the host can update metadata
    if (room.hostSocketId !== socket.id) return;

    // Merge updated fields
    if (data.videoUrl !== undefined) room.videoUrl = data.videoUrl;
    if (data.videoTitle !== undefined) room.videoTitle = data.videoTitle;
    if (data.videoThumbnail !== undefined) room.videoThumbnail = data.videoThumbnail;
    if (data.source !== undefined) room.source = data.source;
    if (data.videoDuration !== undefined) room.videoDuration = data.videoDuration;

    // Reset playback position for the new video
    room.hostTime = 0;
    room.isHostPaused = true;

    console.log('[updateRoomMeta] room=%s newVideo=%s', code, room.videoTitle);

    // Notify viewers about the video change
    socket.to(code).emit('updateRoomMeta', {
      videoUrl: room.videoUrl,
      videoTitle: room.videoTitle,
      videoThumbnail: room.videoThumbnail,
      source: room.source,
      videoDuration: room.videoDuration,
    });
  });

  // --------------------------------------------------
  // reclaimRoom – host reconnects after a brief disconnect
  // --------------------------------------------------
  socket.on('reclaimRoom', function (data) {
    var code = (data.roomCode || '').toUpperCase();
    var room = rooms.get(code);

    if (!room) {
      socket.emit('joinError', { message: 'Room "' + code + '" no longer exists.' });
      return;
    }

    // Verify identity by host name (simple approach; can be upgraded to tokens)
    if (room.hostName !== data.hostName) {
      socket.emit('joinError', { message: 'Host name does not match.' });
      return;
    }

    // Cancel the disconnect timer if it's still pending
    if (room.disconnectTimer) {
      clearTimeout(room.disconnectTimer);
      room.disconnectTimer = null;
    }

    // Reassign the host socket
    room.hostSocketId = socket.id;
    socket.join(code);

    socket.data = socket.data || {};
    socket.data.hostedRoom = code;
    socket.data.name = data.hostName;

    console.log('[reclaimRoom] room=%s host=%s newSocket=%s', code, data.hostName, socket.id);

    socket.emit('roomCreated', { roomCode: code });

    // Notify viewers the host is back
    io.to(code).emit('hostReconnected', { hostName: room.hostName });
  });

  // --------------------------------------------------
  // disconnect – clean up rooms on socket disconnect
  // --------------------------------------------------
  socket.on('disconnect', function () {
    console.log('[disconnect] socket=%s', socket.id);

    var data = socket.data || {};

    // --- Host disconnected ---
    if (data.hostedRoom) {
      var code = data.hostedRoom;
      var room = rooms.get(code);

      if (room && room.hostSocketId === socket.id) {
        console.log('[hostDisconnect] room=%s – starting 30s grace period', code);

        // Start a 30-second grace period
        room.disconnectTimer = setTimeout(function () {
          console.log('[hostTimeout] room=%s – dissolving room', code);

          // Notify all remaining viewers
          io.to(code).emit('roomDissolved', {
            message: 'The host has left. This room has been closed.',
          });

          // Force all sockets out of the room
          io.in(code).socketsLeave(code);

          // Delete the room from the registry
          rooms.delete(code);
        }, 30000);
      }
    }

    // --- Viewer disconnected ---
    if (data.joinedRoom) {
      var viewerCode = data.joinedRoom;
      var viewerRoom = rooms.get(viewerCode);

      if (viewerRoom && data.name) {
        viewerRoom.viewers.delete(data.name);

        console.log('[viewerLeft] room=%s viewer=%s viewers=%d',
          viewerCode, data.name, viewerRoom.viewers.size);

        io.to(viewerCode).emit('viewerLeft', {
          name: data.name,
          viewerCount: viewerRoom.viewers.size,
        });
      }
    }
  });
});

// ============================================================================
// Start Server
// ============================================================================

server.listen(PORT, function () {
  console.log('');
  console.log('  🟢  Huddle Sync Server is running');
  console.log('  📡  Port: %d', PORT);
  console.log('  🕐  Started at: %s', new Date().toISOString());
  console.log('');
});
