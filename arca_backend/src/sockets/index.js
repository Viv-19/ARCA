const setupSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join room for general compliance officers / central dashboard
    socket.on('join:dashboard', () => {
      console.log(`[Socket] Client ${socket.id} joined 'compliance-dashboard'`);
      socket.join('compliance-dashboard');
    });

    // Join room for a specific bank department (e.g. IT Security, Treasury)
    socket.on('join:department', (deptId) => {
      console.log(`[Socket] Client ${socket.id} joined 'department:${deptId}'`);
      socket.join(`department:${deptId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = setupSockets;
