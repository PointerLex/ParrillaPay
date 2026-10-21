import Link from "next/link";
import { Home, Receipt, Users, User } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/event/1", label: "Expenses", icon: Receipt },
  { href: "/event/1", label: "People", icon: Users },
  { href: "/", label: "Profile", icon: User },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md border-t border-zinc-800 bg-zinc-900">
      <ul className="flex items-center justify-around py-2">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={label}>
            <Link href={href} className="flex flex-col items-center gap-1 px-3 py-1 text-xs text-zinc-400 hover:text-white">
              <Icon size={20} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
