const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });

const port = process.env.PORT || 4000;

app.get('/', (req, res) => {
	res.send('<h1>WeWatcheD Server</h1>');
});

io.on('connection', (socket) => {
	// Connected Check 
	console.log('user connected');
	socket.emit('whoami', { id: socket.id });
	// Join to the room
	socket.on('joinmetothisroom', ({ roomid, name }) => {
		socket.join(roomid);
		socket.emit('joinmetothisroomsuccess', `${roomid} `);
		io.to(roomid).emit('someonejoined', name);
	});

	// Tell everyone who are here in the room
	socket.on('tell_everyone_who_joined', ({ allusers, roomid }) => {
		io.to(roomid).emit('who_joined', allusers);
	});

	// Check connection
	socket.on('msg', ({ data, roomid }) => {
		io.to(roomid).emit('msg', data);
	});

	// Get video state
	socket.on('videoStates', ({ videoState, roomid }) => {
		io.to(roomid).emit('videoStates', videoState);
	});

	// Disconnect Check 
	socket.on('disconnect', () => {
		console.log('user disconnected');
	});
});

server.listen(port, () => {
	console.log(`listening on ${port}`);
});
