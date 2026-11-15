const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env, store: config.dataStore },
    `CareCircle service listening on port ${config.port}`
  );
});

// Graceful shutdown handling (Cloud Run sends SIGTERM)
function handleShutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received. Closing HTTP server gracefully...');
  server.close(() => {
    logger.info('HTTP server closed cleanly. Exiting process.');
    process.exit(0);
  });

  // Force shutdown if taking longer than 10s
  setTimeout(() => {
    logger.error('Forced shutdown timeout exceeded.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = server;
