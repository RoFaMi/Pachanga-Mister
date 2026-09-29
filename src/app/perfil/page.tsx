"use client";

import { useState, useEffect } from "react";
import { User, Camera, Save, CheckCircle, AlertCircle, ArrowLeft, Trophy, Shield, Upload } from "lucide-react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { safeFetchJson } from "@/lib/api";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
];

export default function PerfilPage() {
  const [user, setUser] = useState<any>(null);
  const [league, setLeague] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setMessage({ text: "La imagen debe ser menor a 8MB", type: "error" });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        setAvatarUrl(base64Url);
        setMessage({ text: "Foto de tu dispositivo cargada. Pulsa 'Guardar Cambios' para aplicar.", type: "success" });
      }
      setUploadingAvatar(false);
    };
    reader.onerror = () => {
      setMessage({ text: "Error al leer la imagen seleccionada", type: "error" });
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const dataUser = await safeFetchJson<{ user: any }>("/api/user/profile");
      if (dataUser?.user) {
        setUser(dataUser.user);
        setFullName(dataUser.user.fullName || "");
        setNickname(dataUser.user.nickname || "");
        setAvatarUrl(dataUser.user.avatarUrl || "");
      }

      const dataLeagues = await safeFetchJson<{ leagues: any[] }>("/api/leagues");
      if (dataLeagues?.leagues && dataLeagues.leagues.length > 0) {
        setLeague(dataLeagues.leagues[0]);
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          nickname,
          avatarUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message || "Perfil guardado con éxito", type: "success" });
        setUser(data.user);
      } else {
        setMessage({ text: data.error || "Error al actualizar perfil", type: "error" });
      }
    } catch (e) {
      console.error("Save profile error:", e);
      setMessage({ text: "Error de conexión al guardar", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0b1310] text-slate-100 pb-20 md:pb-0">
      <Navigation user={user} activeLeague={league} />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <Header user={user} activeLeague={league} onSwitchUser={handleSwitchUser} />

        <main className="p-4 space-y-6 flex-1">
          {/* Top Banner */}
          <div className="glass-panel-glow p-5 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white">Mi Perfil de Míster</h1>
                <p className="text-xs text-emerald-400 font-semibold">Configura tus datos personales y tu avatar</p>
              </div>
            </div>
            <Link
              href="/plantilla"
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-emerald-800/40 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a Plantilla
            </Link>
          </div>

          {/* Toast Message */}
          {message && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-red-500/20 text-red-300 border border-red-500/40"
              }`}
            >
              {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Avatar Preview */}
            <div className="glass-panel p-6 rounded-3xl space-y-4 flex flex-col items-center text-center justify-center">
              <div className="relative group">
                <img
                  src={avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                  alt="Avatar"
                  className="w-28 h-28 rounded-3xl object-cover border-4 border-emerald-500/50 shadow-2xl bg-slate-900"
                />
                <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-white">{nickname || "Míster"}</h3>
                <p className="text-xs text-emerald-400 font-semibold">{user?.email}</p>
                <span className="inline-block px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 text-[11px] font-black border border-amber-500/40 mt-2">
                  🏆 Manager de Liga Pachanga
                </span>
              </div>
            </div>

            {/* Right Column: Edit Profile Form */}
            <div className="md:col-span-2 glass-panel p-6 rounded-3xl space-y-5">
              <h2 className="text-base font-black text-white border-b border-emerald-900/40 pb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" /> Editar Información Personal
              </h2>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Apodo / Nickname (Público en la Liga)</label>
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Ej: El Míster, Pablito DT"
                    className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Carlos Gómez"
                    className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Foto de Perfil / Avatar</label>
                  <div className="space-y-3">
                    <label className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer transition-colors shadow-sm">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>{uploadingAvatar ? "CARGANDO FOTO DE TU DISPOSITIVO..." : "📁 SUBIR FOTO DESDE TU DISPOSITIVO (PC / MÓVIL)"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        className="hidden"
                      />
                    </label>

                    <div>
                      <span className="text-[11px] font-bold text-slate-300 block mb-1.5">O elige un avatar rápido:</span>
                      <div className="grid grid-cols-6 gap-2">
                        {PRESET_AVATARS.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAvatarUrl(url)}
                            className={`p-1 rounded-xl border transition-all ${
                              avatarUrl === url ? "border-amber-400 bg-amber-400/20 scale-105" : "border-emerald-900/40 bg-slate-900 hover:border-emerald-500"
                            }`}
                          >
                            <img src={url} alt={`Preset ${i}`} className="w-10 h-10 rounded-lg object-cover mx-auto" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="O pega una URL de imagen personalizada (https://...)"
                      className="w-full bg-slate-900 border border-emerald-800/60 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-emerald-900/40">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {loading ? "Guardando..." : "Guardar Cambios de Perfil"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
