import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateMatchdayScores } from "@/lib/fantasy/scoring";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const {
      matchdayId,
      teamAId,
      teamBId,
      scoreA,
      scoreB,
      endedCondition,
      isPenaltyShootout,
      penaltyWinnerTeamId,
      events, // array of { type, realPlayerId, assisterPlayerId, minute }
      lineupsA, // array of realPlayerIds for Team A
      lineupsB, // array of realPlayerIds for Team B
      goalkeeperAId,
      goalkeeperBId,
    } = await req.json();

    const matchday = await db.matchday.findUnique({
      where: { id: matchdayId },
      include: { league: { include: { members: true } } },
    });

    if (!matchday) {
      return NextResponse.json({ error: "Jornada no encontrada" }, { status: 404 });
    }

    // Verify Admin rights
    const membership = matchday.league.members.find((m) => m.userId === user.id);
    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo los administradores pueden registrar partidos" }, { status: 403 });
    }

    // Create Match
    const matchCount = await db.match.count({ where: { matchdayId } });
    const newMatch = await db.match.create({
      data: {
        matchdayId,
        matchNumber: matchCount + 1,
        teamAId,
        teamBId,
        scoreA: scoreA || 0,
        scoreB: scoreB || 0,
        status: "FINISHED",
        durationSeconds: 600,
        endedCondition: endedCondition || "MANUAL",
        isPenaltyShootout: !!isPenaltyShootout,
        penaltyWinnerTeamId: penaltyWinnerTeamId || null,
        startedAt: new Date(Date.now() - 600 * 1000),
        endedAt: new Date(),
      },
    });

    // Save Lineups A & B
    if (Array.isArray(lineupsA)) {
      for (const pid of lineupsA) {
        await db.matchLineup.create({
          data: {
            matchId: newMatch.id,
            matchTeamId: teamAId,
            realPlayerId: pid,
            isGoalkeeper: pid === goalkeeperAId,
          },
        });
      }
    }

    if (Array.isArray(lineupsB)) {
      for (const pid of lineupsB) {
        await db.matchLineup.create({
          data: {
            matchId: newMatch.id,
            matchTeamId: teamBId,
            realPlayerId: pid,
            isGoalkeeper: pid === goalkeeperBId,
          },
        });
      }
    }

    // Save Events (Goals, Assists, Decisive Penalty)
    if (Array.isArray(events)) {
      for (const ev of events) {
        await db.matchEvent.create({
          data: {
            matchId: newMatch.id,
            type: ev.type,
            realPlayerId: ev.realPlayerId,
            assisterPlayerId: ev.assisterPlayerId || null,
            minute: ev.minute || null,
          },
        });
      }
    }

    // Update matchday status to IN_PROGRESS
    await db.matchday.update({
      where: { id: matchdayId },
      data: { status: "IN_PROGRESS" },
    });

    // Re-calculate scores for this matchday
    await calculateMatchdayScores(matchdayId);

    return NextResponse.json({ match: newMatch, message: "Partido registrado con éxito" });
  } catch (error) {
    console.error("Match Save Error:", error);
    return NextResponse.json({ error: "Error al guardar el partido" }, { status: 500 });
  }
}
