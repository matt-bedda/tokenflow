# Testing Guide

## Local Testing

### 1. Start Valkey/Redis

**Using Docker (Recommended)**:

```bash
# Valkey (Redis-compatible)
docker run -d --name valkey -p 6380:6379 valkey/valkey:latest

# Or use Redis
docker run -d --name redis -p 6380:6379 redis:latest
```

**Verify it's running**:
```bash
docker ps | grep valkey
```

### 2. Test Redis Connection

```bash
npm run test:redis
```

Expected output:
```
Testing Redis/Valkey connection...

✅ Connection successful: PONG
✅ Write/Read test: Hello from TokenFlow!
✅ Sorted set test: 1 entries
✅ Stream test: 1 entries

✨ All tests passed! Redis/Valkey is ready.
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Test API Endpoints

**Generate Endpoint (Rate Limited)**:
```bash
# First request (should succeed)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is the meaning of life?"}'

# Expected response:
# {
#   "response": "Here's an AI-generated response...",
#   "cached": false,
#   "rateLimit": {
#     "remaining": 9,
#     "resetAt": 1234567890
#   }
# }

# Second identical request (should be cached)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is the meaning of life?"}'

# Expected response includes:
# "cached": true
```

**Stats Endpoint**:
```bash
curl http://localhost:3000/api/stats | jq
```

**Simulate Load Test**:
```bash
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"count":50}' | jq
```

### 5. Test Rate Limiting

Run rapid requests to trigger rate limiting:

```bash
# Bash script to send 15 rapid requests (limit is 10/min)
for i in {1..15}; do
  echo "Request $i:"
  curl -X POST http://localhost:3000/api/generate \
    -H "Content-Type: application/json" \
    -d "{\"prompt\":\"Request $i\"}" \
    -w "\nStatus: %{http_code}\n\n"
  sleep 0.1
done
```

Expected behavior:
- First 10 requests: HTTP 200
- Requests 11-15: HTTP 429 (Rate Limited)

### 6. Test Cache Behavior

Send the same prompt multiple times:

```bash
# First request - cache miss
time curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain quantum computing"}' | jq '.cached'

# Second request - cache hit (should be faster)
time curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain quantum computing"}' | jq '.cached'
```

### 7. Inspect Redis Data

**Using redis-cli**:
```bash
# Connect to Valkey/Redis
docker exec -it valkey redis-cli

# View all keys
KEYS *

# Check rate limit keys
KEYS ratelimit:*
ZRANGE ratelimit:127.0.0.1 0 -1 WITHSCORES

# Check cache keys
KEYS cache:*
GET cache:{some-hash}

# Check cache stats
GET stats:cache:hits
GET stats:cache:misses

# Check activity stream
XREVRANGE activity:stream + - COUNT 10

# Exit
exit
```

### 8. Dashboard Testing Checklist

- [ ] Dashboard loads without errors
- [ ] Shows "Connected" status (not "Connecting..." or error)
- [ ] Stat cards display numbers
- [ ] Cache analytics shows hit ratio
- [ ] Top consumers list populates after requests
- [ ] Live activity feed updates in real-time
- [ ] Key distribution pie chart appears
- [ ] Load test button works
- [ ] Valkey commands expandable sections toggle
- [ ] BetterDB card displays correctly
- [ ] Auto-refresh works (stats update every 2 seconds)

### 9. Cross-Browser Testing

Test in:
- [ ] Chrome/Brave
- [ ] Firefox
- [ ] Safari (if on Mac)
- [ ] Mobile browser (responsive design)

### 10. Performance Testing

**Measure Response Times**:
```bash
# Cache miss (first request)
time curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"New prompt here"}'

# Cache hit (second request)
time curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"New prompt here"}'
```

Cache hits should be significantly faster (no AI generation).

**Load Test**:
```bash
# Use the built-in simulator
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"count":100}' | jq '.summary'
```

## Production Testing

After deploying to Vercel:

### 1. Verify Deployment

```bash
# Check if site is live
curl https://your-app.vercel.app

# Test API
curl -X POST https://your-app.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Production test"}'
```

### 2. Monitor Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com)
2. Select your database
3. Watch metrics during testing:
   - Commands per second
   - Memory usage
   - Key count

### 3. Check Vercel Logs

```bash
# Using Vercel CLI
vercel logs --follow
```

Or in Vercel dashboard:
- Project → Deployments → Latest → Logs

## Troubleshooting

### Redis Connection Fails

**Symptom**: Dashboard shows "Connection Error"

**Fixes**:
1. Check Valkey/Redis is running:
   ```bash
   docker ps | grep valkey
   ```

2. Test connection manually:
   ```bash
   docker exec -it valkey redis-cli ping
   ```

3. Check `REDIS_URL` environment variable:
   ```bash
   echo $REDIS_URL
   # Should output: redis://localhost:6380
   ```

### Build Fails

**Run TypeScript Check**:
```bash
npx tsc --noEmit
```

**Check for Missing Dependencies**:
```bash
npm install
```

**Clean Build Cache**:
```bash
rm -rf .next node_modules
npm install
npm run build
```

### Rate Limiting Not Working

**Check Redis Keys**:
```bash
docker exec -it valkey redis-cli KEYS "ratelimit:*"
```

**Verify TTL is Set**:
```bash
docker exec -it valkey redis-cli TTL ratelimit:127.0.0.1
```

### Cache Not Working

**Check Cache Keys**:
```bash
docker exec -it valkey redis-cli KEYS "cache:*"
```

**Verify Same Prompt Hashes Identically**:
```bash
# In Node.js console
const crypto = require('crypto');
const prompt = "Your test prompt";
const hash = crypto.createHash('sha256').update(prompt).digest('hex');
console.log(`cache:${hash}`);
```

## Automated Testing (Future Enhancement)

### Unit Tests (Jest)

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom
```

Test files to create:
- `lib/__tests__/rate-limiter.test.ts`
- `lib/__tests__/cache.test.ts`
- `app/__tests__/page.test.tsx`

### E2E Tests (Playwright)

```bash
npm install -D @playwright/test
npx playwright install
```

Test scenarios:
- Dashboard loads
- API endpoints respond
- Rate limiting enforced
- Cache working

---

**Happy Testing! 🚀**
