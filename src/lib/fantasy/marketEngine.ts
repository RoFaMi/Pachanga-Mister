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

          // 2. Add player to buyer roster
          await tx.fantasyRoster.create({
            data: {
              fantasyTeamId: buyerTeam.id,
              realPlayerId: listing.realPlayerId,
              positionSlot: targetSlot,
              purchasePrice: bidAmount,
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
 * Creates a new 12-hour market round with 6 system players + any user-listed players.
 */
export async function createNewMarketRound(leagueId: string) {
  const roundEndsAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now

  // Get all players owned by fantasy teams
  const ownedRosterEntries = await db.fantasyRoster.findMany({
    where: { fantasyTeam: { leagueId } },
    select: { realPlayerId: true },
  });
  const ownedPlayerIds = ownedRosterEntries.map((r) => r.realPlayerId);

  // 1. First try unowned system players
  let availableSystemPlayers = await db.realPlayer.findMany({
    where: {
      leagueId,
      id: { notIn: ownedPlayerIds },
    },
  });

  // 2. Fall back to all RealPlayers in the league if unowned pool is less than 6
  if (availableSystemPlayers.length < 6) {
    availableSystemPlayers = await db.realPlayer.findMany({
      where: { leagueId },
    });
  }

  // Shuffle & pick up to 6 system players
  const shuffled = [...availableSystemPlayers].sort(() => 0.5 - Math.random());
  const selectedSystemPlayers = shuffled.slice(0, 6);

  // Create listings for system players
  for (const player of selectedSystemPlayers) {
    await db.marketListing.create({
      data: {
        leagueId,
        realPlayerId: player.id,
        askingPrice: player.marketValue,
        roundEndsAt,
        status: "ACTIVE",
      },
    });
  }

  // Return current active listings
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
