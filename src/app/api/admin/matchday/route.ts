import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { leagueId, name, action, matchdayId, teamAPlayerIds, teamBPlayerIds, teamCPlayerIds } = await req.json();

    const membership = await db.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: user.id } },
    });

    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Permiso denegado. Se requieren derechos de administrador." }, { status: 403 });
    }

    if (action === "CREATE_MATCHDAY") {
      const currentCount = await db.matchday.count({ where: { leagueId } });
      const newMatchday = await db.matchday.create({
        data: {
          leagueId,
          number: currentCount + 1,
          name: name || `Jornada ${currentCount + 1}`,
          status: "SCHEDULED",
          date: new Date(),
        },
      });

      // Create default 3 real teams (Equipo A, Equipo B, Equipo C)
      const tA = await db.matchTeam.create({
        data: { matchdayId: newMatchday.id, name: "Equipo A (Verdes)", color: "#10B981" },
      });
      const tB = await db.matchTeam.create({
        data: { matchdayId: newMatchday.id, name: "Equipo B (Azules)", color: "#3B82F6" },
      });
      const tC = await db.matchTeam.create({
        data: { matchdayId: newMatchday.id, name: "Equipo C (Naranjas)", color: "#F97316" },
      });

      return NextResponse.json({ matchday: newMatchday, teams: [tA, tB, tC], message: "Jornada creada con éxito" });
    }

    if (action === "FINISH_MATCHDAY") {
      if (!matchdayId) {
        return NextResponse.json({ error: "ID de jornada requerido" }, { status: 400 });
      }

      await db.matchday.update({
        where: { id: matchdayId },
        data: { status: "COMPLETED" },
      });

      return NextResponse.json({ message: "Jornada finalizada y clasificaciones cerradas" });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Admin Matchday Error:", error);
    return NextResponse.json({ error: "Error de administración" }, { status: 500 });
  }
}
