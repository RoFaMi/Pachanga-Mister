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

    const { leagueId, matchdayId, realPlayerId } = await req.json();

    if (!leagueId || !matchdayId || !realPlayerId) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    const matchday = await db.matchday.findUnique({
      where: { id: matchdayId },
    });

    if (!matchday) {
      return NextResponse.json({ error: "Jornada no encontrada" }, { status: 404 });
    }

    if (matchday.status === "COMPLETED" || matchday.status === "IN_PROGRESS") {
      return NextResponse.json({ error: "🚫 La jornada ya ha comenzado o finalizado. No se pueden cambiar capitanes durante la jornada." }, { status: 400 });
    }

    const fantasyTeam = await db.fantasyTeam.findUnique({
      where: { leagueId_userId: { leagueId, userId: user.id } },
      include: { roster: true },
    });

    if (!fantasyTeam) {
      return NextResponse.json({ error: "Equipo Fantasy no encontrado" }, { status: 404 });
    }

    // Verify player is in roster
    const isPlayerInRoster = fantasyTeam.roster.some((r) => r.realPlayerId === realPlayerId);
    if (!isPlayerInRoster) {
      return NextResponse.json({ error: "El capitán debe pertenecer a tu plantilla Fantasy" }, { status: 400 });
    }

    // Upsert captain
    await db.fantasyCaptain.upsert({
      where: {
        fantasyTeamId_matchdayId: {
          fantasyTeamId: fantasyTeam.id,
          matchdayId,
        },
      },
      update: {
        realPlayerId,
      },
      create: {
        fantasyTeamId: fantasyTeam.id,
        matchdayId,
        realPlayerId,
      },
    });

    // Recalculate matchday scores if matchday was in progress
    if (matchday.status === "IN_PROGRESS") {
      await calculateMatchdayScores(matchdayId);
    }

    return NextResponse.json({ message: "Capitán designado correctamente (puntos dobles en la jornada)" });
  } catch (error) {
    console.error("Captain Error:", error);
    return NextResponse.json({ error: "Error al asignar capitán" }, { status: 500 });
  }
}
