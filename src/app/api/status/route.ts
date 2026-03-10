import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

type StatusType = "task_start" | "task_done" | "idle" | "info";

const VALID_TYPES: StatusType[] = ["task_start", "task_done", "idle", "info"];
const MAX_LOG_ENTRIES = 50;

export async function GET() {
  try {
    const [current, log] = await Promise.all([
      kv.get("current_status"),
      kv.get("activity_log"),
    ]);

    return NextResponse.json({
      current: current ?? null,
      log: (log as unknown[]) ?? [],
    });
  } catch (err) {
    console.error("GET /api/status error:", err);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: "text must be a non-empty string" },
      { status: 400 }
    );
  }

  if (!VALID_TYPES.includes(type as StatusType)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const currentStatus = {
    text: text.trim(),
    type: type as StatusType,
    updatedAt: now,
  };

  const newEntry = {
    text: text.trim(),
    type: type as StatusType,
    timestamp: now,
  };

  const existingLog = ((await kv.get("activity_log")) as unknown[]) ?? [];
  const updatedLog = [newEntry, ...existingLog].slice(0, MAX_LOG_ENTRIES);

  await Promise.all([
    kv.set("current_status", currentStatus),
    kv.set("activity_log", updatedLog),
  ]);

  return NextResponse.json({ ok: true });
}
