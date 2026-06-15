const { connectDB, mongoose } = require('./db');
const createApp = require('./app');
const config = require('./config');

async function start() {
  await connectDB();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on :${config.port} (${config.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
