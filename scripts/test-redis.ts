import { getRedisClient } from '../lib/redis';

async function testRedisConnection() {
  console.log('Testing Redis/Valkey connection...\n');

  const redis = getRedisClient();

  try {
    // Test connection
    const pong = await redis.ping();
    console.log('✅ Connection successful:', pong);

    // Test basic operations
    await redis.set('test:key', 'Hello from TokenFlow!');
    const value = await redis.get('test:key');
    console.log('✅ Write/Read test:', value);

    // Test sorted set (rate limiting pattern)
    const now = Date.now();
    await redis.zadd('test:ratelimit', now, `${now}-test`);
    const count = await redis.zcard('test:ratelimit');
    console.log('✅ Sorted set test:', count, 'entries');

    // Test streams (activity feed pattern)
    await redis.xadd(
      'test:stream',
      '*',
      'type',
      'test',
      'message',
      'Testing streams'
    );
    const entries = await redis.xrevrange('test:stream', '+', '-', 'COUNT', 1);
    console.log('✅ Stream test:', entries.length, 'entries');

    // Cleanup
    await redis.del('test:key', 'test:ratelimit', 'test:stream');
    console.log('\n✨ All tests passed! Redis/Valkey is ready.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed:', error);
    console.error('\nMake sure Redis/Valkey is running:');
    console.error('  docker run -d --name valkey -p 6380:6379 valkey/valkey:latest');
    console.error('or set REDIS_URL environment variable\n');
    process.exit(1);
  }
}

testRedisConnection();
