import { getRedisClient } from './redis';

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: 'request' | 'rate_limited' | 'cache_hit' | 'cache_miss';
  ip: string;
  prompt?: string;
  cached?: boolean;
  blocked?: boolean;
}

const STREAM_KEY = 'activity:stream';
const MAX_STREAM_LENGTH = 100;

/**
 * Add event to activity stream
 */
export async function addActivityEvent(event: Omit<ActivityEvent, 'id' | 'timestamp'>): Promise<void> {
  const redis = getRedisClient();

  try {
    const eventData = {
      type: event.type,
      ip: event.ip,
      prompt: event.prompt || '',
      cached: event.cached ? '1' : '0',
      blocked: event.blocked ? '1' : '0',
      timestamp: Date.now().toString(),
    };

    // Add to stream
    await redis.xadd(
      STREAM_KEY,
      'MAXLEN',
      '~',
      MAX_STREAM_LENGTH,
      '*',
      ...Object.entries(eventData).flat()
    );
  } catch (error) {
    console.error('Add activity event error:', error);
  }
}

/**
 * Get recent activity events
 */
export async function getRecentActivity(count: number = 20): Promise<ActivityEvent[]> {
  const redis = getRedisClient();

  try {
    // Read latest entries from stream
    const entries = await redis.xrevrange(STREAM_KEY, '+', '-', 'COUNT', count);

    return entries.map(([id, fields]) => {
      const event: any = { id };
      
      // Parse fields array into object
      for (let i = 0; i < fields.length; i += 2) {
        event[fields[i]] = fields[i + 1];
      }

      return {
        id: event.id,
        timestamp: parseInt(event.timestamp || '0'),
        type: event.type,
        ip: event.ip,
        prompt: event.prompt || undefined,
        cached: event.cached === '1',
        blocked: event.blocked === '1',
      };
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    return [];
  }
}
