import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { leagueId, realPlayerId, targetSlot, action } = await req.json();
    if (!leagueId || !targetSlot) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    const VALID_SLOTS = ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT", "UNASSIGNED", "SUPLENTE_1", "SUPLENTE_2"];
    if (!VALID_SLOTS.includes(targetSlot)) {
      return NextResponse.json({ error: "Posición no válida" }, { status: 400 });
    }

    // Check if there is an ongoing matchday in progress
    const activeMatchday = await db.matchday.findFirst({
      where: { leagueId, status: "IN_PROGRESS" },
    });

    if (activeMatchday) {
      return NextResponse.json({
        error: "🚫 La jornada está en juego. No se pueden realizar cambios en la alineación hasta que finalicen los partidos.",
      }, { status: 400 });
    }

    const fantasyTeam = await db.fantasyTeam.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: authUser.id,
        },
      },
      include: {
        roster: true,
      },
    });

    if (!fantasyTeam) {
      return NextResponse.json({ error: "Equipo fantasy no encontrado" }, { status: 404 });
    }

    if (action === "VACATE") {
      const occupant = fantasyTeam.roster.find((r) => r.positionSlot === targetSlot);
      if (occupant) {
        await db.fantasyRoster.update({
          where: { id: occupant.id },
          data: { positionSlot: "UNASSIGNED" },
        });
      }
      return NextResponse.json({ success: true, message: "Posición vaciada" });
    }

    if (!realPlayerId) {
      return NextResponse.json({ error: "Debes seleccionar un jugador" }, { status: 400 });
    }

    // Find the roster entry for the selected player
    const targetPlayerRoster = fantasyTeam.roster.find((r) => r.realPlayerId === realPlayerId);
    if (!targetPlayerRoster) {
      return NextResponse.json({ error: "El jugador no pertenece a tu plantilla" }, { status: 404 });
    }

    // Check if another player currently occupies targetSlot
    const currentOccupantRoster = fantasyTeam.roster.find((r) => r.positionSlot === targetSlot && r.realPlayerId !== realPlayerId);
    const oldSlotOfTargetPlayer = targetPlayerRoster.positionSlot;

    // Swap or update slots in transaction
    await db.$transaction(async (tx) => {
      if (currentOccupantRoster) {
        // Swap: current occupant takes the old slot of target player
        await tx.fantasyRoster.update({
          where: { id: currentOccupantRoster.id },
          data: { positionSlot: oldSlotOfTargetPlayer && oldSlotOfTargetPlayer !== "UNASSIGNED" ? oldSlotOfTargetPlayer : "UNASSIGNED" },
        });
      }

      // Target player gets targetSlot
      await tx.fantasyRoster.update({
        where: { id: targetPlayerRoster.id },
        data: { positionSlot: targetSlot },
      });
    });

    return NextResponse.json({ success: true, message: "Posición actualizada correctamente" });
  } catch (error: any) {
    console.error("Error updating roster slot:", error);
    return NextResponse.json({ error: "Error al cambiar la posición" }, { status: 500 });
  }
}
