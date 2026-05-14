import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Акваторинг — Админ",
  description: "Панель управления гостевым домом",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
