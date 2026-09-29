import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        fullName: fullName?.trim() || null,
        nickname: nickname.trim(),
        avatarUrl: avatarUrl?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        nickname: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      message: "Perfil actualizado correctamente",
      user: updatedUser,
    });
  } catch (error) {
    console.error("PUT /api/user/profile error:", error);
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
