import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const params = await props.params;
    const playerId = params?.id;

    if (!playerId) {
      return NextResponse.json({ error: "ID de jugador no especificado" }, { status: 400 });
    }

    // Find real player
    const realPlayer = await db.realPlayer.findUnique({
      where: { id: playerId },
      include: { league: true },
    });

    if (!realPlayer) {
      return NextResponse.json({ error: "El jugador no existe" }, { status: 404 });
    }

    // Check if user is ADMIN in the league
    const membership = await db.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId: realPlayer.leagueId,
          userId: user.id,
        },
      },
    });

    const isOwner = realPlayer.league.ownerId === user.id;
    const isAdmin = membership?.role === "ADMIN" || isOwner || user.role === "ADMIN";

    if (!isAdmin) {
      return NextResponse.json({ error: "Permiso denegado. Se requieren derechos de administrador." }, { status: 403 });
    }

    // Unset assisted events to prevent foreign key errors
    await db.matchEvent.updateMany({
      where: { assisterPlayerId: playerId },
      data: { assisterPlayerId: null },
    });

    // Delete real player (Cascade deletes roster entries, lineups, market values, etc.)
    await db.realPlayer.delete({
      where: { id: playerId },
    });

    return NextResponse.json({
      message: `Jugador '${realPlayer.name}' (${realPlayer.nickname}) eliminado correctamente`,
    });
  } catch (error) {
    console.error("Delete Real Player Error:", error);
    return NextResponse.json({ error: "Error al eliminar el jugador" }, { status: 500 });
  }
}
