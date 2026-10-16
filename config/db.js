const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * Handles connection lifecycle, logs status, and avoids crashing ungracefully.
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trusthire';
    
    console.log(`[Database] Attempting connection to MongoDB at: ${mongoURI}`);
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    });

    console.log(`[Database] MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    console.warn(`[Database Warning] Please ensure MongoDB is running locally, or configure a valid MONGO_URI (e.g. MongoDB Atlas) in your .env file.`);
    // Do not call process.exit(1) in development so Express can continue running and serve health/status checks
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
