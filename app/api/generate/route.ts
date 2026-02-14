import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { getCachedResponse, setCachedResponse } from '@/lib/cache';
import { addActivityEvent } from '@/lib/activity-stream';

// Simulated AI text generation
function generateAIResponse(prompt: string): string {
  const responses = [
    `Here's an AI-generated response to "${prompt.substring(0, 30)}...": This is a simulated completion demonstrating cache and rate limiting patterns.`,
    `Based on your prompt "${prompt.substring(0, 30)}...", here's a generated response showing how Valkey efficiently handles repeated requests.`,
    `AI Response: Your query about "${prompt.substring(0, 30)}..." has been processed. This demonstrates semantic caching in action.`,
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';

    let connected = true;
    try {
      await getRedisClient().ping();
    } catch {
      connected = false;
    }

    if (!connected) {
      // Demo mode: simulate rate limiting and caching without Redis
      const demoResponses: Record<string, string> = {
        'What is the meaning of life?': '42. But seriously, meaning is subjective—find what resonates with you.',
        'Explain quantum computing': 'Quantum computing uses qubits that can exist in superposition, enabling parallel computation on massive scales.',
        'Write a haiku about code': 'Bugs appear at dusk / The keyboard clacks through the night / Coffee fuels the dawn.',
      };
      const response = demoResponses[prompt] || `Demo response to: "${prompt}" (connect Redis for full functionality)`;
      const isCacheHit = Object.keys(demoResponses).some((k) => demoResponses[k] === response);
      return NextResponse.json({
        response,
        cached: isCacheHit,
        rateLimit: {
          remaining: Math.floor(Math.random() * 10),
          resetAt: Date.now() + 30000,
        },
        demo: true,
      });
    }

    // Check rate limit (10 requests per minute)
    const rateLimit = await checkRateLimit(ip, 10, 60000);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
    };

    if (!rateLimit.allowed) {
      // Log rate limited event
      await addActivityEvent({
        type: 'rate_limited',
        ip,
        prompt: prompt.substring(0, 50),
        blocked: true,
      });

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: new Date(rateLimit.resetAt).toISOString(),
        },
        { status: 429, headers }
      );
    }

    // Check cache
    let response = await getCachedResponse(prompt);
    const fromCache = !!response;

    if (!response) {
      // Generate new response
      response = generateAIResponse(prompt);
      
      // Cache it for 1 hour
      await setCachedResponse(prompt, response, 3600);

      // Log cache miss
      await addActivityEvent({
        type: 'cache_miss',
        ip,
        prompt: prompt.substring(0, 50),
        cached: false,
      });
    } else {
      // Log cache hit
      await addActivityEvent({
        type: 'cache_hit',
        ip,
        prompt: prompt.substring(0, 50),
        cached: true,
      });
    }

    // Log successful request
    await addActivityEvent({
      type: 'request',
      ip,
      prompt: prompt.substring(0, 50),
      cached: fromCache,
    });

    return NextResponse.json(
      {
        response,
        cached: fromCache,
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
