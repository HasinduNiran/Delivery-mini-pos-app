const crypto = require('crypto');
const config = require('../config');

// Constant-time comparison so the API key can't be guessed by timing.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = function apiKeyAuth(req, res, next) {
  const provided = req.get('x-api-key');
  if (!provided || !safeEqual(provided, config.apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};
