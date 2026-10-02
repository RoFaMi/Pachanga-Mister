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
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        logoUrl: true,
        maxMembers: true,
        initialBudget: true,
        maxOwnersPerPlayer: true,
        scoringConfig: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, fullName: true, nickname: true, email: true, avatarUrl: true } },
        members: {
          select: {
            id: true,
            role: true,
            userId: true,
            joinedAt: true,
            user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } },
          },
        },
        realPlayers: {
          select: {
            id: true,
            name: true,
            nickname: true,
            position: true,
            marketValue: true,
            buyoutClause: true,
            photoUrl: true,
            isDemo: true,
            userId: true,
            user: { select: { id: true, fullName: true, nickname: true } },
          },
        },
        fantasyTeams: {
          select: {
            id: true,
            name: true,
            badgeUrl: true,
            budget: true,
            totalPoints: true,
            lastMatchdayPoints: true,
            accumulatedEarnings: true,
            userId: true,
            user: { select: { id: true, fullName: true, nickname: true, avatarUrl: true } },
            roster: {
              select: {
                id: true,
                positionSlot: true,
                purchasePrice: true,
                buyoutClause: true,
                realPlayerId: true,
                realPlayer: {
                  select: {
                    id: true,
                    name: true,
                    nickname: true,
                    position: true,
                    marketValue: true,
                    buyoutClause: true,
                    photoUrl: true,
                  },
                },
              },
            },
            captains: {
              select: {
                id: true,
                matchdayId: true,
                realPlayerId: true,
              },
            },
          },
          orderBy: { totalPoints: "desc" },
        },
        matchdays: {
          select: {
            id: true,
            number: true,
            name: true,
            status: true,
            date: true,
            matchTeams: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            matches: {
              select: {
                id: true,
                matchNumber: true,
                status: true,
                scoreA: true,
                scoreB: true,
                durationSeconds: true,
                endedCondition: true,
                isPenaltyShootout: true,
                penaltyWinnerTeamId: true,
                teamAId: true,
                teamBId: true,
                teamA: { select: { id: true, name: true, color: true } },
                teamB: { select: { id: true, name: true, color: true } },
                lineups: {
                  select: {
                    id: true,
                    matchTeamId: true,
                    realPlayerId: true,
                    isGoalkeeper: true,
                    realPlayer: { select: { id: true, name: true, nickname: true, photoUrl: true } },
                  },
                },
                events: {
                  select: {
                    id: true,
                    type: true,
                    realPlayerId: true,
                    assisterPlayerId: true,
                    minute: true,
                    realPlayer: { select: { id: true, name: true, nickname: true } },
                    assister: { select: { id: true, name: true, nickname: true } },
                  },
                },
                ratings: {
                  select: {
                    id: true,
                    evaluatorUserId: true,
                    targetRealPlayerId: true,
                    score: true,
                  },
                },
              },
            },
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

    return NextResponse.json(
      {
        league,
        userRole: myMembership?.role || null,
        myFantasyTeam: myFantasyTeam || null,
      },
      { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("Get League Detail Error:", error);
    return NextResponse.json({ error: "Error al obtener la liga" }, { status: 500 });
  }
}
