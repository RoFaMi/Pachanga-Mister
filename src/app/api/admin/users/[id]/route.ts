import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acceso denegado. Se requieren permisos de Administrador." }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 4) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 4 caracteres" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);

    await db.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });

    return NextResponse.json({
      message: `Contraseña restablecida con éxito para '${targetUser.nickname}'.`,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Error al restablecer la contraseña" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acceso denegado. Se requieren permisos de Administrador." }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
    }

    if (session.id === targetUserId) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta de administrador desde aquí. Usa el botón 'Borrar mi cuenta'." }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      include: {
        leaguesOwned: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });
    }

    if (targetUser.leaguesOwned.length > 0) {
      return NextResponse.json({
        error: "No se puede eliminar a este usuario porque es el creador/propietario de una liga activa."
      }, { status: 400 });
    }

    // 1. Unlink linked real players
    await db.realPlayer.updateMany({
      where: { userId: targetUserId },
      data: { userId: null },
    });

    // 2. Delete user (Cascade will clean up FantasyTeam, LeagueMember, Ratings, AuditLogs, Notifications)
    await db.user.delete({
      where: { id: targetUserId },
    });

    return NextResponse.json({ message: `El mánager '${targetUser.nickname}' ha sido eliminado del sistema con éxito.` });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Error al eliminar el usuario" }, { status: 500 });
  }
}
