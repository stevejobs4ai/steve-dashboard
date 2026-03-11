import { NextResponse } from "next/server";

const GIST_ID = process.env.GIST_ID!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

export async function GET() {
  try {
    // First get the gist metadata to find the raw_url for workspace.json
    // (Gist API truncates files >1MB, so we must fetch via raw_url)
    const metaRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    if (!metaRes.ok) throw new Error(`Gist meta fetch failed: ${metaRes.status}`);
    const gist = await metaRes.json();
    const fileInfo = gist.files["workspace.json"];
    if (!fileInfo) return NextResponse.json({ files: {} });

    // If truncated, fetch full content from raw_url
    let content: string;
    if (fileInfo.truncated && fileInfo.raw_url) {
      const rawRes = await fetch(fileInfo.raw_url, { cache: "no-store" });
      if (!rawRes.ok) throw new Error(`Raw fetch failed: ${rawRes.status}`);
      content = await rawRes.text();
    } else {
      content = fileInfo.content || "{}";
    }

    const files: Record<string, string> = JSON.parse(content);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("GET /api/brain error:", err);
    return NextResponse.json({ error: "Failed to fetch brain" }, { status: 500 });
  }
}
