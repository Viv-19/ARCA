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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting — 100 requests per 15 minutes per IP
try {
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again after 15 minutes.' }
  });
  app.use('/api/', limiter);
  console.log('[ARCA Backend] Rate limiting enabled (300 req / 15 min per IP).');
} catch (e) {
  console.warn('[ARCA Backend] express-rate-limit not installed. Skipping rate limiter. Run: npm install express-rate-limit');
}

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
const pipelineRoutes = require('./routes/pipeline');

// Register API Routes
app.use('/api/documents', documentRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/pipeline', pipelineRoutes);

// Global Error Handler — Centralized with structured responses
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[Error Handler] ${req.method} ${req.originalUrl} — ${statusCode}:`, err.message);
  if (!isProduction) console.error(err.stack);

  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      ...(isProduction ? {} : { stack: err.stack })
    }
  });
});

module.exports = app;

