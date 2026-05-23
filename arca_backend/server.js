require('dotenv').config();
const http = require('http');
const app = require('./src/app');

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.io with CORS allowances
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Expose io instance to Express app
app.set('io', io);

// Setup socket connection listeners
const setupSockets = require('./src/sockets');
setupSockets(io);

// Start listening
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[ARCA Backend] Service running on http://localhost:${PORT}`);
});
