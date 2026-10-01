"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trophy,
  Zap,
  Users,
  ShoppingBag,
  Star,
  Sparkles,
  Share2,
  Calendar,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson } from "@/lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [fantasyTeam, setFantasyTeam] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pachanga_user");
      if (stored) {
        try { setUser(JSON.parse(stored)); } catch {}
      }
    }
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [dataUser, dataLeagues] = await Promise.all([
        safeFetchJson<{ user: any }>("/api/auth/me"),
        safeFetchJson<{ leagues: any[] }>("/api/leagues"),
      ]);

      if (dataUser?.user) {
        setUser(dataUser.user);
        try { localStorage.setItem("pachanga_user", JSON.stringify(dataUser.user)); } catch {}
      }

      if (dataLeagues?.leagues && dataLeagues.leagues.length > 0) {
        const activeL = dataLeagues.leagues[0];

        const [dataDetail, dataTransfers] = await Promise.all([
          safeFetchJson<{ league: any; myFantasyTeam: any }>(`/api/leagues/${activeL.id}`),
          safeFetchJson<{ recentTransfers: any[] }>(`/api/transfers/recent?leagueId=${activeL.id}`),
        ]);

        if (dataDetail?.league) setLeague(dataDetail.league);
        if (dataDetail?.myFantasyTeam) setFantasyTeam(dataDetail.myFantasyTeam);
        if (dataTransfers?.recentTransfers) setRecentTransfers(dataTransfers.recentTransfers);
      }
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    }
  };

  const handleSwitchUser = async (email: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "pachanga123" }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.token) {
        localStorage.setItem("pachanga_token", data.token);
        window.location.reload();
      }
    } catch (e) {
      console.error("User switch failed", e);
    }
  };

  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningLeague, setJoiningLeague] = useState(false);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);

  const getShareableJoinUrl = async (): Promise<string> => {
    if (!league?.code) return "";
    try {
      const res = await fetch(`/api/invite-link?code=${encodeURIComponent(league.code)}`);
      const data = await res.json();
      if (data?.joinUrl) return data.joinUrl;
    } catch (e) {
      console.error("Error fetching invite link", e);
    }
    return `${window.location.origin}/unirse?code=${league.code}`;
  };

  const copyInviteCode = async () => {
    if (league?.code) {
      const joinUrl = await getShareableJoinUrl();
      navigator.clipboard.writeText(joinUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const shareWhatsApp = async () => {
    if (league?.code) {
      const joinUrl = await getShareableJoinUrl();
      const text = `⚽ ¡Únete a nuestra liga Míster Pachanga '${league?.name || "5v5"}'! Haz clic en el enlace para unirte:\n${joinUrl}\n(Código: ${league.code})`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoiningLeague(true);
    setJoinMessage(null);

    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCodeInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setJoinMessage(`¡Éxito! ${data.message}`);
        setJoinCodeInput("");
        fetchInitialData();
      } else {
        setJoinMessage(data.error);
      }
    } catch {
      setJoinMessage("Error al intentar unirse a la liga");
    } finally {
      setJoiningLeague(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {/* USER WELCOME HERO CARD */}
          {(() => {
            const fantasyTeamsList = league?.fantasyTeams || [];
            const userRankIndex = fantasyTeamsList.findIndex((t: any) => t.userId === user?.id);
            const userRank = userRankIndex !== -1 ? userRankIndex + 1 : 1;
            const userTotalPoints = fantasyTeam?.totalPoints !== undefined ? fantasyTeam.totalPoints : 0;

            return (
              <div className="glass-panel-glow p-6 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4 z-10">
                  <img
                    src={user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                    alt={user?.nickname}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-xl"
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Hola, {user?.nickname || "Míster"}!
                    </span>
                    <h1 className="text-2xl font-black text-white">{fantasyTeam?.name || "Míster Pachanga FC"}</h1>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">{league?.name || "Liga Pachanga 5v5"}</p>
                  </div>
                </div>

                {/* Real Total Points & Rank Stats */}
                <div className="flex items-center gap-4 bg-slate-950/70 border border-emerald-800/40 p-4 rounded-2xl z-10 w-full md:w-auto justify-around md:justify-start">
                  <div className="text-center px-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Puntos Totales</span>
                    <span className="text-2xl font-black text-amber-400">{userTotalPoints}</span>
                  </div>
                  <div className="w-px h-10 bg-emerald-900/40"></div>
                  <div className="text-center px-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Posición</span>
                    <span className="text-2xl font-black text-emerald-400">#{userRank}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* MODO PACHANGA LIVE HIGHLIGHT BANNER */}
          <div className="pitch-gradient p-4 sm:p-5 rounded-3xl border border-emerald-500/50 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse flex-shrink-0">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex flex-wrap items-center gap-1.5">
                  ¿JUEGAS HOY? ABRE EL MODO PACHANGA <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black uppercase tracking-wider">EN DIRECTO</span>
                </h3>
                <p className="text-xs text-emerald-200 font-medium mt-0.5">Cronómetro 10 min, registro de goles a 1 toque y valoraciones anónimas.</p>
              </div>
            </div>

            <Link
              href="/pachanga"
              className="py-3 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-xl flex items-center justify-center gap-1.5 flex-shrink-0 transition-transform active:scale-95 w-full sm:w-auto"
            >
              IR A PACHANGA <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* NEGATIVE BUDGET WARNING BANNER */}
          {(fantasyTeam?.budget || 0) < 0 && (
            <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-400 animate-ping"></span>
                <div>
                  <p className="text-sm font-black text-red-400 uppercase tracking-wider">¡SANCIÓN DE PRESUPUESTO NEGATIVO!</p>
                  <p className="text-[11px] font-medium text-slate-200">
                    Tu presupuesto está en <strong className="text-red-300">{fantasyTeam?.budget?.toFixed(1)}M €</strong>. No puntuarás en la jornada si no vendes jugadores.
                  </p>
                </div>
              </div>
              <Link
                href="/mercado"
                className="py-2 px-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black text-xs shadow-md transition-all flex-shrink-0"
              >
                IR AL MERCADO
              </Link>
            </div>
          )}

          {/* QUICK ACTIONS GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/plantilla"
              className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center text-center gap-2 hover:border-emerald-500/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-white">Mi Plantilla 5v5</span>
              <span className="text-[10px] text-emerald-400 font-semibold">{fantasyTeam?.roster?.length || 0}/5 Jugadores</span>
            </Link>

            <Link
              href="/mercado"
              className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center text-center gap-2 hover:border-emerald-500/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-white">Mercado</span>
              <span className="text-[10px] text-amber-400 font-semibold">{fantasyTeam?.budget?.toFixed(1) || 30.0}M € Disp.</span>
            </Link>

            <Link
              href="/clasificacion"
              className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center text-center gap-2 hover:border-emerald-500/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Trophy className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-white">Clasificación</span>
              <span className="text-[10px] text-cyan-400 font-semibold">Ver Líderes</span>
            </Link>

            <Link
              href="/valoracion"
              className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center text-center gap-2 hover:border-emerald-500/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Star className="w-5 h-5 fill-purple-400" />
              </div>
              <span className="text-xs font-extrabold text-white">Valoraciones</span>
              <span className="text-[10px] text-purple-400 font-semibold">Votar 1-10</span>
            </Link>
          </div>

          {/* REAL LEAGUE STANDINGS FEED */}
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> Clasificación en Vivo de la Liga
              </h3>
              <Link href="/clasificacion" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
                Ver Todo ({league?.fantasyTeams?.length || 0} Managers) <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {(!league?.fantasyTeams || league.fantasyTeams.length === 0) ? (
              <p className="text-xs text-slate-400 font-medium py-4 text-center">Cargando clasificación de la liga...</p>
            ) : (
              <div className="space-y-2">
                {league.fantasyTeams.map((team: any, idx: number) => {
                  const isMine = team.userId === user?.id;
                  return (
                    <Link
                      key={team.id}
                      href="/clasificacion"
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        isMine
                          ? "bg-emerald-500/10 border-emerald-500/50 shadow-md"
                          : "bg-slate-900/70 border-emerald-900/30 hover:border-emerald-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center ${
                            idx === 0
                              ? "bg-amber-400 text-slate-950"
                              : idx === 1
                              ? "bg-slate-300 text-slate-950"
                              : idx === 2
                              ? "bg-amber-700 text-white"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <img
                          src={team.user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                          alt={team.name}
                          className="w-9 h-9 rounded-full object-cover border border-emerald-500/30"
                        />
                        <div>
                          <p className="text-xs font-black text-white flex items-center gap-2">
                            {team.name}
                            {isMine && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">TÚ</span>}
                          </p>
                          <p className="text-[10px] text-emerald-400 font-semibold">👤 {team.user?.nickname || team.user?.fullName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-amber-400">{team.totalPoints ?? 0} pts</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* RECENT TRANSFERS & RESOLVED BIDS TRANSPARENCY FEED */}
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" /> Mercado Resuelto & Transparencia de Pujas
              </h3>
              <Link href="/mercado" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
                Ir al Mercado <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentTransfers.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-4 text-center">Aún no se han completado fichajes ni pujas en el mercado.</p>
            ) : (
              <div className="space-y-3">
                {recentTransfers.map((t: any) => {
                  const p = t.realPlayer;
                  const buyerName = t.buyerTeam?.user?.nickname || t.buyerTeam?.name;
                  const sellerName = t.sellerTeam?.user?.nickname || t.sellerTeam?.name;
                  let bidsList: any[] = [];
                  try {
                    if (t.bidsSummary) bidsList = JSON.parse(t.bidsSummary);
                  } catch {}

                  return (
                    <div key={t.id} className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={p?.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                            alt={p?.name}
                            className="w-10 h-10 rounded-xl object-cover border border-emerald-500/40"
                          />
                          <div>
                            <p className="text-xs font-black text-white flex items-center gap-2">
                              {p?.name} <span className="text-[10px] font-bold text-emerald-400">({p?.nickname})</span>
                            </p>
                            <p className="text-[11px] text-slate-300">
                              {t.type === "MISTER_BUYBACK" ? (
                                <span className="text-amber-400 font-bold">🤝 El Míster lo compró por {t.price.toFixed(1)}M € (Vendedor: {sellerName})</span>
                              ) : t.type === "CLAUSULAZO" ? (
                                <span className="text-amber-300 font-bold">💥 Clausulazo de {buyerName} por {t.price.toFixed(1)}M € (a {sellerName})</span>
                              ) : (
                                <span className="text-emerald-400 font-bold">✅ Fichado por {buyerName} por {t.price.toFixed(1)}M €</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-black text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded-xl border border-emerald-800/40">
                          {t.price.toFixed(1)}M €
                        </span>
                      </div>

                      {/* Bids breakdown transparency list */}
                      {bidsList.length > 0 && (
                        <div className="pt-2 border-t border-emerald-900/30 text-[10px] space-y-1">
                          <span className="font-bold text-amber-400 block uppercase tracking-wider">
                            📊 Detalle de todas las pujas en la ronda:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {bidsList.map((b: any, idx: number) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                                  b.isWinner
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}
                              >
                                {b.userName || b.teamName}: <strong className="text-amber-300">{b.amount.toFixed(1)}M €</strong> {b.isWinner ? "🏆 (Ganador)" : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LEAGUE INVITATION CODE & LAST MATCHDAY SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Share Invite Code & Direct Link */}
            <div className="glass-panel p-5 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-400" /> Código de Invitación a la Liga
                </h3>
                <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950">Máx 18 Amigos</span>
              </div>
              <p className="text-xs text-slate-300">
                Comparte este código o el enlace directo por WhatsApp con tus colegas de pachanga para unirse.
              </p>
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-900 border border-emerald-800/60 rounded-xl px-3 py-2.5 text-center font-mono font-black text-amber-400 text-lg tracking-widest">
                    {league?.code || "PACHANGA5V5"}
                  </div>
                  <button
                    onClick={copyInviteCode}
                    title="Copiar enlace de invitación completo"
                    className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-md transition-all flex items-center gap-1 flex-shrink-0"
                  >
                    {copiedCode ? "¡ENLACE COPIADO!" : "COPIAR ENLACE"}
                  </button>
                </div>
                <button
                  onClick={shareWhatsApp}
                  title="Compartir directo por WhatsApp"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> COMPARTIR POR WHATSAPP
                </button>
              </div>

              {/* Inline Join another league form */}
              <div className="pt-3 border-t border-emerald-900/30 space-y-2">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">¿Tienes un código de otra liga?</p>
                {joinMessage && (
                  <p className="text-xs font-bold text-emerald-300">{joinMessage}</p>
                )}
                <form onSubmit={handleJoinWithCode} className="flex gap-2">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Pega el código aquí (Ej: PACHANGA-X892)"
                    className="flex-1 bg-slate-900 border border-emerald-800/60 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={joiningLeague || !joinCodeInput.trim()}
                    className="py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all disabled:opacity-50"
                  >
                    {joiningLeague ? "UNIÉNDOTE..." : "UNIRME"}
                  </button>
                </form>
              </div>
            </div>

            {/* Next Pachanga Schedule Dynamic Card */}
            <div className="glass-panel p-5 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" /> Próxima Pachanga Programada
                </h3>
                {league?.matchdays && league.matchdays.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-xl border border-emerald-900/40">
                    {league.matchdays.length} Jornada(s) Creada(s)
                  </span>
                )}
              </div>

              {(() => {
                const matchdaysList = league?.matchdays || [];
                const activeMatchdays = matchdaysList.filter((m: any) => m.status === "SCHEDULED" || m.status === "LIVE");
                const nextMd = activeMatchdays.length > 0 ? activeMatchdays[0] : (matchdaysList.length > 0 ? matchdaysList[matchdaysList.length - 1] : null);

                if (!nextMd) {
                  return (
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-emerald-900/40 text-center space-y-2">
                      <p className="text-xs font-bold text-slate-300">No hay pachangas programadas en esta liga.</p>
                      <Link href="/admin" className="text-[11px] font-bold text-amber-400 hover:underline inline-block">
                        + Crear Jornada en el Panel de Administración
                      </Link>
                    </div>
                  );
                }

                let badgeText = "PROGRAMADA";
                let badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

                if (nextMd.status === "LIVE") {
                  badgeText = "EN DIRECTO";
                  badgeClass = "bg-amber-400 text-slate-950 font-black animate-pulse";
                } else if (nextMd.status === "COMPLETED") {
                  badgeText = "FINALIZADA";
                  badgeClass = "bg-slate-800 text-slate-400 border-slate-700";
                } else if (nextMd.date) {
                  const diffMs = new Date(nextMd.date).getTime() - Date.now();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  if (diffDays <= 0) {
                    badgeText = "HOY";
                  } else if (diffDays === 1) {
                    badgeText = "MAÑANA";
                  } else {
                    badgeText = `EN ${diffDays} DÍAS`;
                  }
                  badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/30 font-black";
                }

                return (
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-900/40 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-white flex items-center gap-2">
                        #{nextMd.number} - {nextMd.name}
                      </p>
                      <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                        11:00h • 3 Equipos (Verdes, Azules, Naranjas)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] border ${badgeClass}`}>
                        {badgeText}
                      </span>
                      <Link
                        href="/pachanga"
                        className="py-1.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-transform"
                      >
                        IR
                      </Link>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
