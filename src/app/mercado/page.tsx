"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Zap, Shield, AlertCircle, Clock, Tag, X, CheckCircle, XCircle, Send } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson } from "@/lib/api";

export default function MercadoPage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [fantasyTeam, setFantasyTeam] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [pendingMisterOffers, setPendingMisterOffers] = useState<any[]>([]);
  const [incomingDirectOffers, setIncomingDirectOffers] = useState<any[]>([]);
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  
  const [marketTab, setMarketTab] = useState<"BID_MARKET" | "CLAUSULAZO">("BID_MARKET");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  
  // Countdown timer state for 12h market round
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (listings.length === 0) return;
    const roundEndsAt = new Date(listings[0].roundEndsAt).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = roundEndsAt - now;

      if (diff <= 0) {
        setTimeLeftStr("¡Resolviendo mercado...");
        clearInterval(interval);
        fetchInitialData(); // Re-fetch to trigger resolution
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeftStr(`${hours}h ${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [listings]);

  const fetchInitialData = async () => {
    try {
      const [dataUser, dataLeagues] = await Promise.all([
        safeFetchJson<{ user: any }>("/api/auth/me"),
        safeFetchJson<{ leagues: any[] }>("/api/leagues"),
      ]);

      if (dataUser?.user) setUser(dataUser.user);

      if (dataLeagues?.leagues && dataLeagues.leagues.length > 0) {
        const demoLeague = dataLeagues.leagues[0];

        const [dataDetail, dataMarket] = await Promise.all([
          safeFetchJson<{ league: any; myFantasyTeam: any }>(`/api/leagues/${demoLeague.id}`),
          safeFetchJson<{
            listings: any[];
            myBids: any[];
            pendingMisterOffers: any[];
            incomingDirectOffers: any[];
          }>(`/api/market?leagueId=${demoLeague.id}`),
        ]);

        if (dataDetail?.league) setLeague(dataDetail.league);
        if (dataDetail?.myFantasyTeam) setFantasyTeam(dataDetail.myFantasyTeam);

        if (dataMarket?.listings) setListings(dataMarket.listings);
        if (dataMarket?.pendingMisterOffers) setPendingMisterOffers(dataMarket.pendingMisterOffers);
        if (dataMarket?.incomingDirectOffers) setIncomingDirectOffers(dataMarket.incomingDirectOffers);
        if (dataMarket?.myBids) {
          setMyBids(dataMarket.myBids);
          const prefill: Record<string, string> = {};
          for (const b of dataMarket.myBids) {
            prefill[b.listingId] = String(b.amount);
          }
          setBidInputs(prefill);
        }
      }
    } catch (e) {
      console.error("Error loading transfer market data:", e);
    }
  };

  const handleSwitchUser = async (email: string) => {
    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "pachanga123" }),
      });
      const data = await loginRes.json().catch(() => null);
      if (loginRes.ok && data?.token) {
        localStorage.setItem("pachanga_token", data.token);
        window.location.reload();
      }
    } catch (e) {
      console.error("User switch failed", e);
    }
  };

  const handlePlaceBid = async (listingId: string, askingPrice: number) => {
    if (!league) return;
    const bidVal = parseFloat(bidInputs[listingId] || "");

    if (isNaN(bidVal) || bidVal < askingPrice) {
      setMessage({
        text: `No puedes pujar menos de lo que vale el jugador (${askingPrice.toFixed(1)}M €).`,
        type: "error",
      });
      return;
    }

    setLoadingId(listingId);
    setMessage(null);

    try {
      const res = await fetch("/api/market/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          listingId,
          bidAmount: bidVal,
          action: "BID",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        await fetchInitialData();
      } else {
        setMessage({ text: data.error, type: "error" });
      }
    } catch (e) {
      console.error("Bid error:", e);
      setMessage({ text: "Error de conexión al pujar", type: "error" });
    } finally {
      setLoadingId(null);
    }
  };

  const handleMisterOfferDecision = async (listingId: string, decision: "ACCEPT" | "REJECT") => {
    if (!league) return;
    setLoadingId(listingId);
    setMessage(null);

    try {
      const res = await fetch("/api/market/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          listingId,
          action: decision === "ACCEPT" ? "ACCEPT_MISTER_OFFER" : "REJECT_MISTER_OFFER",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        await fetchInitialData();
      } else {
        setMessage({ text: data.error, type: "error" });
      }
    } catch (e) {
      console.error("Mister offer decision error:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDirectOfferDecision = async (offerId: string, decision: "ACCEPT" | "REJECT") => {
    setLoadingId(offerId);
    setMessage(null);

    try {
      const res = await fetch("/api/market/direct-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESPOND",
          offerId,
          decision,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        await fetchInitialData();
      } else {
        setMessage({ text: data.error, type: "error" });
      }
    } catch (e) {
      console.error("Direct offer decision error:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleClausulazoOrShield = async (realPlayerId: string, action: "CLAUSULAZO" | "SHIELD_CLAUSE") => {
    if (!league) return;
    setLoadingId(realPlayerId);
    setMessage(null);

    try {
      const res = await fetch("/api/market/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          realPlayerId,
          action,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        fetchInitialData();
      } else {
        setMessage({ text: data.error, type: "error" });
      }
    } catch (e) {
      console.error("Action error:", e);
      setMessage({ text: "Error de conexión al procesar", type: "error" });
    } finally {
      setLoadingId(null);
    }
  };

  const myRoster = fantasyTeam?.roster || [];
  const myRosterIds = myRoster.map((r: any) => r.realPlayerId);

  // Filter Rival Players for Clausulazos
  const rivalPlayers = (league?.realPlayers || []).filter((p: any) => {
    const ownerEntry = p.rosterEntries && p.rosterEntries.length > 0 ? p.rosterEntries[0] : null;
    const isOwnedByRival = ownerEntry && ownerEntry.fantasyTeam?.userId !== user?.id;
    return isOwnedByRival;
  });

  const currentMd = league?.matchdays?.[0];
  const is24hLockdown = currentMd?.date && (new Date(currentMd.date).getTime() - Date.now() < 24 * 60 * 60 * 1000);

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {/* Header Banner */}
          <div className="glass-panel-glow p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white">Mercado de Fichajes</h1>
                <p className="text-xs text-emerald-400 font-semibold">
                  Pujas secretas de 12h, ofertas recibidas y clausulazos a rivales
                </p>
              </div>
            </div>

            {/* Budget & Status pill */}
            <div className="flex items-center gap-4 bg-slate-900/80 border border-emerald-800/40 p-3 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Presupuesto</span>
                <span className="text-base font-black text-emerald-400">{fantasyTeam?.budget?.toFixed(1) || 30.0}M €</span>
              </div>
              <div className="w-px h-8 bg-emerald-900/40"></div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Plantilla</span>
                <span className="text-base font-black text-amber-400">{myRosterIds.length}/6</span>
              </div>
            </div>
          </div>

          {/* Toast Notice */}
          {message && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-red-500/20 text-red-300 border border-red-500/40"
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          {/* INCOMING DIRECT MANAGER OFFERS SECTION */}
          {incomingDirectOffers.length > 0 && (
            <div className="p-5 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/50 space-y-4 shadow-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-emerald-300 flex items-center gap-2">
                  <Send className="w-5 h-5 text-emerald-400" /> Ofertas Directas de Rivales Recibidas
                </h3>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-xl border border-emerald-500/30">
                  {incomingDirectOffers.length} oferta(s) de rivales
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {incomingDirectOffers.map((offer: any) => {
                  const p = offer.realPlayer;
                  const buyerName = offer.buyerTeam?.user?.nickname || offer.buyerTeam?.name;
                  const isLoading = loadingId === offer.id;

                  return (
                    <div key={offer.id} className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover border border-emerald-400"
                        />
                        <div>
                          <h4 className="text-sm font-black text-white">{p.name}</h4>
                          <p className="text-xs text-amber-400 font-bold">
                            Oferta de rival: 👤 <span className="text-white">{buyerName}</span>
                          </p>
                          <p className="text-xs font-bold text-emerald-400 mt-0.5">
                            Ofrece: <strong className="text-emerald-300 text-sm font-black">{offer.amount.toFixed(1)}M €</strong>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-900/40">
                        <button
                          onClick={() => handleDirectOfferDecision(offer.id, "ACCEPT")}
                          disabled={isLoading}
                          className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" /> Aceptar ({offer.amount.toFixed(1)}M)
                        </button>
                        <button
                          onClick={() => handleDirectOfferDecision(offer.id, "REJECT")}
                          disabled={isLoading}
                          className="py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PENDING MÍSTER OFFERS SECTION */}
          {pendingMisterOffers.length > 0 && (
            <div className="p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/50 space-y-4 shadow-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-400" /> Ofertas del Míster Pendientes de Tu Decisión
                </h3>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30">
                  {pendingMisterOffers.length} oferta(s) recibida(s)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingMisterOffers.map((offer: any) => {
                  const p = offer.realPlayer;
                  const offerPrice = offer.misterOfferPrice || Math.round(p.marketValue * 0.9 * 10) / 10;
                  const isLoading = loadingId === offer.id;

                  return (
                    <div key={offer.id} className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/40 space-y-3 shadow-lg">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover border border-amber-400"
                        />
                        <div>
                          <h4 className="text-sm font-black text-white">{p.name}</h4>
                          <p className="text-xs text-slate-300">
                            Valor de mercado: <strong className="text-emerald-400">{p.marketValue}M €</strong>
                          </p>
                          <p className="text-xs font-bold text-amber-400 mt-0.5">
                            💼 Oferta del Míster (90%): <strong className="text-amber-300 text-sm font-black">{offerPrice.toFixed(1)}M €</strong>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-900/40">
                        <button
                          onClick={() => handleMisterOfferDecision(offer.id, "ACCEPT")}
                          disabled={isLoading}
                          className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" /> Aceptar ({offerPrice.toFixed(1)}M)
                        </button>
                        <button
                          onClick={() => handleMisterOfferDecision(offer.id, "REJECT")}
                          disabled={isLoading}
                          className="py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 12h Market Cycle Status Banner */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-emerald-900/50 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>Tiempo Restante del Mercado Actual:</span>
                <span className="bg-amber-400 text-slate-950 px-3 py-1 rounded-xl text-base font-black shadow-md">
                  {timeLeftStr || "12h 00m 00s"}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-300">
                <span>Ronda de 6 Jugadores en Subasta</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-300">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-900/40">
                <strong className="text-emerald-400 block mb-0.5">🔒 Pujas Secretas (12h)</strong>
                Nadie ve tu puja hasta que terminen las 12 horas. Gana la puja más alta.
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-900/40">
                <strong className="text-amber-400 block mb-0.5">💼 Oferta del Míster (90%)</strong>
                Al poner a la venta desde tu plantilla, el Míster te hace oferta del 90%. Tú decides si ACEPTAR o RECHAZAR.
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-900/40">
                <strong className="text-red-400 block mb-0.5">⚡ Clausulazos & Cierre (24h)</strong>
                Blindaje dura 1 jornada. Los clausulazos se bloquean 24h antes del inicio de la jornada.
              </div>
            </div>
          </div>

          {/* Market Tab Bar */}
          <div className="glass-panel p-4 rounded-3xl space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMarketTab("BID_MARKET")}
                className={`py-2 px-4 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
                  marketTab === "BID_MARKET"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Mercado 12h ({listings.length})
              </button>
              <button
                onClick={() => setMarketTab("CLAUSULAZO")}
                className={`py-2 px-4 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
                  marketTab === "CLAUSULAZO"
                    ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-900 text-amber-400 hover:bg-amber-500/10"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Clausulazos a Rivales ({rivalPlayers.length})
              </button>
            </div>
          </div>

          {/* TAB 1: 12-HOUR SECRET BID MARKET */}
          {marketTab === "BID_MARKET" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing: any) => {
                const p = listing.realPlayer;
                const isMine = myRosterIds.includes(p.id);
                const isUserSeller = listing.sellerTeamId !== null;
                const sellerName = listing.sellerTeam?.user?.nickname || listing.sellerTeam?.name;
                
                const myBid = myBids.find((b: any) => b.listingId === listing.id);
                const isLoading = loadingId === listing.id;

                return (
                  <div key={listing.id} className="glass-panel p-4 rounded-3xl space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                            alt={p.name}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40"
                          />
                          <div>
                            <h4 className="text-sm font-black text-white">{p.name}</h4>
                            <p className="text-xs text-emerald-400 font-bold">{p.nickname}</p>
                          </div>
                        </div>
                      </div>

                      {/* Listing origin badge */}
                      <div className="text-[11px] p-2 rounded-xl bg-slate-900/80 border border-emerald-900/30 flex items-center justify-between">
                        <span className="text-slate-400 font-bold">Origen:</span>
                        {isUserSeller ? (
                          <span className="font-black text-amber-400">👤 Vendedor: {sellerName}</span>
                        ) : (
                          <span className="font-black text-emerald-400">🌐 Agente Libre Sistema</span>
                        )}
                      </div>

                      {/* Current bid status badge */}
                      {myBid && (
                        <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center justify-between">
                          <span>🎯 Tu puja guardada:</span>
                          <span className="text-amber-300 font-black text-xs">{myBid.amount.toFixed(1)}M €</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-emerald-900/30 space-y-3">
                      <div className="p-2 rounded-xl bg-slate-900/60 border border-emerald-900/40 text-center">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Puja Mínima / Valor</span>
                        <span className="text-sm font-black text-emerald-400">{listing.askingPrice.toFixed(1)}M €</span>
                      </div>

                      {/* Bidding Controls */}
                      {!isMine ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min={listing.askingPrice}
                              value={bidInputs[listing.id] || ""}
                              onChange={(e) => setBidInputs({ ...bidInputs, [listing.id]: e.target.value })}
                              placeholder={`Mín. ${listing.askingPrice.toFixed(1)}M €`}
                              className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={() => handlePlaceBid(listing.id, listing.askingPrice)}
                              disabled={isLoading || (myRosterIds.length >= 6)}
                              className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 flex-shrink-0 transition-all"
                            >
                              {isLoading ? "Enviando..." : myBid ? "Actualizar Puja" : "Pujar Secreto"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center text-xs font-bold">
                          Tu propio jugador está en venta
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: CLAUSULAZOS A RIVALES */}
          {marketTab === "CLAUSULAZO" && (
            <div className="space-y-4">
              {is24hLockdown && (
                <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-black text-red-400 uppercase tracking-wider">🚫 CLAUSULAZOS CERRADOS POR PROXIMIDAD DE JORNADA</p>
                    <p className="text-[11px] font-medium text-slate-200">
                      Faltan menos de 24 horas para el inicio de la jornada. Los clausulazos se vuelven a abrir al finalizar la jornada.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rivalPlayers.map((player: any) => {
                  const ownerEntry = player.rosterEntries && player.rosterEntries.length > 0 ? player.rosterEntries[0] : null;
                  const ownerName = ownerEntry?.fantasyTeam?.user?.nickname || ownerEntry?.fantasyTeam?.name;
                  const buyoutClause = player.buyoutClause || Math.round((player.marketValue * 1.5) * 10) / 10;
                  const isLoading = loadingId === player.id;
                  const canAffordClause = (fantasyTeam?.budget || 0) >= buyoutClause;
                  const isShielded = currentMd && player.shieldedAtMatchdayNumber === currentMd.number;

                  return (
                    <div key={player.id} className="glass-panel p-4 rounded-3xl space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={player.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                              alt={player.name}
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40"
                            />
                            <div>
                              <h4 className="text-sm font-black text-white">{player.name}</h4>
                              <p className="text-xs text-emerald-400 font-bold">{player.nickname}</p>
                              {isShielded && (
                                <span className="px-1.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/40 flex items-center gap-0.5 mt-1 inline-block">
                                  <Shield className="w-3 h-3 inline" /> Blindado J#{currentMd.number}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] p-2 rounded-xl bg-slate-900/80 border border-emerald-900/30 flex items-center justify-between">
                          <span className="text-slate-400 font-bold">Rival Dueño:</span>
                          <span className="font-black text-amber-400">👤 {ownerName}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-900/30 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-xl bg-slate-900/60 border border-emerald-900/40">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Valor Mercado</span>
                            <span className="text-sm font-black text-emerald-400">{player.marketValue}M €</span>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block">Cláusula Rescisión</span>
                            <span className="text-sm font-black text-amber-300">{buyoutClause}M €</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleClausulazoOrShield(player.id, "CLAUSULAZO")}
                          disabled={isLoading || !canAffordClause || is24hLockdown || isShielded || (myRosterIds.length >= 6)}
                          className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                        >
                          <Zap className="w-4 h-4 fill-slate-950" />
                          {isShielded ? "BLINDADO ESTA JORNADA" : is24hLockdown ? "CLAUSULAZOS CERRADOS (<24H)" : `PAGAR CLAUSULAZO (${buyoutClause}M €)`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
