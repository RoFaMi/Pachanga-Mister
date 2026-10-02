"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, Plus, CheckCircle2, RefreshCw, Download, Users, Calendar, Lock, ArrowLeft, ArrowRightLeft, UserPlus, Trash2, Upload, UserMinus, UserX, LogOut, Key, RotateCcw, Shuffle, X, Wallet, Pencil } from "lucide-react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson, authFetch } from "@/lib/api";

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [matchdayName, setMatchdayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // New Player Form State
  const [playerName, setPlayerName] = useState("");
  const [playerNickname, setPlayerNickname] = useState("");
  const [playerPosition, setPlayerPosition] = useState("ALA");
  const [playerMarketValue, setPlayerMarketValue] = useState("12.0");
  const [playerPhotoUrl, setPlayerPhotoUrl] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Edit Player State (Modal)
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerNickname, setEditPlayerNickname] = useState("");
  const [editPlayerPosition, setEditPlayerPosition] = useState("ALA");
  const [editPlayerMarketValue, setEditPlayerMarketValue] = useState("10.0");
  const [editPlayerPhotoUrl, setEditPlayerPhotoUrl] = useState("");
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resettingStats, setResettingStats] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Matchday editing state
  const [editingMatchday, setEditingMatchday] = useState<any | null>(null);
  const [editMatchdayName, setEditMatchdayName] = useState("");
  const [editMatchdayStatus, setEditMatchdayStatus] = useState("SCHEDULED");

  const handleResetUserPassword = async (userId: string, nickname: string) => {
    const newPassword = prompt(`Introduce la nueva contraseña para el mánager '${nickname}':`);
    if (!newPassword) return;
    if (newPassword.trim().length < 4) {
      alert("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    setResettingUserId(userId);
    setMessage(null);

    try {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPassword.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setMessage(data.error || "Error al restablecer la contraseña");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setMessage("Error al restablecer la contraseña");
    } finally {
      setResettingUserId(null);
    }
  };

  const executeReset = async (mode: "EMPTY" | "DRAFT_5") => {
    const confirmMessage = mode === "DRAFT_5"
      ? "⚠️ ¿Estás seguro de que deseas REINICIAR LA LIGA con plantillas aleatorias (5 jugadores < 30M € + saldo restante)?"
      : "⚠️ ¿Estás seguro de que deseas REINICIAR LA LIGA con plantillas vacías y 30.0M € de saldo?";

    if (!confirm(confirmMessage)) return;

    setResettingStats(true);
    setShowResetModal(false);
    setMessage(null);

    try {
      const res = await authFetch("/api/admin/reset-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetMode: mode, leagueId: league?.id }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchInitialData();
      } else {
        setMessage(data.error || "Error al reiniciar la liga");
      }
    } catch (err) {
      console.error("Reset stats error:", err);
      setMessage("Error al reiniciar la liga");
    } finally {
      setResettingStats(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setMessage("La imagen debe ser menor a 8MB");
      return;
    }

    setUploadingPhoto(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        setPlayerPhotoUrl(base64Url);
        setMessage("Foto de tu dispositivo cargada correctamente");
      }
      setUploadingPhoto(false);
    };
    reader.onerror = () => {
      setMessage("Error al leer el archivo de imagen");
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

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
      console.error("Error loading admin data:", e);
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

  const handleCreateMatchday = async () => {
    if (!league) return;
    try {
      const res = await authFetch("/api/admin/matchday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          name: matchdayName || `Jornada ${(league.matchdays?.length || 0) + 1}`,
          action: "CREATE_MATCHDAY",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setMatchdayName("");
        fetchInitialData();
      }
    } catch (e) {
      console.error("Create matchday error:", e);
    }
  };

  const handleDeleteMatchday = async (matchdayId: string, name: string) => {
    if (!league) return;
    if (!confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR permanentemente '${name}' y todos sus partidos/estadísticas asociadas?`)) {
      return;
    }

    setMessage(null);
    try {
      const res = await authFetch("/api/admin/matchday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          matchdayId,
          action: "DELETE_MATCHDAY",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchInitialData();
      } else {
        setMessage(data.error || "Error al eliminar la jornada");
      }
    } catch (e) {
      console.error("Delete matchday error:", e);
      setMessage("Error al eliminar la jornada");
    }
  };

  const handleEditMatchday = async (matchdayId: string) => {
    if (!league || !editMatchdayName.trim()) return;

    setMessage(null);
    try {
      const res = await authFetch("/api/admin/matchday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          matchdayId,
          name: editMatchdayName.trim(),
          status: editMatchdayStatus,
          action: "EDIT_MATCHDAY",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setEditingMatchday(null);
        fetchInitialData();
      } else {
        setMessage(data.error || "Error al editar la jornada");
      }
    } catch (e) {
      console.error("Edit matchday error:", e);
      setMessage("Error al editar la jornada");
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!league) return;
    setCreatingPlayer(true);
    setMessage(null);

    try {
      const res = await authFetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          name: playerName,
          nickname: playerNickname,
          position: playerPosition,
          marketValue: parseFloat(playerMarketValue) || 10.0,
          photoUrl: playerPhotoUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setPlayerName("");
        setPlayerNickname("");
        setPlayerPhotoUrl("");
        fetchInitialData();
      } else {
        setMessage(data.error);
      }
    } catch (err) {
      console.error("Create player error:", err);
      setMessage("Error al crear el jugador");
    } finally {
      setCreatingPlayer(false);
    }
  };

  const handleDeletePlayer = async (playerId: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar a ${name}?`)) {
      return;
    }
    setDeletingPlayerId(playerId);
    setMessage(null);

    try {
      const res = await authFetch(`/api/admin/players/${playerId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchInitialData();
      } else {
        setMessage(data.error || "Error al eliminar el jugador");
      }
    } catch (err) {
      console.error("Delete player error:", err);
      setMessage("Error al eliminar el jugador");
    } finally {
      setDeletingPlayerId(null);
    }
  };

  const handleOpenEditPlayer = (p: any) => {
    setEditingPlayer(p);
    setEditPlayerName(p.name || "");
    setEditPlayerNickname(p.nickname || "");
    setEditPlayerPosition(p.position || "ALA");
    setEditPlayerMarketValue(String(p.marketValue || 10.0));
    setEditPlayerPhotoUrl(p.photoUrl || "");
  };

  const handleSaveEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    setSavingPlayer(true);
    setMessage(null);

    try {
      const res = await authFetch(`/api/admin/players/${editingPlayer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editPlayerName,
          nickname: editPlayerNickname,
          position: editPlayerPosition,
          marketValue: parseFloat(editPlayerMarketValue) || 10.0,
          photoUrl: editPlayerPhotoUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setEditingPlayer(null);
        fetchInitialData();
      } else {
        setMessage(data.error || "Error al actualizar el jugador");
      }
    } catch (err) {
      console.error("Save edit player error:", err);
      setMessage("Error al actualizar el jugador");
    } finally {
      setSavingPlayer(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setMessage("La imagen debe ser menor a 8MB");
      return;
    }

    setUploadingPhoto(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        setUploadingPhoto(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const MAX_SIZE = 150;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedWebP = canvas.toDataURL("image/webp", 0.75);
          setPlayerPhotoUrl(compressedWebP);
          setMessage("Foto comprimida y cargada con éxito.");
        } catch {
          setPlayerPhotoUrl(rawDataUrl);
        } finally {
          setUploadingPhoto(false);
        }
      };
      img.onerror = () => {
        setMessage("Error al procesar la imagen");
        setUploadingPhoto(false);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setMessage("La imagen debe ser menor a 8MB");
      return;
    }

    setUploadingEditPhoto(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        setUploadingEditPhoto(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const MAX_SIZE = 150;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedWebP = canvas.toDataURL("image/webp", 0.75);
          setEditPlayerPhotoUrl(compressedWebP);
          setMessage("Foto editada y comprimida.");
        } catch {
          setEditPlayerPhotoUrl(rawDataUrl);
        } finally {
          setUploadingEditPhoto(false);
        }
      };
      img.onerror = () => {
        setMessage("Error al procesar la imagen");
        setUploadingEditPhoto(false);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteUser = async (userId: string, nickname: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al mánager '${nickname}' de la liga y del sistema?`)) {
      return;
    }
    setDeletingUserId(userId);
    setMessage(null);

    try {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchInitialData();
      } else {
        setMessage(data.error || "Error al eliminar el mánager");
      }
    } catch (err) {
      console.error("Delete user error:", err);
      setMessage("Error al eliminar el usuario");
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleLeaveLeague = async () => {
    if (!league) return;
    if (!confirm(`¿Estás seguro de que deseas salir de la liga '${league.name}'? Se borrará tu equipo de esta liga.`)) {
      return;
    }
    setMessage(null);
    try {
      const res = await authFetch("/api/leagues/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        window.location.href = "/";
      } else {
        setMessage(data.error || "Error al salir de la liga");
      }
    } catch (err) {
      console.error("Leave league error:", err);
      setMessage("Error al intentar salir de la liga");
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("⚠️ ATENCIÓN: ¿Estás seguro de que deseas ELIMINAR TU CUENTA PERMANENTEMENTE? Esta acción borrará todos tus datos.")) {
      return;
    }
    try {
      const res = await authFetch("/api/auth/me", {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        alert("Tu cuenta ha sido eliminada con éxito.");
        if (typeof window !== "undefined") {
          localStorage.removeItem("pachanga_token");
          localStorage.removeItem("pachanga_user");
        }
        window.location.href = "/auth/login";
      } else {
        setMessage(data.error || "Error al borrar tu cuenta");
      }
    } catch (err) {
      console.error("Delete account error:", err);
      setMessage("Error al borrar tu cuenta");
    }
  };

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,Nombre,Posicion,Precio,Goles,Asistencias\n" +
      (league?.realPlayers || []).map((p: any) => `${p.name},${p.position},${p.marketValue},4,2`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pachanga_stats_${league?.code || "league"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAdmin = user?.role === "ADMIN" || league?.ownerId === user?.id;

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {!isAdmin ? (
            /* NON-ADMIN RESTRICTED ACCESS SCREEN */
            <div className="glass-panel p-8 rounded-3xl text-center max-w-md mx-auto my-12 space-y-4 border border-amber-500/30">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white">Acceso Restringido</h2>
              <p className="text-xs text-slate-300">
                Esta sección está reservada exclusivamente para el <span className="font-bold text-amber-400">Administrador de la liga</span>.
              </p>
              <p className="text-[11px] text-emerald-400 italic">
                Actualmente estás conectado como <span className="font-bold">{user?.nickname || "Participante"}</span> ({user?.role || "USER"}).
              </p>

              <div className="pt-3 space-y-2">
                <button
                  onClick={() => handleSwitchUser("admin@pachanga.com")}
                  className="w-full py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Cambiar a Carlos Míster (ADMIN Demo)
                </button>
                <Link
                  href="/"
                  className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-emerald-900/40 flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                </Link>
              </div>
            </div>
          ) : (
            /* FULL ADMIN PANEL FOR ADMINS ONLY */
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="glass-panel-glow p-5 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl font-extrabold text-white">Panel de Administración</h1>
                    <p className="text-xs text-emerald-400 font-semibold">Crear jugadores reales, jornadas y equipos A/B/C</p>
                  </div>
                </div>

                <button
                  onClick={handleExportCSV}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 border border-emerald-800/60 text-xs font-bold text-emerald-300 flex items-center gap-2 hover:bg-emerald-950 transition-colors"
                >
                  <Download className="w-4 h-4 text-amber-400" /> Exportar CSV
                </button>
              </div>

              {message && (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {message}
                </div>
              )}

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Form: Create Real Player */}
                <div className="glass-panel p-5 rounded-3xl space-y-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-400" /> Crear Jugador Real de la Pachanga
                  </h3>

                  <form onSubmit={handleCreatePlayer} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Nombre Completo</label>
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          placeholder="Ej: Marcos Llorente"
                          required
                          className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Apodo / Nickname</label>
                        <input
                          type="text"
                          value={playerNickname}
                          onChange={(e) => setPlayerNickname(e.target.value)}
                          placeholder="Ej: El Balón"
                          required
                          className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Posición</label>
                        <select
                          value={playerPosition}
                          onChange={(e) => setPlayerPosition(e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none"
                        >
                          <option value="POR">Portero (POR)</option>
                          <option value="CIERRE">Cierre (CIERRE)</option>
                          <option value="ALA">Ala (ALA)</option>
                          <option value="PIVOT">Pívot (PIVOT)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Precio de Mercado (M €)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={playerMarketValue}
                          onChange={(e) => setPlayerMarketValue(e.target.value)}
                          placeholder="12.0"
                          required
                          className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Foto del Jugador</label>
                      <div className="space-y-2">
                        <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 text-amber-400" />
                          <span>{uploadingPhoto ? "SUBIENDO FOTO DE TU DISPOSITIVO..." : "📁 SUBIR FOTO DESDE LOCAL (PC / MÓVIL)"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={uploadingPhoto}
                            className="hidden"
                          />
                        </label>

                        <div className="relative">
                          <input
                            type="text"
                            value={playerPhotoUrl}
                            onChange={(e) => setPlayerPhotoUrl(e.target.value)}
                            placeholder="O pega una URL de imagen externa (https://...)"
                            className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                          />
                        </div>

                        {playerPhotoUrl && (
                          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-emerald-900/50">
                            <img
                              src={playerPhotoUrl}
                              alt="Vista previa del jugador"
                              className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                            <div className="overflow-hidden flex-1">
                              <p className="text-[10px] text-emerald-400 font-bold uppercase">Foto Seleccionada</p>
                              <p className="text-xs text-slate-300 font-mono truncate">{playerPhotoUrl}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPlayerPhotoUrl("")}
                              className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded bg-red-500/10"
                            >
                              Quitar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={creatingPlayer}
                      className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      {creatingPlayer ? "CREANDO..." : "+ DAR DE ALTA JUGADOR REAL"}
                    </button>
                  </form>
                </div>

                {/* 2. Form: Create Matchday & Real Players Roster */}
                <div className="space-y-6">
                  {/* Create Matchday Form */}
                  <div className="glass-panel p-5 rounded-3xl space-y-4">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-400" /> Crear Nueva Jornada de Pachanga
                    </h3>

                    <div>
                      <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Nombre de la Jornada</label>
                      <input
                        type="text"
                        value={matchdayName}
                        onChange={(e) => setMatchdayName(e.target.value)}
                        placeholder="Ej: Jornada 3 - Sábado 3 de Octubre"
                        className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3 text-sm text-white focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={handleCreateMatchday}
                      className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-md"
                    >
                      CREAR JORNADA Y EQUIPOS A/B/C
                    </button>

                    {/* Existing Matchdays List with Edit & Delete Controls */}
                    {league?.matchdays && league.matchdays.length > 0 && (
                      <div className="pt-4 border-t border-emerald-900/40 space-y-3">
                        <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                          📅 Jornadas de la Liga ({league.matchdays.length})
                        </label>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {league.matchdays.map((md: any) => {
                            const isEditingThis = editingMatchday?.id === md.id;

                            return (
                              <div key={md.id} className="p-3 rounded-2xl bg-slate-900/80 border border-emerald-900/40 space-y-2">
                                {!isEditingThis ? (
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <span className="text-xs font-black text-white flex items-center gap-2">
                                        #{md.number} - {md.name}
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                                          md.status === "COMPLETED"
                                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                        }`}>
                                          {md.status === "COMPLETED" ? "FINALIZADA" : "PROGRAMADA"}
                                        </span>
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMatchday(md);
                                          setEditMatchdayName(md.name);
                                          setEditMatchdayStatus(md.status);
                                        }}
                                        className="py-1 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMatchday(md.id, md.name)}
                                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[11px] font-bold transition-all"
                                        title="Eliminar jornada"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Inline Edit Matchday Form */
                                  <div className="space-y-2 p-2 rounded-xl bg-slate-950/90 border border-amber-500/40">
                                    <span className="text-[10px] font-bold text-amber-400 uppercase">Editando Jornada #{md.number}</span>
                                    <input
                                      type="text"
                                      value={editMatchdayName}
                                      onChange={(e) => setEditMatchdayName(e.target.value)}
                                      className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <select
                                        value={editMatchdayStatus}
                                        onChange={(e) => setEditMatchdayStatus(e.target.value)}
                                        className="bg-slate-900 border border-emerald-800/60 rounded-xl px-2 py-1 text-xs text-white focus:outline-none"
                                      >
                                        <option value="SCHEDULED">PROGRAMADA</option>
                                        <option value="COMPLETED">FINALIZADA</option>
                                      </select>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleEditMatchday(md.id)}
                                          className="py-1 px-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingMatchday(null)}
                                          className="py-1 px-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                           })}
                         </div>
                       </div>
                     )}
                   </div>

                  {/* Real Players List Summary */}
                  <div className="glass-panel p-5 rounded-3xl space-y-3">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-400" /> Plantilla de Jugadores Reales ({league?.realPlayers?.length || 0})
                    </h3>

                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {league?.realPlayers?.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-emerald-900/30 text-xs">
                          <div className="flex items-center gap-2">
                            <img src={p.photoUrl} alt={p.nickname} className="w-6 h-6 rounded-full object-cover" />
                            <span className="font-bold text-white">{p.name} ({p.nickname})</span>
                            <span className="text-[10px] text-emerald-400">[{p.position}]</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-400 mr-1">{p.marketValue}M €</span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPlayer(p)}
                              title={`Editar a ${p.name}`}
                              className="py-1 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingPlayerId === p.id}
                              onClick={() => handleDeletePlayer(p.id, p.name)}
                              title={`Eliminar a ${p.name}`}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit Real Player Modal */}
                  {editingPlayer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                      <div className="glass-panel p-6 rounded-3xl max-w-lg w-full space-y-4 border border-amber-500/40 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                        <button
                          onClick={() => setEditingPlayer(null)}
                          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                            <Pencil className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white">Editar Jugador Real</h3>
                            <p className="text-xs text-amber-400 font-semibold">Modificar datos de {editingPlayer.name}</p>
                          </div>
                        </div>

                        <form onSubmit={handleSaveEditPlayer} className="space-y-3 pt-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Nombre Completo</label>
                              <input
                                type="text"
                                value={editPlayerName}
                                onChange={(e) => setEditPlayerName(e.target.value)}
                                required
                                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Apodo / Nickname</label>
                              <input
                                type="text"
                                value={editPlayerNickname}
                                onChange={(e) => setEditPlayerNickname(e.target.value)}
                                required
                                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Posición</label>
                              <select
                                value={editPlayerPosition}
                                onChange={(e) => setEditPlayerPosition(e.target.value)}
                                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                              >
                                <option value="POR">Portero (POR)</option>
                                <option value="CIERRE">Cierre (CIERRE)</option>
                                <option value="ALA">Ala (ALA)</option>
                                <option value="PIVOT">Pívot (PIVOT)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Precio de Mercado (M €)</label>
                              <input
                                type="number"
                                step="0.5"
                                value={editPlayerMarketValue}
                                onChange={(e) => setEditPlayerMarketValue(e.target.value)}
                                required
                                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Foto del Jugador</label>
                            <div className="space-y-2">
                              <label className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer transition-colors">
                                <Upload className="w-4 h-4 text-amber-400" />
                                <span>{uploadingEditPhoto ? "SUBIENDO FOTO..." : "📁 CAMBIAR FOTO DE TU DISPOSITIVO"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleEditFileUpload}
                                  disabled={uploadingEditPhoto}
                                  className="hidden"
                                />
                              </label>

                              <input
                                type="text"
                                value={editPlayerPhotoUrl}
                                onChange={(e) => setEditPlayerPhotoUrl(e.target.value)}
                                placeholder="O pega una URL de imagen (https://...)"
                                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                              />

                              {editPlayerPhotoUrl && (
                                <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-950/70 border border-emerald-900/50">
                                  <img
                                    src={editPlayerPhotoUrl}
                                    alt="Vista previa"
                                    className="w-10 h-10 rounded-xl object-cover border border-emerald-500/40"
                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                  />
                                  <div className="overflow-hidden flex-1">
                                    <p className="text-[10px] text-emerald-400 font-bold uppercase">Foto Seleccionada</p>
                                    <p className="text-[11px] text-slate-300 font-mono truncate">{editPlayerPhotoUrl}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setEditPlayerPhotoUrl("")}
                                    className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded bg-red-500/10"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPlayer(null)}
                              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={savingPlayer}
                              className="py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all disabled:opacity-50"
                            >
                              {savingPlayer ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* 3. Registered Managers Management Section */}
                  <div className="glass-panel p-5 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-400" /> Mánagers y Usuarios de la Liga ({league?.members?.length || 0})
                      </h3>
                      <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950">Gestión de Usuarios</span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {league?.members?.map((m: any) => {
                        const isCurrentOwner = m.userId === league?.ownerId;
                        const isSelf = m.userId === user?.id;

                        return (
                          <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-emerald-900/40 text-xs gap-3">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <img
                                src={m.user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                                alt={m.user?.nickname}
                                className="w-8 h-8 rounded-full border border-emerald-500/40 object-cover flex-shrink-0"
                              />
                              <div className="overflow-hidden">
                                <p className="font-bold text-white truncate flex items-center gap-1.5">
                                  {m.user?.nickname || m.user?.fullName}
                                  {isCurrentOwner && <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">CREADOR</span>}
                                  {isSelf && <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">TÚ</span>}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{m.user?.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                disabled={resettingUserId === m.userId}
                                onClick={() => handleResetUserPassword(m.userId, m.user?.nickname || m.user?.fullName)}
                                className="py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                                title="Restablecer contraseña de este usuario"
                              >
                                <Key className="w-3.5 h-3.5" />
                                <span>Contraseña</span>
                              </button>

                              {!isSelf && !isCurrentOwner && (
                                <button
                                  type="button"
                                  disabled={deletingUserId === m.userId}
                                  onClick={() => handleDeleteUser(m.userId, m.user?.nickname || m.user?.fullName)}
                                  className="py-1.5 px-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                                  title="Eliminar mánager de la liga y del sistema"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Reset Real Statistics Card */}
                  <div className="glass-panel p-5 rounded-3xl space-y-3 border border-amber-500/30 bg-amber-950/10">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-amber-400" /> Reiniciar Liga, Estadísticas y Plantillas
                    </h3>
                    <p className="text-xs text-slate-300">
                      Permite reiniciar la liga eligiendo si comenzar con plantillas vacías (30M €) o con un repartos aleatorio de 5 jugadores que sumen menos de 30M € más el dinero sobrante.
                    </p>
                    <button
                      type="button"
                      disabled={resettingStats}
                      onClick={() => setShowResetModal(true)}
                      className="w-full py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-400" />
                      <span>{resettingStats ? "REINICIANDO LIGA..." : "⚡ OPIONES DE REINICIO DE LIGA (VACÍO O CON JUGADORES)"}</span>
                    </button>
                  </div>

                  {/* Reset Options Modal */}
                  {showResetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                      <div className="glass-panel p-6 rounded-3xl max-w-lg w-full space-y-5 border border-amber-500/40 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                        <button
                          onClick={() => setShowResetModal(false)}
                          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                            <RotateCcw className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white">Reiniciar Liga y Equipos</h3>
                            <p className="text-xs text-emerald-400 font-semibold">Selecciona la modalidad de inicio para la liga</p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300">
                          Elige cómo deseas que comiencen los equipos de la liga tras reiniciar todas las jornadas, puntuaciones y transacciones:
                        </p>

                        <div className="space-y-3">
                          {/* Option 1: Empty Rosters + 30M € */}
                          <button
                            type="button"
                            onClick={() => executeReset("EMPTY")}
                            className="w-full p-4 rounded-2xl bg-slate-900/90 hover:bg-emerald-950/50 border border-emerald-500/30 hover:border-emerald-500/60 text-left transition-all group space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-white text-sm flex items-center gap-2 group-hover:text-emerald-400">
                                <UserX className="w-4 h-4 text-emerald-400" /> 1. Equipos Vacíos + 30.0M €
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                30M € Líquidos
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Reinicia todos los equipos sin ningún jugador en plantilla y asigna a cada mánager los 30.0M € completos de presupuesto inicial.
                            </p>
                          </button>

                          {/* Option 2: Random 5 Players (<30M €) + Remaining Budget */}
                          <button
                            type="button"
                            onClick={() => executeReset("DRAFT_5")}
                            className="w-full p-4 rounded-2xl bg-slate-900/90 hover:bg-amber-950/50 border border-amber-500/30 hover:border-amber-500/60 text-left transition-all group space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-white text-sm flex items-center gap-2 group-hover:text-amber-400">
                                <Shuffle className="w-4 h-4 text-amber-400" /> 2. Plantilla Aleatoria de 5 Jugadores (&lt; 30M €)
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Quinteto + Restante
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Reparte 5 jugadores por mánager (1 POR, 1 CIERRE, 2 ALA, 1 PIVOT) que sumen menos de 30M €. El presupuesto restante (30M - valor plantilla) se abonará en dinero.
                            </p>
                          </button>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowResetModal(false)}
                            className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Leave League & Delete Account Section */}
                  <div className="glass-panel p-5 rounded-3xl space-y-4 border border-red-900/30 bg-red-950/10">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <UserX className="w-5 h-5 text-red-400" /> Mi Cuenta y Acciones de Usuario
                    </h3>
                    <p className="text-xs text-slate-300">
                      Opciones para salir de la liga activa o eliminar permanentemente tu cuenta de usuario.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleLeaveLeague}
                        className="py-3 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <UserMinus className="w-4 h-4 text-amber-400" /> Abandonar Esta Liga
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="py-3 px-4 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-extrabold text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" /> Borrar Mi Cuenta Permanentemente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
