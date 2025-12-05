#!/usr/bin/env node

/**
 * REPA Backend Startup Script
 * Handles environment setup and graceful startup
 */

const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Load environment variables
if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config();
} else {
  console.log('⚠️  No .env file found. Using default environment variables.');
  console.log('💡 Copy .env.example to .env and configure your database settings.');
}

// Check for required environment variables
const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  console.log('Using default values. Please configure your .env file for production.');
}

// Start the server
console.log('🚀 Starting REPA Backend Server...');
console.log(`📦 Node.js version: ${process.version}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

try {
  require('./server.js');
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}