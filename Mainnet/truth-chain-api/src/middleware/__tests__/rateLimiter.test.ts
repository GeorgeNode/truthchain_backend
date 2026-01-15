import request from 'supertest';
import express from 'express';
import { 
  globalLimiter, 
  authLimiter, 
  registrationLimiter, 
  verificationLimiter 
} from '../rateLimiter';

describe('Rate Limiter Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Global Rate Limiter', () => {
    it('should allow requests within the limit', async () => {
      app.get('/test', globalLimiter, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      app.get('/test', globalLimiter, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Authentication Rate Limiter', () => {
    it('should have stricter limits than global limiter', async () => {
      app.post('/auth', authLimiter, (req, res) => {
        res.json({ success: true });
      });

      // Make multiple requests
      const responses = await Promise.all(
        Array(12).fill(null).map(() => request(app).post('/auth'))
      );

      // Check that at least one was rate limited (after 10 requests)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Registration Rate Limiter', () => {
    it('should allow legitimate registration requests', async () => {
      app.post('/register', registrationLimiter, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/register')
        .send({ content: 'test' });

      expect(response.status).toBe(200);
    });
  });

  describe('Verification Rate Limiter', () => {
    it('should allow high volume of read requests', async () => {
      app.get('/verify', verificationLimiter, (req, res) => {
        res.json({ verified: true });
      });

      // Should allow many requests
      const responses = await Promise.all(
        Array(50).fill(null).map(() => request(app).get('/verify'))
      );

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(50);
    });
  });

  describe('Rate Limit Error Response', () => {
    it('should return proper error message when rate limited', async () => {
      // Create a very restrictive limiter for testing
      const testLimiter = express();
      testLimiter.use(express.json());
      
      const restrictiveLimiter = require('express-rate-limit').default({
        windowMs: 60000,
        max: 1,
        standardHeaders: true,
        message: { error: 'Rate limit exceeded' }
      });

      testLimiter.get('/test', restrictiveLimiter, (req, res) => {
        res.json({ success: true });
      });

      // First request should succeed
      await request(testLimiter).get('/test');

      // Second request should be rate limited
      const response = await request(testLimiter).get('/test');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });
  });
});
