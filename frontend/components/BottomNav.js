"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, Users, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const eventId = pathname.match(/^\/event\/(\d+)/)?.[1];
  const items = [
    { href: "/#eventos", label: "Juntas", icon: Home },
    { href: eventId ? `/event/${eventId}#gastos` : "/#eventos", label: "Gastos", icon: Receipt },
    { href: eventId ? `/event/${eventId}#personas` : "/#eventos", label: "Personas", icon: Users },
    { href: "/#cuenta", label: "Cuenta", icon: User },
  ];
  return (
    <nav aria-label="Navegación principal" className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md border-t border-zinc-800 bg-black/90 backdrop-blur-xl">
      <ul className="flex items-center justify-around py-2">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={label}>
            <Link href={href} className="flex flex-col items-center gap-1 px-3 py-1 text-xs text-zinc-500 hover:text-white">
              <Icon size={20} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
