import { NextResponse } from "next/server";

const GIST_ID = process.env.GIST_ID!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

export async function GET() {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Gist fetch failed: ${res.status}`);
    const gist = await res.json();
    const content = gist.files["workspace.json"]?.content;
    const files: Record<string, string> = content ? JSON.parse(content) : {};
    return NextResponse.json({ files });
  } catch (err) {
    console.error("GET /api/brain error:", err);
    return NextResponse.json({ error: "Failed to fetch brain" }, { status: 500 });
  }
}
