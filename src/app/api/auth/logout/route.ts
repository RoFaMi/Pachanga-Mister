import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const session = await getCurrentUser();
  const res = NextResponse.json({ message: "Sesión cerrada correctamente" });
  res.cookies.set("pachanga_token", "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0),
  });
  return res;
}
