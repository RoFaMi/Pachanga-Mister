import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { leagueId, name, nickname, position, marketValue, photoUrl } = await req.json();

    if (!leagueId || !name || !nickname || !position) {
      return NextResponse.json({ error: "Nombre, apodo y posición son obligatorios" }, { status: 400 });
    }

    const membership = await db.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: user.id } },
    });

    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Permiso denegado. Se requieren derechos de administrador." }, { status: 403 });
    }

    const val = parseFloat(marketValue) || 10.0;
    const defaultPhoto = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname)}`;

    const newPlayer = await db.realPlayer.create({
      data: {
        leagueId,
        name,
        nickname,
        position,
        marketValue: val,
        photoUrl: photoUrl?.trim() || defaultPhoto,
        isDemo: false,
      },
    });

    // Create market value initial history entry
    await db.playerMarketValue.create({
      data: {
        realPlayerId: newPlayer.id,
        value: val,
      },
    });

    return NextResponse.json({ player: newPlayer, message: `Jugador real '${name}' creado con éxito` });
  } catch (error) {
    console.error("Create Real Player Error:", error);
    return NextResponse.json({ error: "Error al crear el jugador real" }, { status: 500 });
  }
}
