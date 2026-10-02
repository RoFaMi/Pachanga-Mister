import { db } from "../src/lib/db";
import { signToken } from "../src/lib/auth";
import { GET as getAuthMe } from "../src/app/api/auth/me/route";
import { GET as getLeagues } from "../src/app/api/leagues/route";
import { GET as getLeagueDetail } from "../src/app/api/leagues/[id]/route";
import { GET as getMarket } from "../src/app/api/market/route";
import { GET as getTransfersRecent } from "../src/app/api/transfers/recent/route";

async function runEgressBenchmark() {
  console.log("=================================================");
  console.log("🧪 BENCHMARK REPRODUCIBLE DE EGRESS (MEDICIÓN DIRECTA EN BACKEND)");
  console.log("=================================================\n");

  // 1. Get test user & league from DB
  const testUser = await db.user.findFirst();
  if (!testUser) {
    console.error("❌ Error: No hay usuarios en la base de datos.");
    process.exit(1);
  }

  const token = signToken({
    id: testUser.id,
    email: testUser.email,
    fullName: testUser.fullName,
    nickname: testUser.nickname,
    role: testUser.role,
  });

  const testLeague = await db.league.findFirst();
  const leagueId = testLeague?.id || "";

  console.log(`👤 Usuario de prueba: ${testUser.nickname} (${testUser.email})`);
  console.log(`🏆 Liga de prueba: ${testLeague?.name || "N/A"} (${leagueId})\n`);

  function createMockRequest(url: string) {
    return new Request(url, {
      headers: {
        "authorization": `Bearer ${token}`,
      },
    });
  }

  const payloadSizes: Record<string, number> = {};
  const responseTimes: Record<string, number> = {};

  console.log("--- 1. MEDICIÓN DE TAMAÑO REAL DE PAYLOAD POR ENDPOINT (OPTIMIZADO) ---");

  // Endpoint 1: /api/auth/me
  let t0 = Date.now();
  let res = await getAuthMe();
  let text = await res.text();
  payloadSizes["/api/auth/me"] = Buffer.byteLength(text, "utf8");
  responseTimes["/api/auth/me"] = Date.now() - t0;

  // Endpoint 2: /api/leagues
  t0 = Date.now();
  res = await getLeagues();
  text = await res.text();
  payloadSizes["/api/leagues"] = Buffer.byteLength(text, "utf8");
  responseTimes["/api/leagues"] = Date.now() - t0;

  // Endpoint 3: /api/leagues/[id]
  t0 = Date.now();
  res = await getLeagueDetail(createMockRequest(`http://localhost:3000/api/leagues/${leagueId}`), {
    params: Promise.resolve({ id: leagueId }),
  });
  text = await res.text();
  payloadSizes["/api/leagues/[id]"] = Buffer.byteLength(text, "utf8");
  responseTimes["/api/leagues/[id]"] = Date.now() - t0;

  // Endpoint 4: /api/market
  t0 = Date.now();
  res = await getMarket(createMockRequest(`http://localhost:3000/api/market?leagueId=${leagueId}`));
  text = await res.text();
  payloadSizes["/api/market"] = Buffer.byteLength(text, "utf8");
  responseTimes["/api/market"] = Date.now() - t0;

  // Endpoint 5: /api/transfers/recent
  t0 = Date.now();
  res = await getTransfersRecent(createMockRequest(`http://localhost:3000/api/transfers/recent?leagueId=${leagueId}`));
  text = await res.text();
  payloadSizes["/api/transfers/recent"] = Buffer.byteLength(text, "utf8");
  responseTimes["/api/transfers/recent"] = Date.now() - t0;

  Object.keys(payloadSizes).forEach((key) => {
    const bytes = payloadSizes[key];
    const ms = responseTimes[key];
    console.log(`  • ${key.padEnd(24)} | Payload: ${(bytes / 1024).toFixed(2)} KB (${bytes} bytes) | Latencia DB: ${ms} ms`);
  });

  console.log("\n--- 2. SIMULACIÓN DE SESIÓN REAL DE 10 PESTAÑAS (MATRIZ DE TRÁFICO) ---");

  const sessionFlow = [
    { screen: "1. Dashboard", calls: ["/api/auth/me", "/api/leagues", "/api/leagues/[id]", "/api/transfers/recent"] },
    { screen: "2. Plantilla", calls: ["/api/auth/me", "/api/leagues", "/api/leagues/[id]"] },
    { screen: "3. Mercado", calls: ["/api/auth/me", "/api/leagues", "/api/market"] },
    { screen: "4. Clasificación", calls: ["/api/auth/me", "/api/leagues", "/api/leagues/[id]"] },
    { screen: "5. Pachanga Live", calls: ["/api/auth/me", "/api/leagues", "/api/leagues/[id]"] },
    { screen: "6. Valoración", calls: ["/api/auth/me", "/api/leagues", "/api/leagues/[id]"] },
    { screen: "7. Perfil", calls: ["/api/auth/me", "/api/leagues"] },
    { screen: "8. Mercado (Revisita)", calls: ["/api/auth/me", "/api/leagues", "/api/market"] },
    { screen: "9. Plantilla (Revisita)", calls: ["/api/auth/me", "/api/leagues", "/api/leagues/[id]"] },
    { screen: "10. Dashboard (Revisita)", calls: ["/api/auth/me", "/api/leagues", "/api/leagues/[id]", "/api/transfers/recent"] },
  ];

  let totalComponentRequests = 0;
  let coldCacheBytes = 0;

  sessionFlow.forEach((s) => {
    s.calls.forEach((c) => {
      totalComponentRequests++;
      coldCacheBytes += payloadSizes[c] || 0;
    });
  });

  const uniqueUrlsInSession = new Set<string>();
  sessionFlow.forEach((s) => s.calls.forEach((c) => uniqueUrlsInSession.add(c)));

  let warmNetworkCalls = uniqueUrlsInSession.size;
  let warmNetworkBytes = 0;
  uniqueUrlsInSession.forEach((c) => {
    warmNetworkBytes += payloadSizes[c] || 0;
  });

  const cacheHits = totalComponentRequests - warmNetworkCalls;
  const hitRatio = ((cacheHits / totalComponentRequests) * 100).toFixed(1);
  const bytesSaved = coldCacheBytes - warmNetworkBytes;
  const savingsPercent = ((bytesSaved / coldCacheBytes) * 100).toFixed(1);

  console.log(`  • Peticiones invocadas por la app en la sesión: ${totalComponentRequests}`);
  console.log(`  • Peticiones REALES a red con Caché SWR (Warm): ${warmNetworkCalls}`);
  console.log(`  • Peticiones reutilizadas desde Caché (Hits): ${cacheHits}`);
  console.log(`  • Tasa de Acierto de Caché (Hit Ratio): ${hitRatio}%\n`);

  console.log("--- 3. BALANCE DE EGRESS EN LABORATORIO ---");
  console.log(`  • Consumo SIN CACHÉ CLIENTE (Sin SWR / Sin Deduplicar): ${(coldCacheBytes / 1024).toFixed(2)} KB (${(coldCacheBytes / 1024 / 1024).toFixed(3)} MB)`);
  console.log(`  • Consumo REAL CON CACHÉ CLIENTE (Warm SWR Session):   ${(warmNetworkBytes / 1024).toFixed(2)} KB (${(warmNetworkBytes / 1024 / 1024).toFixed(3)} MB)`);
  console.log(`  • Ahorro directo en la sesión:                         ${(bytesSaved / 1024).toFixed(2)} KB (${savingsPercent}% de reducción)\n`);

  await db.$disconnect();
}

runEgressBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
