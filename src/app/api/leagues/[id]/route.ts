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
                lineups: { include: { realPlayer: true } },
                events: { include: { realPlayer: true, assister: true } },
                ratings: true,
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
    const myFantasyTeam = user ? league.fantasyTeams.find((ft: any) => ft.userId === user.id) : null;

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
