"use client";

import { useRouter } from "next/navigation";
import type { MonthOption } from "@/lib/articles";

export function MonthFilter({ months, current }: { months: MonthOption[]; current: string | null }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-sumi-soft shadow-sm transition hover:border-shu/50 hover:text-shu-deep">
      <span aria-hidden className="text-xs">
        📅
      </span>
      <select
        value={current ?? ""}
        onChange={(e) => router.push(e.target.value ? `/?month=${e.target.value}` : "/")}
        aria-label="Filter by month"
        className="cursor-pointer bg-transparent text-sm text-sumi-soft outline-none [&>option]:text-sumi"
      >
        <option value="">最新50件 — Latest 50</option>
        {months.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label} ({m.count})
          </option>
        ))}
      </select>
    </label>
  );
}
