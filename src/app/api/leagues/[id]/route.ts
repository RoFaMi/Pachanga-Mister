import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: any, context: any) {
  try {
    const params = await context.params;
    const id = params.id;
    const user = await getCurrentUser();

    const league = await db.league.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, fullName: true, nickname: true, email: true } },
        members: {
          include: { user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } } },
        },
        realPlayers: {
          include: {
            user: { select: { id: true, fullName: true, nickname: true } },
            rosterEntries: {
              include: {
                fantasyTeam: {
                  include: {
                    user: { select: { id: true, nickname: true, fullName: true } },
                  },
                },
              },
            },
          },
        },
        fantasyTeams: {
          include: {
            user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } },
            roster: {
              include: { realPlayer: true },
            },
            captains: true,
          },
          orderBy: { totalPoints: "desc" },
        },
        matchdays: {
          include: {
            matches: {
              include: {
                teamA: true,
                teamB: true,
                lineups: { select: { id: true, matchTeamId: true, realPlayerId: true, isGoalkeeper: true } },
                events: { select: { id: true, type: true, realPlayerId: true, assisterPlayerId: true, minute: true } },
                ratings: { select: { id: true, targetRealPlayerId: true, evaluatorUserId: true, score: true } },
              },
            },
            matchTeams: true,
          },
          orderBy: { number: "asc" },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "Liga no encontrada" }, { status: 404 });
    }

    const myMembership = user ? league.members.find((m: any) => m.userId === user.id) : null;
    let myFantasyTeam = user ? league.fantasyTeams.find((ft: any) => ft.userId === user.id) : null;

    // Auto-create FantasyTeam for logged-in user if missing
    if (user && !myFantasyTeam) {
      try {
        myFantasyTeam = await db.fantasyTeam.create({
          data: {
            leagueId: league.id,
            userId: user.id,
            name: `Equipo de ${user.nickname || user.fullName || "Míster"}`,
            badgeUrl: user.avatarUrl || "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80",
            budget: league.initialBudget || 30.0,
          },
          include: {
            user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } },
            roster: { include: { realPlayer: true } },
            captains: true,
          },
        });

        // Ensure membership record
        if (!myMembership) {
          await db.leagueMember.create({
            data: { leagueId: league.id, userId: user.id, role: "PARTICIPANT" },
          }).catch(() => null);
        }
      } catch (e) {
        console.error("Auto-create fantasy team error:", e);
      }
    }

    return NextResponse.json({
      league,
      userRole: myMembership?.role || null,
      myFantasyTeam: myFantasyTeam || null,
    });
  } catch (error) {
    console.error("Get League Detail Error:", error);
    return NextResponse.json({ error: "Error al obtener la liga" }, { status: 500 });
  }
}
