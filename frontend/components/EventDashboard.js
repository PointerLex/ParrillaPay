"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Copy, ReceiptText, Upload, Users } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const tabs = ["Resumen", "Gastos", "Personas"];
const money = (amount) => `$${Number(amount).toFixed(2)}`;

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      Authorization: "Bearer " + token,
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No se pudo completar la solicitud.");
  return result;
}

export default function EventDashboard({ id }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState("Resumen");
  const [showExpense, setShowExpense] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [expense, setExpense] = useState({ description: "", amount: "", items: [] });
  const [receiptProofId, setReceiptProofId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadEvent = useCallback(async (currentToken) => {
    const [profile, data] = await Promise.all([
      apiRequest("/api/auth/me", currentToken),
      apiRequest(`/api/events/${id}`, currentToken),
    ]);
    setUser(profile);
    setEvent(data);
  }, [id]);

  useEffect(() => {
    const saved = window.localStorage.getItem("parrillapay-token");
    if (!saved) {
      setError("Inicia sesión para ver esta junta.");
      return;
    }
    setToken(saved);
    loadEvent(saved).catch((requestError) => setError(requestError.message));
  }, [loadEvent]);

  useEffect(() => {
    const selectHashTab = () => {
      if (window.location.hash === "#gastos") setTab("Gastos");
      if (window.location.hash === "#personas") setTab("Personas");
    };
    selectHashTab();
    window.addEventListener("hashchange", selectHashTab);
    return () => window.removeEventListener("hashchange", selectHashTab);
  }, []);

  async function submitExpense(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/events/${id}/expenses`, token, {
        method: "POST",
        body: JSON.stringify({ ...expense, receiptId: receiptProofId }),
      });
      setExpense({ description: "", amount: "", items: [] });
      setReceiptProofId(null);
      setShowExpense(false);
      setNotice("Gasto agregado y saldos actualizados.");
      await loadEvent(token);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadReceipt(file, type, debtId) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("receipt", file);
      form.set("eventId", id);
      form.set("type", type);
      if (debtId) form.set("debtId", debtId);
      const result = await apiRequest("/api/upload", token, { method: "POST", body: form });
      if (type === "EXPENSE") {
        const items = Array.isArray(result.extracted?.items)
          ? result.extracted.items.filter((item) => item && item.name && Number(item.amount) > 0)
          : [];
        setExpense({
          description: result.extracted ? (items.length ? "Boleta de supermercado" : "Compra del asado") : "",
          amount: result.extracted
            ? Number(result.extracted.total || items.reduce((total, item) => total + Number(item.amount), 0)).toFixed(2)
            : "",
          items: items.map((item) => ({
            name: String(item.name).slice(0, 100),
            amount: Number(item.amount).toFixed(2),
            category: typeof item.category === "string" ? item.category : "",
          })),
        });
        setReceiptProofId(result.id);
        setShowExpense(true);
        setNotice(result.extracted
          ? "Revisa los datos extraídos y corrígelos antes de guardar."
          : "No se pudo leer la boleta. Ingresa los datos manualmente para guardarla.");
      } else {
        setNotice(result.message);
        await loadEvent(token);
      }
      setShowPayment(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment(debtId) {
    setError("");
    try {
      await apiRequest(`/api/events/${id}/debts/${debtId}/confirm`, token, { method: "POST" });
      setNotice("Pago confirmado.");
      await loadEvent(token);
    } catch (requestError) {
      setError(requestError.message);
    }

    async function rejectPayment(debtId) {
      setError("");
      try {
        await apiRequest(`/api/events/${id}/debts/${debtId}/reject`, token, { method: "POST" });
        setNotice("Comprobante rechazado. La deuda sigue pendiente.");
        await loadEvent(token);
      } catch (requestError) {
        setError(requestError.message);
      }
    }
  }

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(event.inviteCode);
      setNotice("Código copiado.");
    } catch {
      setNotice(`Código de invitación: ${event.inviteCode}`);
    }
  }

  if (!token) {
    return <main className="p-6"><p role="alert" className="text-zinc-300">{error}</p><Link href="/" className="mt-4 inline-block text-sm text-zinc-400">Volver al inicio</Link></main>;
  }
  if (!event) {
    return <main className="p-6"><Link href="/" className="text-sm text-zinc-400">← Mis juntas</Link><p className="mt-8 text-zinc-400">{error || "Cargando junta…"}</p></main>;
  }

  const personalDebts = event.debts.filter((debt) => debt.debtorId === user?.id);
  const reviewDebts = event.debts.filter((debt) => debt.status === "REVIEW" && (debt.creditorId === user?.id || event.creatorId === user?.id));
  const total = event.expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <main className="min-h-screen px-5 pb-28 pt-5">
      <Link href="/" className="inline-flex items-center gap-2 py-2 text-sm text-zinc-400"><ArrowLeft size={16} /> Mis juntas</Link>
      <header className="sticky top-0 z-10 -mx-5 mt-3 border-b border-zinc-800 bg-black/95 px-5 pb-4 pt-2 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{event.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{event.members.length} personas · {event.status === "OPEN" ? "Junta abierta" : "Junta cerrada"}</p>
          </div>
          <button onClick={copyInviteCode} aria-label="Copiar código de invitación" className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300"><Copy size={14} /> Invitar</button>
        </div>
        <div className="mt-5 flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {tabs.map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === item ? "bg-white text-black" : "text-zinc-400"}`}>{item}</button>
          ))}
        </div>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">{notice}</p>}

      {tab === "Resumen" && (
        <section className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Gastos totales</p>
          <h2 className="mt-1 text-5xl font-bold tracking-tighter">{money(total)}</h2>
          {event.date && <p className="mt-2 text-sm text-zinc-500">{new Date(event.date).toLocaleDateString()}</p>}

          <div className="mt-8 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">Saldos de la junta</h3>
            <span className="text-xs text-zinc-500">{event.debts.length} pendientes</span>
          </div>
          {event.debts.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">Todavía no hay deudas pendientes.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {event.debts.map((debt) => (
                <article key={debt.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm"><span className="truncate">{debt.debtor.name}</span><ArrowRight size={14} className="shrink-0 text-zinc-500" /><span className="truncate">{debt.creditor.name}</span></div>
                    <span className="shrink-0 font-semibold">{money(debt.amount)}</span>
                  </div>
                  {debt.debtorId === user?.id && debt.status === "PENDING" && (
                    <button onClick={() => setShowPayment(debt)} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black">Ver instrucciones y pagar</button>
                  )}
                  {reviewDebts.some((item) => item.id === debt.id) && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button onClick={() => confirmPayment(debt.id)} className="rounded-xl bg-white py-3 text-sm font-semibold text-black">Confirmar pago</button>
                      <button onClick={() => rejectPayment(debt.id)} className="rounded-xl border border-zinc-700 py-3 text-sm font-medium">Rechazar</button>
                    </div>
                  )}
                  {debt.status === "REVIEW" && debt.debtorId === user?.id && <p className="mt-3 text-xs text-zinc-500">Comprobante enviado · esperando confirmación</p>}
                  {debt.proofs?.map((proof) => (
                    <ProofPreview key={proof.id} proof={proof} eventId={id} token={token} />
                  ))}
                </article>
              ))}
            </div>
          )}
          <button onClick={() => setShowExpense(true)} disabled={event.status !== "OPEN"} className="mt-6 w-full rounded-xl bg-white py-3 font-semibold text-black disabled:opacity-40"><span className="inline-flex items-center justify-center gap-2"><ReceiptText size={18} /> Agregar gasto</span></button>
        </section>
      )}

      {tab === "Gastos" && (
        <section id="gastos" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">Gastos y boletas</h2>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm">
              <Upload size={16} /> Subir boleta
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => uploadReceipt(e.target.files?.[0], "EXPENSE")} />
            </label>
          </div>
          {event.expenses.length === 0 ? <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">Los gastos que agreguen aparecerán aquí.</p> : (
            <div className="space-y-3">
              {event.expenses.map((item) => (
                <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex justify-between gap-3"><div><p className="font-medium">{item.description}</p><p className="mt-1 text-sm text-zinc-500">Pagó {item.paidBy.name}</p></div><strong>{money(item.amount)}</strong></div>
                  {item.items?.length > 0 && <ul className="mt-3 border-t border-zinc-800 pt-3 text-sm text-zinc-400">{item.items.map((product) => <li key={product.id} className="flex justify-between py-1"><span>{product.name}</span><span>{money(product.amount)}</span></li>)}</ul>}
                </article>
              ))}
            </div>
          )}
          <button onClick={() => setShowExpense(true)} disabled={event.status !== "OPEN"} className="mt-5 w-full rounded-xl bg-white py-3 font-semibold text-black disabled:opacity-40">Agregar gasto manual</button>
        </section>
      )}

      {tab === "Personas" && (
        <section id="personas" className="mt-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Participantes</h2>
          <div className="space-y-3">
            {event.members.map(({ id: memberId, user: member, preferences }) => (
              <article key={memberId} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-zinc-800"><Users size={18} className="text-zinc-400" /></div><div><p className="font-medium">{member.name}{member.id === event.creatorId ? " · anfitrión" : ""}</p>{preferences.length > 0 && <p className="mt-1 text-xs text-zinc-500">{preferences.join(" · ")}</p>}</div></div>
              </article>
            ))}
          </div>
          <PreferencesForm eventId={id} token={token} current={event.members.find((item) => item.userId === user?.id)?.preferences || []} onSaved={loadEvent} />
          {event.creatorId === user?.id && <EventBankDetails event={event} eventId={id} token={token} onSaved={loadEvent} />}
        </section>
      )}

      {showExpense && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="presentation" onClick={() => setShowExpense(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="expense-title" onClick={(e) => e.stopPropagation()} className="mx-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 pb-8">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" />
            <h2 id="expense-title" className="text-xl font-semibold">Nuevo gasto</h2>
            <form onSubmit={submitExpense} className="mt-5 space-y-4">
              <label className="block text-sm text-zinc-400">Descripción
                <input required maxLength={150} value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white" placeholder="Carne, carbón…" />
              </label>
              <label className="block text-sm text-zinc-400">Total
                <input required type="number" min="0.01" step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white" placeholder="0.00" />
              </label>
              {expense.items.length > 0 && (
                <div className="rounded-xl border border-zinc-800 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Productos detectados · revisa antes de guardar</p>
                  {expense.items.map((item, index) => (
                    <div key={`${index}-${item.name}`} className="flex gap-2 py-1">
                      <input aria-label={`Producto ${index + 1}`} value={item.name} onChange={(e) => setExpense({ ...expense, items: expense.items.map((value, i) => i === index ? { ...value, name: e.target.value } : value) })} className="min-w-0 flex-1 bg-transparent text-sm" />
                      <input aria-label={`Precio ${index + 1}`} type="number" step="0.01" value={item.amount} onChange={(e) => setExpense({ ...expense, items: expense.items.map((value, i) => i === index ? { ...value, amount: e.target.value } : value) })} className="w-24 bg-transparent text-right text-sm" />
                    </div>
                  ))}
                </div>
              )}
              <button disabled={busy} className="w-full rounded-xl bg-white py-3 font-semibold text-black disabled:opacity-50">{busy ? "Guardando…" : "Guardar gasto"}</button>
            </form>
          </section>
        </div>
      )}

      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" role="presentation" onClick={() => setShowPayment(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 pb-8">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" />
            <h2 id="payment-title" className="text-xl font-semibold">Paga {money(showPayment.amount)}</h2>
            <p className="mt-1 text-sm text-zinc-400">Transfiere a {showPayment.creditor.name} y sube el comprobante.</p>
            <div className="mt-5 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
              <p className="flex justify-between"><span className="text-zinc-500">Banco</span><span>{event.bankName || "Solicita los datos al anfitrión"}</span></p>
              <p className="flex justify-between"><span className="text-zinc-500">Titular</span><span>{event.accountName || showPayment.creditor.name}</span></p>
              {event.accountNumber && <p className="flex justify-between"><span className="text-zinc-500">Cuenta</span><span>{event.accountNumber}</span></p>}
              {event.taxId && <p className="flex justify-between"><span className="text-zinc-500">RUT</span><span>{event.taxId}</span></p>}
            </div>
            <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white py-3 font-semibold text-black">
              <Upload size={18} /> {busy ? "Procesando…" : "Subir comprobante"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} className="sr-only" onChange={(e) => uploadReceipt(e.target.files?.[0], "PAYMENT", showPayment.id)} />
            </label>
            <button onClick={() => setShowPayment(null)} className="mt-3 w-full py-2 text-sm text-zinc-500">Cerrar</button>
          </section>
        </div>
      )}
    </main>
  );
}

