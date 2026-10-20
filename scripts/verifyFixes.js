'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { verifyTransporter } = require('../services/emailService');

async function testAll() {
  console.log('====================================================');
  console.log(' TRUSTHIRE DIAGNOSTIC & VERIFICATION SUITE');
  console.log('====================================================');

  // 1. Verify MongoDB Connection & Database Target
  console.log('\n[TEST 1] Testing Database Connection...');
  const conn = await connectDB();
  const dbName = conn.connection.name;
  console.log(`Connected to Database Name: "${dbName}"`);
  if (dbName !== 'trusthire') {
    throw new Error(`Expected database "trusthire", but connected to "${dbName}"`);
  }
  console.log('-> Database target test: PASSED (connected to trusthire)');

  // 2. Verify Data Preservation in trusthire DB
  console.log('\n[TEST 2] Verifying Preserved Data in "trusthire" DB...');
  const userCount = await User.countDocuments();
  const profileCount = await conn.connection.db.collection('studentprofiles').countDocuments();
  const historyCount = await conn.connection.db.collection('scorehistories').countDocuments();
  const taskCount = await conn.connection.db.collection('scoreboostertasks').countDocuments();

  console.log(`- Users count in trusthire: ${userCount}`);
  console.log(`- Student profiles count in trusthire: ${profileCount}`);
  console.log(`- Score histories count in trusthire: ${historyCount}`);
  console.log(`- Score booster tasks count in trusthire: ${taskCount}`);

  if (userCount === 0) {
    throw new Error('User count in trusthire is 0! Data migration failed or incomplete.');
  }
  console.log('-> Data preservation test: PASSED');

  // 3. Verify Email Transporter Authentication
  console.log('\n[TEST 3] Verifying Nodemailer Transporter with Gmail SMTP...');
  await verifyTransporter();
  console.log('-> Gmail SMTP authentication test: PASSED (credentials verified successfully with Google)');

  console.log('\n====================================================');
  console.log(' ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================');

  await mongoose.disconnect();
}

testAll().catch((err) => {
  console.error('\n[VERIFICATION FAILED]:', err.message);
  process.exit(1);
});
