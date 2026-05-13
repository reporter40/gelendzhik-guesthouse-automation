"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/bookings", label: "Брони" },
  { href: "/templates", label: "Шаблоны" },
  { href: "/health", label: "Статус" },
  { href: "/revenue", label: "Revenue" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6 border-b border-gray-200 bg-white px-6 py-3">
      <span className="mr-4 font-semibold text-blue-700">Акваторинг</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            pathname.startsWith(l.href)
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          {l.label}
        </Link>
      ))}
      <Link
        href="/logout"
        className="ml-auto text-sm text-gray-400 hover:text-gray-700"
        prefetch={false}
      >
        Выйти
      </Link>
    </nav>
  );
}
