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

    // Verify if provided leagueId actually exists in DB
    if (leagueId) {
      const existingLeague = await db.league.findUnique({ where: { id: leagueId }, select: { id: true } });
      if (!existingLeague) {
        leagueId = null;
      }
    }

    // If no valid leagueId provided, find user's active fantasy team league
    if (!leagueId) {
      const userTeam = await db.fantasyTeam.findFirst({
        where: { userId: user.id },
        select: { leagueId: true },
      });

      if (userTeam) {
        leagueId = userTeam.leagueId;
      } else {
        const firstLeague = await db.league.findFirst({ select: { id: true } });
        if (!firstLeague) {
          return NextResponse.json({
            league: null,
            myFantasyTeam: null,
            listings: [],
            myBids: [],
            pendingMisterOffers: [],
            incomingDirectOffers: [],
            rivalRosterEntries: [],
            nextRenewalAt: null,
            cycleNumber: 1,
          });
        }
        leagueId = firstLeague.id;
      }
    }

    // Run parallel data resolution
    const [activeListings, activeCycle, leagueData, fantasyTeam, rivalRosterEntries] = await Promise.all([
      getOrResolveMarketRound(leagueId),
      db.marketCycle.findFirst({
        where: { leagueId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      }),
      db.league.findUnique({
        where: { id: leagueId },
        select: {
          id: true,
          name: true,
          code: true,
          logoUrl: true,
          initialBudget: true,
          maxMembers: true,
          maxOwnersPerPlayer: true,
          ownerId: true,
        },
      }),
      db.fantasyTeam.findUnique({
        where: { leagueId_userId: { leagueId, userId: user.id } },
        include: { roster: true },
      }),
      db.fantasyRoster.findMany({
        where: {
          fantasyTeam: {
            leagueId,
            userId: { not: user.id },
          },
        },
        include: {
          realPlayer: true,
          fantasyTeam: { include: { user: true } },
        },
      }),
    ]);

    const nextRenewalAt = activeCycle?.endsAt || (activeListings.length > 0 ? activeListings[0].roundEndsAt : null);

    let myBids: any[] = [];
    let pendingMisterOffers: any[] = [];
    let incomingDirectOffers: any[] = [];

    if (fantasyTeam) {
      const activeListingIds = activeListings.map((l) => l.id);

      const [bids, misterOffers, directOffers] = await Promise.all([
        db.marketBid.findMany({
          where: {
            fantasyTeamId: fantasyTeam.id,
            listingId: { in: activeListingIds },
          },
        }),
        db.marketListing.findMany({
          where: {
            leagueId,
            sellerTeamId: fantasyTeam.id,
            status: { in: ["ACTIVE", "OFFER_PENDING"] },
          },
          include: { realPlayer: true },
        }),
        db.directOffer.findMany({
          where: {
            sellerTeamId: fantasyTeam.id,
            status: "PENDING",
          },
          include: {
            buyerTeam: { include: { user: true } },
            realPlayer: true,
          },
        }),
      ]);

      myBids = bids;
      pendingMisterOffers = misterOffers;
      incomingDirectOffers = directOffers;
    }

    return NextResponse.json({
      league: leagueData,
      myFantasyTeam: fantasyTeam,
      listings: activeListings,
      myBids,
      pendingMisterOffers,
      incomingDirectOffers,
      rivalRosterEntries,
      nextRenewalAt,
      cycleNumber: activeCycle?.cycleNumber || 1,
    });
  } catch (error) {
    console.error("GET /api/market error:", error);
    return NextResponse.json({ error: "Error al obtener el mercado" }, { status: 500 });
  }
}
