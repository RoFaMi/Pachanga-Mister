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

    const { matchId, ratings } = await req.json();
    // ratings is an array of { targetRealPlayerId: string, score: number }

    if (!matchId || !Array.isArray(ratings)) {
      return NextResponse.json({ error: "Datos de valoración inválidos" }, { status: 400 });
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        lineups: { include: { realPlayer: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    // Check if evaluator is linked to a RealPlayer who played in this match
    const evaluatorRealPlayer = await db.realPlayer.findFirst({
      where: { userId: user.id },
    });

    // Validate that each target score is between 0 and 10
    for (const r of ratings) {
      if (typeof r.score !== "number" || r.score < 0 || r.score > 10) {
        return NextResponse.json({ error: "Las valoraciones deben estar entre 0 y 10" }, { status: 400 });
      }

      // Cannot rate oneself
      if (evaluatorRealPlayer && evaluatorRealPlayer.id === r.targetRealPlayerId) {
        return NextResponse.json({ error: "No puedes valorarte a ti mismo" }, { status: 400 });
      }

      // Check if target player played in this match
      const targetInMatch = match.lineups.some((l) => l.realPlayerId === r.targetRealPlayerId);
      if (!targetInMatch) {
        return NextResponse.json({ error: "Solo puedes valorar a jugadores que hayan participado en el partido" }, { status: 400 });
      }

      // Upsert rating safely
      await db.matchRating.upsert({
        where: {
          matchId_evaluatorUserId_targetRealPlayerId: {
            matchId,
            evaluatorUserId: user.id,
            targetRealPlayerId: r.targetRealPlayerId,
          },
        },
        update: {
          score: r.score,
        },
        create: {
          matchId,
          evaluatorUserId: user.id,
          targetRealPlayerId: r.targetRealPlayerId,
          score: r.score,
        },
      });
    }

    // Recalculate matchday scores to reflect new average ratings
    await calculateMatchdayScores(match.matchdayId);

    return NextResponse.json({ message: "Valoraciones guardadas correctamente" });
  } catch (error) {
    console.error("Submit Rating Error:", error);
    return NextResponse.json({ error: "Error al guardar valoraciones" }, { status: 500 });
  }
}
