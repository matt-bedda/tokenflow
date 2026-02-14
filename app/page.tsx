'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

interface Stats {
  connected: boolean;
  demo?: boolean;
  timestamp: number;
  rateLimit: {
    totalKeys: number;
    topConsumers: Array<{ ip: string; requests: number }>;
    blockedRequests: number;
    requestsPerMinute: number;
  };
  cache: {
    hits: number;
    misses: number;
    total: number;
    hitRatio: number;
    cachedKeys: number;
  };
  activity: Array<{
    id: string;
    timestamp: number;
    type: string;
    ip: string;
    prompt?: string;
    cached?: boolean;
    blocked?: boolean;
  }>;
  keyDistribution: {
    rateLimit: number;
    cache: number;
    stats: number;
    activity: number;
  };
  totalKeys: number;
}

interface SimResult {
  summary: {
    total: number;
    successful: number;
    blocked: number;
    cached: number;
    failed: number;
  };
  results: Array<{
    success: boolean;
    status: number;
    cached?: boolean;
    blocked?: boolean;
    prompt?: string;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

function StatCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
    red: 'from-red-500/20 to-red-600/5 border-red-500/30',
    violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/30',
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-b p-5 ${colorMap[color]}`}>
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [history, setHistory] = useState<Array<{ time: string; rpm: number; hits: number; misses: number }>>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.connected) {
        setStats(data);
        setHistory((prev) => {
          const next = [
            ...prev,
            {
              time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              rpm: data.rateLimit.requestsPerMinute,
              hits: data.cache.hits,
              misses: data.cache.misses,
            },
          ];
          return next.slice(-30);
        });
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const runSimulation = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 50 }),
      });
      const data = await res.json();
      setSimResult(data);
      // Refresh stats after simulation
      await fetchStats();
    } catch (e) {
      console.error('Simulation failed:', e);
    }
    setSimulating(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-slate-400">Connecting to Valkey...</p>
        </div>
      </div>
    );
  }

  if (!stats?.connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center max-w-md">
          <p className="text-lg font-semibold text-red-400">Valkey Disconnected</p>
          <p className="mt-2 text-sm text-slate-400">Unable to connect to the Valkey instance. Check REDIS_URL configuration.</p>
        </div>
      </div>
    );
  }

  const pieData = Object.entries(stats.keyDistribution)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: name === 'rateLimit' ? 'Rate Limit' : name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

  const codeSnippets: Record<string, { title: string; code: string; description: string }> = {
    rateLimit: {
      title: 'Sliding Window Rate Limiter',
      description: 'Uses Valkey sorted sets (ZRANGEBYSCORE) for precise, O(log N) rate limiting with automatic window cleanup.',
      code: `// Sliding window rate limiter using sorted sets
ZREMRANGEBYSCORE ratelimit:{ip} 0 {windowStart}
ZCARD ratelimit:{ip}              // Count in window
ZADD ratelimit:{ip} {now} {id}    // Add request
PEXPIRE ratelimit:{ip} {windowMs} // Auto-cleanup`,
    },
    cache: {
      title: 'Semantic Response Cache',
      description: 'SHA-256 hash-based cache keys with TTL. Cache hits avoid redundant AI generation, reducing latency from ~200ms to <1ms.',
      code: `// Hash-based semantic cache
key = "cache:" + SHA256(prompt)
cached = GET {key}              // Check cache
if (!cached) {
  response = generateAI(prompt) // Generate
  SETEX {key} 3600 {response}   // Cache 1h
}
INCR stats:cache:hits           // Track metrics`,
    },
    stream: {
      title: 'Activity Stream',
      description: 'Valkey Streams (XADD/XREVRANGE) provide an append-only log of all API events with automatic trimming.',
      code: `// Activity stream with auto-trimming
XADD activity:stream MAXLEN ~ 100 *
  type "request" ip "192.168.1.1"
  cached "1" blocked "0"
  
// Read latest events
XREVRANGE activity:stream + - COUNT 20`,
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-blue-400">Token</span>
              <span className="text-emerald-400">Flow</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              AI API Rate Limiter & Cache Analytics • Built with{' '}
              <span className="text-emerald-400">Valkey</span> • Monitored with{' '}
              <a href="https://betterdb.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">
                BetterDB
              </a>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
              <LiveDot />
              <span className="text-xs font-medium text-emerald-400">Connected</span>
            </div>
            <span className="text-xs text-slate-600">{stats.totalKeys} keys</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Intro */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-sm text-slate-300 leading-relaxed">
            <span className="font-semibold text-white">TokenFlow</span> demonstrates production Valkey patterns:
            sliding window rate limiting via sorted sets, semantic response caching with SHA-256 keys,
            and real-time activity logging via Streams. Connect a Valkey instance to see it live,
            or explore the demo data below.{' '}
            <button
              onClick={() => setExpandedSection(expandedSection === 'rateLimit' ? null : 'rateLimit')}
              className="text-blue-400 hover:underline"
            >
              See the commands ↓
            </button>
          </p>
          {stats.demo && (
            <p className="mt-2 text-xs text-slate-500">
              🟡 Running in demo mode — no Valkey instance connected. Set <code className="text-slate-400">REDIS_URL</code> to enable live data.
            </p>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Requests / min" value={stats.rateLimit.requestsPerMinute} color="blue" />
          <StatCard label="Blocked" value={stats.rateLimit.blockedRequests} sub="Rate limited" color="red" />
          <StatCard
            label="Cache Hit Rate"
            value={`${stats.cache.hitRatio.toFixed(1)}%`}
            sub={`${stats.cache.hits} hits / ${stats.cache.misses} misses`}
            color="green"
          />
          <StatCard label="Cached Keys" value={stats.cache.cachedKeys} color="amber" />
          <StatCard label="Active IPs" value={stats.rateLimit.totalKeys} sub="Tracked consumers" color="violet" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Request History */}
          <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Request History (live)</h3>
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="rpmFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="rpm" stroke="#3b82f6" fill="url(#rpmFill)" name="Req/min" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-slate-600 text-sm">
                Collecting data points...
              </div>
            )}
          </div>