function ProofPreview({ proof, eventId, token }) {
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);
  async function toggleImage() {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl("");
      return;
    }
    try {
      const response = await fetch(`${API}/api/events/${eventId}/proofs/${proof.id}/image`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error("No se pudo cargar la imagen.");
      setImageUrl(URL.createObjectURL(await response.blob()));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      <button onClick={toggleImage} className="text-sm text-zinc-300">{imageUrl ? "Ocultar comprobante" : "Ver comprobante"}</button>
      {proof.reviewNote && <p className="mt-1 text-xs text-zinc-500">{proof.reviewNote}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-zinc-400">{error}</p>}
      {imageUrl && <img src={imageUrl} alt={`Comprobante de ${proof.filename}`} className="mt-3 max-h-80 w-full rounded-xl object-contain" />}
    </div>
  );
}

function EventBankDetails({ event, eventId, token, onSaved }) {
  const [details, setDetails] = useState({
    bankName: event.bankName || "",
    accountName: event.accountName || "",
    accountNumber: event.accountNumber || "",
    taxId: event.taxId || "",
  });
  const [message, setMessage] = useState("");
  async function save() {
    try {
      await apiRequest(`/api/events/${eventId}`, token, { method: "PATCH", body: JSON.stringify(details) });
      setMessage("Datos bancarios guardados.");
      onSaved(token);
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="font-medium">Datos para transferencias</h3>
      <div className="mt-3 space-y-3">
        {[
          ["bankName", "Banco"],
          ["accountName", "Nombre del titular"],
          ["accountNumber", "Número de cuenta"],
          ["taxId", "RUT"],
        ].map(([field, label]) => (
          <label key={field} className="block text-sm text-zinc-400">{label}
            <input value={details[field]} onChange={(e) => setDetails({ ...details, [field]: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-white" />
          </label>
        ))}
      </div>
      <button onClick={save} className="mt-3 rounded-lg border border-zinc-700 px-4 py-2 text-sm">Guardar datos</button>
      {message && <p role="status" className="mt-2 text-xs text-zinc-400">{message}</p>}
    </div>
  );
}

function PreferencesForm({ eventId, token, current, onSaved }) {
  const [value, setValue] = useState(current.join(", "));
  const [message, setMessage] = useState("");
  async function save() {
    try {
      await apiRequest(`/api/events/${eventId}/preferences`, token, {
        method: "PATCH",
        body: JSON.stringify({ preferences: value.split(",").map((item) => item.trim()).filter(Boolean) }),
      });
      setMessage("Preferencias guardadas.");
      onSaved(token);
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <label className="block text-sm text-zinc-400">Mis exclusiones (por categoría, separadas por coma)
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="alcohol, carne" className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-white" />
      </label>
      <button onClick={save} className="mt-3 rounded-lg border border-zinc-700 px-4 py-2 text-sm">Guardar preferencias</button>
      {message && <p role="status" className="mt-2 text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
