import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Código de invitación requerido" }, { status: 400 });
    }

    const league = await db.league.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: { members: true },
    });

    if (!league) {
      return NextResponse.json({ error: "Código de invitación inválido o liga no encontrada" }, { status: 404 });
    }

    if (league.members.length >= league.maxMembers) {
      return NextResponse.json({ error: "La liga ha alcanzado el límite máximo de participantes" }, { status: 400 });
    }

    const isMember = league.members.some((m) => m.userId === user.id);
    if (isMember) {
      return NextResponse.json({ error: "Ya eres miembro de esta liga", leagueId: league.id });
    }

    await db.leagueMember.create({
      data: {
        leagueId: league.id,
        userId: user.id,
        role: "PARTICIPANT",
      },
    });

    // Create Fantasy Team for user
    await db.fantasyTeam.create({
      data: {
        leagueId: league.id,
        userId: user.id,
        name: `Equipo de ${user.nickname}`,
        badgeUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80",
        budget: league.initialBudget,
      },
    });

    // Auto-create RealPlayer profile representing this person in the futsal league pool
    const existingRealPlayer = await db.realPlayer.findFirst({
      where: {
        leagueId: league.id,
        OR: [{ userId: user.id }, { nickname: user.nickname }],
      },
    });

    if (!existingRealPlayer) {
      await db.realPlayer.create({
        data: {
          leagueId: league.id,
          name: user.fullName,
          nickname: user.nickname,
          position: "ALA",
          marketValue: 10.0,
          buyoutClause: 15.0,
          photoUrl: user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.nickname)}`,
          isDemo: false,
          userId: user.id,
        },
      });
    }

    return NextResponse.json({ leagueId: league.id, message: "Te has unido a la liga con éxito" });
  } catch (error) {
    console.error("Join League Error:", error);
    return NextResponse.json({ error: "Error al unirse a la liga" }, { status: 500 });
  }
}
