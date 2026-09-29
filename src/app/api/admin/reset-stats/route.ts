import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acceso denegado. Se requieren permisos de Administrador." }, { status: 403 });
    }

    // 1. Delete all matchday performance data
    await db.fantasyScore.deleteMany({});
    await db.matchRating.deleteMany({});
    await db.matchEvent.deleteMany({});
    await db.matchLineup.deleteMany({});
    await db.match.deleteMany({});
    await db.matchTeam.deleteMany({});
    await db.fantasyCaptain.deleteMany({});
    await db.matchday.deleteMany({});

    // 2. Reset points and earnings in FantasyTeam
    await db.fantasyTeam.updateMany({
      data: {
        totalPoints: 0.0,
        lastMatchdayPoints: 0.0,
        accumulatedEarnings: 0.0,
      },
    });

    // 3. Reset clauses and shields on RealPlayer
    await db.realPlayer.updateMany({
      data: {
        clauseIncrements: 0,
        shieldedAtMatchdayNumber: null,
      },
    });

    return NextResponse.json({
      message: "Todas las estadísticas reales, partidos, puntuaciones y jornadas han sido reiniciadas correctamente. No hay jornadas jugadas.",
    });
  } catch (error) {
    console.error("Reset stats error:", error);
    return NextResponse.json({ error: "Error al reiniciar las estadísticas reales" }, { status: 500 });
  }
}
