// Load environment variables immediately before any other imports
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// Initialize Express application
const app = express();

// Establish MongoDB connection
connectDB();

// Core Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Request logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root Health & System Status Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    platform: 'TrustHire API',
    tagline: 'AI-Powered Evidence-Backed Candidate Verification & Placement Intelligence',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date(),
    endpoints: {
      health: '/api/health',
      parseResume: 'POST /api/profile/parse-resume',
      confirmProfile: 'POST /api/profile/confirm-profile',
      confirm: 'POST /api/profile/confirm',
      getProfile: 'GET /api/profile/user/:userId',
    },
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Mount Routes
const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profile', profileRoutes);

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Serve Static Frontend Assets (if built)
const path = require('path');
const fs = require('fs');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// 404 Route Handler for unmatched API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack || err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Server Listener
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` TrustHire Backend Engine running on port: ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Error] Port ${PORT} is already in use.`);
    console.error(`  Run this to find and kill the process:\n`);
    console.error(`    netstat -ano | findstr :${PORT}`);
    console.error(`    taskkill /PID <PID> /F\n`);
    console.error(`  Or kill all node processes with:\n`);
    console.error(`    taskkill /F /IM node.exe\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err.message);
});

module.exports = app;
