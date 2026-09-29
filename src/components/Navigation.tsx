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
} from "lucide-react";

interface NavigationProps {
  user?: any;
  activeLeague?: any;
  onLogout?: () => void;
}

export function Navigation({ user, activeLeague, onLogout }: NavigationProps) {
  const pathname = usePathname();
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

  const navItems = [
    { href: "/", label: "Inicio", icon: LayoutDashboard },
    { href: "/plantilla", label: "Plantilla", icon: Users },
    { href: "/pachanga", label: "Modo Pachanga", icon: Zap, highlight: true },
    { href: "/mercado", label: "Mercado", icon: ShoppingBag },
    { href: "/clasificacion", label: "Clasificación", icon: Trophy },
    { href: "/valoracion", label: "Valoraciones", icon: Star },
  ];

  const isAdmin = activeUser?.role === "ADMIN" || activeLeague?.ownerId === activeUser?.id;

  if (isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", icon: ShieldAlert, highlight: false });
  }

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-emerald-900/40 p-4 min-h-screen sticky top-0 z-40">
        <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-emerald-900/30">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xl shadow-lg shadow-emerald-500/10">
            MP
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-wide leading-tight">
              MÍSTER <span className="text-emerald-400">PACHANGA</span>
            </h1>
            <p className="text-xs text-emerald-400/80 font-medium">Fantasy 5v5 Futsal</p>
          </div>
        </div>

        {/* Active League Badge */}
        {activeLeague && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="overflow-hidden">
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Liga Activa</p>
              <p className="text-sm font-bold text-white truncate">{activeLeague.name}</p>
            </div>
          </div>
        )}

        {/* Menu Navigation */}
        <nav className="flex-1 space-y-1.5">
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

        {/* User Info & Logout */}
        {activeUser ? (
          <div className="pt-4 border-t border-emerald-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={activeUser.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={activeUser.nickname}
                className="w-9 h-9 rounded-full bg-emerald-900/50 border border-emerald-500/30 flex-shrink-0 object-cover"
              />
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{activeUser.nickname}</p>
                <p className="text-[11px] text-slate-400 capitalize truncate">{activeUser.role}</p>
              </div>
            </div>
            <button
              onClick={async () => {
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
              }}
              title="Cerrar sesión"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <LogOut className="w-4 h-4 text-red-400" />
            </button>
          </div>
        ) : (
          <div className="pt-4 border-t border-emerald-900/30">
            <Link
              href="/auth/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md transition-colors"
            >
              <UserCheck className="w-4 h-4" /> Iniciar Sesión
            </Link>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg glass-panel bg-[#0b1310]/95 backdrop-blur-md border-t border-emerald-900/50 z-50 px-3 py-1.5 flex items-center justify-around shadow-2xl">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                isActive ? "text-emerald-400 font-bold" : item.highlight ? "text-amber-400 font-bold" : "text-slate-400"
              }`}
            >
              <div
                className={`p-1.5 rounded-lg ${
                  isActive
                    ? "bg-emerald-500/20 border border-emerald-500/40"
                    : item.highlight
                    ? "bg-amber-500/20 border border-amber-500/40 animate-pulse"
                    : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
