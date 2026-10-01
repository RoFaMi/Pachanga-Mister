import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      const publicLeagues = await db.league.findMany({
        take: 5,
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } } },
          },
          fantasyTeams: true,
        },
      });
      return NextResponse.json({ leagues: publicLeagues.map((l) => ({ ...l, myRole: null })) });
    }

    const memberships = await db.leagueMember.findMany({
      where: { userId: user.id },
      include: {
        league: {
          include: {
            members: {
              include: { user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } } },
            },
            fantasyTeams: true,
          },
        },
      },
    });

    if (memberships.length === 0) {
      const allLeagues = await db.league.findMany({
        take: 5,
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } } },
          },
          fantasyTeams: true,
        },
      });
      return NextResponse.json({ leagues: allLeagues.map((l) => ({ ...l, myRole: null })) });
    }

    return NextResponse.json({ leagues: memberships.map((m) => ({ ...m.league, myRole: m.role })) });
  } catch (error) {
    console.error("Get Leagues Error:", error);
    return NextResponse.json({ error: "Error al obtener ligas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { name, description, logoUrl, maxMembers, initialBudget, maxOwnersPerPlayer } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "El nombre de la liga es obligatorio" }, { status: 400 });
    }

    // Generate unique code (e.g. PACHANGA-X782)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `PACHANGA-${randomSuffix}`;

    const newLeague = await db.league.create({
      data: {
        name,
        code,
        description: description || "Liga privada de fútbol sala 5v5",
        logoUrl: logoUrl || "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200&auto=format&fit=crop&q=80",
        maxMembers: maxMembers || 18,
        initialBudget: initialBudget || 30.0,
        maxOwnersPerPlayer: maxOwnersPerPlayer || 18,
        ownerId: user.id,
      },
    });

    // Add creator as ADMIN member
    await db.leagueMember.create({
      data: {
        leagueId: newLeague.id,
        userId: user.id,
        role: "ADMIN",
      },
    });

    // Create default fantasy team for owner
    await db.fantasyTeam.create({
      data: {
        leagueId: newLeague.id,
        userId: user.id,
        name: `Equipo de ${user.nickname}`,
        badgeUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80",
        budget: newLeague.initialBudget,
      },
    });

    return NextResponse.json({ league: newLeague, message: "Liga creada con éxito" });
  } catch (error) {
    console.error("Create League Error:", error);
    return NextResponse.json({ error: "Error al crear la liga" }, { status: 500 });
  }
}
