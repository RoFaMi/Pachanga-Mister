"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  ShoppingBag,
  Zap,
  ShieldAlert,
  Star,
  LogOut,
  UserCheck,
  Plus,
  X,
  Shield,
} from "lucide-react";
import { authFetch } from "@/lib/api";

interface NavigationProps {
  user?: any;
  activeLeague?: any;
  onLogout?: () => void;
}

export function Navigation({ user, activeLeague, onLogout }: NavigationProps) {
  const pathname = usePathname();
  const [localUser, setLocalUser] = useState<any>(null);

  // Create League Modal State
  const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueDesc, setNewLeagueDesc] = useState("");
  const [newLeagueBudget, setNewLeagueBudget] = useState("30.0");
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (user) {
      setLocalUser(user);
      try {
        localStorage.setItem("pachanga_user", JSON.stringify(user));
      } catch (e) {}
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pachanga_user");
      if (saved) {
        try {
          setLocalUser(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, [user]);

  const activeUser = user || localUser;

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;

    setCreatingLeague(true);
    setCreateMessage(null);

    try {
      const res = await authFetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLeagueName.trim(),
          description: newLeagueDesc.trim() || "Liga de fútbol sala 5v5",
          initialBudget: parseFloat(newLeagueBudget) || 30.0,
        }),
      });

      const data = await res.json();
      if (res.ok && data.league) {
        setCreateMessage({
          text: `🎉 ¡Liga '${data.league.name}' creada con éxito! Código: ${data.league.code}. Ahora eres Administrador de esta liga.`,
          type: "success",
        });

        if (typeof window !== "undefined") {
          localStorage.setItem("pachanga_active_league_id", data.league.id);
        }

        setTimeout(() => {
          window.location.href = "/admin";
        }, 1500);
      } else {
        setCreateMessage({ text: data.error || "Error al crear la liga", type: "error" });
      }
    } catch (err) {
      console.error("Create league error:", err);
      setCreateMessage({ text: "Error de conexión al crear la liga", type: "error" });
    } finally {
      setCreatingLeague(false);
    }
  };

  const navItems = [
    { href: "/", label: "Inicio", mobileLabel: "Inicio", icon: LayoutDashboard },
    { href: "/plantilla", label: "Plantilla", mobileLabel: "Plantilla", icon: Users },
    { href: "/pachanga", label: "Modo Pachanga", mobileLabel: "Pachanga", icon: Zap, highlight: true },
    { href: "/mercado", label: "Mercado", mobileLabel: "Mercado", icon: ShoppingBag },
    { href: "/clasificacion", label: "Clasificación", mobileLabel: "Tabla", icon: Trophy },
    { href: "/valoracion", label: "Valoraciones", mobileLabel: "Votar", icon: Star },
  ];

  const isAdmin = activeUser?.role === "ADMIN" || activeLeague?.ownerId === activeUser?.id;

  if (isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", mobileLabel: "Admin", icon: ShieldAlert, highlight: false });
  }

  const handleLogoutAction = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("pachanga_token");
        localStorage.removeItem("pachanga_user");
      }
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    } finally {
      window.location.href = "/auth/login";
    }
  };

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-emerald-900/40 p-4 min-h-screen sticky top-0 z-40">
        {/* App Title Header */}
        <div className="flex items-center gap-3 px-2 py-2 mb-4 border-b border-emerald-900/30">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-lg shadow-lg shadow-emerald-500/10">
            MP
          </div>
          <div>
            <h1 className="font-extrabold text-base text-white tracking-wide leading-tight">
              MÍSTER <span className="text-emerald-400">PACHANGA</span>
            </h1>
            <p className="text-[10px] text-emerald-400/80 font-medium">Fantasy 5v5 Futsal</p>
          </div>
        </div>

        {/* FIXED USER PROFILE & LEAGUE CREATION CARD AT TOP */}
        {activeUser ? (
          <div className="mb-4 p-3 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <img
                  src={activeUser.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                  alt={activeUser.nickname}
                  className="w-10 h-10 rounded-full bg-emerald-900/50 border-2 border-emerald-400 flex-shrink-0 object-cover"
                />
                <div className="overflow-hidden">
                  <p className="text-sm font-extrabold text-white truncate">{activeUser.nickname}</p>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                    isAdmin
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  }`}>
                    {isAdmin ? "ADMINISTRADOR" : "MÁNAGER"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogoutAction}
                title="Cerrar sesión"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-400" />
              </button>
            </div>

            {/* Create New League Button */}
            <div className="pt-2 border-t border-emerald-900/40 space-y-1.5">
              <button
                type="button"
                onClick={() => setShowCreateLeagueModal(true)}
                className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> + CREAR OTRA LIGA (ADMIN)
              </button>
              <Link
                href="/unirse"
                className="w-full py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-emerald-950/60 border border-emerald-900/50 text-emerald-400 font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
              >
                <Trophy className="w-3 h-3 text-amber-400" /> Unirme a otra liga
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-2xl bg-slate-900/90 border border-emerald-900/40">
            <Link
              href="/auth/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md transition-colors"
            >
              <UserCheck className="w-4 h-4" /> Iniciar Sesión
            </Link>
          </div>
        )}

        {/* Active League Badge */}
        {activeLeague && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="overflow-hidden">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Liga Activa</p>
              <p className="text-xs font-black text-white truncate">{activeLeague.name}</p>
            </div>
          </div>
        )}

        {/* Menu Navigation */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : item.highlight
                    ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30"
                    : "text-slate-300 hover:bg-emerald-900/20 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : item.highlight ? "text-amber-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
                {item.highlight && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    LIVE
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full glass-panel bg-[#0b1310]/95 backdrop-blur-md border-t border-emerald-900/50 z-50 px-1 py-1 flex items-center justify-around shadow-2xl">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all ${
                isActive ? "text-emerald-400 font-bold" : item.highlight ? "text-amber-400 font-bold" : "text-slate-400"
              }`}
            >
              <div
                className={`p-1 rounded-lg ${
                  isActive
                    ? "bg-emerald-500/20 border border-emerald-500/40"
                    : item.highlight
                    ? "bg-amber-500/20 border border-amber-500/40 animate-pulse"
                    : ""
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[9px] sm:text-[10px] mt-0.5 truncate max-w-full text-center">{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* CREATE NEW LEAGUE MODAL */}
      {showCreateLeagueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel p-6 rounded-3xl max-w-md w-full space-y-4 border border-amber-500/40 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowCreateLeagueModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Crear Nueva Liga</h3>
                <p className="text-xs text-amber-400 font-semibold">Te convertirás en el Administrador de esta liga</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Crea una liga personalizada para jugar con otros grupos de amigos. Podrás invitar mánagers con tu código único y administrar jugadores, jornadas y partidos.
            </p>

            {createMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  createMessage.type === "success"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-red-500/20 text-red-300 border border-red-500/40"
                }`}
              >
                {createMessage.text}
              </div>
            )}

            <form onSubmit={handleCreateLeague} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Nombre de la Liga</label>
                <input
                  type="text"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  placeholder="Ej: Pachanga Viernes Noche"
                  required
                  className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Descripción (Opcional)</label>
                <input
                  type="text"
                  value={newLeagueDesc}
                  onChange={(e) => setNewLeagueDesc(e.target.value)}
                  placeholder="Ej: Liga de fútbol sala con compañeros de trabajo"
                  className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Presupuesto Inicial por Mánager (M €)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newLeagueBudget}
                  onChange={(e) => setNewLeagueBudget(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateLeagueModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingLeague}
                  className="py-2.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {creatingLeague ? "CREANDO LIGA..." : "🚀 CREAR LIGA Y SER ADMIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
