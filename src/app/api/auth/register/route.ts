import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, nickname } = await req.json();

    if (!email || !password || !fullName || !nickname) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json({ error: "El correo electrónico ya está registrado" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash: hashedPassword,
        fullName,
        nickname,
        role: "USER",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      },
    });

    // Auto-join default demo league if exists
    const defaultLeague = await db.league.findFirst();
    if (defaultLeague) {
      await db.leagueMember.create({
        data: {
          leagueId: defaultLeague.id,
          userId: newUser.id,
          role: "PARTICIPANT",
        },
      });

      await db.fantasyTeam.create({
        data: {
          leagueId: defaultLeague.id,
          userId: newUser.id,
          name: `Equipo de ${newUser.nickname}`,
          badgeUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80",
          budget: defaultLeague.initialBudget,
        },
      });

      // Auto-create RealPlayer profile representing this person in the futsal league
      const existingRealPlayer = await db.realPlayer.findFirst({
        where: {
          leagueId: defaultLeague.id,
          OR: [{ userId: newUser.id }, { nickname: newUser.nickname }],
        },
      });

      if (!existingRealPlayer) {
        await db.realPlayer.create({
          data: {
            leagueId: defaultLeague.id,
            name: newUser.fullName,
            nickname: newUser.nickname,
            position: "ALA",
            marketValue: 10.0,
            buyoutClause: 15.0,
            photoUrl: newUser.avatarUrl,
            isDemo: false,
            userId: newUser.id,
          },
        });
      }
    }

    const sessionUser = {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      nickname: newUser.nickname,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
    };

    const token = signToken(sessionUser);

    const proto = req.headers.get("x-forwarded-proto");
    const referer = req.headers.get("referer") || "";
    const isHttps = proto === "https" || referer.startsWith("https://") || process.env.NODE_ENV === "production";

    const res = NextResponse.json({ user: sessionUser, token, message: "Registro completado con éxito" });
    res.cookies.set("pachanga_token", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json({ error: "Error al registrar el usuario" }, { status: 500 });
  }
}
