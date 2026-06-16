"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/alertas?estado=activa");
        if (res.ok) {
          const data = await res.json();
          setCount(Array.isArray(data) ? data.length : 0);
        }
      } catch {
        /* ignore */
      }
    }
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href="/alertas"
      className="relative rounded-lg border border-slate-200/80 bg-white/80 p-2 text-slate-600 transition-colors hover:border-amber-300 hover:text-amber-700"
      aria-label={`${count} alertas activas`}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
