import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { getRateLimitStats } from '@/lib/rate-limiter';
import { getCacheStats } from '@/lib/cache';
import { getRecentActivity } from '@/lib/activity-stream';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const redis = getRedisClient();

    // Check Redis connection
    let connected = true;
    try {
      await redis.ping();
    } catch (error) {
      connected = false;
    }

    if (!connected) {
      // Return demo data for Vercel preview
      return NextResponse.json({
        connected: true,
        demo: true,
        timestamp: Date.now(),
        rateLimit: {
          totalKeys: 3,
          topConsumers: [
            { ip: '192.168.1.1', requests: 42 },
            { ip: '10.0.0.5', requests: 23 },
            { ip: '192.168.1.3', requests: 17 },
          ],
          blockedRequests: 2,
          requestsPerMinute: 47,
        },
        cache: {
          hits: 142,
          misses: 38,
          total: 180,
          hitRatio: 79.4,
          cachedKeys: 25,
        },
        activity: Array.from({ length: 10 }, (_, i) => ({
          id: `demo-${i}`,
          timestamp: Date.now() - i * 10000,
          type: i % 3 === 0 ? 'rate_limited' : i % 2 === 0 ? 'cache_hit' : 'cache_miss',
          ip: `192.168.1.${(i % 5) + 1}`,
          prompt: `Sample prompt ${i + 1}`,
          cached: i % 3 !== 0,
          blocked: i % 3 === 0,
        })),
        keyDistribution: {
          rateLimit: 3,
          cache: 25,
          stats: 4,
          activity: 1,
        },
        totalKeys: 33,
      });
    }

    // Fetch all stats in parallel
    const [rateLimitStats, cacheStats, recentActivity, allKeys] = await Promise.all([
      getRateLimitStats(),
      getCacheStats(),
      getRecentActivity(20),
      redis.keys('*'),
    ]);

    // Count blocked requests from activity stream
    const blockedCount = recentActivity.filter((e) => e.blocked).length;

    // Calculate requests per minute (from recent activity)
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = recentActivity.filter(
      (e) => e.timestamp > oneMinuteAgo && e.type === 'request'
    ).length;

    // Key distribution
    const keyTypes = {
      rateLimit: allKeys.filter((k) => k.startsWith('ratelimit:')).length,
      cache: allKeys.filter((k) => k.startsWith('cache:')).length,
      stats: allKeys.filter((k) => k.startsWith('stats:')).length,
      activity: allKeys.filter((k) => k.startsWith('activity:')).length,
    };

    return NextResponse.json({
      connected: true,
      timestamp: Date.now(),
      rateLimit: {
        ...rateLimitStats,
        blockedRequests: blockedCount,
        requestsPerMinute: recentRequests,
      },
      cache: cacheStats,
      activity: recentActivity,
      keyDistribution: keyTypes,
      totalKeys: allKeys.length,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', connected: false },
      { status: 500 }
    );
  }
}
