"use client";

import { useState } from "react";
import Link from "next/link";
import { UserCheck, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.user) {
        if (data?.token) {
          localStorage.setItem("pachanga_token", data.token);
        }
        localStorage.setItem("pachanga_user", JSON.stringify(data.user));
        window.location.href = "/";
      } else {
        setError(data?.error || "Credenciales inválidas. Comprueba el correo y contraseña.");
      }
    } catch (err) {
      setError("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("pachanga123");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: "pachanga123" }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.user) {
        if (data?.token) {
          localStorage.setItem("pachanga_token", data.token);
        }
        localStorage.setItem("pachanga_user", JSON.stringify(data.user));
        window.location.href = "/";
      } else {
        setError(data?.error || "Error al iniciar sesión demo");
      }
    } catch (err) {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1310] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Banner */}
        <Link href="/" className="text-center space-y-2 block hover:opacity-90 transition-opacity">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-2xl mx-auto shadow-xl">
            MP
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            MÍSTER <span className="text-emerald-400">PACHANGA</span>
          </h1>
          <p className="text-xs text-emerald-400 font-medium">Tu equipo. Tus colegas. Tu liga Fantasy 5v5.</p>
        </Link>

        {/* Login Form */}
        <div className="glass-panel-glow p-6 rounded-3xl space-y-4">
          <h2 className="text-base font-black text-white">Iniciar Sesión</h2>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pachanga.com"
                required
                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/30"
            >
              {loading ? "ACCEDIENDO..." : "ENTRAR A MI LIGA"}
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="pt-4 border-t border-emerald-900/40 space-y-2">
            <div className="text-center">
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Acceso Rápido Demo (1-Click)</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Contraseña demo para todos: <span className="text-emerald-400 font-bold">pachanga123</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDemoLogin("admin@pachanga.com")}
                className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex flex-col items-center justify-center text-center"
              >
                <span>Carlos (Admin)</span>
                <span className="text-[9px] text-amber-400/70 font-mono">admin@pachanga.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("pablo@pachanga.com")}
                className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex flex-col items-center justify-center text-center"
              >
                <span>Pablo DT</span>
                <span className="text-[9px] text-emerald-400/70 font-mono">pablo@pachanga.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("pedri@pachanga.com")}
                className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex flex-col items-center justify-center text-center"
              >
                <span>Pedri González</span>
                <span className="text-[9px] text-emerald-400/70 font-mono">pedri@pachanga.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("nico@pachanga.com")}
                className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex flex-col items-center justify-center text-center"
              >
                <span>Nico Williams</span>
                <span className="text-[9px] text-emerald-400/70 font-mono">nico@pachanga.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin("borja@pachanga.com")}
                className="col-span-2 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex flex-col items-center justify-center text-center"
              >
                <span>Borja Iglesias</span>
                <span className="text-[9px] text-emerald-400/70 font-mono">borja@pachanga.com</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-center text-slate-400 pt-2">
            ¿No tienes cuenta aún?{" "}
            <Link href="/auth/register" className="text-emerald-400 font-bold hover:underline">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
