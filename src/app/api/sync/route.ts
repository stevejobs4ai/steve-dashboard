import { NextRequest, NextResponse } from "next/server";

const GIST_ID = process.env.GIST_ID!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

async function readWorkspace(): Promise<Record<string, string>> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!res.ok) return {};
  const gist = await res.json();
  const content = gist.files["workspace.json"]?.content;
  if (!content) return {};
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeWorkspace(files: Record<string, string>): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "workspace.json": { content: JSON.stringify(files, null, 2) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Failed to write gist: ${res.status}`);
}

export async function POST(req: NextRequest) {
  const token = process.env.STEVE_TOKEN;
  const authHeader = req.headers.get("authorization");

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { files?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.files !== "object" ||
    body.files === null ||
    Array.isArray(body.files)
  ) {
    return NextResponse.json(
      { error: "files must be a non-null object" },
      { status: 400 }
    );
  }

  const incoming = body.files as Record<string, unknown>;
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === "string") {
      sanitized[key] = value;
    }
  }

  const existing = await readWorkspace();
  await writeWorkspace({ ...existing, ...sanitized });

  return NextResponse.json({ ok: true, updated: Object.keys(sanitized) });
}
