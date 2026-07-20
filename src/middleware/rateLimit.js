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
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const now = Date.now();

    if (!ipRequestMap.has(ip)) {
      ipRequestMap.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    const data = ipRequestMap.get(ip);

    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
      return next();
    }

    data.count++;
    if (data.count > limit) {
      return res.status(429).json({
        error: "Too many requests from this IP, please try again later.",
      });
    }

    next();
  };
};
