"use client";

import { useState, useEffect } from "react";
import { Star, CheckCircle2, ShieldCheck, User, Info, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson } from "@/lib/api";

export default function PeerRatingPage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [ratings, setRatings] = useState<{ [playerId: string]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const RATING_DESCRIPTIONS: { [key: number]: string } = {
    0: "0 - No jugó",
    1: "1 - Muy mal",
    2: "2 - Muy flojo",
    3: "3 - Flojo",
    4: "4 - Por debajo de lo esperado",
    5: "5 - Normal",
    6: "6 - Bien",
    7: "7 - Notable",
    8: "8 - Muy bien",
    9: "9 - Excelente",
    10: "10 - ¡Partidazo!",
  };

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
      const activeLeagueId = typeof window !== "undefined" ? localStorage.getItem("pachanga_active_league_id") || "" : "";
      const [dataUser, dataLeagues] = await Promise.all([
        safeFetchJson<{ user: any }>("/api/auth/me"),
        safeFetchJson<{ leagues: any[] }>("/api/leagues"),
      ]);

      if (dataUser?.user) setUser(dataUser.user);

      if (dataLeagues?.leagues && dataLeagues.leagues.length > 0) {
        const targetLeague = dataLeagues.leagues.find((l: any) => l.id === activeLeagueId) || dataLeagues.leagues[0];
        if (targetLeague && typeof window !== "undefined") {
          localStorage.setItem("pachanga_active_league_id", targetLeague.id);
        }
        const dataDetail = await safeFetchJson<{ league: any }>(`/api/leagues/${targetLeague.id}`);
        if (dataDetail?.league) {
          setLeague(dataDetail.league);
          const currentMd = dataDetail.league.matchdays?.[0];
          if (currentMd && currentMd.matches && currentMd.matches.length > 0) {
            setMatch(currentMd.matches[0]);
          }
        }
      }
    } catch (e) {
      console.error("Error loading peer rating page:", e);
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

  const handleSetRating = (playerId: string, score: number) => {
    setRatings((prev) => ({ ...prev, [playerId]: score }));
  };

  const handleSubmitRatings = async () => {
    if (!match) return;
    setLoading(true);

    try {
      const formattedRatings = Object.entries(ratings).map(([targetRealPlayerId, score]) => ({
        targetRealPlayerId,
        score,
      }));

      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          ratings: formattedRatings,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch (e) {
      console.error("Rating submission error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Players in match (filter out current user if linked)
  const playersToRate = league?.realPlayers?.filter((p: any) => p.userId !== user?.id) || [];

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {/* Page Banner */}
          <div className="glass-panel-glow p-5 rounded-3xl flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-400 fill-amber-400" /> Valoración de Compañeros (0-10)
              </h1>
              <p className="text-xs text-emerald-400 font-semibold mt-1">
                🔒 Votación 100% Anónima y Privada. La media aritmética se convierte directamente en puntos Fantasy.
              </p>
            </div>
          </div>

          {submitted ? (
            <div className="glass-panel p-8 rounded-3xl text-center space-y-4 max-w-md mx-auto my-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
              <h2 className="text-2xl font-black text-white">¡Valoraciones Enviadas!</h2>
              <p className="text-xs text-slate-300">
                Tus puntuaciones anónimas han sido registradas. La media calculada sumará directamente a la clasificación Fantasy.
              </p>
              <Link
                href="/clasificacion"
                className="inline-block py-3 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20"
              >
                VER CLASIFICACIÓN FANTASY
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-slate-400">
                  Jugadores del partido: <span className="text-white">{playersToRate.length}</span>
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  Completadas: {Object.keys(ratings).length}/{playersToRate.length}
                </span>
              </div>

              {/* Player Rating Cards */}
              <div className="space-y-4">
                {playersToRate.map((player: any) => {
                  const currentScore = ratings[player.id] ?? 5;
                  return (
                    <div key={player.id} className="glass-panel p-4 rounded-3xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={player.photoUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"}
                            alt={player.name}
                            className="w-12 h-12 rounded-2xl object-cover border border-emerald-500/40"
                          />
                          <div>
                            <h4 className="text-sm font-black text-white">{player.name}</h4>
                            <p className="text-xs text-emerald-400 font-semibold">{player.nickname}</p>
                          </div>
                        </div>

                        {/* Current Badge Rating */}
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-sm">
                          {RATING_DESCRIPTIONS[currentScore]}
                        </div>
                      </div>

                      {/* Tactile 0-10 Number Selector Buttons */}
                      <div className="grid grid-cols-11 gap-1 pt-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            onClick={() => handleSetRating(player.id, num)}
                            className={`py-2 rounded-xl text-xs font-black transition-all ${
                              currentScore === num
                                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 scale-105"
                                : "bg-slate-900/80 hover:bg-emerald-950 text-slate-300 border border-emerald-900/40"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  onClick={handleSubmitRatings}
                  disabled={loading || Object.keys(ratings).length === 0}
                  className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/30 disabled:opacity-50"
                >
                  {loading ? "ENVIANDO..." : "ENVIAR VALORACIONES ANÓNIMAS"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
