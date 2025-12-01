const mongoose = require('mongoose');
require('dotenv/config');
const monogUrI = process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(monogUrI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;