# Deployment Guide

## Vercel Deployment

### Prerequisites
1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Upstash Redis**: Create a free Redis database at [upstash.com](https://upstash.com)

### Step-by-Step Deployment

#### 1. Set Up Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com)
2. Click "Create Database"
3. Choose:
   - **Name**: `tokenflow-db`
   - **Type**: Regional (or Global for multi-region)
   - **Region**: Closest to your users
4. Click "Create"
5. Copy the **REST API URL** (or standard Redis URL starting with `rediss://`)

#### 2. Deploy to Vercel (CLI Method)

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Navigate to project directory
cd ~/clawd/tokenflow

# Deploy to Vercel
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: tokenflow (or your choice)
# - Directory: ./
# - Override settings? No

# Set environment variable
vercel env add REDIS_URL
# When prompted, paste your Upstash Redis URL:
# rediss://default:YOUR_PASSWORD@YOUR_ENDPOINT.upstash.io:6379

# Choose environment: Production

# Deploy to production
vercel --prod
```

#### 3. Deploy to Vercel (Dashboard Method)

1. **Connect GitHub**:
   ```bash
   # Create a GitHub repository
   gh repo create tokenflow --public --source=. --remote=origin --push
   ```

2. **Import to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Configure project:
     - Framework Preset: Next.js
     - Root Directory: `./`
     - Build Command: `npm run build`
     - Output Directory: `.next`

3. **Add Environment Variable**:
   - In Vercel project settings → Environment Variables
   - Add `REDIS_URL` with your Upstash Redis connection string
   - Apply to: Production, Preview, Development

4. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete (~2 minutes)

### Verification

After deployment:

1. **Test the API**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/generate \
     -H "Content-Type: application/json" \
     -d '{"prompt":"Hello world"}'
   ```

2. **Check Dashboard**:
   - Visit `https://your-app.vercel.app`
   - Verify connection status (should show "Connected")
   - Run load test to generate sample data

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `REDIS_URL` | Yes | Upstash Redis connection string | `rediss://default:xxx@xxx.upstash.io:6379` |

### Custom Domain (Optional)

1. Go to Vercel project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. SSL certificate will be provisioned automatically

### Monitoring

**Built-in Vercel Metrics:**
- Go to your project → Analytics
- Monitor:
  - Response times
  - Error rates
  - Traffic patterns

**Upstash Redis Metrics:**
- Go to your Upstash database dashboard
- Monitor:
  - Memory usage
  - Command statistics
  - Key count

### Troubleshooting

**Build Fails**
- Check `package.json` has all dependencies
- Verify TypeScript compiles: `npm run build` locally
- Check Vercel build logs for specific errors

**Redis Connection Error**
- Verify `REDIS_URL` is set correctly in Vercel environment variables
- Test connection string locally:
  ```bash
  REDIS_URL="your-url" npm run dev
  ```
- Ensure Upstash database is active

**Rate Limiting Not Working**
- Check Vercel logs for Redis errors
- Verify Upstash database isn't overloaded
- Test with curl to isolate frontend issues

### Production Checklist

- [ ] Upstash Redis database created
- [ ] `REDIS_URL` environment variable set in Vercel
- [ ] Build succeeds locally (`npm run build`)
- [ ] Deployment successful on Vercel
- [ ] Dashboard loads and shows "Connected"
- [ ] API endpoint responds (`/api/generate`)
- [ ] Load test works
- [ ] Rate limiting enforced (test with burst requests)
- [ ] Cache working (repeated requests return cached results)

### Next Steps

After successful deployment:

1. **Share the Demo**:
   - Add URL to your resume/portfolio
   - Share with BetterDB team

2. **Monitor Performance**:
   - Watch Vercel analytics
   - Track Upstash Redis metrics
   - Optimize based on real usage

3. **Enhance (Optional)**:
   - Add authentication
   - Implement user-specific rate limits
   - Add more cache strategies
   - Integrate BetterDB (when available)

---

**Need Help?**
- Vercel Docs: https://vercel.com/docs
- Upstash Docs: https://docs.upstash.com
- Next.js Docs: https://nextjs.org/docs
