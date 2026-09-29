"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, ArrowRight, ShieldCheck, AlertCircle, Trophy, CheckCircle2 } from "lucide-react";
import { authFetch } from "@/lib/api";

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const codeParam = searchParams.get("code") || "";

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(codeParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (codeParam) {
      setInviteCode(codeParam);
    }
  }, [codeParam]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Register User
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          nickname: nickname.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Error al registrar la cuenta");
        setLoading(false);
        return;
      }

      if (data?.token) {
        localStorage.setItem("pachanga_token", data.token);
      }
      if (data?.user) {
        localStorage.setItem("pachanga_user", JSON.stringify(data.user));
      }

      // 2. If invitation code is present, automatically join the league
      if (inviteCode.trim()) {
        try {
          await authFetch("/api/leagues/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: inviteCode.trim() }),
          });
        } catch (e) {
          console.error("Auto join league error:", e);
        }
      }

      // 3. Redirect to main dashboard
      window.location.href = "/";
    } catch (err) {
      console.error("Registration error:", err);
      setError("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Banner */}
      <Link href="/" className="text-center space-y-2 block hover:opacity-90 transition-opacity">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-2xl mx-auto shadow-xl">
          MP
        </div>
        <h1 className="text-2xl font-extrabold text-white">
          CREAR MI CUENTA EN <span className="text-emerald-400">PACHANGA</span>
        </h1>
        <p className="text-xs text-emerald-400 font-medium">Únete a la liga Fantasy de tus colegas en 10 segundos</p>
      </Link>

      {/* Form Card */}
      <div className="glass-panel-glow p-6 rounded-3xl space-y-4">
        <h2 className="text-base font-black text-white">Registro de Mánager</h2>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Nombre Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Alejandro Gómez"
              required
              className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Apodo / Nickname (en la liga)</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ej: Alex 'El Mago'"
              required
              className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tuemail@ejemplo.com"
              required
              className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Código de Liga (Opcional)</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="PACHANGA5V5"
              className="w-full bg-slate-900 border border-amber-500/40 rounded-xl p-3 font-mono font-black text-amber-300 text-center tracking-widest focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
          >
            {loading ? "CREANDO CUENTA..." : "REGISTRARME Y ENTRAR"}
          </button>
        </form>

        <p className="text-xs text-center text-slate-400 pt-2">
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" className="text-emerald-400 font-bold hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#0b1310] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-white text-center">Cargando...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
