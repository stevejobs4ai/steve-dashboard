"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "brain" | "tasks" | "activity";
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

interface TaskSection {
  title: string;
  emoji: string;
  colorKey: "red" | "yellow" | "green" | "sky";
  items: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diffMs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (s < 60) return `${s}s ago`;
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderMarkdown(md: string): string {
  function esc(t: string) {
    return t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function inline(t: string) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(
        /\[(.+?)\]\((https?:\/\/.+?)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#38bdf8">$1</a>'
      );
  }

  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  const codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${codeLines.map(esc).join("\n")}</code></pre>`);
        codeLines.length = 0;
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (line.startsWith("### "))
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith("## "))
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith("# "))
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (/^[-*] /.test(line))
      out.push(`<li>${inline(line.slice(2))}</li>`);
    else if (line.trim() === "") out.push(`<br>`);
    else out.push(`<p>${inline(line)}</p>`);
  }

  return out.join("");
}

function parseHeartbeat(md: string): TaskSection[] {
  const defs: { emoji: string; colorKey: TaskSection["colorKey"] }[] = [
    { emoji: "🔴", colorKey: "red" },
    { emoji: "🟡", colorKey: "yellow" },
    { emoji: "🟢", colorKey: "green" },
    { emoji: "✅", colorKey: "sky" },
  ];

  const sections: TaskSection[] = [];
  let current: TaskSection | null = null;

  for (const line of md.split("\n")) {
    const hMatch = line.match(/^#+\s+(.*)/);
    if (hMatch) {
      const title = hMatch[1];
      const def = defs.find((d) => title.includes(d.emoji));
      if (def) {
        current = { title, emoji: def.emoji, colorKey: def.colorKey, items: [] };
        sections.push(current);
        continue;
      }
    }
    if (current && /^[-*] /.test(line)) {
      current.items.push(line.slice(2).trim());
    }
  }

  return sections;
}

function buildFileTree(files: Record<string, string>) {
  const root: string[] = [];
  const dirs: Record<string, string[]> = {};

  for (const path of Object.keys(files).sort()) {
    if (!path.endsWith(".md")) continue;
    const slash = path.indexOf("/");
    if (slash === -1) {
      root.push(path);
    } else {
      const dir = path.slice(0, slash);
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir].push(path);
    }
  }

  return { root, dirs };
}

// ─── Shared components ────────────────────────────────────────────────────────

function StatusDot({ type }: { type?: StatusType }) {
  const cls =
    type === "task_start"
      ? "bg-green-400 animate-pulse"
      : type === "idle"
      ? "bg-yellow-400"
      : type === "task_done" || type === "info"
      ? "bg-sky-400"
      : "bg-gray-600";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="py-16 text-center">
      <div className="text-gray-500 text-sm font-mono mb-1">{message}</div>
      {sub && <div className="text-gray-700 text-xs">{sub}</div>}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="py-16 text-center text-gray-600 font-mono text-sm animate-pulse">
      {label}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-4 mt-4 px-4 py-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-400 text-sm font-mono">
      error: {message}
    </div>
  );
}

// ─── Brain Tab ────────────────────────────────────────────────────────────────

function BrainTab({
  files,
  loading,
  error,
  onRefresh,
}: {
  files: Record<string, string> | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return <LoadingState label="loading brain…" />;
  if (error) return <ErrorBanner message={error} />;

  if (!files || Object.keys(files).filter((k) => k.endsWith(".md")).length === 0) {
    return (
      <EmptyState
        message="no files synced yet"
        sub="POST to /api/sync to add workspace files"
      />
    );
  }

  if (selected !== null && files[selected] !== undefined) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a] sticky top-[53px] bg-[#0a0a0a] z-10">
          <button
            onClick={() => setSelected(null)}
            className="text-sky-400 text-sm font-mono hover:text-sky-300 transition-colors shrink-0"
          >
            ← back
          </button>
          <span className="text-gray-400 text-xs font-mono truncate">{selected}</span>
        </div>
        <div
          className="md-content px-4 py-4 pb-6"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(files[selected]) }}
        />
      </div>
    );
  }

  const { root, dirs } = buildFileTree(files);

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">
          Memory Files
        </div>
        <button
          onClick={onRefresh}
          className="text-xs font-mono text-gray-600 hover:text-gray-400 transition-colors"
        >
          refresh
        </button>
      </div>

      <div className="space-y-1.5">
        {root.map((path) => (
          <FileButton
            key={path}
            label={path}
            onClick={() => setSelected(path)}
          />
        ))}
      </div>

      {Object.entries(dirs).map(([dir, paths]) => (
        <div key={dir} className="mt-4">
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span className="text-gray-600 text-xs">▸</span>
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-widest">
              {dir}/
            </span>
          </div>
          <div className="space-y-1.5 pl-3">
            {paths.map((path) => (
              <FileButton
                key={path}
                label={path.split("/").pop()!}
                onClick={() => setSelected(path)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FileButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#111] border border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#161616] active:bg-[#1a1a1a] transition-all text-left"
    >
      <span className="text-gray-600 text-xs shrink-0">◻</span>
      <span className="text-gray-300 text-sm font-mono truncate">{label}</span>
      <span className="text-gray-700 text-xs ml-auto shrink-0">›</span>
    </button>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

const SECTION_STYLES: Record<
  TaskSection["colorKey"],
  { border: string; bg: string; text: string; dot: string }
> = {
  red: {
    border: "border-red-900/60",
    bg: "bg-red-950/30",
    text: "text-red-400",
    dot: "bg-red-400",
  },
  yellow: {
    border: "border-yellow-900/60",
    bg: "bg-yellow-950/30",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  green: {
    border: "border-green-900/60",
    bg: "bg-green-950/30",
    text: "text-green-400",
    dot: "bg-green-400",
  },
  sky: {
    border: "border-sky-900/60",
    bg: "bg-sky-950/30",
    text: "text-sky-400",
    dot: "bg-sky-400",
  },
};

function TasksTab({
  files,
  loading,
  error,
}: {
  files: Record<string, string> | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <LoadingState label="loading tasks…" />;
  if (error) return <ErrorBanner message={error} />;

  const heartbeat = files?.["HEARTBEAT.md"] ?? "";
  if (!heartbeat) {
    return (
      <EmptyState
        message="no HEARTBEAT.md found"
        sub="sync HEARTBEAT.md to see tasks"
      />
    );
  }

  const sections = parseHeartbeat(heartbeat);

  if (sections.length === 0) {
    return (
      <EmptyState
        message="no task sections parsed"
        sub="HEARTBEAT.md needs ## 🔴/🟡/🟢/✅ sections"
      />
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {sections.map((section) => {
        const s = SECTION_STYLES[section.colorKey];
        return (
          <div
            key={section.title}
            className={`rounded-xl border ${s.border} ${s.bg} overflow-hidden`}
          >
            <div className={`px-4 py-3 flex items-center gap-2 border-b ${s.border}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
              <span className={`text-sm font-bold font-mono ${s.text}`}>
                {section.title}
              </span>
              <span className="ml-auto text-xs font-mono text-gray-600">
                {section.items.length}
              </span>
            </div>
            {section.items.length === 0 ? (
              <div className="px-4 py-3 text-gray-700 text-xs font-mono italic">
                empty
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className={`mt-1 text-[10px] shrink-0 ${s.text}`}>›</span>
                    <span className="text-sm text-gray-300 leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<StatusType, { color: string; label: string }> = {
  task_start: { color: "text-green-400", label: "START" },
  task_done: { color: "text-sky-400", label: "DONE" },
  idle: { color: "text-yellow-400", label: "IDLE" },
  info: { color: "text-gray-500", label: "INFO" },
};

function ActivityTab({
  data,
  loading,
  error,
  lastFetch,
}: {
  data: StatusData;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}) {
  const { current, log } = data;

  return (
    <div className="px-4 py-4">
      {error && <ErrorBanner message={error} />}

      {/* Current Status Card */}
      <div className="mb-5 p-4 bg-[#111] border border-[#1f1f1f] rounded-xl">
        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">
          Current Status
        </div>
        <div className="flex items-center gap-3">
          <StatusDot type={current?.type} />
          <span className="text-base font-semibold text-white leading-snug">
            {loading && !current ? "Loading…" : current ? current.text : "Offline"}
          </span>
        </div>
        {current && (
          <div className="mt-2.5 text-xs text-gray-600 font-mono">
            last seen{" "}
            <span className="text-gray-400">{timeAgo(current.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2.5">
        Recent Activity
      </div>
      <div className="bg-[#111] border border-[#1f1f1f] rounded-xl overflow-hidden">
        {log.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-600 text-sm font-mono">
            no activity yet
          </div>
        ) : (
          <ul className="divide-y divide-[#181818]">
            {log.slice(0, 25).map((entry, i) => {
              const { color, label } = TYPE_STYLES[entry.type];
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.015] transition-colors"
                >
                  <span
                    className={`text-[10px] font-mono font-bold mt-0.5 w-9 shrink-0 ${color}`}
                  >
                    {label}
                  </span>
                  <span className="text-sm text-gray-300 flex-1 leading-relaxed">
                    {entry.text}
                  </span>
                  <span className="text-[11px] font-mono text-gray-600 shrink-0 mt-0.5">
                    {timeAgo(entry.timestamp)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {lastFetch && (
        <div className="mt-3 text-center text-[11px] font-mono text-gray-700">
          updated {timeAgo(lastFetch.toISOString())} · auto-refresh 15s
        </div>
      )}
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "brain", label: "Brain", icon: "🧠" },
  { id: "tasks", label: "Tasks", icon: "📋" },
  { id: "activity", label: "Activity", icon: "⚡" },
];

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("activity");

  // Brain / Tasks shared data
  const [brainFiles, setBrainFiles] = useState<Record<string, string> | null>(null);
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainError, setBrainError] = useState<string | null>(null);

  // Activity data
  const [statusData, setStatusData] = useState<StatusData>({ current: null, log: [] });
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchBrain = useCallback(async () => {
    setBrainLoading(true);
    setBrainError(null);
    try {
      const res = await fetch("/api/brain", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBrainFiles(json.files ?? {});
    } catch (e) {
      setBrainError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setBrainLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: StatusData = await res.json();
      setStatusData(json);
      setLastFetch(new Date());
      setStatusError(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Load brain data when tab is first accessed
  useEffect(() => {
    if (
      (activeTab === "brain" || activeTab === "tasks") &&
      brainFiles === null &&
      !brainLoading
    ) {
      fetchBrain();
    }
  }, [activeTab, brainFiles, brainLoading, fetchBrain]);

  // Keep activity data fresh
  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0a0a0a]/90 backdrop-blur-sm border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-white">Steve</span>
          <span>⚡</span>
        </div>
        <div className="text-[11px] font-mono text-gray-600 uppercase tracking-widest">
          {activeTab}
        </div>
      </header>

      {/* Tab content — padded at bottom so tab bar doesn't overlap */}
      <main className="pb-safe" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
        {activeTab === "brain" && (
          <BrainTab
            files={brainFiles}
            loading={brainLoading}
            error={brainError}
            onRefresh={fetchBrain}
          />
        )}
        {activeTab === "tasks" && (
          <TasksTab
            files={brainFiles}
            loading={brainLoading}
            error={brainError}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab
            data={statusData}
            loading={statusLoading}
            error={statusError}
            lastFetch={lastFetch}
          />
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d]/95 backdrop-blur-sm border-t border-[#1a1a1a] flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-2 transition-colors ${
                active ? "text-white" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span
                className={`text-[10px] font-mono uppercase tracking-widest ${
                  active ? "text-sky-400" : "text-gray-600"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
