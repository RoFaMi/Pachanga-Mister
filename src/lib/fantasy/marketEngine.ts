import { db } from "@/lib/db";

export const CYCLE_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
export const MAX_OWNERS_PER_PLAYER = 7;
export const SYSTEM_PLAYERS_PER_CYCLE = 7;
export const FUTSAL_STARTING_SLOTS = ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT"];

/**
 * Resolves any expired 8-hour market cycle for a league, and initializes a new 8-hour market cycle if needed.
 */
export async function getOrResolveMarketRound(leagueId: string) {
  const now = new Date();

  // Find the current active MarketCycle for this league
  let activeCycle = await db.marketCycle.findFirst({
    where: { leagueId, status: "ACTIVE" },
    include: {
      listings: {
        where: { status: "ACTIVE" },
        include: {
          realPlayer: true,
          sellerTeam: { include: { user: true } },
          bids: {
            include: { fantasyTeam: { include: { user: true } } },
            orderBy: [
              { amount: "desc" },
              { createdAt: "asc" }, // Server timestamp tie-breaker: earliest offer wins!
            ],
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const isExpired = activeCycle && activeCycle.endsAt <= now;

  if (!activeCycle || isExpired) {
    if (activeCycle && isExpired) {
      await resolveMarketCycle(leagueId, activeCycle.id);
    }
    // Create new 8-hour cycle
    return await createNewMarketCycle(leagueId);
  }

  // Active cycle is valid and running -> return its active listings immediately (Fast <50ms read)
  return await db.marketListing.findMany({
    where: { leagueId, status: "ACTIVE", marketCycleId: activeCycle.id },
    include: {
      realPlayer: true,
      sellerTeam: { include: { user: true } },
      bids: {
        include: { fantasyTeam: { include: { user: true } } },
        orderBy: [
          { amount: "desc" },
          { createdAt: "asc" },
        ],
      },
    },
  });
}

/**
 * Resolves all listings and bids for an expired 8-hour market cycle atomically.
 */
export async function resolveMarketCycle(leagueId: string, cycleId: string) {
  const listings = await db.marketListing.findMany({
    where: { leagueId, status: "ACTIVE", marketCycleId: cycleId },
    include: {
      realPlayer: true,
      sellerTeam: { include: { user: true } },
      bids: {
        include: { fantasyTeam: { include: { user: true } } },
        orderBy: [
          { amount: "desc" },
          { createdAt: "asc" }, // Server timestamp tie-breaker
        ],
      },
    },
  });

  for (const listing of listings) {
    const candidateBids = listing.bids;
    let winningBid: any = null;
    let winnerAssigned = false;

    if (candidateBids.length > 0) {
      // Evaluate bidders in order (highest amount -> earliest server timestamp)
      for (const bid of candidateBids) {
        const buyerTeam = bid.fantasyTeam;
        const bidAmount = bid.amount;

        // Validation 1: Check buyer roster count (Max 5 futsal players)
        const buyerRoster = await db.fantasyRoster.findMany({
          where: { fantasyTeamId: buyerTeam.id },
        });

        if (buyerRoster.length >= 5) {
          await db.marketBid.update({
            where: { id: bid.id },
            data: { status: "REJECTED", rejectionReason: "Plantilla llena (Máximo 5 jugadores de fútbol sala)" },
          });
          continue;
        }

        // Validation 3: Check buyer does not already own an instance of this player
        const alreadyOwns = buyerRoster.some((r) => r.realPlayerId === listing.realPlayerId);
        if (alreadyOwns) {
          await db.marketBid.update({
            where: { id: bid.id },
            data: { status: "REJECTED", rejectionReason: "Ya tienes una ficha de este jugador en tu plantilla" },
          });
          continue;
        }

        // Validation 4: Check real player max 7 owners limit in league
        const currentOwnersCount = await db.fantasyRoster.count({
          where: {
            realPlayerId: listing.realPlayerId,
            fantasyTeam: { leagueId },
          },
        });

        // If user seller, owner count will decrement by 1, so effectively currentOwnersCount - 1
        const effectiveOwners = listing.sellerTeamId ? currentOwnersCount - 1 : currentOwnersCount;

        if (effectiveOwners >= MAX_OWNERS_PER_PLAYER) {
          await db.marketBid.update({
            where: { id: bid.id },
            data: { status: "REJECTED", rejectionReason: `El jugador ya ha alcanzado el límite de ${MAX_OWNERS_PER_PLAYER} equipos` },
          });
          continue;
        }

        // Top valid candidate found!
        winningBid = bid;
        break;
      }

      if (winningBid) {
        const buyerTeam = winningBid.fantasyTeam;
        const bidAmount = winningBid.amount;

        const buyerRoster = await db.fantasyRoster.findMany({
          where: { fantasyTeamId: buyerTeam.id },
        });
        const occupiedSlots = buyerRoster.map((r) => r.positionSlot);
        const targetSlot = FUTSAL_STARTING_SLOTS.find((s) => !occupiedSlots.includes(s)) || "PIVOT";
        const instanceClause = Math.round(bidAmount * 1.5 * 10) / 10;

        await db.$transaction(async (tx) => {
          // 1. Deduct budget from buyer
          await tx.fantasyTeam.update({
            where: { id: buyerTeam.id },
            data: { budget: { decrement: bidAmount } },
          });

          // 2. Add player to buyer roster with instance buyout clause
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

          // 4. Update winning bid & outbid bids
          await tx.marketBid.update({
            where: { id: winningBid.id },
            data: { status: "WON" },
          });

          await tx.marketBid.updateMany({
            where: { listingId: listing.id, id: { not: winningBid.id }, status: "PENDING" },
            data: { status: "OUTBID" },
          });

          // 5. Record transfer history with bids summary
          const bidsSummary = candidateBids.map((b: any) => ({
            teamName: b.fantasyTeam.name,
            userName: b.fantasyTeam.user.nickname,
            amount: b.amount,
            createdAt: b.createdAt,
            isWinner: b.id === winningBid.id,
          }));

          await tx.transfer.create({
            data: {
              leagueId,
              buyerTeamId: buyerTeam.id,
              sellerTeamId: listing.sellerTeamId || null,
              realPlayerId: listing.realPlayerId,
              price: bidAmount,
              type: "MARKET_BID",
              bidsSummary: JSON.stringify(bidsSummary),
            },
          });

          // 6. Update listing status
          await tx.marketListing.update({
            where: { id: listing.id },
            data: { status: "RESOLVED", processedWinnerTeamId: buyerTeam.id, resolutionReason: "Adjudicado por puja ganadora" },
          });
        });

        winnerAssigned = true;
      }
    }

    // CASE: No valid bids or 0 bids
    if (!winnerAssigned) {
      if (listing.sellerTeamId) {
        // User listed player, no buyer -> Offer pending from Míster
        const misterOfferPrice = listing.misterOfferPrice || Math.round(listing.realPlayer.marketValue * 0.9 * 10) / 10;
        await db.marketListing.update({
          where: { id: listing.id },
          data: { status: "OFFER_PENDING", misterOfferPrice, resolutionReason: "Sin pujas de mánagers. Oferta Míster disponible." },
        });

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
        // System player with 0 bids -> resolve listing
        await db.marketListing.update({
          where: { id: listing.id },
          data: { status: "RESOLVED", resolutionReason: "Sin pujas en el ciclo" },
        });
      }
    }
  }

  // Mark cycle as RESOLVED
  await db.marketCycle.update({
    where: { id: cycleId },
    data: { status: "RESOLVED" },
  });
}

/**
 * Generates a new 8-hour market cycle with 7 random eligible system players + active user listings.
 */
export async function createNewMarketCycle(leagueId: string) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + CYCLE_DURATION_MS);

  // Get current max cycle number for this league
  const lastCycle = await db.marketCycle.findFirst({
    where: { leagueId },
    orderBy: { cycleNumber: "desc" },
  });
  const cycleNumber = (lastCycle?.cycleNumber || 0) + 1;

  // Expire any old active system listings from previous cycles
  await db.marketListing.updateMany({
    where: { leagueId, status: "ACTIVE", sellerTeamId: null },
    data: { status: "EXPIRED" },
  });

  // Create new active cycle
  const newCycle = await db.marketCycle.create({
    data: {
      leagueId,
      cycleNumber,
      startedAt: now,
      endsAt,
      status: "ACTIVE",
    },
  });

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

  // 3. Filter players that have < 7 owners (MAX_OWNERS_PER_PLAYER = 7)
  const eligiblePlayers = allLeaguePlayers.filter((p) => {
    const count = ownerCountMap.get(p.id) || 0;
    return count < MAX_OWNERS_PER_PLAYER;
  });

  // 4. Randomly shuffle eligible players and select up to 7 random players
  const shuffled = [...eligiblePlayers].sort(() => Math.random() - 0.5);
  const selectedSystemPlayers = shuffled.slice(0, SYSTEM_PLAYERS_PER_CYCLE);

  if (selectedSystemPlayers.length > 0) {
    await db.marketListing.createMany({
      data: selectedSystemPlayers.map((player) => ({
        leagueId,
        marketCycleId: newCycle.id,
        realPlayerId: player.id,
        askingPrice: player.marketValue,
        misterOfferPrice: Math.round(player.marketValue * 0.9 * 10) / 10,
        roundEndsAt: endsAt,
        status: "ACTIVE",
      })),
    });
  }

  // Also associate any existing user-listed active players with the new cycle and roundEndsAt
  await db.marketListing.updateMany({
    where: { leagueId, status: "ACTIVE", sellerTeamId: { not: null } },
    data: {
      marketCycleId: newCycle.id,
      roundEndsAt: endsAt,
    },
  });

  // Return all ACTIVE listings for the new cycle
  return await db.marketListing.findMany({
    where: { leagueId, status: "ACTIVE" },
    include: {
      realPlayer: true,
      sellerTeam: { include: { user: true } },
      bids: {
        include: { fantasyTeam: { include: { user: true } } },
        orderBy: [
          { amount: "desc" },
          { createdAt: "asc" },
        ],
      },
    },
  });
}
