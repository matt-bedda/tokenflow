import { getRedisClient } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Sliding window rate limiter using Redis sorted sets
 * @param key - Unique identifier (e.g., IP address)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const rateLimitKey = `ratelimit:${key}`;

  try {
    // Remove old entries outside the window
    await redis.zremrangebyscore(rateLimitKey, 0, windowStart);

    // Count requests in current window
    const count = await redis.zcard(rateLimitKey);

    if (count >= limit) {
      // Get the oldest request timestamp to calculate reset time
      const oldest = await redis.zrange(rateLimitKey, 0, 0, 'WITHSCORES');
      const resetAt = oldest.length > 1 
        ? parseInt(oldest[1]) + windowMs 
        : now + windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add current request
    await redis.zadd(rateLimitKey, now, `${now}-${Math.random()}`);
    
    // Set expiry on the key (cleanup)
    await redis.pexpire(rateLimitKey, windowMs);

    return {
      allowed: true,
      remaining: limit - count - 1,
      resetAt: now + windowMs,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow request if Redis fails
    return {
      allowed: true,
      remaining: limit,
      resetAt: now + windowMs,
    };
  }
}

export async function getRateLimitStats() {
  const redis = getRedisClient();
  
  try {
    // Get all rate limit keys
    const keys = await redis.keys('ratelimit:*');
    const now = Date.now();
    
    const stats = {
      totalKeys: keys.length,
      topConsumers: [] as Array<{ ip: string; requests: number }>,
    };

    // Get top consumers
    const consumerData = await Promise.all(
      keys.slice(0, 10).map(async (key) => {
        const count = await redis.zcard(key);
        return {
          ip: key.replace('ratelimit:', ''),
          requests: count,
        };
      })
    );

    stats.topConsumers = consumerData
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    return stats;
  } catch (error) {
    console.error('Get rate limit stats error:', error);
    return {
      totalKeys: 0,
      topConsumers: [],
    };
  }
}
