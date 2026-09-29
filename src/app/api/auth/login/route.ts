import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const email = String(body.email).toLowerCase().trim();
    const password = String(body.password);

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "El correo electrónico no está registrado" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      nickname: user.nickname,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    const proto = req.headers.get("x-forwarded-proto");
    const referer = req.headers.get("referer") || "";
    const isHttps = proto === "https" || referer.startsWith("https://") || process.env.NODE_ENV === "production";

    const token = signToken(sessionUser);

    const res = NextResponse.json({ user: sessionUser, token, message: "Sesión iniciada con éxito" });
    res.cookies.set("pachanga_token", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return res;
  } catch (error) {
    console.error("Login Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error en el servidor al iniciar sesión: ${msg}` }, { status: 500 });
  }
}

