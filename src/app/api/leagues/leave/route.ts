import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { leagueId } = await req.json().catch(() => ({}));
    if (!leagueId) {
      return NextResponse.json({ error: "ID de liga requerido" }, { status: 400 });
    }

    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return NextResponse.json({ error: "La liga no existe" }, { status: 404 });
    }

    if (league.ownerId === session.id) {
      return NextResponse.json({
        error: "El creador/administrador principal no puede abandonar la liga mientras sea el propietario."
      }, { status: 400 });
    }

    // 1. Delete FantasyTeam for this league and user
    await db.fantasyTeam.deleteMany({
      where: { leagueId, userId: session.id },
    });

    // 2. Delete LeagueMember membership
    await db.leagueMember.deleteMany({
      where: { leagueId, userId: session.id },
    });

    // 3. Unlink real player linked to user in this league if any
    await db.realPlayer.updateMany({
      where: { leagueId, userId: session.id },
      data: { userId: null },
    });

    return NextResponse.json({ message: `Has abandonado la liga '${league.name}' correctamente.` });
  } catch (error) {
    console.error("Leave league error:", error);
    return NextResponse.json({ error: "Error al salir de la liga" }, { status: 500 });
  }
}
