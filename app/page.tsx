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
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#eab308', '#a855f7'];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [history, setHistory] = useState<Array<{ time: string; rpm: number }>>([]);
  const [openSnippet, setOpenSnippet] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.connected) {
        setStats(data);
        setHistory((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            rpm: data.rateLimit.requestsPerMinute,
          },
        ].slice(-30));
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
      setSimResult(await res.json());
      await fetchStats();
    } catch (e) {
      console.error(e);
    }
    setSimulating(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-neutral-500 text-sm font-mono">connecting...</p>
      </div>
    );
  }

  if (!stats?.connected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center space-y-2">
          <p className="text-neutral-400 text-sm">Valkey not connected</p>
          <p className="text-neutral-600 text-xs font-mono">check REDIS_URL</p>
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

  const snippets = [
    {
      id: 'ratelimit',
      label: 'Rate Limiting',
      desc: 'Sliding window via sorted sets — O(log N) per check, auto-expiry.',
      code: `ZREMRANGEBYSCORE ratelimit:{ip} 0 {windowStart}
ZCARD ratelimit:{ip}
ZADD ratelimit:{ip} {now} {requestId}
PEXPIRE ratelimit:{ip} 60000`,
    },
    {
      id: 'cache',
      label: 'Response Cache',
      desc: 'SHA-256 keyed, 1h TTL. Cache hit = <1ms vs ~200ms generation.',
      code: `GET cache:{sha256(prompt)}
SETEX cache:{sha256(prompt)} 3600 {response}
INCR stats:cache:hits`,
    },
    {
      id: 'stream',
      label: 'Activity Stream',
      desc: 'Append-only log with automatic trimming at 100 entries.',
      code: `XADD activity:stream MAXLEN ~ 100 * type request ip {ip}
XREVRANGE activity:stream + - COUNT 20`,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 antialiased">
      {/* Nav */}
      <nav className="border-b border-neutral-800/50 px-6 py-3 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold tracking-tight">TokenFlow</h1>
          <span className="text-[11px] text-neutral-600 font-mono">v1.0</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {stats.demo && (
            <span className="text-yellow-500/70 font-mono text-[11px]">demo</span>
          )}
          <span className="text-neutral-600 font-mono">{stats.totalKeys} keys</span>
          <span className="flex items-center gap-1.5 text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px]">connected</span>
          </span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Hero / Intro */}
        <section className="space-y-3">
          <p className="text-neutral-400 text-[15px] leading-relaxed max-w-2xl">
            Production Valkey patterns in action — sliding window rate limiting,
            semantic caching, and real-time event streams. Built as a{' '}
            <a href="https://betterdb.com" className="text-neutral-200 underline underline-offset-2 decoration-neutral-700 hover:decoration-neutral-400 transition-colors" target="_blank" rel="noopener noreferrer">
              BetterDB
            </a>{' '}
            integration demo.
          </p>
          {stats.demo && (
            <p className="text-neutral-600 text-xs font-mono">
              ↳ demo mode · set REDIS_URL for live data
            </p>
          )}
        </section>

        {/* Metrics row */}
        <section className="grid grid-cols-5 gap-px bg-neutral-800/30 rounded-lg overflow-hidden">
          {[
            { label: 'req/min', value: stats.rateLimit.requestsPerMinute },
            { label: 'blocked', value: stats.rateLimit.blockedRequests },
            { label: 'hit rate', value: `${stats.cache.hitRatio.toFixed(1)}%` },
            { label: 'cached', value: stats.cache.cachedKeys },
            { label: 'consumers', value: stats.rateLimit.totalKeys },
          ].map((m) => (
            <div key={m.label} className="bg-[#0a0a0a] p-4">
              <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-mono">{m.label}</p>
              <p className="text-2xl font-semibold text-neutral-100 mt-1 tabular-nums">{m.value}</p>
            </div>
          ))}
        </section>

        {/* Charts */}
        <section className="grid grid-cols-3 gap-6">
          {/* Throughput */}
          <div className="col-span-2 space-y-3">
            <h2 className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Throughput</h2>
            <div className="h-[180px]">
              {history.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#525252' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#525252' }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip
                      contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: '6px', fontSize: '12px' }}
                      labelStyle={{ color: '#737373' }}
                    />
                    <Area type="monotone" dataKey="rpm" stroke="#6366f1" strokeWidth={1.5} fill="url(#g)" name="req/min" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-700 text-xs font-mono">collecting...</div>
              )}
            </div>
          </div>

          {/* Key distribution */}
          <div className="space-y-3">
            <h2 className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Keys</h2>
            <div className="h-[140px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={2} dataKey="value" stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {pieData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name} <span className="text-neutral-400 tabular-nums">{d.value}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Activity + Top consumers side by side */}
        <section className="grid grid-cols-2 gap-6">
          {/* Activity */}
          <div className="space-y-3">
            <h2 className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Activity</h2>
            <div className="space-y-px rounded-lg overflow-hidden">
              {stats.activity.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center gap-3 bg-neutral-900/50 px-3 py-2 text-xs font-mono">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    e.blocked ? 'bg-red-500' : e.cached ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`} />
                  <span className="text-neutral-600 w-[72px] shrink-0">
                    {e.timestamp ? new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false }) : '—'}
                  </span>
                  <span className="text-neutral-400">{e.ip}</span>
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                    e.type === 'rate_limited' ? 'text-red-400 bg-red-500/10'
                    : e.type === 'cache_hit' ? 'text-emerald-400 bg-emerald-500/10'
                    : e.type === 'cache_miss' ? 'text-yellow-400 bg-yellow-500/10'
                    : 'text-neutral-500 bg-neutral-800'
                  }`}>
                    {e.type.replace('_', ' ')}
                  </span>
                </div>
              ))}
              {stats.activity.length === 0 && (
                <p className="text-neutral-700 text-xs font-mono py-8 text-center">no activity — run a simulation</p>
              )}
            </div>
          </div>

          {/* Top consumers */}
          <div className="space-y-3">
            <h2 className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Top Consumers</h2>
            {stats.rateLimit.topConsumers.length > 0 ? (
              <div className="space-y-2">
                {stats.rateLimit.topConsumers.map((c) => {
                  const max = stats.rateLimit.topConsumers[0].requests;
                  return (
                    <div key={c.ip} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-neutral-400">{c.ip}</span>
                        <span className="text-neutral-500 tabular-nums">{c.requests}</span>
                      </div>
                      <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500/60 rounded-full transition-all"
                          style={{ width: `${(c.requests / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-neutral-700 text-xs font-mono py-8 text-center">no data yet</p>
            )}
          </div>
        </section>

        {/* Load Test */}
        <section className="flex items-center justify-between py-4 border-t border-neutral-800/50">
          <div>
            <h2 className="text-sm font-medium text-neutral-200">Load Test</h2>
            <p className="text-xs text-neutral-600">Fire 50 burst requests to see rate limiting + caching in action</p>
          </div>
          <button
            onClick={runSimulation}
            disabled={simulating}
            className="text-sm font-medium px-4 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
          >
            {simulating ? 'Running...' : 'Run simulation →'}
          </button>
        </section>

        {simResult && (
          <section className="grid grid-cols-5 gap-px bg-neutral-800/30 rounded-lg overflow-hidden">
            {[
              { label: 'total', value: simResult.summary.total, color: 'text-neutral-100' },
              { label: 'ok', value: simResult.summary.successful, color: 'text-emerald-400' },
              { label: 'blocked', value: simResult.summary.blocked, color: 'text-red-400' },
              { label: 'cached', value: simResult.summary.cached, color: 'text-indigo-400' },
              { label: 'failed', value: simResult.summary.failed, color: 'text-yellow-400' },
            ].map((m) => (
              <div key={m.label} className="bg-[#0a0a0a] p-4">
                <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-mono">{m.label}</p>
                <p className={`text-2xl font-semibold mt-1 tabular-nums ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </section>
        )}

        {/* Implementation */}
        <section className="space-y-3 pt-4 border-t border-neutral-800/50">
          <h2 className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Implementation</h2>
          <div className="space-y-1">
            {snippets.map((s) => (
              <div key={s.id}>
                <button
                  onClick={() => setOpenSnippet(openSnippet === s.id ? null : s.id)}
                  className="w-full flex items-center justify-between py-2.5 px-1 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-300 group-hover:text-neutral-100 transition-colors">{s.label}</span>
                    <span className="text-[11px] text-neutral-600 font-mono hidden sm:inline">{s.desc}</span>
                  </div>
                  <span className="text-neutral-700 text-xs">{openSnippet === s.id ? '−' : '+'}</span>
                </button>
                {openSnippet === s.id && (
                  <pre className="text-[12px] font-mono text-indigo-300/80 bg-neutral-900/50 rounded-md p-4 mb-2 overflow-x-auto leading-relaxed">
                    {s.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* BetterDB */}
        <section className="pt-4 border-t border-neutral-800/50 space-y-2">
          <p className="text-neutral-500 text-sm leading-relaxed max-w-2xl">
            This dashboard shows app-level metrics.{' '}
            <a href="https://betterdb.com" className="text-neutral-300 underline underline-offset-2 decoration-neutral-700 hover:decoration-neutral-400 transition-colors" target="_blank" rel="noopener noreferrer">
              BetterDB
            </a>{' '}
            adds the infrastructure layer — COMMANDLOG analysis, slowlog patterns,
            memory anomaly detection, and historical persistence that survives restarts.
            Full-stack observability from API request to database command.
          </p>
          <div className="flex gap-3 pt-1">
            <a href="https://betterdb.com" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 decoration-neutral-700 transition-colors">
              betterdb.com
            </a>
            <a href="https://github.com/BetterDB-inc/monitor" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 decoration-neutral-700 transition-colors">
              github
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/30 mt-16 py-5">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[11px] text-neutral-700 font-mono">
          <span>matt whitney · betterdb application</span>
          <span>valkey 8.1 + next.js</span>
        </div>
      </footer>
    </div>
  );
}
