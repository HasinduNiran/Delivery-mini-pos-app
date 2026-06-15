const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const apiKeyAuth = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const productsRouter = require('./routes/products');
const billsRouter = require('./routes/bills');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '256kb' }));
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Health check (no auth) for load balancers / uptime monitors.
  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Everything under /api requires the API key.
  app.use('/api', apiKeyAuth);
  app.use('/api/products', productsRouter);
  app.use('/api/bills', billsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
