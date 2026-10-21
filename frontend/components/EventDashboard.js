"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

const TABS = ["Summary", "Expenses", "People"];

const people = ["Ana", "Bruno", "Carla", "Diego"];
const expenses = [
  { id: 1, title: "Asado meat", paidBy: "Ana", amount: 120 },
  { id: 2, title: "Drinks", paidBy: "Bruno", amount: 60 },
  { id: 3, title: "Charcoal", paidBy: "Carla", amount: 20 },
];
const debts = [
  { id: 1, from: "Diego", to: "Ana", amount: 50 },
  { id: 2, from: "Carla", to: "Ana", amount: 30 },
  { id: 3, from: "Bruno", to: "Ana", amount: 10 },
];

const money = (n) => `$${n.toFixed(2)}`;

export default function EventDashboard({ id }) {
  const [tab, setTab] = useState("Summary");
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <main className="p-4">
      <p className="text-sm text-zinc-400">Event #{id}</p>
      <h1 className="mt-1 text-5xl font-bold text-white">{money(total)}</h1>
      <p className="mt-1 text-sm text-zinc-400">Total expenses</p>

      <div className="mt-6 flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${
              tab === t ? "bg-white text-black" : "text-zinc-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-3">
        {tab === "Summary" && (
          <>
            <h2 className="text-sm font-semibold text-zinc-400">Who owes who</h2>
            {debts.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center gap-2 text-white">
                  <span>{d.from}</span>
                  <ArrowRight size={16} className="text-zinc-400" />
                  <span>{d.to}</span>
                </div>
                <span className="font-semibold text-white">{money(d.amount)}</span>
              </div>
            ))}
          </>
        )}
        {tab === "Expenses" &&
          expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div>
                <p className="text-white">{e.title}</p>
                <p className="text-sm text-zinc-400">Paid by {e.paidBy}</p>
              </div>
              <span className="font-semibold text-white">{money(e.amount)}</span>
            </div>
          ))}
        {tab === "People" &&
          people.map((p) => (
            <div key={p} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-white">
              {p}
            </div>
          ))}
      </section>

      <button className="mt-6 w-full rounded-xl bg-white py-3 font-semibold text-black">Add expense</button>
    </main>
  );
}
