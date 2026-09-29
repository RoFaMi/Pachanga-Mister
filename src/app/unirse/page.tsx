"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UserCheck, ArrowRight, ShieldCheck, AlertCircle, Trophy, Users, CheckCircle2 } from "lucide-react";
import { safeFetchJson, authFetch } from "@/lib/api";

function JoinLeagueForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCode = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const data = await safeFetchJson<{ user: any }>("/api/auth/me");
      if (data?.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.error("Error fetching user:", e);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authFetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || "¡Te has unido a la liga con éxito!");
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } else {
        setError(data.error || "Error al unirse a la liga");
      }
    } catch (err) {
      console.error("Join league error:", err);
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Banner */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-2xl mx-auto shadow-xl">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          UNIRSE A LIGA <span className="text-emerald-400">PACHANGA</span>
        </h1>
        <p className="text-xs text-emerald-400 font-medium">Introduce el código de invitación recibido para unirte a tus colegas</p>
      </div>

      {/* Main Join Card */}
      <div className="glass-panel-glow p-6 rounded-3xl space-y-4">
        {successMessage ? (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p>{successMessage}</p>
            <p className="text-xs text-slate-300 font-medium">Redirigiendo a tu liga...</p>
          </div>
        ) : (
          <form onSubmit={handleJoinLeague} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                Código de Invitación de la Liga
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: PACHANGA5V5"
                required
                className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3.5 text-center font-mono font-black text-lg text-amber-400 tracking-widest focus:outline-none focus:border-emerald-400"
              />
            </div>

            {!user ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center space-y-2">
                <p>Debes estar conectado para unirte a la liga.</p>
                <Link
                  href="/auth/login"
                  className="inline-block py-2 px-4 rounded-xl bg-amber-400 text-slate-950 font-black text-xs"
                >
                  Iniciar Sesión
                </Link>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
              >
                {loading ? "UNIÉNDOTE..." : "¡UNIRME A LA LIGA AHORA!"}
              </button>
            )}
          </form>
        )}

        <div className="pt-3 border-t border-emerald-900/40 text-center">
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-white transition-colors">
            ← Volver al Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnirsePage() {
  return (
    <div className="min-h-screen bg-[#0b1310] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-white text-center">Cargando...</div>}>
        <JoinLeagueForm />
      </Suspense>
    </div>
  );
}
