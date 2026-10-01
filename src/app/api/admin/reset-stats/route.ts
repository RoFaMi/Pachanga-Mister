import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acceso denegado. Se requieren permisos de Administrador." }, { status: 403 });
    }

    let resetMode = "EMPTY"; // "EMPTY" or "DRAFT_5"
    let leagueId: string | null = null;

    try {
      const body = await req.json();
      if (body.resetMode) resetMode = body.resetMode;
      if (body.leagueId) leagueId = body.leagueId;
    } catch {
      // Body might be empty
    }

    // 1. Delete all market transactions, bids, listings, cycles, and offers
    await db.marketBid.deleteMany({});
    await db.marketListing.deleteMany({});
    await db.marketCycle.deleteMany({});
    await db.directOffer.deleteMany({});
    await db.transfer.deleteMany({});

    // 2. Delete all matchday performance, lineups, matches, events, captains, scores
    await db.fantasyCaptain.deleteMany({});
    await db.fantasyScore.deleteMany({});
    await db.matchRating.deleteMany({});
    await db.matchEvent.deleteMany({});
    await db.matchLineup.deleteMany({});
    await db.match.deleteMany({});
    await db.matchTeam.deleteMany({});
    await db.matchday.deleteMany({});

    // 3. Delete all fantasy roster entries
    await db.fantasyRoster.deleteMany({});

    // 4. Reset clauses and shields on RealPlayer
    await db.realPlayer.updateMany({
      data: {
        clauseIncrements: 0,
        shieldedAtMatchdayNumber: null,
      },
    });

    // 5. Get fantasy teams to reset
    const teamWhereFilter = leagueId ? { leagueId } : {};
    const teams = await db.fantasyTeam.findMany({
      where: teamWhereFilter,
      include: { league: true },
    });

    if (resetMode === "DRAFT_5") {
      // Get all real players for draft
      for (const team of teams) {
        const leagueRealPlayers = await db.realPlayer.findMany({
          where: { leagueId: team.leagueId },
        });

        if (leagueRealPlayers.length === 0) {
          // If no real players exist, set budget to initialBudget
          await db.fantasyTeam.update({
            where: { id: team.id },
            data: {
              budget: team.league.initialBudget || 30.0,
              totalPoints: 0.0,
              lastMatchdayPoints: 0.0,
              accumulatedEarnings: 0.0,
            },
          });
          continue;
        }

        const porPool = leagueRealPlayers.filter((p) => p.position === "POR");
        const cierrePool = leagueRealPlayers.filter((p) => p.position === "CIERRE");
        const alaPool = leagueRealPlayers.filter((p) => p.position === "ALA");
        const pivotPool = leagueRealPlayers.filter((p) => p.position === "PIVOT");

        const getFallbackPlayer = (primaryPool: typeof leagueRealPlayers, usedIds: Set<string>) => {
          const unusedPrimary = primaryPool.filter((p) => !usedIds.has(p.id));
          if (unusedPrimary.length > 0) {
            return unusedPrimary[Math.floor(Math.random() * unusedPrimary.length)];
          }
          const unusedGlobal = leagueRealPlayers.filter((p) => !usedIds.has(p.id));
          if (unusedGlobal.length > 0) {
            return unusedGlobal[Math.floor(Math.random() * unusedGlobal.length)];
          }
          // If pool exhausted, pick any
          return primaryPool[Math.floor(Math.random() * primaryPool.length)] || leagueRealPlayers[0];
        };

        const targetBudget = team.league.initialBudget || 30.0;
        let selected5: Array<{ player: typeof leagueRealPlayers[0]; slot: string }> = [];
        let bestSum = Infinity;
        let bestSelection: typeof selected5 = [];

        // Attempt up to 50 draws to find squad where sum <= targetBudget
        for (let attempt = 0; attempt < 50; attempt++) {
          const usedIds = new Set<string>();

          const por = getFallbackPlayer(porPool, usedIds);
          usedIds.add(por.id);

          const cierre = getFallbackPlayer(cierrePool, usedIds);
          usedIds.add(cierre.id);

          const ala1 = getFallbackPlayer(alaPool, usedIds);
          usedIds.add(ala1.id);

          const ala2 = getFallbackPlayer(alaPool, usedIds);
          usedIds.add(ala2.id);

          const pivot = getFallbackPlayer(pivotPool, usedIds);
          usedIds.add(pivot.id);

          const currentSelection = [
            { player: por, slot: "POR" },
            { player: cierre, slot: "CIERRE" },
            { player: ala1, slot: "ALA_1" },
            { player: ala2, slot: "ALA_2" },
            { player: pivot, slot: "PIVOT" },
          ];

          const sumValue = currentSelection.reduce((acc, s) => acc + s.player.marketValue, 0);

          if (sumValue <= targetBudget) {
            bestSelection = currentSelection;
            bestSum = sumValue;
            break;
          }

          if (sumValue < bestSum) {
            bestSum = sumValue;
            bestSelection = currentSelection;
          }
        }

        selected5 = bestSelection;
        const totalSquadValue = Math.round(selected5.reduce((acc, s) => acc + s.player.marketValue, 0) * 10) / 10;
        const remainingBudget = Math.max(0, Math.round((targetBudget - totalSquadValue) * 10) / 10);

        // Update team
        await db.fantasyTeam.update({
          where: { id: team.id },
          data: {
            budget: remainingBudget,
            totalPoints: 0.0,
            lastMatchdayPoints: 0.0,
            accumulatedEarnings: 0.0,
          },
        });

        // Insert roster entries for the 5 players
        for (const item of selected5) {
          const buyoutClause = Math.round(item.player.marketValue * 1.5 * 10) / 10;
          await db.fantasyRoster.create({
            data: {
              fantasyTeamId: team.id,
              realPlayerId: item.player.id,
              positionSlot: item.slot,
              purchasePrice: item.player.marketValue,
              buyoutClause,
            },
          });
        }
      }
    } else {
      // EMPTY_ROSTER mode: set budget to 30M € for all teams
      for (const team of teams) {
        await db.fantasyTeam.update({
          where: { id: team.id },
          data: {
            budget: team.league.initialBudget || 30.0,
            totalPoints: 0.0,
            lastMatchdayPoints: 0.0,
            accumulatedEarnings: 0.0,
          },
        });
      }
    }

    const modeText = resetMode === "DRAFT_5" 
      ? "Plantillas asignadas aleatoriamente (5 jugadores < 30M € + saldo restante)." 
      : "Plantillas vacías y 30.0M € de saldo restaurado para todos los equipos.";

    return NextResponse.json({
      message: `Liga reiniciada con éxito. ${modeText}`,
    });
  } catch (error) {
    console.error("Reset stats error:", error);
    return NextResponse.json({ error: "Error al reiniciar la liga" }, { status: 500 });
  }
}
