import { NextResponse } from "next/server";
import os from "os";

function getLocalNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  }
  return "localhost";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "PACHANGA5V5";

    const customAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    let baseUrl = "";
    if (customAppUrl) {
      baseUrl = customAppUrl.replace(/\/$/, "");
    } else {
      const hostHeader = req.headers.get("host") || "";
      const port = hostHeader.includes(":") ? hostHeader.split(":")[1] : "3000";

      if (hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1")) {
        const localIp = getLocalNetworkIp();
        baseUrl = `http://${localIp}:${port}`;
      } else {
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        baseUrl = `${protocol}://${hostHeader}`;
      }
    }

    const joinUrl = `${baseUrl}/unirse?code=${code}`;

    return NextResponse.json({
      joinUrl,
      code,
      networkIp: getLocalNetworkIp(),
    });
  } catch (error) {
    console.error("Invite Link Error:", error);
    return NextResponse.json({ error: "Error al generar el enlace de invitación" }, { status: 500 });
  }
}
