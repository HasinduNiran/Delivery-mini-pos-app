const mongoose = require('mongoose');
const config = require('./config');

mongoose.set('strictQuery', true);

async function connectDB() {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  console.log('[db] connected to MongoDB');
  return mongoose.connection;
}

module.exports = { connectDB, mongoose };
