"use client";

import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Plus, CheckCircle2, Shield, Flame, Award, Timer, Volume2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson } from "@/lib/api";

export default function PachangaLivePage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [matchday, setMatchday] = useState<any>(null);

  // Match State
  const [selectedTeamA, setSelectedTeamA] = useState<any>(null);
  const [selectedTeamB, setSelectedTeamB] = useState<any>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [matchFinished, setMatchFinished] = useState(false);
  const [endedCondition, setEndedCondition] = useState<string | null>(null);

  // Goal Modal State
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [scoringTeam, setScoringTeam] = useState<any>(null);
  const [scorerId, setScorerId] = useState<string>("");
  const [assisterId, setAssisterId] = useState<string>("");

  // Penalty Modal State
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [penaltyWinnerId, setPenaltyWinnerId] = useState<string>("");

  // Rating Redirect Modal
  const [ratingModalOpen, setRatingModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pachanga_user");
      if (stored) {
        try { setUser(JSON.parse(stored)); } catch {}
      }
    }
    fetchInitialData();
  }, []);

  // Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            handleFinishMatch("TIME_LIMIT");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

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
          setMatchday(currentMd);

          if (currentMd && currentMd.matchTeams && currentMd.matchTeams.length >= 2) {
            setSelectedTeamA(currentMd.matchTeams[0]);
            setSelectedTeamB(currentMd.matchTeams[1]);
          }
        }
      }
    } catch (e) {
      console.error("Error loading pachanga live data:", e);
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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  const handleOpenGoalModal = (team: any) => {
    setScoringTeam(team);
    setScorerId("");
    setAssisterId("");
    setGoalModalOpen(true);
  };

  const handleAddGoal = () => {
    if (!scorerId) return;

    const isTeamA = scoringTeam.id === selectedTeamA.id;
    const newScoreA = isTeamA ? scoreA + 1 : scoreA;
    const newScoreB = !isTeamA ? scoreB + 1 : scoreB;

    setScoreA(newScoreA);
    setScoreB(newScoreB);

    const minute = Math.ceil((600 - timerSeconds) / 60);

    const newEvent = {
      type: "GOAL",
      realPlayerId: scorerId,
      assisterPlayerId: assisterId || null,
      minute,
      teamId: scoringTeam.id,
    };

    setEvents([...events, newEvent]);
    setGoalModalOpen(false);

    // Auto-finish rule: First team to 2 goals wins!
    if (newScoreA >= 2 || newScoreB >= 2) {
      setIsTimerRunning(false);
      handleFinishMatch("TWO_GOALS");
    }
  };

  const handleFinishMatch = (condition: string) => {
    setMatchFinished(true);
    setEndedCondition(condition);

    // Check if draw -> trigger penalty shootout modal
    if (scoreA === scoreB) {
      setPenaltyModalOpen(true);
    } else {
      setRatingModalOpen(true);
    }
  };

  const handleSaveMatchToBackend = async () => {
    try {
      if (!matchday || !selectedTeamA || !selectedTeamB) return;

      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchdayId: matchday.id,
          teamAId: selectedTeamA.id,
          teamBId: selectedTeamB.id,
          scoreA,
          scoreB,
          endedCondition: endedCondition || "MANUAL",
          isPenaltyShootout: !!penaltyWinnerId,
          penaltyWinnerTeamId: penaltyWinnerId || null,
          events,
          lineupsA: league?.realPlayers?.slice(0, 5).map((p: any) => p.id) || [],
          lineupsB: league?.realPlayers?.slice(5, 10).map((p: any) => p.id) || [],
          goalkeeperAId: league?.realPlayers?.[0]?.id,
          goalkeeperBId: league?.realPlayers?.[1]?.id,
        }),
      });

      if (res.ok) {
        window.location.href = "/valoracion";
      }
    } catch (e) {
      console.error("Save match error:", e);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {/* Header Banner */}
          <div className="glass-panel-glow p-4 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                  MODO PACHANGA <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">EN DIRECTO</span>
                </h1>
                <p className="text-xs text-emerald-400 font-medium">Control rápido optimizado para móvil durante el partido</p>
              </div>
            </div>
          </div>

          {/* Teams Selector Pill */}
          <div className="glass-panel p-4 rounded-3xl grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Equipo 1</label>
              <select
                value={selectedTeamA?.id || ""}
                onChange={(e) => {
                  const t = matchday?.matchTeams?.find((mt: any) => mt.id === e.target.value);
                  setSelectedTeamA(t);
                }}
                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-sm font-bold text-white focus:outline-none"
              >
                {matchday?.matchTeams?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Equipo 2</label>
              <select
                value={selectedTeamB?.id || ""}
                onChange={(e) => {
                  const t = matchday?.matchTeams?.find((mt: any) => mt.id === e.target.value);
                  setSelectedTeamB(t);
                }}
                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-sm font-bold text-white focus:outline-none"
              >
                {matchday?.matchTeams?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MAIN SCOREBOARD & BIG TIMER */}
          <div className="pitch-gradient rounded-3xl p-6 border border-emerald-600/40 shadow-2xl relative overflow-hidden flex flex-col items-center">
            {/* Background texture line */}
            <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>

            {/* Timer Banner */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/50 border border-emerald-500/30 text-emerald-300 mb-6 backdrop-blur-md">
              <Timer className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} />
              <span className="font-mono text-3xl font-black tracking-widest">{formatTime(timerSeconds)}</span>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center gap-3 mb-8">
              {!isTimerRunning ? (
                <button
                  onClick={() => setIsTimerRunning(true)}
                  className="big-touch-btn flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/30"
                >
                  <Play className="w-5 h-5 fill-current" /> EMPEZAR CRONO
                </button>
              ) : (
                <button
                  onClick={() => setIsTimerRunning(false)}
                  className="big-touch-btn flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base shadow-lg shadow-amber-500/30"
                >
                  <Pause className="w-5 h-5 fill-current" /> PAUSAR
                </button>
              )}
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(600);
                  setScoreA(0);
                  setScoreB(0);
                  setEvents([]);
                  setMatchFinished(false);
                }}
                className="big-touch-btn p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-emerald-800/40"
                title="Reiniciar"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Score Display & Big Goal Buttons */}
            <div className="w-full grid grid-cols-2 gap-4 items-center mb-6">
              {/* Team A */}
              <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/30">
                <span className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider mb-1 text-center">
                  {selectedTeamA?.name || "Equipo A"}
                </span>
                <span className="text-6xl font-black text-white my-2">{scoreA}</span>
                <button
                  onClick={() => handleOpenGoalModal(selectedTeamA)}
                  disabled={matchFinished}
                  className="big-touch-btn w-full mt-2 py-4 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <Plus className="w-6 h-6 stroke-[3]" /> GOL!
                </button>
              </div>

              {/* Team B */}
              <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-950/60 border border-blue-500/30">
                <span className="text-xs font-extrabold uppercase text-blue-400 tracking-wider mb-1 text-center">
                  {selectedTeamB?.name || "Equipo B"}
                </span>
                <span className="text-6xl font-black text-white my-2">{scoreB}</span>
                <button
                  onClick={() => handleOpenGoalModal(selectedTeamB)}
                  disabled={matchFinished}
                  className="big-touch-btn w-full mt-2 py-4 px-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Plus className="w-6 h-6 stroke-[3]" /> GOL!
                </button>
              </div>
            </div>

            {/* Match Rules Quick Note */}
            <div className="text-[11px] text-emerald-300/80 font-medium text-center">
              * El partido finaliza automáticamente al llegar a <span className="font-bold text-amber-300">2 goles</span> o agotar los <span className="font-bold text-amber-300">10 minutos</span>.
            </div>
          </div>

          {/* Live Events Log */}
          <div className="glass-panel p-4 rounded-3xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Eventos del Partido en Directo
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No se han registrado goles aún.</p>
            ) : (
              <div className="space-y-2">
                {events.map((ev, idx) => {
                  const player = league?.realPlayers?.find((p: any) => p.id === ev.realPlayerId);
                  const assister = ev.assisterPlayerId ? league?.realPlayers?.find((p: any) => p.id === ev.assisterPlayerId) : null;
                  return (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-emerald-900/40 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                          {ev.minute}'
                        </span>
                        <span className="font-bold text-white">⚽ GOL de {player?.name || "Jugador"}</span>
                        {assister && <span className="text-slate-400">(Asistencia: {assister.name})</span>}
                      </div>
                      <span className="font-semibold text-emerald-400">+5 pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL 1: REGISTRAR GOLEADOR Y ASISTENTE */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="glass-panel-glow w-full max-w-md rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              ⚽ Registrar Gol para <span className="text-emerald-400">{scoringTeam?.name}</span>
            </h3>

            {/* Select Scorer */}
            <div>
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Goleador (+5 Puntos)</label>
              <select
                value={scorerId}
                onChange={(e) => setScorerId(e.target.value)}
                className="w-full bg-slate-900 border border-emerald-800 rounded-xl p-3 text-sm font-bold text-white focus:outline-none"
              >
                <option value="">-- Seleccionar Goleador --</option>
                {league?.realPlayers?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.nickname}) - {p.position}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Assister */}
            <div>
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Asistente (+3 Puntos - Opcional)</label>
              <select
                value={assisterId}
                onChange={(e) => setAssisterId(e.target.value)}
                className="w-full bg-slate-900 border border-emerald-800 rounded-xl p-3 text-sm font-bold text-white focus:outline-none"
              >
                <option value="">-- Sin Asistencia --</option>
                {league?.realPlayers?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.nickname})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setGoalModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-900 text-slate-400 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddGoal}
                disabled={!scorerId}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm disabled:opacity-50"
              >
                Confirmar Gol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TANDA DE PENALTIS (SI EMPATE) */}
      {penaltyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow w-full max-w-md rounded-3xl p-5 space-y-4 text-center">
            <h3 className="text-lg font-black text-white">🤝 Empate ({scoreA} - {scoreB})</h3>
            <p className="text-xs text-amber-300 font-semibold">
              El partido ha terminado en tablas. Selecciona el ganador de la tanda de penaltis decisiva (+3 pts al penalti decisivo).
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setPenaltyWinnerId(selectedTeamA.id);
                  setPenaltyModalOpen(false);
                  setRatingModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold text-emerald-300 text-sm"
              >
                Ganador: {selectedTeamA?.name}
              </button>
              <button
                onClick={() => {
                  setPenaltyWinnerId(selectedTeamB.id);
                  setPenaltyModalOpen(false);
                  setRatingModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 font-bold text-blue-300 text-sm"
              >
                Ganador: {selectedTeamB?.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR Y ABRIR VALORACIONES */}
      {ratingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow w-full max-w-md rounded-3xl p-6 space-y-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-xl font-black text-white">¡PARTIDO FINALIZADO!</h3>
            <p className="text-sm text-slate-300">
              Resultado final: <span className="font-bold text-amber-400">{selectedTeamA?.name} {scoreA} - {scoreB} {selectedTeamB?.name}</span>
            </p>
            <p className="text-xs text-emerald-300">
              A continuación se abre la pantalla de valoraciones anónimas de los compañeros (1 al 10).
            </p>
            <button
              onClick={handleSaveMatchToBackend}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/30"
            >
              IR A VALORAR COMPAÑEROS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
