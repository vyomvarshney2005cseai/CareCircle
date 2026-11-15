const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const apiRouter = require('./routes/apiRouter');
const taskRoutes = require('./routes/taskRoutes');

const app = express();

// Security headers with Helmet (strict CSP without unsafe-inline)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com']
      }
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    crossOriginEmbedderPolicy: false
  })
);

// Standard Permissions-Policy Header (microphone for Web Speech assistant)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=(self)');
  next();
});

// Strict CORS locked down
app.use(
  cors({
    origin: true, // Echo origin or same-origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
);

// Logging HTTP requests with Pino
if (config.env !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/healthz'
      }
    })
  );
}

// Body and Cookie parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(config.cookieSecret));

// Gzip compression for all outgoing HTTP responses
app.use(compression());

// Health check endpoint (for Cloud Run & Docker)
app.get(['/healthz', '/api/healthz'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dataStore: config.dataStore,
    commit: process.env.COMMIT_SHA || process.env.K_REVISION || 'main',
    version: '1.0.0'
  });
});

// Cloud Scheduler task triggers
app.use('/tasks', taskRoutes);

// REST API with rate limiting
app.use('/api', apiLimiter, apiRouter);

// Static frontend from /public with HTTP caching headers
const publicDir = path.join(__dirname, '..', 'public');
app.use(
  express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      }
    },
    etag: true
  })
);

// Fallback to index.html for SPA routing on non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/tasks')) {
    return next();
  }
  return res.sendFile(path.join(publicDir, 'index.html'));
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
