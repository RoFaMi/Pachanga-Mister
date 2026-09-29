import { db } from "@/lib/db";

/**
 * Resolves any expired 12-hour market round for a league, and initializes a new 12-hour market round if needed.
 */
export async function getOrResolveMarketRound(leagueId: string) {
  const now = new Date();

  // Find active listings for this league
  const activeListings = await db.marketListing.findMany({
    where: {
      leagueId,
      status: "ACTIVE",
    },
    include: {
      realPlayer: true,
      sellerTeam: { include: { user: true } },
      bids: {
        include: {
          fantasyTeam: { include: { user: true } },
        },
        orderBy: [
          { amount: "desc" },
          { createdAt: "asc" }, // Tie breaker: earliest timestamp wins!
        ],
      },
    },
  });

  // Check if current round has expired
  const isExpired = activeListings.length > 0 && activeListings[0].roundEndsAt <= now;

  if (isExpired) {
    // RESOLVE EXPIRED ROUND
    await resolveMarketRound(leagueId, activeListings);
    // GENERATE NEW 12H ROUND
    return await createNewMarketRound(leagueId);
  } else if (activeListings.length === 0) {
    // No active round exists yet, initialize a new 12h round
    return await createNewMarketRound(leagueId);
  }

  return activeListings;
}

/**
 * Resolves bids for an expired market round.
 */
async function resolveMarketRound(leagueId: string, listings: any[]) {
  for (const listing of listings) {
    const bids = listing.bids;
    const bidsSummary = bids.map((b: any) => ({
      teamName: b.fantasyTeam.name,
      userName: b.fantasyTeam.user.nickname,
      amount: b.amount,
      createdAt: b.createdAt,
    }));

    if (bids.length > 0) {
      // Find highest bidder who can afford their bid
      let winningBid = null;
      for (const b of bids) {
        if (b.fantasyTeam.budget >= b.amount) {
          winningBid = b;
          break;
        }
      }

      if (winningBid) {
        // Winner gets the player
        const buyerTeam = winningBid.fantasyTeam;
        const bidAmount = winningBid.amount;

        // Determine target slot for buyer
        const buyerRoster = await db.fantasyRoster.findMany({
          where: { fantasyTeamId: buyerTeam.id },
        });
        const occupiedSlots = buyerRoster.map((r) => r.positionSlot);
        const ALL_SLOTS = ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT", "SUPLENTE_1"];
        const targetSlot = ALL_SLOTS.find((s) => !occupiedSlots.includes(s)) || "SUPLENTE_1";

        await db.$transaction(async (tx) => {
          // 1. Deduct budget from buyer
          await tx.fantasyTeam.update({
            where: { id: buyerTeam.id },
            data: { budget: { decrement: bidAmount } },
          });

          // 2. Add player to buyer roster with instance buyout clause (1.5x purchase price)
          const instanceClause = Math.round(bidAmount * 1.5 * 10) / 10;
          await tx.fantasyRoster.create({
            data: {
              fantasyTeamId: buyerTeam.id,
              realPlayerId: listing.realPlayerId,
              positionSlot: targetSlot,
              purchasePrice: bidAmount,
              buyoutClause: instanceClause,
            },
          });

          // 3. If user seller, remove from seller roster & credit seller budget
          if (listing.sellerTeamId) {
            await tx.fantasyRoster.deleteMany({
              where: {
                fantasyTeamId: listing.sellerTeamId,
                realPlayerId: listing.realPlayerId,
              },
            });
            await tx.fantasyTeam.update({
              where: { id: listing.sellerTeamId },
              data: { budget: { increment: bidAmount } },
            });
          }

          // 4. Record transfer history with bids transparency
          await tx.transfer.create({
            data: {
              leagueId,
              buyerTeamId: buyerTeam.id,
              sellerTeamId: listing.sellerTeamId || null,
              realPlayerId: listing.realPlayerId,
              price: bidAmount,
              type: "MARKET_BID",
              bidsSummary: JSON.stringify(
                bidsSummary.map((bs: any) => ({
                  ...bs,
                  isWinner: bs.teamName === buyerTeam.name && bs.amount === bidAmount,
                }))
              ),
            },
          });

          // 5. Update listing status
          await tx.marketListing.update({
            where: { id: listing.id },
            data: { status: "RESOLVED" },
          });
        });

        continue;
      }
    }

    // CASE 0 BIDS or NO AFFORDABLE BID FROM OTHER MANAGERS
    if (listing.sellerTeamId) {
      // User listed a player and no other manager bought them -> Set status to OFFER_PENDING and notify seller to Accept or Reject Míster offer!
      const misterOfferPrice = listing.misterOfferPrice || Math.round(listing.realPlayer.marketValue * 0.9 * 10) / 10;

      await db.marketListing.update({
        where: { id: listing.id },
        data: {
          status: "OFFER_PENDING",
          misterOfferPrice,
        },
      });

      // Send notification to seller team
      if (listing.sellerTeam?.userId) {
        await db.notification.create({
          data: {
            userId: listing.sellerTeam.userId,
            title: `💼 OFERTA DEL MÍSTER POR ${listing.realPlayer.name.toUpperCase()}`,
            message: `El Míster te ofrece ${misterOfferPrice.toFixed(1)}M € por ${listing.realPlayer.name}. Ve al Mercado para ACEPTAR o RECHAZAR la oferta.`,
            type: "MARKET",
          },
        });
      }
    } else {
      // System free agent with 0 bids -> simply resolve
      await db.marketListing.update({
        where: { id: listing.id },
        data: { status: "RESOLVED" },
      });
    }
  }
}

