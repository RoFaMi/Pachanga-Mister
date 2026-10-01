import { NextResponse } from "next/server";
import { getCurrentUser, signToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ user: fullUser });
  } catch (error) {
    console.error("GET /api/user/profile error:", error);
    return NextResponse.json({ error: "Error al obtener perfil" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { fullName, nickname, avatarUrl } = await req.json();

    if (!nickname || nickname.trim().length === 0) {
      return NextResponse.json({ error: "El apodo (nickname) es obligatorio" }, { status: 400 });
    }

    const newNickname = nickname.trim();
    const newFullName = fullName?.trim() || null;
    let newAvatarUrl = avatarUrl?.trim() || null;
    if (newAvatarUrl && newAvatarUrl.startsWith("data:")) {
      newAvatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        fullName: newFullName,
        nickname: newNickname,
        avatarUrl: newAvatarUrl,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        nickname: true,
        role: true,
        avatarUrl: true,
      },
    });

    // Cascade update fantasy team badges/names and real player photo/names for this user
    await Promise.all([
      db.fantasyTeam.updateMany({
        where: { userId: user.id },
        data: {
          badgeUrl: newAvatarUrl || undefined,
          name: `Equipo de ${newNickname}`,
        },
      }).catch(() => null),
      db.realPlayer.updateMany({
        where: { userId: user.id },
        data: {
          photoUrl: newAvatarUrl || undefined,
          nickname: newNickname,
          name: newFullName || newNickname,
        },
      }).catch(() => null),
    ]);

    const sessionUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName || "",
      nickname: updatedUser.nickname,
      role: updatedUser.role || "USER",
      avatarUrl: updatedUser.avatarUrl,
    };

    const token = signToken(sessionUser);

    const proto = req.headers.get("x-forwarded-proto");
    const referer = req.headers.get("referer") || "";
    const isHttps = proto === "https" || referer.startsWith("https://") || process.env.NODE_ENV === "production";

    const res = NextResponse.json({
      message: "Perfil actualizado correctamente en todo el sistema",
      user: sessionUser,
      token,
    });

    res.cookies.set("pachanga_token", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    console.error("PUT /api/user/profile error:", error);
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
