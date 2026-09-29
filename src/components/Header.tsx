"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, Bell, Shield, User, ArrowRightLeft, LogOut, UserCheck } from "lucide-react";

interface HeaderProps {
  user?: any;
  leagues?: any[];
  activeLeague?: any;
  onSelectLeague?: (leagueId: string) => void;
  onSwitchUser?: (email: string) => void;
  onLogout?: () => void;
}

export function Header({ user, leagues = [], activeLeague, onSelectLeague, onSwitchUser, onLogout }: HeaderProps) {
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  const handleLogout = async () => {
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

  const demoAccounts = [
    { name: "Carlos Míster", email: "admin@pachanga.com", role: "ADMIN (Organizador)", color: "text-amber-400" },
    { name: "Pablo DT", email: "pablo@pachanga.com", role: "PARTICIPANTE", color: "text-emerald-400" },
    { name: "Pedri González", email: "pedri@pachanga.com", role: "PARTICIPANTE", color: "text-cyan-400" },
    { name: "Nico Williams", email: "nico@pachanga.com", role: "PARTICIPANTE", color: "text-purple-400" },
    { name: "Borja Iglesias", email: "borja@pachanga.com", role: "PARTICIPANTE", color: "text-orange-400" },
  ];

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-emerald-900/40 px-4 py-3 flex items-center justify-between gap-4">
      {/* Mobile Brand Title */}
      <div className="flex md:hidden items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-sm">
          MP
        </div>
        <span className="font-extrabold text-white text-base tracking-wide">
          MÍSTER <span className="text-emerald-400">PACHANGA</span>
        </span>
      </div>

      {/* League Selector Dropdown */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/50">
          <Trophy className="w-4 h-4 text-amber-400" />
          <select
            value={activeLeague?.id || ""}
            onChange={(e) => onSelectLeague && onSelectLeague(e.target.value)}
            className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer"
          >
            {leagues.length > 0 ? (
              leagues.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                  {l.name}
                </option>
              ))
            ) : (
              <option value="">Liga Pachanga Demo 5v5</option>
            )}
          </select>
        </div>
      </div>

      {/* Right Controls: Demo Fast Switcher & Notifications */}
      <div className="flex items-center gap-2.5 ml-auto">
        {/* Join League Button */}
        <Link
          href="/unirse"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 transition-all shadow-sm"
          title="Unirse a una liga con código de invitación"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Unirme a Liga</span>
        </Link>

        {/* Fast Demo Account Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowDemoMenu(!showDemoMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-emerald-900/30 border border-emerald-700/40 text-xs font-bold text-emerald-300 transition-all shadow-sm"
            title="Cambiar de usuario demo para probar la app"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Cambiar Usuario</span>
          </button>

          {showDemoMenu && (
            <div className="absolute right-0 mt-2 w-64 glass-panel border border-emerald-700/50 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider px-3 py-1 border-b border-emerald-900/40 mb-1">
                Usuarios Demo Disponibles
              </p>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => {
                    setShowDemoMenu(false);
                    onSwitchUser && onSwitchUser(acc.email);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-emerald-950/60 transition-colors ${
                    user?.email === acc.email ? "bg-emerald-500/20 border border-emerald-500/40" : ""
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-white">{acc.name}</p>
                    <p className={`text-[10px] font-semibold ${acc.color}`}>{acc.role}</p>
                  </div>
                  {user?.email === acc.email && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Badge & Logout */}
        {user ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
            <Link
              href="/perfil"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
              title="Ir a mi perfil para cambiar nombre y foto"
            >
              <img
                src={user.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=user"}
                alt={user.nickname}
                className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
              />
              <span className="text-xs font-bold text-white hidden sm:inline">{user.nickname}</span>
            </Link>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 text-red-300 rounded-lg transition-colors ml-1 flex items-center gap-1 text-[11px] font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </Link>
        )}
      </div>
    </header>
  );
}
