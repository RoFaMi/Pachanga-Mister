import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrResolveMarketRound } from "@/lib/fantasy/marketEngine";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { leagueId, realPlayerId, action, positionSlot, bidAmount, listingId, askPrice } = await req.json();

    if (!leagueId || !action) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    const fantasyTeam = await db.fantasyTeam.findUnique({
      where: { leagueId_userId: { leagueId, userId: user.id } },
      include: {
        roster: true,
      },
    });

    if (!fantasyTeam) {
      return NextResponse.json({ error: "Equipo Fantasy no encontrado" }, { status: 404 });
    }

    // ACTION: ACCEPT MÍSTER OFFER (90% market value)
    if (action === "ACCEPT_MISTER_OFFER") {
      if (!listingId) {
        return NextResponse.json({ error: "Falta ID de la oferta" }, { status: 400 });
      }

      const listing = await db.marketListing.findUnique({
        where: { id: listingId },
        include: { realPlayer: true },
      });

      if (!listing || listing.sellerTeamId !== fantasyTeam.id) {
        return NextResponse.json({ error: "Oferta no encontrada o no te pertenece" }, { status: 400 });
      }

      const offerPrice = listing.misterOfferPrice || Math.round(listing.realPlayer.marketValue * 0.9 * 10) / 10;

      await db.$transaction(async (tx) => {
        // 1. Remove player from seller roster
        await tx.fantasyRoster.deleteMany({
          where: {
            fantasyTeamId: fantasyTeam.id,
            realPlayerId: listing.realPlayerId,
          },
        });

        // 2. Credit offer price to fantasy team budget
        await tx.fantasyTeam.update({
          where: { id: fantasyTeam.id },
          data: { budget: { increment: offerPrice } },
        });

        // 3. Log transfer
        await tx.transfer.create({
          data: {
            leagueId,
            sellerTeamId: fantasyTeam.id,
            realPlayerId: listing.realPlayerId,
            price: offerPrice,
            type: "MISTER_BUYBACK",
            bidsSummary: JSON.stringify([]),
          },
        });

        // 4. Update listing status
        await tx.marketListing.update({
          where: { id: listing.id },
          data: { status: "ACCEPTED" },
        });
      });

      return NextResponse.json({
        message: `✅ Has aceptado la oferta del Míster. ${listing.realPlayer.name} ha sido vendido por ${offerPrice.toFixed(1)}M €.`
      });
    }

    // ACTION: REJECT MÍSTER OFFER
    if (action === "REJECT_MISTER_OFFER") {
      if (!listingId) {
        return NextResponse.json({ error: "Falta ID de la oferta" }, { status: 400 });
      }

      const listing = await db.marketListing.findUnique({
        where: { id: listingId },
        include: { realPlayer: true },
      });

      if (!listing || listing.sellerTeamId !== fantasyTeam.id) {
        return NextResponse.json({ error: "Oferta no encontrada o no te pertenece" }, { status: 400 });
      }

      await db.marketListing.update({
        where: { id: listing.id },
        data: { status: "REJECTED" },
      });

      return NextResponse.json({
        message: `❌ Oferta del Míster rechazada. ${listing.realPlayer.name} permanece en tu plantilla.`
      });
    }

    // ACTION: PLACE SECRET BID ON MARKET LISTING
    if (action === "BID") {
      if (!listingId || !bidAmount) {
        return NextResponse.json({ error: "Parámetros de puja incompletos" }, { status: 400 });
      }

      const listing = await db.marketListing.findUnique({
        where: { id: listingId },
        include: { realPlayer: true },
      });

      if (!listing || listing.status !== "ACTIVE") {
        return NextResponse.json({ error: "Esta oferta de mercado ya no está activa." }, { status: 400 });
      }

      if (bidAmount < listing.askingPrice) {
        return NextResponse.json({
          error: `La puja mínima no puede ser inferior al valor de mercado del jugador (${listing.askingPrice.toFixed(1)}M €).`
        }, { status: 400 });
      }

      if (fantasyTeam.budget < bidAmount) {
        return NextResponse.json({
          error: `No tienes suficiente presupuesto. Tu saldo actual es ${fantasyTeam.budget.toFixed(1)}M €.`
        }, { status: 400 });
      }

      // Upsert Bid
      await db.marketBid.upsert({
        where: {
          listingId_fantasyTeamId: {
            listingId,
            fantasyTeamId: fantasyTeam.id,
          },
        },
        create: {
          listingId,
          fantasyTeamId: fantasyTeam.id,
          amount: bidAmount,
        },
        update: {
          amount: bidAmount,
          createdAt: new Date(),
        },
      });

      return NextResponse.json({
        message: `🎯 Puja de ${bidAmount.toFixed(1)}M € guardada con éxito por ${listing.realPlayer.name}.`
      });
    }

    // ACTION: LIST PLAYER FOR SALE (USER SELLER)
    if (action === "SELL_LISTING") {
      if (!realPlayerId) {
        return NextResponse.json({ error: "Selecciona un jugador" }, { status: 400 });
      }

      const rosterEntry = fantasyTeam.roster.find((r) => r.realPlayerId === realPlayerId);
      if (!rosterEntry) {
        return NextResponse.json({ error: "Este jugador no pertenece a tu plantilla" }, { status: 400 });
      }

      const realPlayer = await db.realPlayer.findUnique({ where: { id: realPlayerId } });
      if (!realPlayer) {
        return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
      }

      // Check if already listed
      const existingListing = await db.marketListing.findFirst({
        where: { leagueId, realPlayerId, status: { in: ["ACTIVE", "OFFER_PENDING"] } },
      });
      if (existingListing) {
        return NextResponse.json({ error: "Este jugador ya tiene una oferta activa en el mercado." }, { status: 400 });
      }

      const price = askPrice && askPrice >= realPlayer.marketValue ? askPrice : realPlayer.marketValue;
      const misterOfferPrice = Math.round(realPlayer.marketValue * 0.9 * 10) / 10;

      // Get current active market round end time
      const activeListings = await getOrResolveMarketRound(leagueId);
      const roundEndsAt = activeListings.length > 0 ? activeListings[0].roundEndsAt : new Date(Date.now() + 12 * 60 * 60 * 1000);

      await db.marketListing.create({
        data: {
          leagueId,
          realPlayerId,
          sellerTeamId: fantasyTeam.id,
          askingPrice: price,
          misterOfferPrice,
          roundEndsAt,
          status: "ACTIVE",
        },
      });

      return NextResponse.json({
        message: `🏷️ Has puesto a ${realPlayer.name} a la venta por ${price.toFixed(1)}M €. El Míster ya te ofrece ${misterOfferPrice.toFixed(1)}M € (90%) y puedes decidir si aceptar o rechazar en cualquier momento.`
      });
    }

    // CLAUSULAZO AND SHIELDING REQUIRE realPlayer
    const realPlayer = realPlayerId ? await db.realPlayer.findUnique({ where: { id: realPlayerId } }) : null;

    if (action === "CLAUSULAZO") {
      if (!realPlayer) {
        return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
      }

      // Check current scheduled matchday
      const currentMd = await db.matchday.findFirst({
        where: { leagueId, status: "SCHEDULED" },
        orderBy: { number: "asc" },
      });

      // 1. Rule: Buyout clauses locked 24h before matchday
      if (currentMd && currentMd.date) {
        const msUntilMatchday = new Date(currentMd.date).getTime() - Date.now();
        if (msUntilMatchday < 24 * 60 * 60 * 1000) {
          return NextResponse.json({
            error: "🚫 Los clausulazos están cerrados porque faltan menos de 24 horas para el inicio de la jornada."
          }, { status: 400 });
        }
      }

      // 2. Rule: Check 1-matchday shield
      if (currentMd && realPlayer.shieldedAtMatchdayNumber === currentMd.number) {
        return NextResponse.json({
          error: `🛡️ ${realPlayer.name} está blindado contra clausulazos durante la Jornada #${currentMd.number}.`
        }, { status: 400 });
      }

      // Find current owner roster entry
      const existingRosterEntry = await db.fantasyRoster.findFirst({
        where: { realPlayerId },
        include: { fantasyTeam: { include: { user: true } } },
      });

      if (!existingRosterEntry) {
        return NextResponse.json({ error: "Este jugador no pertenece a ningún rival. Puedes pujar por él en el mercado." }, { status: 400 });
      }

      if (existingRosterEntry.fantasyTeamId === fantasyTeam.id) {
        return NextResponse.json({ error: "Ya eres el dueño de este jugador." }, { status: 400 });
      }

      const sellerTeam = existingRosterEntry.fantasyTeam;
      const clauseAmount = existingRosterEntry.buyoutClause || realPlayer.buyoutClause || Math.round(realPlayer.marketValue * 1.5 * 10) / 10;

      // Check buyer budget
      if (fantasyTeam.budget < clauseAmount) {
        return NextResponse.json({
          error: `Presupuesto insuficiente para pagar la cláusula de ${clauseAmount.toFixed(1)}M €. Te faltan ${(clauseAmount - fantasyTeam.budget).toFixed(1)}M €.`
        }, { status: 400 });
      }

      // Check max roster length (6 players: 5 starters + 1er cambio)
      if (fantasyTeam.roster.length >= 6) {
        return NextResponse.json({
          error: "Tu plantilla ya tiene el límite máximo de 6 jugadores. Vende a uno antes de ejecutar el clausulazo."
        }, { status: 400 });
      }

      // 1. Remove player from seller roster
      await db.fantasyRoster.delete({
        where: { id: existingRosterEntry.id },
      });

      // 2. Add player to buyer roster with +30% escalated clause
      const newBuyoutClause = Math.round(clauseAmount * 1.3 * 10) / 10;
      const occupiedBuyerSlots = fantasyTeam.roster.map((r) => r.positionSlot);
      let targetSlot = positionSlot;
      if (!targetSlot) {
        targetSlot = ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT", "SUPLENTE_1"].find((s) => !occupiedBuyerSlots.includes(s)) || "SUPLENTE_1";
      }
      await db.fantasyRoster.create({
        data: {
          fantasyTeamId: fantasyTeam.id,
          realPlayerId,
          positionSlot: targetSlot,
          purchasePrice: clauseAmount,
          buyoutClause: newBuyoutClause,
        },
      });

      // 3. Deduct budget from Buyer & Credit budget to Seller
      await db.fantasyTeam.update({
        where: { id: fantasyTeam.id },
        data: { budget: { decrement: clauseAmount } },
      });

      await db.fantasyTeam.update({
        where: { id: sellerTeam.id },
        data: { budget: { increment: clauseAmount } },
      });

      // 4. Update base player statistics
      await db.realPlayer.update({
        where: { id: realPlayerId },
        data: {
          clauseIncrements: { increment: 1 },
        },
      });

      // 5. Log transfer
      await db.transfer.create({
        data: {
          leagueId,
          buyerTeamId: fantasyTeam.id,
          sellerTeamId: sellerTeam.id,
          realPlayerId,
          price: clauseAmount,
          type: "CLAUSULAZO",
        },
      });

      // 6. Send notifications
      await db.notification.create({
        data: {
          userId: sellerTeam.userId,
          title: `🚨 ¡CLAUSULAZO RECIBIDO!`,
          message: `${user.nickname || "Un mánager"} ha ejecutado la cláusula de rescisión de ${realPlayer.name} por ${clauseAmount}M €. Tu saldo ha aumentado en +${clauseAmount}M €.`,
          type: "MARKET",
        },
      });

      return NextResponse.json({
        message: `💥 ¡CLAUSULAZO! Has fichado a ${realPlayer.name} por ${clauseAmount}M €. Su nueva cláusula es ${newBuyoutClause}M €.`,
      });
    } else if (action === "SHIELD_CLAUSE") {
      if (!realPlayer) {
        return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
      }

      const shieldCost = 2.0; // 2.0M € to increase clause & shield for 1 matchday
      const clauseBoost = 3.5;

      const rosterEntry = fantasyTeam.roster.find((r) => r.realPlayerId === realPlayerId);
      if (!rosterEntry) {
        return NextResponse.json({ error: "Este jugador no está en tu plantilla" }, { status: 400 });
      }

      if (fantasyTeam.budget < shieldCost) {
        return NextResponse.json({ error: `Presupuesto insuficiente. Blindar la cláusula cuesta ${shieldCost}M €.` }, { status: 400 });
      }

      const currentMd = await db.matchday.findFirst({
        where: { leagueId, status: "SCHEDULED" },
        orderBy: { number: "asc" },
      });

      const matchdayNumber = currentMd ? currentMd.number : 1;

      await db.fantasyTeam.update({
        where: { id: fantasyTeam.id },
        data: { budget: { decrement: shieldCost } },
      });

      const currentClause = rosterEntry.buyoutClause || realPlayer.buyoutClause || Math.round((rosterEntry.purchasePrice || realPlayer.marketValue) * 1.5 * 10) / 10;
      const updatedClause = Math.round((currentClause + clauseBoost) * 10) / 10;

      await db.fantasyRoster.update({
        where: { id: rosterEntry.id },
        data: { buyoutClause: updatedClause },
      });

      await db.realPlayer.update({
        where: { id: realPlayerId },
        data: {
          shieldedAtMatchdayNumber: matchdayNumber,
        },
      });

      return NextResponse.json({
        message: `🛡️ Cláusula de ${realPlayer.name} blindada con éxito (+${clauseBoost}M €) para la Jornada #${matchdayNumber}. Nueva cláusula de tu jugador: ${updatedClause}M €.`,
      });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    console.error("Transfer Error:", error);
    return NextResponse.json({ error: "Error al procesar la operación" }, { status: 500 });
  }
}
