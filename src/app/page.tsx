"use client";

import { useEffect, useState, useCallback } from "react";

type StatusType = "task_start" | "task_done" | "idle" | "info";
type ActivitySource = "reece" | "steve" | "cron";
type TaskStatus = "todo" | "in_progress" | "done";
type TaskCategory = "build" | "research" | "design" | "bug";
type Tab = "brain" | "tasks" | "activity";

interface CurrentStatus {
  text: string;
  type: StatusType;
  updatedAt: string;
}

interface ActivityEntry {
  text: string;
  type: StatusType;
  timestamp: string;
  source?: ActivitySource;
}

interface StatusData {
  current: CurrentStatus | null;
  log: ActivityEntry[];
}

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  category: TaskCategory;
  createdAt: string;
  completedAt?: string;
  githubIssue?: number;
}

interface TasksData {
  tasks: Task[];
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

const CATEGORY_STYLES: Record<TaskCategory, string> = {
  build: "bg-sky-950 text-sky-400 border-sky-800",
  research: "bg-violet-950 text-violet-400 border-violet-800",
  design: "bg-pink-950 text-pink-400 border-pink-800",
  bug: "bg-red-950 text-red-400 border-red-800",
};

function PriorityDots({ priority }: { priority: number }) {
  return (
    <span className="flex gap-0.5 items-center">
      {[1, 2, 3].map((p) => (
        <span
          key={p}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            p <= priority ? "bg-orange-400" : "bg-gray-700"
          }`}
        />
      ))}
    </span>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-3 hover:border-[#2a2a2a] transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm text-gray-200 leading-snug flex-1">{task.title}</span>
        <PriorityDots priority={task.priority} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
            CATEGORY_STYLES[task.category]
          }`}
        >
          {task.category}
        </span>
        {task.githubIssue && (
          <span className="text-[10px] font-mono text-sky-600">
            #{task.githubIssue}
          </span>
        )}
        <span className="text-[10px] font-mono text-gray-600 ml-auto">
          {timeAgo(task.createdAt)}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  tasks,
  accentClass,
}: {
  title: string;
  tasks: Task[];
  accentClass: string;
}) {
  const [doneExpanded, setDoneExpanded] = useState(false);
  const isDone = title === "Done";
  const displayTasks = isDone && !doneExpanded ? tasks.slice(0, 10) : tasks;
  const hidden = isDone && tasks.length > 10 && !doneExpanded;

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-mono font-bold uppercase tracking-widest ${accentClass}`}>
          {title}
        </span>
        <span className="text-xs font-mono text-gray-600 bg-[#111111] border border-[#1f1f1f] rounded px-1.5 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {displayTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="text-[11px] font-mono text-gray-700 text-center py-6 bg-[#111111] border border-[#1f1f1f] rounded-lg">
            empty
          </div>
        )}
        {hidden && (
          <button
            onClick={() => setDoneExpanded(true)}
            className="w-full text-[11px] font-mono text-gray-600 hover:text-gray-400 py-2 transition-colors"
          >
            +{tasks.length - 10} more
          </button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("brain");
  const [data, setData] = useState<StatusData>({ current: null, log: [] });
  const [tasksData, setTasksData] = useState<TasksData>({ tasks: [] });
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

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TasksData = await res.json();
      setTasksData(json);
    } catch {
      // non-blocking; tasks tab will show empty state
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchTasks();
    const interval = setInterval(() => {
      fetchStatus();
      fetchTasks();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchTasks]);

  const { current, log } = data;
  const { tasks } = tasksData;

  const todo = tasks.filter((t) => t.status === "todo").sort((a, b) => b.priority - a.priority);
  const inProgress = tasks.filter((t) => t.status === "in_progress").sort((a, b) => b.priority - a.priority);
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime());

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-100 px-4 py-8 md:px-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-white">Steve</span>
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

      {/* Tab Nav */}
      <nav className="flex gap-1 mb-6 bg-[#111111] border border-[#1f1f1f] rounded-lg p-1 w-fit">
        {(["brain", "tasks", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-widest transition-colors ${
              tab === t
                ? "bg-[#1f1f1f] text-white"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm font-mono">
          error: {error}
        </div>
      )}

      {tab === "brain" && (
        <>
          {/* Current Status Card */}
          <section className="mb-6 p-5 bg-[#111111] border border-[#1f1f1f] rounded-xl">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">
              Current Status
            </div>
            <div className="flex items-center gap-3">
              <StatusDot type={current?.type} />
              <span className="text-lg font-semibold text-white">
                {loading && !current ? "Loading…" : current ? current.text : "Offline"}
              </span>
            </div>
            {current && (
              <div className="mt-3 text-xs text-gray-500 font-mono">
                Last seen:{" "}
                <span className="text-gray-400">{timeAgo(current.updatedAt)}</span>
                <span className="text-gray-700 mx-2">·</span>
                <span className="text-gray-600">{formatTime(current.updatedAt)}</span>
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
        </>
      )}

      {tab === "tasks" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KanbanColumn title="Todo" tasks={todo} accentClass="text-gray-400" />
          <KanbanColumn title="In Progress" tasks={inProgress} accentClass="text-green-400" />
          <KanbanColumn title="Done" tasks={done} accentClass="text-sky-400" />
        </div>
      )}

      {tab === "activity" && (
        <section>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">
            Activity Log
          </div>
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
            {log.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-600 text-sm font-mono">
                no activity yet
              </div>
            ) : (
              <ul className="divide-y divide-[#1a1a1a]">
                {log.slice(0, 100).map((entry, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span
                      className={`text-[10px] font-mono font-bold mt-0.5 w-10 shrink-0 ${typeBadge(entry.type)}`}
                    >
                      {typeLabel(entry.type)}
                    </span>
                    <span className="text-sm text-gray-300 flex-1 leading-relaxed">
                      {entry.text}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          entry.source === "reece"
                            ? "bg-orange-950 text-orange-400 border-orange-800"
                            : entry.source === "cron"
                            ? "bg-violet-950 text-violet-400 border-violet-800"
                            : "bg-green-950 text-green-400 border-green-800"
                        }`}
                      >
                        {entry.source === "reece" ? "Reece" : entry.source === "cron" ? "Cron" : "Steve"}
                      </span>
                      <span
                        className="text-[11px] font-mono text-gray-600"
                        title={new Date(entry.timestamp).toLocaleString()}
                      >
                        {timeAgo(entry.timestamp)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-10 text-center text-[11px] font-mono text-gray-700">
        steve-dashboard · read-only view
      </footer>
    </main>
  );
}
