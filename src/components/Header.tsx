"use client";

import { useState, useEffect } from "react";
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

export function Header({ user, leagues = [], activeLeague, onSelectLeague, onLogout }: HeaderProps) {
  const [localUser, setLocalUser] = useState<any>(null);

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

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-emerald-900/40 px-4 py-3 flex items-center justify-between gap-4">
      {/* Brand Title & Active League Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-sm shadow-md">
          MP
        </div>
        <div>
          <span className="font-extrabold text-white text-base tracking-wide flex items-center gap-1.5">
            MÍSTER <span className="text-emerald-400">PACHANGA</span>
          </span>
          <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400 inline" /> {activeLeague?.name || "Liga Pachanga 5v5"}
          </p>
        </div>
      </div>

      {/* Right Controls */}
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

        {/* User Badge & Logout */}
        {activeUser ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
            <Link
              href="/perfil"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
              title="Ir a mi perfil para cambiar nombre y foto"
            >
              <img
                src={activeUser.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={activeUser.nickname}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
                }}
                className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
              />
              <span className="text-xs font-bold text-white hidden sm:inline">{activeUser.nickname}</span>
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
