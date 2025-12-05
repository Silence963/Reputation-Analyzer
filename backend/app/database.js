const { Sequelize, DataTypes } = require('sequelize');
const logger = require('./utils/logger');

// Database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME || 'repa_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    dialectOptions: {
      charset: process.env.DB_CHARSET || 'utf8mb4',
      timezone: process.env.DB_TIMEZONE || '+00:00',
    },
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      match: [
        /ConnectionError/,
        /ConnectionRefusedError/,
        /ConnectionTimedOutError/,
        /TimeoutError/,
      ],
      max: 3
    }
  }
);

module.exports = { sequelize, DataTypes };