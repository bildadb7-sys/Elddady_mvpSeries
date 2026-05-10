import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { LIMITER_LUA_SCRIPT } from './limiterScript.js';

// Configuration Types
type RateLimitTier = 'FIREHOSE' | 'VAULT' | 'MEMBER';

interface RateConfig {
  capacity: number;
  ratePerSec: number; // calculated as capacity / window_seconds
}

const TIERS: Record<RateLimitTier, RateConfig> = {
  // Public GET: 5,000 req/min (Browsing)
  FIREHOSE: { capacity: 5000, ratePerSec: 5000 / 60 },
  // Login/Signup: 5 req/hour (Brute force protection)
  VAULT: { capacity: 5, ratePerSec: 5 / 3600 },
  // Authenticated: 500 req/min (API usage)
  MEMBER: { capacity: 500, ratePerSec: 500 / 60 },
};

export const createRateLimiter = (redis: Redis | null) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Defense in Depth: Fail Open
    // If Redis is down, allow traffic to prevent outage
    if (!redis || redis.status !== 'ready') {
      return next();
    }

    // 1. Determine Tier & Identifier
    let tier: RateLimitTier = 'FIREHOSE';
    // Fix: Cast req to any to access ip property
    let identifier = (req as any).ip || 'unknown';

    // Check for Auth (Token usually attached by previous verifyToken middleware)
    const user = (req as any).user;

    if (user && user.id) {
      tier = 'MEMBER';
      identifier = `user:${user.id}`;
    } else if ((req as any).path === '/api/auth/login' || (req as any).path === '/api/auth/signup') {
      tier = 'VAULT';
      identifier = `ip:${(req as any).ip}`; // Strict IP limiting for auth endpoints
    } else {
      tier = 'FIREHOSE';
      identifier = `ip:${(req as any).ip}`;
    }

    const config = TIERS[tier];
    const key = `rate:${identifier}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      // 2. Execute Atomic Lua Script
      // This runs in a single network round-trip
      const allowed = await redis.eval(
        LIMITER_LUA_SCRIPT,
        1, // Number of keys
        key, // KEYS[1]
        config.capacity, // ARGV[1]
        config.ratePerSec, // ARGV[2]
        now, // ARGV[3]
        1 // ARGV[4] Cost
      );

      if (allowed === 1) {
        // Fix: Cast res to any to access setHeader
        (res as any).setHeader('X-RateLimit-Limit', config.capacity);
        return next();
      } else {
        console.warn(`[Security] Rate Limit Exceeded: ${identifier} on ${tier}`);
        // Fix: Cast res to any to access status
        return (res as any).status(429).json({
          error: 'Too Many Requests From This Device',
          retryAfter: 'Please wait before retrying.'
        });
      }
    } catch (err) {
      console.error('Rate Limiter Redis Error:', err);
      // Fail open
      next();
    }
  };
};