          {/* Key Distribution */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Key Distribution</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-slate-600 text-sm">No keys yet</div>
            )}
            <div className="mt-2 flex flex-wrap gap-3 justify-center">
              {pieData.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-400">{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Consumers + Live Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Consumers */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Top Consumers</h3>
            {stats.rateLimit.topConsumers.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.rateLimit.topConsumers} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis dataKey="ip" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Bar dataKey="requests" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-slate-600 text-sm">No rate limit data yet</div>
            )}
          </div>

          {/* Live Activity Feed */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Live Activity Feed</h3>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-hide">
              {stats.activity.length > 0 ? (
                stats.activity.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-1.5 text-xs">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        event.blocked
                          ? 'bg-red-500'
                          : event.cached
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <span className="text-slate-500 w-16 shrink-0">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false }) : '—'}
                    </span>
                    <span className="text-slate-300 font-mono">{event.ip}</span>
                    <span
                      className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        event.type === 'rate_limited'
                          ? 'bg-red-500/20 text-red-400'
                          : event.type === 'cache_hit'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : event.type === 'cache_miss'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {event.type.replace('_', ' ')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex h-[180px] items-center justify-center text-slate-600 text-sm">No activity yet — run a simulation!</div>
              )}
            </div>
          </div>
        </div>

        {/* Load Test Panel */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Load Test Panel</h3>
              <p className="text-sm text-slate-500">Simulate burst traffic to see rate limiting and caching in action</p>
            </div>
            <button
              onClick={runSimulation}
              disabled={simulating}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 px-6 py-2.5 text-sm font-medium text-white transition-colors"
            >
              {simulating ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Running...
                </span>
              ) : (
                '🚀 Simulate 50 Requests'
              )}
            </button>
          </div>

          {simResult && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <div className="rounded-lg bg-slate-800 p-3 text-center">
                <p className="text-2xl font-bold text-white">{simResult.summary.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{simResult.summary.successful}</p>
                <p className="text-xs text-slate-500">Successful</p>
              </div>
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{simResult.summary.blocked}</p>
                <p className="text-xs text-slate-500">Rate Limited</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{simResult.summary.cached}</p>
                <p className="text-xs text-slate-500">Cache Hits</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{simResult.summary.failed}</p>
                <p className="text-xs text-slate-500">Failed</p>
              </div>
            </div>
          )}
        </div>

        {/* Valkey Commands Used */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Valkey Commands Under the Hood</h3>
          <p className="text-sm text-slate-500 mb-4">
            Click to expand and see the Valkey data structures powering each feature.
          </p>
          <div className="space-y-3">
            {Object.entries(codeSnippets).map(([key, snippet]) => (
              <div key={key} className="rounded-lg border border-slate-800 overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === key ? null : key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-200">{snippet.title}</span>
                  <span className="text-slate-500 text-xs">{expandedSection === key ? '▲' : '▼'}</span>
                </button>
                {expandedSection === key && (
                  <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/80">
                    <p className="text-xs text-slate-400 mb-3">{snippet.description}</p>
                    <pre className="rounded-lg bg-black/40 p-4 text-xs text-emerald-300 font-mono overflow-x-auto">
                      {snippet.code}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BetterDB Integration Card */}
        <div className="rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 to-blue-500/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">
                📊 Deep Observability with{' '}
                <a href="https://betterdb.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">
                  BetterDB
                </a>
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                While this dashboard shows application-level metrics, BetterDB provides deep infrastructure-level observability
                into the Valkey instance powering TokenFlow — COMMANDLOG analysis showing every command executed,
                slowlog pattern detection, memory anomaly alerts, client connection tracking, and historical analytics
                that persist beyond restarts. Together, they give you full-stack visibility from API request to database command.
              </p>
              <div className="mt-4 flex gap-3">
                <a
                  href="https://betterdb.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-teal-600 hover:bg-teal-500 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Learn More →
                </a>
                <a
                  href="https://github.com/BetterDB-inc/monitor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-700 hover:border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 mt-12">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between text-xs text-slate-600">
          <p>
            Built by <span className="text-slate-400">Matt Whitney</span> as part of a{' '}
            <a href="https://betterdb.com" target="_blank" rel="noopener noreferrer" className="text-teal-500 hover:underline">
              BetterDB
            </a>{' '}
            founding engineer application
          </p>
          <p>Powered by Valkey 8.1 + Next.js</p>
        </div>
      </footer>
    </div>
  );
}
