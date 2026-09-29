import { db } from "@/lib/db";

export interface ScoringConfig {
  goal: number;
  assist: number;
  win: number;
  loss: number;
  decisivePenalty: number;
  goalkeeperConceded: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  goal: 5,
  assist: 3,
  win: 3,
  loss: -2,
  decisivePenalty: 3,
  goalkeeperConceded: -1,
};

/**
 * Calculates and updates Fantasy Scores for a given Matchday.
 */
export async function calculateMatchdayScores(matchdayId: string) {
  const matchday = await db.matchday.findUnique({
    where: { id: matchdayId },
    include: {
      league: true,
      matches: {
        include: {
          lineups: true,
          events: true,
          ratings: true,
        },
      },
    },
  });

  if (!matchday) throw new Error("Matchday not found");

  let config: ScoringConfig = DEFAULT_SCORING_CONFIG;
  if (matchday.league.scoringConfig) {
    try {
      config = { ...DEFAULT_SCORING_CONFIG, ...JSON.parse(matchday.league.scoringConfig) };
    } catch {
      // fallback to default
    }
  }

  // Fetch all fantasy teams in this league and their roster/captains
  const fantasyTeams = await db.fantasyTeam.findMany({
    where: { leagueId: matchday.leagueId },
    include: {
      roster: {
        include: { realPlayer: true },
      },
      captains: {
        where: { matchdayId },
      },
    },
  });

  // Clear existing fantasy scores for this matchday to ensure idempotency
  await db.fantasyScore.deleteMany({
    where: { matchdayId },
  });

  // Calculate stats for each real player in this matchday
  const realPlayers = await db.realPlayer.findMany({
    where: { leagueId: matchday.leagueId },
  });

  for (const team of fantasyTeams) {
    // RULE 1: Negative Budget Disqualification ("si estás en negativo no puedes participar/puntuar")
    if (team.budget < 0) {
      await db.fantasyTeam.update({
        where: { id: team.id },
        data: {
          lastMatchdayPoints: 0,
        },
      });

      await db.notification.create({
        data: {
          userId: team.userId,
          title: `⚠️ Sanción Presupuesto Negativo`,
          message: `Tu equipo no ha puntuado en la Jornada #${matchday.number} por tener un saldo negativo (${team.budget.toFixed(1)}M €). Vende un jugador para regularizar tu saldo.`,
          type: "MARKET",
        },
      });

      continue; // Skip scoring for negative budget team
    }

    let teamMatchdayPoints = 0;
    const captain = team.captains[0];

    // Score all players in roster (including starting 5 + 6th player "SUPLENTE_1")
    for (const entry of team.roster) {
      const realPlayerId = entry.realPlayerId;
      const isCaptain = captain?.realPlayerId === realPlayerId;

      let goalPts = 0;
      let assistPts = 0;
      let winPts = 0;
      let lossPts = 0;
      let gkConcededPts = 0;
      let decPenaltyPts = 0;
      let ratingPts = 0;

      // Accumulate across all finished matches in this matchday
      for (const m of matchday.matches) {
        if (m.status !== "FINISHED") continue;

        const lineup = m.lineups.find((l) => l.realPlayerId === realPlayerId);
        if (!lineup) continue; // Player didn't play in this match

        const playerTeamId = lineup.matchTeamId;
        const isTeamA = playerTeamId === m.teamAId;
        const playerScore = isTeamA ? m.scoreA : m.scoreB;
        const opponentScore = isTeamA ? m.scoreB : m.scoreA;

        // Win or Loss points
        let isWinner = false;
        if (m.isPenaltyShootout && m.penaltyWinnerTeamId) {
          isWinner = m.penaltyWinnerTeamId === playerTeamId;
        } else {
          isWinner = playerScore > opponentScore;
        }

        if (isWinner) {
          winPts += config.win;
        } else {
          lossPts += config.loss;
        }

        // Goalkeeper conceded points
        if (lineup.isGoalkeeper) {
          gkConcededPts += opponentScore * config.goalkeeperConceded;
        }

        // Match events (Goals, Assists, Decisive Penalty)
        for (const ev of m.events) {
          if (ev.realPlayerId === realPlayerId) {
            if (ev.type === "GOAL") goalPts += config.goal;
            if (ev.type === "DECISIVE_PENALTY") decPenaltyPts += config.decisivePenalty;
          }
          if (ev.assisterPlayerId === realPlayerId && ev.type === "GOAL") {
            assistPts += config.assist;
          }
        }

        // Peer ratings for this match
        const ratingsForPlayer = m.ratings.filter((r) => r.targetRealPlayerId === realPlayerId);
        if (ratingsForPlayer.length > 0) {
          const avgScore =
            ratingsForPlayer.reduce((sum, r) => sum + r.score, 0) / ratingsForPlayer.length;
          // Format to 1 decimal place
          ratingPts += Math.round(avgScore * 10) / 10;
        }
      }

      const rawTotal =
        goalPts + assistPts + winPts + lossPts + gkConcededPts + decPenaltyPts + ratingPts;
      const finalTotal = isCaptain ? rawTotal * 2 : rawTotal;

      teamMatchdayPoints += finalTotal;

      await db.fantasyScore.create({
        data: {
          matchdayId,
          fantasyTeamId: team.id,
          realPlayerId,
          goalPoints: goalPts,
          assistPoints: assistPts,
          winPoints: winPts,
          lossPoints: lossPts,
          goalkeeperConcededPoints: gkConcededPts,
          decisivePenaltyPoints: decPenaltyPts,
          ratingPoints: ratingPts,
          isCaptain,
          totalPoints: finalTotal,
        },
      });
    }

    // RULE 2: Empty Starting 5 Slots Penalty (-4 pts per empty starting slot)
    const filledStartingSlots = team.roster.filter((e) =>
      ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT"].includes(e.positionSlot)
    ).length;
    const emptyStartingSlots = Math.max(0, 5 - filledStartingSlots);
    const emptySlotPenalty = emptyStartingSlots * 4; // -4 points per empty starting slot

    teamMatchdayPoints -= emptySlotPenalty;

    // Send warning notification if empty slots penalty was applied
    if (emptyStartingSlots > 0) {
      await db.notification.create({
        data: {
          userId: team.userId,
          title: `⚠️ Penalización Posiciones Vacías (-${emptySlotPenalty} pts)`,
          message: `Has tenido ${emptyStartingSlots} posición(es) titular(es) vacía(s) en la Jornada #${matchday.number} (-4 pts por cada una).`,
          type: "MATCHDAY",
        },
      });
    }

    // Calculate matchday prize money (0.5M € per point scored)
    const prizeEarnings = Math.max(0, Math.round(teamMatchdayPoints * 0.5 * 10) / 10);

    // Update FantasyTeam points & budget with prize earnings
    await db.fantasyTeam.update({
      where: { id: team.id },
      data: {
        lastMatchdayPoints: teamMatchdayPoints,
        totalPoints: { increment: teamMatchdayPoints },
        budget: { increment: prizeEarnings },
        accumulatedEarnings: { increment: prizeEarnings },
      },
    });

    // Send Notification to user for prize money
    if (prizeEarnings > 0) {
      await db.notification.create({
        data: {
          userId: team.userId,
          title: `💰 Premios Jornada #${matchday.number}`,
          message: `¡Has ganado ${prizeEarnings}M € en presupuesto por sumar ${teamMatchdayPoints} pts!`,
          type: "MARKET",
        },
      });
    }
  }

  // --- REVALUE ALL REAL PLAYERS IN THE LEAGUE BASED ON THIS MATCHDAY ---
  for (const player of realPlayers) {
    // Find all fantasy scores for this player in this matchday
    const scores = await db.fantasyScore.findMany({
      where: { matchdayId, realPlayerId: player.id },
    });

    // Sum unweighted raw performance points across teams (or use highest score)
    const totalPlayerPts = scores.length > 0
      ? Math.max(...scores.map((s) => s.goalPoints + s.assistPoints + s.winPoints + s.lossPoints + s.goalkeeperConcededPoints + s.decisivePenaltyPoints + s.ratingPoints))
      : 0;

    let delta = -0.3;
    if (totalPlayerPts >= 12) delta = 2.5;
    else if (totalPlayerPts >= 8) delta = 1.5;
    else if (totalPlayerPts >= 5) delta = 0.8;
    else if (totalPlayerPts > 0) delta = 0.3;

    const newMarketValue = Math.max(3.0, Math.round((player.marketValue + delta) * 10) / 10);
    const minClause = Math.round(newMarketValue * 1.5 * 10) / 10;
    const newBuyoutClause = Math.max(minClause, Math.round((player.buyoutClause + delta * 1.5) * 10) / 10);

    // Update Player market value and buyout clause
    await db.realPlayer.update({
      where: { id: player.id },
      data: {
        marketValue: newMarketValue,
        buyoutClause: newBuyoutClause,
      },
    });

    // Add to market value history
    await db.playerMarketValue.create({
      data: {
        realPlayerId: player.id,
        value: newMarketValue,
      },
    });
  }
}
