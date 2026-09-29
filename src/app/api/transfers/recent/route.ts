import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const leagueIdParam = searchParams.get("leagueId");

    let leagueId = leagueIdParam;
    if (!leagueId) {
      const firstLeague = await db.league.findFirst();
      if (!firstLeague) {
        return NextResponse.json({ recentTransfers: [] });
      }
      leagueId = firstLeague.id;
    }

    const recentTransfers = await db.transfer.findMany({
      where: { leagueId },
      include: {
        realPlayer: true,
        buyerTeam: { include: { user: true } },
        sellerTeam: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ recentTransfers });
  } catch (error) {
    console.error("GET recent transfers error:", error);
    return NextResponse.json({ error: "Error al obtener historial de fichajes" }, { status: 500 });
  }
}
