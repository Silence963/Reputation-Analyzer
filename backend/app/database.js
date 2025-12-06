const { Sequelize, DataTypes } = require('sequelize');
const logger = require('./utils/logger');

// Database configuration - Remote nrktrn database
const sequelize = new Sequelize(
  process.env.DB_NAME || 'nrkindex_trn',
  process.env.DB_USER || 'nrktrn_web_admin',
  process.env.DB_PASSWORD || 'GOeg&*$*657',
  {
    host: process.env.DB_HOST || '88.150.227.117',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    dialectOptions: {
      charset: process.env.DB_CHARSET || 'utf8mb4',
      timezone: process.env.DB_TIMEZONE || '+00:00',
      connectTimeout: 60000
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