/**
 * Creates a new 12-hour market round with 7 random eligible players + any user-listed players.
 */
export async function createNewMarketRound(leagueId: string) {
  const roundEndsAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now
  const MAX_OWNERS_PER_PLAYER = 7;
  const SYSTEM_LISTINGS_COUNT = 7;

  // 1. Group roster entries by realPlayerId in this league to count owners
  const rosterCounts = await db.fantasyRoster.groupBy({
    by: ["realPlayerId"],
    where: { fantasyTeam: { leagueId } },
    _count: { realPlayerId: true },
  });

  const ownerCountMap = new Map<string, number>();
  for (const rc of rosterCounts) {
    ownerCountMap.set(rc.realPlayerId, rc._count.realPlayerId);
  }

  // 2. Fetch all real players in the league
  const allLeaguePlayers = await db.realPlayer.findMany({
    where: { leagueId },
  });

  // 3. Filter players that have fewer than 7 owners (MAX_OWNERS_PER_PLAYER = 7)
  const eligiblePlayers = allLeaguePlayers.filter((p) => {
    const count = ownerCountMap.get(p.id) || 0;
    return count < MAX_OWNERS_PER_PLAYER;
  });

  // 4. Fetch currently ACTIVE system listings for this league
  const existingActiveListings = await db.marketListing.findMany({
    where: { leagueId, status: "ACTIVE" },
    select: { realPlayerId: true, sellerTeamId: true },
  });

  const activeSystemPlayerIds = new Set(
    existingActiveListings.filter((l) => l.sellerTeamId === null).map((l) => l.realPlayerId)
  );

  // 5. Fill active system listings up to 7 random eligible players
  const currentActiveCount = activeSystemPlayerIds.size;
  const neededCount = Math.max(0, SYSTEM_LISTINGS_COUNT - currentActiveCount);

  if (neededCount > 0) {
    const availablePool = eligiblePlayers.filter((p) => !activeSystemPlayerIds.has(p.id));
    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selectedPlayers = shuffled.slice(0, neededCount);

    if (selectedPlayers.length > 0) {
      await db.marketListing.createMany({
        data: selectedPlayers.map((player) => ({
          leagueId,
          realPlayerId: player.id,
          askingPrice: player.marketValue,
          misterOfferPrice: Math.round(player.marketValue * 0.9 * 10) / 10,
          roundEndsAt,
          status: "ACTIVE",
        })),
      });
    }
  }

  // Return all current ACTIVE market listings
  return await db.marketListing.findMany({
    where: {
      leagueId,
      status: "ACTIVE",
    },
    include: {
      realPlayer: true,
      sellerTeam: { include: { user: true } },
      bids: {
        include: {
          fantasyTeam: { include: { user: true } },
        },
      },
    },
  });
}
