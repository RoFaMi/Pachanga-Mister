"use client";

import { useState, useEffect } from "react";
import { Users, Crown, Shield, Zap, AlertCircle, ShoppingBag, X, UserMinus, Tag } from "lucide-react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson } from "@/lib/api";

export default function PlantillaPage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [fantasyTeam, setFantasyTeam] = useState<any>(null);
  const [captainId, setCaptainId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectedSlotModal, setSelectedSlotModal] = useState<{ slotKey: string; slotTitle: string } | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);

  // Sell player listing modal state
  const [sellModalPlayer, setSellModalPlayer] = useState<any | null>(null);
  const [sellPriceInput, setSellPriceInput] = useState<string>("");

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
        const dataDetail = await safeFetchJson<{ league: any; myFantasyTeam: any }>(`/api/leagues/${demoLeague.id}`);
        if (dataDetail?.league) setLeague(dataDetail.league);
        if (dataDetail?.myFantasyTeam) {
          setFantasyTeam(dataDetail.myFantasyTeam);
          if (dataDetail.myFantasyTeam.captains?.length > 0) {
            setCaptainId(dataDetail.myFantasyTeam.captains[0].realPlayerId);
          }
        }
      }
    } catch (e) {
      console.error("Error loading fantasy roster:", e);
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

  const handleSelectCaptain = async (realPlayerId: string) => {
    if (!league || !fantasyTeam) return;
    setLoading(true);

    try {
      const currentMd = league.matchdays[0];
      const res = await fetch("/api/fantasy/captain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          matchdayId: currentMd.id,
          realPlayerId,
        }),
      });

      if (res.ok) {
        setCaptainId(realPlayerId);
      }
    } catch (e) {
      console.error("Set captain error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPlayerToSlot = async (realPlayerId: string) => {
    if (!league || !selectedSlotModal) return;
    setSavingSlot(true);

    try {
      const res = await fetch("/api/fantasy/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          realPlayerId,
          targetSlot: selectedSlotModal.slotKey,
        }),
      });

      if (res.ok) {
        setSelectedSlotModal(null);
        await fetchInitialData();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Error al asignar jugador a la posición");
      }
    } catch (e) {
      console.error("Assign slot error:", e);
    } finally {
      setSavingSlot(false);
    }
  };

  const handleVacateSlot = async () => {
    if (!league || !selectedSlotModal) return;
    setSavingSlot(true);

    try {
      const res = await fetch("/api/fantasy/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          targetSlot: selectedSlotModal.slotKey,
          action: "VACATE",
        }),
      });

      if (res.ok) {
        setSelectedSlotModal(null);
        await fetchInitialData();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Error al dejar vacía la posición");
      }
    } catch (e) {
      console.error("Vacate slot error:", e);
    } finally {
      setSavingSlot(false);
    }
  };

  const handleListPlayerForSale = async () => {
    if (!league || !sellModalPlayer) return;
    const priceVal = parseFloat(sellPriceInput);
    if (isNaN(priceVal) || priceVal < sellModalPlayer.marketValue) {
      alert(`El precio de venta no puede ser menor a su valor de mercado (${sellModalPlayer.marketValue.toFixed(1)}M €).`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/market/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          realPlayerId: sellModalPlayer.id,
          askPrice: priceVal,
          action: "SELL_LISTING",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Jugador puesto a la venta correctamente. El Míster ha hecho una oferta en Mercado.");
        setSellModalPlayer(null);
        await fetchInitialData();
      } else {
        alert(data.error || "Error al poner en venta");
      }
    } catch (e) {
      console.error("Sell listing error:", e);
    } finally {
      setLoading(false);
    }
  };

  const roster = fantasyTeam?.roster || [];
  const getPlayerBySlot = (slot: string) => roster.find((r: any) => r.positionSlot === slot)?.realPlayer;

  const portero = getPlayerBySlot("POR");
  const cierre = getPlayerBySlot("CIERRE");
  const ala1 = getPlayerBySlot("ALA_1");
  const ala2 = getPlayerBySlot("ALA_2");
  const pivot = getPlayerBySlot("PIVOT");

  const isNegativeBudget = (fantasyTeam?.budget || 0) < 0;
  const emptyStartingSlots = ["POR", "CIERRE", "ALA_1", "ALA_2", "PIVOT"].filter((s) => !getPlayerBySlot(s)).length;

  const slotLabels: Record<string, string> = {
    POR: "Portero (POR)",
    CIERRE: "Cierre (CIERRE)",
    ALA_1: "Ala Izquierda (ALA 1)",
    ALA_2: "Ala Derecha (ALA 2)",
    PIVOT: "Pívot (PIVOT)",
    UNASSIGNED: "Sin posición",
  };

  // Find current occupant & available candidates for popup modal
  const currentOccupantRosterEntry = selectedSlotModal
    ? roster.find((r: any) => r.positionSlot === selectedSlotModal.slotKey)
    : null;
  const currentOccupantPlayer = currentOccupantRosterEntry?.realPlayer;

  // Filter OUT the player currently assigned to this position slot
  const availableRosterCandidates = selectedSlotModal
    ? roster.filter((r: any) => r.positionSlot !== selectedSlotModal.slotKey)
    : [];

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {/* Header Banner */}
          <div className="glass-panel-glow p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={fantasyTeam?.badgeUrl || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80"}
                alt="Badge"
                className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40"
              />
              <div>
                <h1 className="text-xl font-extrabold text-white">{fantasyTeam?.name || "Mi Equipo Fantasy"}</h1>
                <p className="text-xs text-emerald-400 font-semibold">
                  Puntos Totales: <span className="text-amber-400 text-sm font-black">{fantasyTeam?.totalPoints || 0} pts</span>
                </p>
              </div>
            </div>

            {/* Budget & Roster Status Pill */}
            <div className="flex items-center gap-4 bg-slate-900/80 border border-emerald-800/40 p-3 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Presupuesto</span>
                <span className={`text-base font-black ${isNegativeBudget ? "text-red-400" : "text-emerald-400"}`}>
                  {fantasyTeam?.budget?.toFixed(1) || 30.0}M €
                </span>
              </div>
              <div className="w-px h-8 bg-emerald-900/40"></div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Plantilla</span>
                <span className="text-base font-black text-amber-400">{roster.length}/5 Jugadores</span>
              </div>
            </div>
          </div>

          {/* WARNING BANNERS */}
          {isNegativeBudget && (
            <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-red-400 uppercase tracking-wider">¡SANCIÓN POR PRESUPUESTO NEGATIVO!</p>
                <p className="text-[11px] font-medium text-slate-200">
                  Tu saldo es de <strong className="text-red-300">{fantasyTeam?.budget?.toFixed(1)}M €</strong>. No puntuarás en la jornada si no vendes jugadores antes de su inicio.
                </p>
              </div>
            </div>
          )}

          {emptyStartingSlots > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-amber-400 uppercase tracking-wider">
                  ⚠️ POSICIONES TITULARES VACÍAS (-{emptyStartingSlots * 4} PTS)
                </p>
                <p className="text-[11px] font-medium text-slate-200">
                  Tienes {emptyStartingSlots} posición(es) titular(es) sin cubrir. Haz clic en las posiciones del campo para asignar cualquier jugador de tu plantilla.
                </p>
              </div>
            </div>
          )}

          {/* VISUAL 5v5 FUTSAL PITCH GRAPHIC */}
          <div className="pitch-gradient rounded-3xl p-6 border border-emerald-600/40 shadow-2xl relative min-h-[460px] flex flex-col justify-between overflow-hidden">
            {/* Goal lines & Penalty arc visual overlays */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 border-b-2 border-l-2 border-r-2 border-white/20 rounded-b-full pointer-events-none"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-12 border-t-2 border-l-2 border-r-2 border-white/20 rounded-t-full pointer-events-none"></div>
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 pointer-events-none"></div>

            {/* PIVOT */}
            <div className="flex justify-center z-10 my-2">
              <PitchSlot
                player={pivot}
                slotName="PÍVOT"
                isCaptain={pivot?.id === captainId}
                onClick={() => setSelectedSlotModal({ slotKey: "PIVOT", slotTitle: "Pívot (PIVOT)" })}
              />
            </div>

            {/* ALAS */}
            <div className="flex justify-between px-6 z-10 my-2">
              <PitchSlot
                player={ala1}
                slotName="ALA 1"
                isCaptain={ala1?.id === captainId}
                onClick={() => setSelectedSlotModal({ slotKey: "ALA_1", slotTitle: "Ala Izquierda (ALA_1)" })}
              />
              <PitchSlot
                player={ala2}
                slotName="ALA 2"
                isCaptain={ala2?.id === captainId}
                onClick={() => setSelectedSlotModal({ slotKey: "ALA_2", slotTitle: "Ala Derecha (ALA_2)" })}
              />
            </div>

            {/* CIERRE */}
            <div className="flex justify-center z-10 my-2">
              <PitchSlot
                player={cierre}
                slotName="CIERRE"
                isCaptain={cierre?.id === captainId}
                onClick={() => setSelectedSlotModal({ slotKey: "CIERRE", slotTitle: "Cierre (CIERRE)" })}
              />
            </div>

            {/* PORTERO */}
            <div className="flex justify-center z-10 my-2">
              <PitchSlot
                player={portero}
                slotName="PORTERO"
                isCaptain={portero?.id === captainId}
                onClick={() => setSelectedSlotModal({ slotKey: "POR", slotTitle: "Portero (POR)" })}
              />
            </div>
          </div>

          {/* Roster Detailed Table & Captain / Selling Actions */}
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" /> Plantilla Actual & Gestión de Venta
              </h3>
              <Link href="/mercado" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" /> Ir al Mercado
              </Link>
            </div>

            {roster.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="text-sm font-semibold">No tienes jugadores en tu plantilla aún.</p>
                <Link
                  href="/mercado"
                  className="inline-block py-2.5 px-5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                >
                  Fichar Jugadores
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {roster.map((entry: any) => {
                  const p = entry.realPlayer;
                  const isCap = p.id === captainId;
                  const posName = slotLabels[entry.positionSlot] || entry.positionSlot;

                  return (
                    <div key={entry.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-2xl bg-slate-900/70 border border-emerald-900/40 gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                          alt={p.name}
                          className="w-10 h-10 rounded-xl object-cover border border-emerald-500/40"
                        />
                        <div>
                          <p className="text-sm font-black text-white flex items-center gap-1.5">
                            {p.name}
                            {isCap && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black tracking-wider">
                                CAPITÁN (x2)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-emerald-400 font-semibold">
                            {p.nickname} • <span className="text-amber-300 font-bold">En {posName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                        <div className="text-right mr-2 hidden md:block">
                          <span className="text-xs font-bold text-slate-300 block">{p.marketValue}M €</span>
                          <span className="text-[10px] font-bold text-amber-400 block">
                            Cláusula: {p.buyoutClause || (p.marketValue * 1.5).toFixed(1)}M €
                          </span>
                        </div>

                        {/* Poner a la Venta Button */}
                        <button
                          onClick={() => {
                            setSellModalPlayer(p);
                            setSellPriceInput(String(p.marketValue));
                          }}
                          disabled={loading}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1 transition-all shadow-md"
                        >
                          <Tag className="w-3.5 h-3.5" /> Poner a Venta
                        </button>

                        <button
                          onClick={async () => {
                            if ((fantasyTeam?.budget || 0) < 2.0) {
                              alert("Necesitas al menos 2.0M € de presupuesto para blindar la cláusula.");
                              return;
                            }
                            const res = await fetch("/api/market/transfers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                leagueId: league.id,
                                realPlayerId: p.id,
                                action: "SHIELD_CLAUSE",
                              }),
                            });
                            if (res.ok) {
                              fetchInitialData();
                            }
                          }}
                          disabled={loading || (fantasyTeam?.budget || 0) < 2.0}
                          title="Gasta 2.0M € para subir su cláusula +3.5M €"
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] border border-amber-500/40 flex items-center gap-1 disabled:opacity-50 transition-all"
                        >
                          <Shield className="w-3.5 h-3.5" /> Blindar
                        </button>

                        <button
                          onClick={() => handleSelectCaptain(p.id)}
                          disabled={isCap || loading}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isCap
                              ? "bg-amber-500 text-slate-950 shadow-md"
                              : "bg-slate-800 hover:bg-emerald-950 text-slate-300 border border-emerald-800/40"
                          }`}
                        >
                          {isCap ? "Capitán" : "Hacer Capitán"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* POPUP MODAL FOR SELECTING / SWAPPING PLAYER IN A PITCH POSITION */}
      {selectedSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl max-w-md w-full border border-emerald-500/40 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Posición: <span className="text-amber-400">{selectedSlotModal.slotTitle}</span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Selecciona qué jugador deseas asignar a esta posición
                </p>
              </div>
              <button
                onClick={() => setSelectedSlotModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {currentOccupantPlayer ? (
              <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={currentOccupantPlayer.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                    alt={currentOccupantPlayer.name}
                    className="w-11 h-11 rounded-xl object-cover border border-emerald-400"
                  />
                  <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">Ocupante Actual</span>
                    <p className="text-sm font-black text-white">{currentOccupantPlayer.name}</p>
                    <p className="text-xs text-slate-300 font-semibold">{currentOccupantPlayer.nickname}</p>
                  </div>
                </div>

                <button
                  onClick={handleVacateSlot}
                  disabled={savingSlot}
                  title="Dejar esta posición libre"
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/40 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <UserMinus className="w-3.5 h-3.5" /> Vaciar
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-dashed border-emerald-500/30 text-center">
                <span className="text-xs font-bold text-emerald-400">Esta posición actualmente está VACÍA</span>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                {currentOccupantPlayer ? "Jugadores disponibles para sustituir / intercambiar:" : "Jugadores disponibles de tu plantilla:"}
              </h4>

              {availableRosterCandidates.length === 0 ? (
                <div className="py-6 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">No tienes otros jugadores disponibles en tu plantilla.</p>
                  <Link
                    href="/mercado"
                    className="inline-block py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg"
                  >
                    Ir al Mercado
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {availableRosterCandidates.map((entry: any) => {
                    const p = entry.realPlayer;
                    const currentSlot = entry.positionSlot;

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={p.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-emerald-500/30"
                          />
                          <div>
                            <p className="text-sm font-black text-white">{p.name}</p>
                            <p className="text-xs text-emerald-400 font-bold">{p.nickname}</p>
                            <span className="text-[10px] font-bold text-amber-400/90 block">
                              Ubicación: {slotLabels[currentSlot] || currentSlot}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAssignPlayerToSlot(p.id)}
                          disabled={savingSlot}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingSlot ? "Guardando..." : currentOccupantPlayer ? "Intercambiar" : "Asignar Aquí"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SELL PLAYER MODAL DIRECTLY FROM PLANTILLA */}
      {sellModalPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl max-w-md w-full border border-emerald-500/40 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-400" />
                  Poner a la Venta: <span className="text-amber-400">{sellModalPlayer.nickname}</span>
                </h3>
              </div>
              <button
                onClick={() => setSellModalPlayer(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-emerald-900/40 flex items-center gap-3">
                <img
                  src={sellModalPlayer.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                  alt={sellModalPlayer.name}
                  className="w-12 h-12 rounded-xl object-cover border border-emerald-400"
                />
                <div>
                  <p className="text-sm font-black text-white">{sellModalPlayer.name}</p>
                  <p className="text-xs text-emerald-400 font-bold">Valor actual: {sellModalPlayer.marketValue}M €</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Precio de Venta Mínimo (M€):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={sellModalPlayer.marketValue}
                  value={sellPriceInput}
                  onChange={(e) => setSellPriceInput(e.target.value)}
                  className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-amber-400/90 mt-1">
                  ℹ️ El Míster te ofrece SIEMPRE {(sellModalPlayer.marketValue * 0.9).toFixed(1)}M € (90%). Tú decides en cualquier momento en el Mercado si ACEPTAR o RECHAZAR su oferta.
                </p>
              </div>

              <button
                onClick={handleListPlayerForSale}
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 transition-all"
              >
                {loading ? "Procesando..." : "Confirmar Puesta a la Venta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PitchSlot({ player, slotName, isCaptain, onClick }: any) {
  if (!player) {
    return (
      <button onClick={onClick} className="flex flex-col items-center group cursor-pointer transition-transform hover:scale-105">
        <div className="w-14 h-14 rounded-2xl bg-black/50 border-2 border-dashed border-emerald-400/50 flex items-center justify-center text-emerald-400/80 group-hover:border-emerald-300 group-hover:bg-emerald-500/20 group-hover:text-white transition-all shadow-lg">
          <Users className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-black text-emerald-300 mt-1 uppercase tracking-wider bg-slate-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/30 group-hover:border-emerald-400">
          + {slotName}
        </span>
      </button>
    );
  }

  return (
    <button onClick={onClick} className="flex flex-col items-center relative group cursor-pointer transition-transform hover:scale-105">
      {isCaptain && (
        <span className="absolute -top-3 z-20 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black border border-black shadow-md flex items-center gap-0.5">
          <Crown className="w-2.5 h-2.5" /> CAP (x2)
        </span>
      )}
      <div className="relative">
        <img
          src={player.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
          alt={player.name}
          className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 shadow-xl group-hover:border-amber-400 transition-colors"
        />
        <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black transition-opacity">
          Cambiar
        </div>
      </div>
      <div className="mt-1 bg-slate-950/90 border border-emerald-500/40 px-2.5 py-0.5 rounded-xl text-center shadow-lg group-hover:border-amber-400/60">
        <p className="text-[11px] font-black text-white truncate max-w-[100px]">{player.nickname}</p>
        <p className="text-[9px] text-amber-400 font-bold">{player.marketValue}M €</p>
      </div>
    </button>
  );
}
