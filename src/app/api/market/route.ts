import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrResolveMarketRound } from "@/lib/fantasy/marketEngine";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leagueIdParam = searchParams.get("leagueId");

    let leagueId = leagueIdParam;
    if (!leagueId) {
      const firstLeague = await db.league.findFirst();
      if (!firstLeague) {
        return NextResponse.json({ listings: [], myBids: [], pendingMisterOffers: [] });
      }
      leagueId = firstLeague.id;
    }

    // Resolve expired 12h rounds & get current active listings
    const activeListings = await getOrResolveMarketRound(leagueId);

    // Get my fantasy team
    const fantasyTeam = await db.fantasyTeam.findUnique({
      where: { leagueId_userId: { leagueId, userId: user.id } },
      include: { roster: true },
    });

    let myBids: any[] = [];
    let pendingMisterOffers: any[] = [];
    let incomingDirectOffers: any[] = [];

    if (fantasyTeam) {
      myBids = await db.marketBid.findMany({
        where: {
          fantasyTeamId: fantasyTeam.id,
          listingId: { in: activeListings.map((l) => l.id) },
        },
      });

      pendingMisterOffers = await db.marketListing.findMany({
        where: {
          leagueId,
          sellerTeamId: fantasyTeam.id,
          status: { in: ["ACTIVE", "OFFER_PENDING"] },
        },
        include: {
          realPlayer: true,
        },
      });

      incomingDirectOffers = await db.directOffer.findMany({
        where: {
          sellerTeamId: fantasyTeam.id,
          status: "PENDING",
        },
        include: {
          buyerTeam: { include: { user: true } },
          realPlayer: true,
        },
      });
    }

    return NextResponse.json({
      listings: activeListings,
      myBids,
      pendingMisterOffers,
      incomingDirectOffers,
      myFantasyTeam: fantasyTeam,
    });
  } catch (error) {
    console.error("GET /api/market error:", error);
    return NextResponse.json({ error: "Error al obtener el mercado" }, { status: 500 });
  }
}
