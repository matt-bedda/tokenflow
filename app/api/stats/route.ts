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
      return NextResponse.json(
        { error: 'Redis not connected', connected: false },
        { status: 503 }
      );
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
