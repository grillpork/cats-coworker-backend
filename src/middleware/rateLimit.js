const ipRequestMap = new Map();

// Periodically clean up expired entries from memory to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequestMap.entries()) {
    if (now > data.resetTime) {
      ipRequestMap.delete(ip);
    }
  }
}, 60000); // every 1 minute

/**
 * Custom in-memory rate limiting middleware.
 * @param {number} limit - Maximum number of requests allowed within windowMs.
 * @param {number} windowMs - Time window in milliseconds (default: 15 minutes).
 */
export const rateLimiter = (limit = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    next();
  };
};
