# TokenFlow — AI API Rate Limiter & Cache Analytics

A production-grade demonstration of advanced Valkey (Redis-compatible) patterns for API rate limiting and intelligent caching, built with Next.js 14.

**Built by Matt Whitney as part of BetterDB founding engineer application**

## 🎯 Features

### 1. Sliding Window Rate Limiting
- Implements precise rate limiting using Valkey sorted sets (`ZRANGEBYSCORE` pattern)
- 10 requests per minute per IP with smooth rolling windows
- Returns standard rate limit headers (`X-RateLimit-*`)
- Graceful degradation on Redis failures

### 2. Semantic Response Cache
- SHA-256 hash-based cache keys for prompt deduplication
- Configurable TTL (default: 1 hour)
- Real-time hit/miss ratio tracking with `INCR` counters
- Automatic cache warming demonstrations

### 3. Real-time Activity Stream
- Valkey Streams (`XADD`/`XREAD`) for live request tracking
- Auto-trimmed to last 100 events (`MAXLEN`)
- Event types: `request`, `cache_hit`, `cache_miss`, `rate_limited`

### 4. Analytics Dashboard
- Live metrics with 2-second auto-refresh
- Interactive charts (Recharts + Tailwind)
- Key distribution pie chart
- Top consumer tracking

### 5. Load Test Simulator
- One-click burst traffic generation (50 requests)
- Visual demonstration of rate limiting + cache warming
- Real-time result aggregation

## 🏗️ Architecture

```
Next.js 14 App Router (TypeScript)
├── Valkey/Redis (ioredis client)
│   ├── Sorted Sets → Rate limiting
│   ├── String keys → Semantic cache
│   ├── Streams → Activity feed
│   └── Counters → Hit/miss tracking
└── Tailwind CSS + Recharts → Dashboard
```

### Valkey Patterns Demonstrated

**Rate Limiting (Sliding Window)**
```redis
ZREMRANGEBYSCORE ratelimit:{ip} 0 {window_start}
ZCARD ratelimit:{ip}
ZADD ratelimit:{ip} {timestamp} {unique_id}
PEXPIRE ratelimit:{ip} {window_ms}
```

**Semantic Caching**
```redis
GET cache:{sha256(prompt)}
SETEX cache:{hash} {ttl} {response}
INCR stats:cache:hits
INCR stats:cache:misses
```

**Activity Stream**
```redis
XADD activity:stream MAXLEN ~ 100 * field1 value1 field2 value2
XREVRANGE activity:stream + - COUNT 20
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Valkey or Redis running on `localhost:6380`

### Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Configure Redis/Valkey**
```bash
cp .env.local.example .env.local
# Edit .env.local if your Valkey isn't on localhost:6380
```

3. **Run development server**
```bash
npm run dev
```

4. **Open dashboard**
```
http://localhost:3000
```

### Running Valkey Locally (Docker)

```bash
docker run -d --name valkey -p 6380:6379 valkey/valkey:latest
```

Or use Redis:
```bash
docker run -d --name redis -p 6380:6379 redis:latest
```

## 📦 Build for Production

```bash
npm run build
npm start
```

The build process validates:
- TypeScript type checking
- Next.js route compilation
- Client/server bundle optimization

## 🌐 Deployment to Vercel

### With Upstash Redis

1. **Create Upstash Redis database**
   - Go to [upstash.com](https://upstash.com)
   - Create a new Redis database
   - Copy the `REDIS_URL` connection string

2. **Deploy to Vercel**
```bash
vercel
```

3. **Set environment variables**
```bash
vercel env add REDIS_URL
# Paste your Upstash Redis URL: rediss://default:...@....upstash.io:6379
```

4. **Redeploy**
```bash
vercel --prod
```

## 🧪 API Endpoints

### `POST /api/generate`
Simulated AI text generation with rate limiting + caching

**Request:**
```json
{
  "prompt": "Explain quantum computing"
}
```

**Response (200):**
```json
{
  "response": "AI-generated text...",
  "cached": false,
  "rateLimit": {
    "remaining": 9,
    "resetAt": 1234567890
  }
}
```

**Rate Limited (429):**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": "2024-02-14T12:34:56Z"
}
```

### `GET /api/stats`
Real-time analytics dashboard data

**Response:**
```json
{
  "connected": true,
  "timestamp": 1234567890,
  "rateLimit": {
    "totalKeys": 5,
    "topConsumers": [{ "ip": "192.168.1.1", "requests": 8 }],
    "blockedRequests": 2,
    "requestsPerMinute": 15
  },
  "cache": {
    "hits": 42,
    "misses": 18,
    "total": 60,
    "hitRatio": 70.0,
    "cachedKeys": 12
  },
  "activity": [...],
  "keyDistribution": {...},
  "totalKeys": 25
}
```

### `POST /api/simulate`
Load test simulator (50 burst requests)

**Request:**
```json
{
  "count": 50
}
```

**Response:**
```json
{
  "summary": {
    "total": 50,
    "successful": 35,
    "blocked": 12,
    "cached": 18,
    "failed": 3
  },
  "results": [...]
}
```

## 🎨 Design Philosophy

- **Dark theme** with Tailwind's slate/zinc palette
- **Blue/green accents** for primary/secondary actions
- **Professional data visualization** (no placeholder data)
- **Graceful error handling** (connection status, loading states)
- **Responsive design** (mobile-friendly grid layouts)

## 🔍 BetterDB Integration Points

This demo showcases patterns that BetterDB can provide deeper observability into:

1. **Memory Profiling**: Track key space growth and TTL distributions
2. **Query Performance**: Analyze `ZRANGEBYSCORE` latencies under load
3. **Cache Optimization**: Identify hot keys and eviction patterns
4. **Stream Health**: Monitor consumer lag and throughput

## 📊 Key Metrics Tracked

- **Rate Limiting**: Requests/min, blocked requests, top consumers
- **Caching**: Hit ratio, hits/misses, cached keys count
- **Activity**: Real-time event stream with 100-event history
- **Key Distribution**: Visual breakdown by key type

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Database**: Valkey/Redis (via ioredis)
- **Hosting**: Vercel-ready

## 📝 License

MIT

---

**Built with ❤️ by Matt Whitney**  
*Demonstrating production-grade Valkey patterns for BetterDB*
