import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TEST_PROMPTS = [
  'What is the meaning of life?',
  'Explain quantum computing',
  'Write a haiku about code',
  'What is the meaning of life?', // Duplicate to show cache
  'Explain machine learning',
  'What is the meaning of life?', // Another duplicate
];

export async function POST(request: NextRequest) {
  try {
    const { count = 50 } = await request.json();
    const results = [];

    // Get the base URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // Simulate burst of requests
    const promises = [];
    for (let i = 0; i < Math.min(count, 100); i++) {
      const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
      
      promises.push(
        fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Simulate different IPs for some variety
            'x-forwarded-for': `192.168.1.${(i % 10) + 1}`,
          },
          body: JSON.stringify({ prompt }),
        })
          .then(async (res) => {
            const data = await res.json();
            return {
              success: res.ok,
              status: res.status,
              cached: data.cached,
              blocked: res.status === 429,
              prompt: prompt.substring(0, 30),
            };
          })
          .catch((error) => ({
            success: false,
            status: 500,
            cached: false,
            blocked: false,
            error: error.message,
            prompt: prompt.substring(0, 30),
          }))
      );

      // Small delay between requests to avoid overwhelming the server
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Aggregate results
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      blocked: results.filter((r) => r.blocked).length,
      cached: results.filter((r) => r.cached).length,
      failed: results.filter((r) => !r.success && !r.blocked).length,
    };

    return NextResponse.json({
      summary,
      results: results.slice(0, 50), // Return first 50 results
    });
  } catch (error) {
    console.error('Simulate API error:', error);
    return NextResponse.json(
      { error: 'Simulation failed' },
      { status: 500 }
    );
  }
}
