import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiting Middleware for TruthChain API
 * 
 * Implements multiple tiers of rate limiting:
 * 1. Global limiter - Prevents API abuse across all endpoints
 * 2. Auth limiter - Stricter limits for authentication endpoints
 * 3. Registration limiter - Moderate limits for content registration
 * 4. Verification limiter - Generous limits for read-only operations
 */

/**
 * Simple key generator - Uses wallet address if available, otherwise falls back to IP address
 * This allows us to track both anonymous and authenticated users
 */
const customKeyGenerator = (req: Request): string => {
  // Try to get wallet address from various sources
  const walletAddress = 
    req.body?.walletAddress || 
    req.query?.walletAddress || 
    req.params?.walletAddress ||
    req.headers['x-wallet-address'];

  // Use wallet address if available
  if (walletAddress && typeof walletAddress === 'string') {
    return `wallet_${walletAddress.toLowerCase()}`;
  }

  // Use the official ipKeyGenerator helper for IPv6 support
  const ip = req.ip || req.socket.remoteAddress || '';
  return ipKeyGenerator(ip);
};

/**
 * Custom handler for when rate limit is exceeded
 */
const rateLimitExceededHandler = (req: Request, res: Response) => {
  console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
  
  res.status(429).json({
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After')
  });
};

/**
 * GLOBAL RATE LIMITER
 * Applied to all API routes
 * Prevents basic abuse and DDoS attempts
 * 
 * Limit: 100 requests per 15 minutes per IP/wallet
 */
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: customKeyGenerator,
  handler: rateLimitExceededHandler,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/' || req.path === '/health';
  },
  message: {
    success: false,
    error: 'Too many requests from this IP/wallet, please try again later.'
  }
});

/**
 * AUTHENTICATION RATE LIMITER
 * Applied to authentication endpoints
 * Stricter limits to prevent brute force attacks
 * 
 * Limit: 50 requests per 15 minutes per IP/wallet
 * Note: Increased from 10 to accommodate React strict mode and legitimate retries
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 authentication attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  handler: rateLimitExceededHandler,
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  }
});

/**
 * REGISTRATION RATE LIMITER
 * Applied to content registration endpoints
 * Moderate limits to prevent spam while allowing legitimate use
 * 
 * Limit: 20 registrations per hour per wallet/IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  handler: rateLimitExceededHandler,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    error: 'Registration limit exceeded. You can register up to 20 items per hour.'
  }
});

/**
 * VERIFICATION RATE LIMITER
 * Applied to verification/read endpoints
 * Generous limits since these are read-only operations
 * 
 * Limit: 200 requests per 15 minutes per IP/wallet
 */
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 verifications per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  handler: rateLimitExceededHandler,
  skipSuccessfulRequests: true, // Only count failed requests
  message: {
    success: false,
    error: 'Verification limit exceeded. Please try again later.'
  }
});

/**
 * DEVELOPMENT MODE LIMITER
 * More generous limits for development/testing
 * Only active when NODE_ENV !== 'production'
 * 
 * Limit: 1000 requests per 15 minutes
 */
export const devLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Very generous for development
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'production', // Skip in production
  message: {
    success: false,
    error: 'Rate limit exceeded (dev mode)'
  }
});

/**
 * STRICT LIMITER
 * For sensitive operations that need extra protection
 * 
 * Limit: 5 requests per 15 minutes
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  handler: rateLimitExceededHandler,
  message: {
    success: false,
    error: 'This operation is rate limited to 5 requests per 15 minutes.'
  }
});

/**
 * Helper function to create custom rate limiter
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: customKeyGenerator,
    handler: rateLimitExceededHandler,
    message: {
      success: false,
      error: options.message || 'Rate limit exceeded'
    }
  });
};

// Export all limiters
export default {
  globalLimiter,
  authLimiter,
  registrationLimiter,
  verificationLimiter,
  devLimiter,
  strictLimiter,
  createRateLimiter
};
