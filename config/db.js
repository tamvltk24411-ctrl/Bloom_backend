// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI. Hãy cấu hình biến này trong .env.');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`--> [MongoDB Atlas Connected]: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ Lỗi kết nối MongoDB: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;