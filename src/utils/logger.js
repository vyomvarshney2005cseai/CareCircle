const pino = require('pino');
const config = require('../config');

const isTest = config.env === 'test';

const logger = pino({
  level: isTest ? 'silent' : config.logLevel,
  base: { service: 'carecircle' },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
