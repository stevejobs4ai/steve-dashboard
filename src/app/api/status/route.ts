import { NextRequest, NextResponse } from "next/server";

type StatusType = "task_start" | "task_done" | "idle" | "info";

const VALID_TYPES: StatusType[] = ["task_start", "task_done", "idle", "info"];
const MAX_LOG_ENTRIES = 50;
const GIST_ID = process.env.GIST_ID!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

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

interface GistData {
  current: CurrentStatus | null;
  log: ActivityEntry[];
}

async function readGist(): Promise<GistData> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to read gist: ${res.status}`);
  const gist = await res.json();
  const content = gist.files["status.json"]?.content ?? '{"current":null,"log":[]}';
  return JSON.parse(content) as GistData;
}

async function writeGist(data: GistData): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "status.json": { content: JSON.stringify(data, null, 2) },
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
    console.error("GET /api/status error:", err);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.STEVE_TOKEN;
  const authHeader = req.headers.get("authorization");

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: unknown; type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text, type } = body;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text must be a non-empty string" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(type as StatusType)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const currentStatus: CurrentStatus = { text: text.trim(), type: type as StatusType, updatedAt: now };
  const newEntry: ActivityEntry = { text: text.trim(), type: type as StatusType, timestamp: now };

  const existing = await readGist();
  const updatedLog = [newEntry, ...existing.log].slice(0, MAX_LOG_ENTRIES);

  await writeGist({ current: currentStatus, log: updatedLog });

  return NextResponse.json({ ok: true });
}
