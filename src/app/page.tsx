"use client";

import { useEffect, useState, useCallback } from "react";

type StatusType = "task_start" | "task_done" | "idle" | "info";

interface CurrentStatus {
  text: string;
  type: StatusType;
  updatedAt: string;
}

interface ActivityEntry {
  text: string;
  type: StatusType;
  timestamp: string;
}

interface StatusData {
  current: CurrentStatus | null;
  log: ActivityEntry[];
}

const MEMORY_HIGHLIGHTS = [
  "Prefers concise, direct responses",
  "Uses TypeScript and Next.js App Router",
  "Deploys on Vercel with KV storage",
  "Dark terminal aesthetic preferred",
  "Avoids over-engineering solutions",
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function StatusDot({ type }: { type: StatusType | undefined }) {
  const color =
    type === "task_start"
      ? "bg-green-400 shadow-green-400/50"
      : type === "idle"
      ? "bg-yellow-400 shadow-yellow-400/50"
      : type === "task_done" || type === "info"
      ? "bg-sky-400 shadow-sky-400/50"
      : "bg-gray-600";

  const animate = type === "task_start" ? "animate-pulse" : "";

  return (
    <span
      className={`inline-block w-3 h-3 rounded-full shadow-lg ${color} ${animate}`}
    />
  );
}

function typeBadge(type: StatusType): string {
  switch (type) {
    case "task_start":
      return "text-green-400";
    case "task_done":
      return "text-sky-400";
    case "idle":
      return "text-yellow-400";
    case "info":
      return "text-gray-400";
  }
}

function typeLabel(type: StatusType): string {
  switch (type) {
    case "task_start":
      return "START";
    case "task_done":
      return "DONE";
    case "idle":
      return "IDLE";
    case "info":
      return "INFO";
  }
}

export default function Dashboard() {
  const [data, setData] = useState<StatusData>({ current: null, log: [] });
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: StatusData = await res.json();
      setData(json);
      setLastFetch(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const { current, log } = data;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-100 px-4 py-8 md:px-8 max-w-3xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-white">
            Steve
          </span>
          <span className="text-xl">⚡</span>
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {lastFetch ? (
            <span>
              fetched{" "}
              <span className="text-gray-400">{timeAgo(lastFetch.toISOString())}</span>
              {" · "}
              <span className="text-gray-600">auto-refresh 15s</span>
            </span>
          ) : loading ? (
            <span className="text-gray-600">loading…</span>
          ) : null}
        </div>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm font-mono">
          error: {error}
        </div>
      )}

      {/* Current Status Card */}
      <section className="mb-6 p-5 bg-[#111111] border border-[#1f1f1f] rounded-xl">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">
          Current Status
        </div>
        <div className="flex items-center gap-3">
          <StatusDot type={current?.type} />
          <span className="text-lg font-semibold text-white">
            {loading && !current
              ? "Loading…"
              : current
              ? current.text
              : "Offline"}
          </span>
        </div>
        {current && (
          <div className="mt-3 text-xs text-gray-500 font-mono">
            Last seen:{" "}
            <span className="text-gray-400">{timeAgo(current.updatedAt)}</span>
            <span className="text-gray-700 mx-2">·</span>
            <span className="text-gray-600">
              {formatTime(current.updatedAt)}
            </span>
          </div>
        )}
      </section>

      {/* Activity Feed */}
      <section className="mb-6">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">
          Recent Activity
        </div>
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
          {log.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-600 text-sm font-mono">
              no activity yet
            </div>
          ) : (
            <ul className="divide-y divide-[#1a1a1a]">
              {log.slice(0, 20).map((entry, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <span
                    className={`text-[10px] font-mono font-bold mt-0.5 w-10 shrink-0 ${typeBadge(
                      entry.type
                    )}`}
                  >
                    {typeLabel(entry.type)}
                  </span>
                  <span className="text-sm text-gray-300 flex-1 leading-relaxed">
                    {entry.text}
                  </span>
                  <span className="text-[11px] font-mono text-gray-600 shrink-0 mt-0.5">
                    {timeAgo(entry.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Memory Highlights */}
      <section>
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">
          Memory Highlights
        </div>
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl px-5 py-4">
          <ul className="space-y-2">
            {MEMORY_HIGHLIGHTS.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="text-sky-500 mt-0.5">›</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 text-center text-[11px] font-mono text-gray-700">
        steve-dashboard · read-only view
      </footer>
    </main>
  );
}
