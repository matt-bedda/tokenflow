import { createHash } from 'crypto';
import { getRedisClient } from './redis';

/**
 * Generate cache key from prompt
 */
export function getCacheKey(prompt: string): string {
  const hash = createHash('sha256').update(prompt).digest('hex');
  return `cache:${hash}`;
}

/**
 * Get cached response
 */
export async function getCachedResponse(prompt: string): Promise<string | null> {
  const redis = getRedisClient();
  const key = getCacheKey(prompt);

  try {
    const cached = await redis.get(key);
    
    if (cached) {
      // Increment cache hits counter
      await redis.incr('stats:cache:hits');
    } else {
      // Increment cache misses counter
      await redis.incr('stats:cache:misses');
    }

    return cached;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set cached response with TTL
 */
export async function setCachedResponse(
  prompt: string,
  response: string,
  ttlSeconds: number = 3600
): Promise<void> {
  const redis = getRedisClient();
  const key = getCacheKey(prompt);

  try {
    await redis.setex(key, ttlSeconds, response);
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  const redis = getRedisClient();

  try {
    const [hits, misses, cacheKeys] = await Promise.all([
      redis.get('stats:cache:hits').then((v) => parseInt(v || '0')),
      redis.get('stats:cache:misses').then((v) => parseInt(v || '0')),
      redis.keys('cache:*').then((keys) => keys.length),
    ]);

    const total = hits + misses;
    const hitRatio = total > 0 ? (hits / total) * 100 : 0;

    return {
      hits,
      misses,
      total,
      hitRatio,
      cachedKeys: cacheKeys,
    };
  } catch (error) {
    console.error('Get cache stats error:', error);
    return {
      hits: 0,
      misses: 0,
      total: 0,
      hitRatio: 0,
      cachedKeys: 0,
    };
  }
}
