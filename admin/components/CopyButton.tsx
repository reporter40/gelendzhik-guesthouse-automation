"use client";

import { useState } from "react";

type Props = {
  text: string;
  label?: string;
  className?: string;
};

export default function CopyButton({
  text,
  label = "Скопировать ссылку",
  className = "",
}: Props) {
  const [done, setDone] = useState(false);

  async function handleClick() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      setDone(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!text}
      className={`rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {done ? "Скопировано" : label}
    </button>
  );
}
