"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/bookings",  label: "Брони" },
  { href: "/templates", label: "Шаблоны" },
  { href: "/health",    label: "Статус" },
  { href: "/revenue",   label: "Доходы" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        background: "linear-gradient(135deg, #072B55 0%, #0B63CE 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
      className="flex items-center gap-4 px-6 py-0 h-14 shadow-md"
    >
      {/* Logo + Brand */}
      <Link href="/bookings" className="flex items-center gap-2.5 shrink-0 mr-3">
        <Image
          src="/brand/aquatoring-owner.png"
          alt="Акваторинг"
          width={36}
          height={36}
          className="rounded-full object-cover border-2 border-white/20 shadow-sm"
          priority
        />
        <div className="leading-none hidden sm:block">
          <p className="text-white font-semibold text-sm tracking-tight leading-none">Акваторинг</p>
          <p className="text-blue-200 text-[10px] leading-none mt-0.5 font-normal opacity-80">панель управления</p>
        </div>
      </Link>

      {/* Divider */}
      <div className="w-px h-6 bg-white/15 hidden sm:block" />

      {/* Nav links */}
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            pathname.startsWith(l.href)
              ? "bg-white/20 text-white shadow-sm"
              : "text-blue-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          {l.label}
        </Link>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      <Link
        href="/logout"
        className="text-xs text-blue-200/70 hover:text-white transition-colors"
        prefetch={false}
      >
        Выйти
      </Link>
    </nav>
  );
}
