import { NextRequest, NextResponse } from "next/server";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskCategory = "build" | "research" | "design" | "bug";

const VALID_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const VALID_CATEGORIES: TaskCategory[] = ["build", "research", "design", "bug"];
const GIST_ID = process.env.GIST_ID!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

export interface Task {
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

async function readGist(): Promise<TasksData> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to read gist: ${res.status}`);
  const gist = await res.json();
  const content = gist.files["tasks.json"]?.content ?? '{"tasks":[]}';
  return JSON.parse(content) as TasksData;
}

async function writeGist(data: TasksData): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "tasks.json": { content: JSON.stringify(data, null, 2) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Failed to write gist: ${res.status}`);
}

export async function GET() {
  try {
    const data = await readGist();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/tasks error:", err);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.STEVE_TOKEN;
  const authHeader = req.headers.get("authorization");

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: unknown; title?: unknown; status?: unknown; priority?: unknown; category?: unknown; githubIssue?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, title, status, priority, category, githubIssue } = body;

  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "id must be a non-empty string" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status as TaskStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }
  if (typeof priority !== "number") {
    return NextResponse.json({ error: "priority must be a number" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category as TaskCategory)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await readGist();
  const now = new Date().toISOString();
  const existingTask = existing.tasks.find((t) => t.id === id);

  const task: Task = {
    id: (id as string).trim(),
    title: (title as string).trim(),
    status: status as TaskStatus,
    priority: priority as number,
    category: category as TaskCategory,
    createdAt: existingTask?.createdAt ?? now,
    ...(status === "done" ? { completedAt: existingTask?.completedAt ?? now } : {}),
    ...(typeof githubIssue === "number" ? { githubIssue } : {}),
  };

  const tasks = existingTask
    ? existing.tasks.map((t) => (t.id === id ? task : t))
    : [...existing.tasks, task];

  await writeGist({ tasks });

  return NextResponse.json({ ok: true, task });
}
