"use client";

import { useCallback, useState } from "react";

type Props = {
  value: string;
  label?: string;
  className?: string;
};

export function CopyButton({ value, label = "Copy", className = "" }: Props) {
  const [done, setDone] = useState(false);

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 ${className}`}
    >
      {done ? "Copied" : label}
    </button>
  );
}
