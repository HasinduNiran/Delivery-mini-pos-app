const config = require('../config');

// 404 for unmatched routes.
function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Central error handler. `err.status` lets routes throw typed HTTP errors.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: err.publicMessage || err.message || 'Internal server error',
    ...(config.nodeEnv !== 'production' && status >= 500
      ? { stack: err.stack }
      : {}),
  });
}

// Helper to throw HTTP errors with a status code.
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.publicMessage = message;
  return e;
}

module.exports = { notFound, errorHandler, httpError };
