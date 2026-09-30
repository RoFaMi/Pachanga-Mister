import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { leagueId, name, action, matchdayId, date, status } = await req.json();

    const membership = await db.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: user.id } },
    });

    const league = await db.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } });
    const isOwnerOrAdmin = (membership && membership.role === "ADMIN") || (league && league.ownerId === user.id);

    if (!isOwnerOrAdmin) {
      return NextResponse.json({ error: "Permiso denegado. Se requieren derechos de administrador." }, { status: 403 });
    }

    // ACTION: CREATE MATCHDAY
    if (action === "CREATE_MATCHDAY") {
      const currentCount = await db.matchday.count({ where: { leagueId } });
      const newMatchday = await db.matchday.create({
        data: {
          leagueId,
          number: currentCount + 1,
          name: name || `Jornada ${currentCount + 1}`,
          status: "SCHEDULED",
          date: date ? new Date(date) : new Date(),
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

    // ACTION: EDIT / UPDATE MATCHDAY
    if (action === "EDIT_MATCHDAY" || action === "UPDATE_MATCHDAY") {
      if (!matchdayId) {
        return NextResponse.json({ error: "ID de jornada requerido" }, { status: 400 });
      }

      const updateData: any = {};
      if (name && name.trim()) updateData.name = name.trim();
      if (date) updateData.date = new Date(date);
      if (status && ["SCHEDULED", "LIVE", "COMPLETED"].includes(status)) updateData.status = status;

      const updated = await db.matchday.update({
        where: { id: matchdayId },
        data: updateData,
      });

      return NextResponse.json({ matchday: updated, message: `✅ Jornada '${updated.name}' actualizada con éxito.` });
    }

    // ACTION: DELETE MATCHDAY
    if (action === "DELETE_MATCHDAY") {
      if (!matchdayId) {
        return NextResponse.json({ error: "ID de jornada requerido" }, { status: 400 });
      }

      const targetMd = await db.matchday.findUnique({ where: { id: matchdayId } });
      if (!targetMd) {
        return NextResponse.json({ error: "Jornada no encontrada" }, { status: 404 });
      }

      await db.$transaction(async (tx) => {
        // Delete all matches, lineups, events, ratings, matchTeams linked to this matchday
        const matches = await tx.match.findMany({ where: { matchdayId } });
        const matchIds = matches.map((m) => m.id);

        if (matchIds.length > 0) {
          await tx.matchLineup.deleteMany({ where: { matchId: { in: matchIds } } });
          await tx.matchEvent.deleteMany({ where: { matchId: { in: matchIds } } });
          await tx.matchRating.deleteMany({ where: { matchId: { in: matchIds } } });
          await tx.match.deleteMany({ where: { matchdayId } });
        }

        await tx.matchTeam.deleteMany({ where: { matchdayId } });
        await tx.matchday.delete({ where: { id: matchdayId } });
      });

      return NextResponse.json({ message: `🗑️ Jornada '${targetMd.name}' eliminada correctamente.` });
    }

    // ACTION: FINISH MATCHDAY
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

    // ACTION: REOPEN MATCHDAY
    if (action === "REOPEN_MATCHDAY") {
      if (!matchdayId) {
        return NextResponse.json({ error: "ID de jornada requerido" }, { status: 400 });
      }

      await db.matchday.update({
        where: { id: matchdayId },
        data: { status: "SCHEDULED" },
      });

      return NextResponse.json({ message: "Jornada reabierta para edición y partidos" });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Admin Matchday Error:", error);
    return NextResponse.json({ error: "Error al gestionar la jornada" }, { status: 500 });
  }
}
