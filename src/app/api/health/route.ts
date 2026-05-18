import { NextResponse } from "next/server";

import { db } from "@/lib/db";

// Vždy běží na requestu — ne statická prerenderace.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [userCount, teamCount, matchCount] = await Promise.all([
      db.user.count(),
      db.team.count(),
      db.match.count({ where: { stage: "GROUP" } }),
    ]);
    return NextResponse.json({
      status: "ok",
      db: "connected",
      userCount,
      teamCount,
      groupMatchCount: matchCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
