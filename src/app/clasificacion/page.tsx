"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Flame, Star, Users, Shield, Zap, X, Send, AlertCircle, CheckCircle } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson, authFetch } from "@/lib/api";

export default function ClasificacionPage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"FANTASY" | "REAL">("FANTASY");

  // Participant Team Inspection Modal
  const [selectedTeamModal, setSelectedTeamModal] = useState<any | null>(null);

  // Player Interaction Modal (Direct Offer or Clausulazo)
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<{ player: any; ownerTeam: any } | null>(null);
  const [directOfferInput, setDirectOfferInput] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [modalToast, setModalToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [dataUser, dataLeagues] = await Promise.all([
        safeFetchJson<{ user: any }>("/api/auth/me"),
        safeFetchJson<{ leagues: any[] }>("/api/leagues"),
      ]);

      if (dataUser?.user) setUser(dataUser.user);

      if (dataLeagues?.leagues && dataLeagues.leagues.length > 0) {
        const demoLeague = dataLeagues.leagues[0];
        const dataDetail = await safeFetchJson<{ league: any }>(`/api/leagues/${demoLeague.id}`);
        if (dataDetail?.league) setLeague(dataDetail.league);
      }
    } catch (e) {
      console.error("Error loading standings:", e);
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

  const handleSendDirectOffer = async () => {
    if (!league || !selectedPlayerModal) return;
    const offerVal = parseFloat(directOfferInput);
    const p = selectedPlayerModal.player;

    if (isNaN(offerVal) || offerVal < p.marketValue) {
      setModalToast({
        text: `La oferta no puede ser inferior a su precio real (${p.marketValue.toFixed(1)}M €).`,
        type: "error",
      });
      return;
    }

    setActionLoading(true);
    setModalToast(null);

    try {
      const res = await authFetch("/api/market/direct-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          leagueId: league.id,
          targetRealPlayerId: p.id,
          offerAmount: offerVal,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setModalToast({ text: data.message, type: "success" });
        fetchInitialData();
      } else {
        setModalToast({ text: data.error || "Error al enviar oferta", type: "error" });
      }
    } catch (e) {
      console.error("Send offer error:", e);
      setModalToast({ text: "Error de conexión al enviar la oferta", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClausulazoFromModal = async () => {
    if (!league || !selectedPlayerModal) return;
    setActionLoading(true);
    setModalToast(null);

    try {
      const res = await authFetch("/api/market/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          realPlayerId: selectedPlayerModal.player.id,
          action: "CLAUSULAZO",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setModalToast({ text: data.message, type: "success" });
        await fetchInitialData();
      } else {
        setModalToast({ text: data.error || "Error al ejecutar clausulazo", type: "error" });
      }
    } catch (e) {
      console.error("Clausulazo error:", e);
      setModalToast({ text: "Error al ejecutar clausulazo", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const fantasyStandings = league?.fantasyTeams || [];
  const realPlayers = league?.realPlayers || [];
  const currentMd = league?.matchdays?.[0];

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {/* Header Banner */}
          <div className="glass-panel-glow p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white">Clasificaciones & Equipos Participantes</h1>
                <p className="text-xs text-emerald-400 font-semibold">
                  Toca a cualquier participante para inspeccionar su plantilla y hacer ofertas o dar clausulazos
                </p>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-2xl border border-emerald-800/40">
              <button
                onClick={() => setActiveTab("FANTASY")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === "FANTASY" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                Liga Fantasy
              </button>
              <button
                onClick={() => setActiveTab("REAL")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  activeTab === "REAL" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                Estadísticas Reales
              </button>
            </div>
          </div>

          {activeTab === "FANTASY" ? (
            /* TAB 1: CLASIFICACIÓN GENERAL FANTASY */
            <div className="glass-panel p-5 rounded-3xl space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> Clasificación General de Míster Pachanga
              </h3>

              <div className="space-y-2.5">
                {fantasyStandings.map((team: any, index: number) => {
                  const isLeader = index === 0;
                  const isMine = team.userId === user?.id;

                  return (
                    <div
                      key={team.id}
                      onClick={() => setSelectedTeamModal(team)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
                        isLeader
                          ? "bg-amber-500/10 border-amber-500/40 hover:border-amber-400 shadow-lg"
                          : isMine
                          ? "bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-400"
                          : "bg-slate-900/70 border-emerald-900/40 hover:border-emerald-500/40 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Position Badge */}
                        <div
                          className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center ${
                            index === 0
                              ? "bg-amber-400 text-slate-950 shadow-md"
                              : index === 1
                              ? "bg-slate-300 text-slate-950"
                              : index === 2
                              ? "bg-amber-700 text-white"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          #{index + 1}
                        </div>

                        {/* Team Info */}
                        <div className="flex items-center gap-3">
                          <img
                            src={team.user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                            alt={team.name}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-500/30 group-hover:scale-105 transition-transform"
                          />
                          <div>
                            <h4 className="text-sm font-black text-white flex items-center gap-2">
                              {team.name}
                              {isLeader && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950">LÍDER</span>}
                              {isMine && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950">TÚ</span>}
                            </h4>
                            <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                              👤 {team.user?.nickname || "DT"} • <span className="text-slate-400">Ver Plantilla &gt;</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <span className="text-xl font-black text-amber-400 block">{team.totalPoints} pts</span>
                        <span className="text-[11px] text-emerald-400 font-bold">Última jornada: +{team.lastMatchdayPoints} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* TAB 2: ESTADÍSTICAS INDIVIDUALES REALES DE LA PACHANGA */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pichichi */}
                <div className="glass-panel p-4 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                    <Flame className="w-5 h-5" /> Máximo Goleador (PichiChi)
                  </div>
                  {realPlayers.slice(0, 3).map((p: any, idx: number) => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900/60">
                      <span className="font-bold text-white">
                        {idx + 1}. {p.name}
                      </span>
                      <span className="font-black text-amber-400">4 Goles</span>
                    </div>
                  ))}
                </div>

                {/* Asistencias */}
                <div className="glass-panel p-4 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                    <Medal className="w-5 h-5" /> Máximo Asistente
                  </div>
                  {realPlayers.slice(3, 6).map((p: any, idx: number) => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900/60">
                      <span className="font-bold text-white">
                        {idx + 1}. {p.name}
                      </span>
                      <span className="font-black text-emerald-400">3 Asist.</span>
                    </div>
                  ))}
                </div>

                {/* Valoración */}
                <div className="glass-panel p-4 rounded-3xl space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-black text-sm">
                    <Star className="w-5 h-5 fill-cyan-400" /> Mejor Valoración (1-10)
                  </div>
                  {realPlayers.slice(6, 9).map((p: any, idx: number) => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900/60">
                      <span className="font-bold text-white">
                        {idx + 1}. {p.name}
                      </span>
                      <span className="font-black text-cyan-400">8.8 Media</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: TEAM ROSTER INSPECTION */}
      {selectedTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl max-w-lg w-full border border-emerald-500/40 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedTeamModal.user?.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=user"}
                  alt="Badge"
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400"
                />
                <div>
                  <h3 className="text-base font-black text-white">{selectedTeamModal.name}</h3>
                  <p className="text-xs text-emerald-400 font-bold">
                    DT: {selectedTeamModal.user?.nickname} • Presupuesto: {selectedTeamModal.budget.toFixed(1)}M €
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeamModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-medium">
              💡 Toca sobre cualquier jugador de esta plantilla para abrir su ficha, enviarle una oferta directa o ejecutar un clausulazo:
            </p>

            {/* Roster list */}
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {(selectedTeamModal.roster || []).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">Este equipo aún no tiene jugadores en su plantilla.</div>
              ) : (
                selectedTeamModal.roster.map((entry: any) => {
                  const p = entry.realPlayer;
                  const buyoutClause = p.buyoutClause || Math.round(p.marketValue * 1.5 * 10) / 10;
                  const isShielded = currentMd && p.shieldedAtMatchdayNumber === currentMd.number;

                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        setSelectedPlayerModal({ player: p, ownerTeam: selectedTeamModal });
                        setDirectOfferInput(String(p.marketValue));
                        setModalToast(null);
                      }}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all hover:bg-slate-850"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={p.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                          alt={p.name}
                          className="w-11 h-11 rounded-xl object-cover border border-emerald-400"
                        />
                        <div>
                          <p className="text-sm font-black text-white">{p.name}</p>
                          <p className="text-xs text-emerald-400 font-bold">{p.nickname}</p>
                          {isShielded && (
                            <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5 mt-0.5">
                              <Shield className="w-3 h-3" /> Blindado J#{currentMd.number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400 block">{p.marketValue}M €</span>
                        <span className="text-[10px] font-bold text-amber-400 block">Cláusula: {buyoutClause}M €</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PLAYER ACTION POPUP (DIRECT OFFER OR CLAUSULAZO) */}
      {selectedPlayerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="glass-panel p-6 rounded-3xl max-w-md w-full border-2 border-emerald-500/50 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Ficha de Jugador</h3>
                <p className="text-xs text-emerald-400 font-semibold">
                  Dueño actual: 👤 {selectedPlayerModal.ownerTeam?.user?.nickname || selectedPlayerModal.ownerTeam?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedPlayerModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toast inside modal */}
            {modalToast && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  modalToast.type === "success"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-red-500/20 text-red-300 border border-red-500/40"
                }`}
              >
                {modalToast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{modalToast.text}</span>
              </div>
            )}

            {/* Player Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-900/40 flex items-center gap-4">
              <img
                src={selectedPlayerModal.player.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                alt={selectedPlayerModal.player.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-lg"
              />
              <div>
                <h4 className="text-base font-black text-white">{selectedPlayerModal.player.name}</h4>
                <p className="text-xs text-emerald-400 font-bold">{selectedPlayerModal.player.nickname}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs font-black">
                  <span className="text-emerald-400">Valor: {selectedPlayerModal.player.marketValue}M €</span>
                  <span className="text-amber-400">
                    Cláusula: {selectedPlayerModal.player.buyoutClause || (selectedPlayerModal.player.marketValue * 1.5).toFixed(1)}M €
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons / Offer Form */}
            {selectedPlayerModal.ownerTeam?.userId === user?.id ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-xs font-bold text-amber-300">
                Este jugador pertenece a tu propia plantilla.
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {/* BUTTON 1: HACER UNA OFERTA */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-800/40 space-y-3">
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Send className="w-4 h-4" /> 1. Hacer una Oferta Directa
                  </span>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Importe de Oferta (Mínimo {selectedPlayerModal.player.marketValue.toFixed(1)}M €):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min={selectedPlayerModal.player.marketValue}
                        value={directOfferInput}
                        onChange={(e) => setDirectOfferInput(e.target.value)}
                        placeholder={`Mín. ${selectedPlayerModal.player.marketValue}M €`}
                        className="w-full bg-slate-950 border border-emerald-800/60 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={handleSendDirectOffer}
                        disabled={actionLoading}
                        className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 flex-shrink-0 transition-all"
                      >
                        {actionLoading ? "Enviando..." : "Enviar Oferta"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      ℹ️ Le llegará una notificación en Mercado al rival para que decida Aceptar o Rechazar.
                    </p>
                  </div>
                </div>

                {/* BUTTON 2: DAR CLAUSULAZO */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-800/40 space-y-3">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Zap className="w-4 h-4 fill-amber-400" /> 2. Ejecutar Clausulazo Instantáneo
                  </span>
                  <button
                    onClick={handleClausulazoFromModal}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 fill-slate-950" />
                    {actionLoading
                      ? "Procesando..."
                      : `Pagar Cláusula (${selectedPlayerModal.player.buyoutClause || (selectedPlayerModal.player.marketValue * 1.5).toFixed(1)}M €)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
