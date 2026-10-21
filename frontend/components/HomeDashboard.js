"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Plus, Users } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `****** } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}

export default function HomeDashboard() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [eventName, setEventName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadEvents(currentToken) {
    const [profile, items] = await Promise.all([
      request("/api/auth/me", currentToken),
      request("/api/events", currentToken),
    ]);
    setUser(profile);
    setEvents(items);
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("parrillapay-token");
    if (!saved) return;
    setToken(saved);
    loadEvents(saved).catch(() => {
      window.localStorage.removeItem("parrillapay-token");
      setToken("");
    });
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request(`/api/auth/${mode === "register" ? "register" : "login"}`, "", {
        method: "POST",
        body: JSON.stringify(form),
      });
      window.localStorage.setItem("parrillapay-token", data.token);
      setToken(data.token);
      setUser(data.user);
      setEvents(await request("/api/events", data.token));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function createEvent(event) {
    event.preventDefault();
    setError("");
    try {
      const created = await request("/api/events", token, {
        method: "POST",
        body: JSON.stringify({ name: eventName }),
      });
      window.location.assign(`/event/${created.id}`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function joinEvent(event) {
    event.preventDefault();
    setError("");
    try {
      const joined = await request("/api/events/join", token, {
        method: "POST",
        body: JSON.stringify({ code: inviteCode }),
      });
      window.location.assign(`/event/${joined.id}`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function signOut() {
    window.localStorage.removeItem("parrillapay-token");
    setToken("");
    setUser(null);
    setEvents([]);
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">ParrillaPay</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">La cuenta clara.<br />El asado, mejor.</h1>
          <p className="mt-3 text-zinc-400">Organiza gastos y salda la junta sin enredos.</p>
        </div>
        <form onSubmit={submitAuth} className="space-y-4">
          {mode === "register" && (
            <label className="block text-sm text-zinc-400">
              Nombre
              <input required maxLength={80} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500" />
            </label>
          )}
          <label className="block text-sm text-zinc-400">
            Correo
            <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500" />
          </label>
          <label className="block text-sm text-zinc-400">
            Contraseña {mode === "register" && <span>(mínimo 10 caracteres)</span>}
            <input required type="password" minLength={mode === "register" ? 10 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500" />
          </label>
          {error && <p role="alert" className="text-sm text-zinc-300">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-white py-3 font-semibold text-black disabled:opacity-50">
            {busy ? "Un momento…" : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }} className="mt-5 py-2 text-sm text-zinc-400">
          {mode === "register" ? "¿Ya tienes cuenta? Inicia sesión" : "¿Primera vez? Crea tu cuenta"}
        </button>
      </main>
    );
  }

  return (
    <main id="cuenta" className="min-h-screen px-5 pb-28 pt-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">ParrillaPay</p>
          <h1 className="mt-2 text-3xl font-bold">Mis juntas</h1>
          <p className="mt-1 text-sm text-zinc-400">Hola, {user?.name || "amigo"}.</p>
        </div>
        <button onClick={signOut} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400">Salir</button>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">{error}</p>}

      <section id="eventos" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">Juntas activas e historial</h2>
          <button aria-label="Crear junta" onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-white p-2.5 text-black"><Plus size={20} /></button>
        </div>

        {showCreate && (
          <form onSubmit={createEvent} className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="block text-sm text-zinc-400">Nombre de la junta
              <input required maxLength={100} value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Asado del sábado" className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-white" />
            </label>
            <button className="mt-3 w-full rounded-xl bg-white py-3 font-semibold text-black">Crear junta</button>
          </form>
        )}

        <form onSubmit={joinEvent} className="mb-5 flex gap-2">
          <input aria-label="Código de invitación" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Código de invitación" className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600" />
          <button className="rounded-xl border border-zinc-700 px-4 text-sm font-medium">Unirme</button>
        </form>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 px-5 py-10 text-center">
            <p className="font-medium">Todavía no tienes juntas</p>
            <p className="mt-2 text-sm text-zinc-500">Crea una o ingresa un código para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Link key={event.id} href={`/event/${event.id}`} className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{event.name}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1"><Users size={14} />{event.participantCount} personas</span>
                      {event.date && <span className="inline-flex items-center gap-1"><CalendarDays size={14} />{new Date(event.date).toLocaleDateString()}</span>}
                      <span>{event.status === "OPEN" ? "Abierta" : "Cerrada"}</span>
                    </div>
                  </div>
                  <ArrowRight size={18} className="mt-1 text-zinc-500" />
                </div>
                {event.amountOwed > 0 && <p className="mt-4 text-sm text-zinc-300">Debes ${event.amountOwed.toFixed(2)}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
