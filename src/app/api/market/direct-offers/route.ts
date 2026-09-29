import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { action, leagueId, targetRealPlayerId, offerAmount, offerId, decision } = body;

    // 1. CREATE DIRECT OFFER (Manager A -> Manager B)
    if (action === "CREATE") {
      if (!leagueId || !targetRealPlayerId || !offerAmount) {
        return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
      }

      const parsedAmount = parseFloat(offerAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: "Importe de oferta inválido" }, { status: 400 });
      }

      // Get buyer fantasy team
      const buyerTeam = await db.fantasyTeam.findUnique({
        where: { leagueId_userId: { leagueId, userId: user.id } },
      });
      if (!buyerTeam) {
        return NextResponse.json({ error: "No tienes equipo en esta liga" }, { status: 404 });
      }

      if (buyerTeam.budget < parsedAmount) {
        return NextResponse.json(
          { error: `No tienes suficiente presupuesto (${buyerTeam.budget.toFixed(1)}M € disponible)` },
          { status: 400 }
        );
      }

      // Get target player and current owner team
      const player = await db.realPlayer.findUnique({
        where: { id: targetRealPlayerId },
        include: {
          rosterEntries: {
            include: {
              fantasyTeam: {
                include: { user: true },
              },
            },
          },
        },
      });

      if (!player) {
        return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
      }

      if (parsedAmount < player.marketValue) {
        return NextResponse.json(
          { error: `La oferta no puede ser inferior a su valor de mercado (${player.marketValue.toFixed(1)}M €)` },
          { status: 400 }
        );
      }

      const currentOwnerEntry = player.rosterEntries.find((r) => r.fantasyTeam.leagueId === leagueId);
      if (!currentOwnerEntry) {
        return NextResponse.json({ error: "El jugador no pertenece a ningún rival de esta liga" }, { status: 400 });
      }

      const sellerTeam = currentOwnerEntry.fantasyTeam;
      if (sellerTeam.userId === user.id) {
        return NextResponse.json({ error: "No puedes hacerte una oferta a ti mismo" }, { status: 400 });
      }

      // Check if there is already an active pending offer for this player from buyer
      const existingOffer = await db.directOffer.findFirst({
        where: {
          buyerTeamId: buyerTeam.id,
          realPlayerId: player.id,
          status: "PENDING",
        },
      });

      let directOffer;
      if (existingOffer) {
        // Update existing offer amount
        directOffer = await db.directOffer.update({
          where: { id: existingOffer.id },
          data: { amount: parsedAmount },
        });
      } else {
        // Create new offer
        directOffer = await db.directOffer.create({
          data: {
            leagueId,
            buyerTeamId: buyerTeam.id,
            sellerTeamId: sellerTeam.id,
            realPlayerId: player.id,
            amount: parsedAmount,
            status: "PENDING",
          },
        });
      }

      // Send Notification to Seller User
      await db.notification.create({
        data: {
          userId: sellerTeam.userId,
          title: `📩 OFERTA DIRECTA DE ${user.nickname.toUpperCase()}`,
          message: `${user.nickname} te ha hecho una oferta de ${parsedAmount.toFixed(1)}M € por tu jugador ${player.name}. Ve al Mercado para ACEPTAR o RECHAZAR.`,
          type: "MARKET",
        },
      });

      return NextResponse.json({
        message: `Oferta de ${parsedAmount.toFixed(1)}M € enviada con éxito a ${sellerTeam.user.nickname}. Se le ha notificado en Mercado.`,
        offer: directOffer,
      });
    }

    // 2. RESPOND TO DIRECT OFFER (Manager B -> Accept / Reject)
    if (action === "RESPOND") {
      if (!offerId || !decision) {
        return NextResponse.json({ error: "Faltan datos de la oferta" }, { status: 400 });
      }

      const offer = await db.directOffer.findUnique({
        where: { id: offerId },
        include: {
          buyerTeam: { include: { user: true } },
          sellerTeam: { include: { user: true } },
          realPlayer: true,
        },
      });

      if (!offer || offer.status !== "PENDING") {
        return NextResponse.json({ error: "La oferta no está disponible o ya fue procesada" }, { status: 404 });
      }

      // Verify current user is the seller
      if (offer.sellerTeam.userId !== user.id) {
        return NextResponse.json({ error: "No tienes permiso para responder a esta oferta" }, { status: 403 });
      }

      if (decision === "REJECT") {
        await db.directOffer.update({
          where: { id: offer.id },
          data: { status: "REJECTED" },
        });

        // Notify Buyer
        await db.notification.create({
          data: {
            userId: offer.buyerTeam.userId,
            title: `❌ OFERTA RECHAZADA`,
            message: `${user.nickname} ha rechazado tu oferta de ${offer.amount.toFixed(1)}M € por ${offer.realPlayer.name}.`,
            type: "MARKET",
          },
        });

        return NextResponse.json({ message: "Has rechazado la oferta." });
      }

      if (decision === "ACCEPT") {
        // Verify buyer budget
        if (offer.buyerTeam.budget < offer.amount) {
          return NextResponse.json(
            { error: `El comprador (${offer.buyerTeam.user.nickname}) ya no tiene suficiente presupuesto.` },
            { status: 400 }
          );
        }

        // Determine buyer slot
        const buyerRoster = await db.fantasyRoster.findMany({
          where: { fantasyTeamId: offer.buyerTeamId },
        });
        const occupiedSlots = buyerRoster.map((r) => r.positionSlot);
        const ALL_SLOTS = ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT", "SUPLENTE_1"];
        const targetSlot = ALL_SLOTS.find((s) => !occupiedSlots.includes(s)) || "SUPLENTE_1";

        await db.$transaction(async (tx) => {
          // Deduct budget buyer & Add budget seller
          await tx.fantasyTeam.update({
            where: { id: offer.buyerTeamId },
            data: { budget: { decrement: offer.amount } },
          });

          await tx.fantasyTeam.update({
            where: { id: offer.sellerTeamId },
            data: { budget: { increment: offer.amount } },
          });

          // Delete player from seller roster
          await tx.fantasyRoster.deleteMany({
            where: {
              fantasyTeamId: offer.sellerTeamId,
              realPlayerId: offer.realPlayerId,
            },
          });

          // Add player to buyer roster
          await tx.fantasyRoster.create({
            data: {
              fantasyTeamId: offer.buyerTeamId,
              realPlayerId: offer.realPlayerId,
              positionSlot: targetSlot,
              purchasePrice: offer.amount,
            },
          });

          // Record transfer history
          await tx.transfer.create({
            data: {
              leagueId: offer.leagueId,
              buyerTeamId: offer.buyerTeamId,
              sellerTeamId: offer.sellerTeamId,
              realPlayerId: offer.realPlayerId,
              price: offer.amount,
              type: "DIRECT_OFFER",
            },
          });

          // Update offer status
          await tx.directOffer.update({
            where: { id: offer.id },
            data: { status: "ACCEPTED" },
          });
        });

        // Send notification to buyer
        await db.notification.create({
          data: {
            userId: offer.buyerTeam.userId,
            title: `🎉 ¡OFERTA ACEPTADA!`,
            message: `¡${user.nickname} ha aceptado tu oferta! Has fichado a ${offer.realPlayer.name} por ${offer.amount.toFixed(1)}M €.`,
            type: "MARKET",
          },
        });

        return NextResponse.json({
          message: `¡Oferta aceptada! Has vendido a ${offer.realPlayer.name} por ${offer.amount.toFixed(1)}M €.`,
        });
      }
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/market/direct-offers error:", error);
    return NextResponse.json({ error: "Error al procesar la oferta directa" }, { status: 500 });
  }
}
