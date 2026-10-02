import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        memberships: {
          include: {
            league: {
              select: {
                id: true,
                name: true,
                code: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      { user: user || null },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Auth Me Error:", error);
    return NextResponse.json({ user: null });
  }
}

export async function DELETE() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      include: { leaguesOwned: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.leaguesOwned.length > 0) {
      return NextResponse.json({
        error: "No puedes borrar tu cuenta mientras seas el creador/propietario de una liga activa."
      }, { status: 400 });
    }

    // 1. Unlink linked real players
    await db.realPlayer.updateMany({
      where: { userId: session.id },
      data: { userId: null },
    });

    // 2. Delete user and all cascaded data
    await db.user.delete({
      where: { id: session.id },
    });

    const res = NextResponse.json({ message: "Tu cuenta ha sido eliminada permanentemente" });
    res.cookies.set("pachanga_token", "", {
      httpOnly: true,
      path: "/",
      expires: new Date(0),
    });
    return res;
  } catch (error) {
    console.error("Delete Account Error:", error);
    return NextResponse.json({ error: "Error al borrar la cuenta" }, { status: 500 });
  }
}
