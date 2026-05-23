const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

// Inject io into request object early, so routers can access it
app.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

// Express configuration & standard security middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: '*' })); // Allow requests from all origins (useful for frontend/AI services)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads as static content
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "ok", service: "arca-backend" });
});

// Import Router Modules
const documentRoutes = require('./routes/documents');
const mapRoutes = require('./routes/maps');
const departmentRoutes = require('./routes/departments');
const alertRoutes = require('./routes/alerts');
const auditLogRoutes = require('./routes/auditLogs');
const riskRoutes = require('./routes/risk');

// Register API Routes
app.use('/api/documents', documentRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/risk', riskRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler triggered:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

module.exports = app;
