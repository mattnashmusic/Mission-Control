"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MetaBackfillButton() {
  const router = useRouter();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [error, setError] = useState("");

  async function handleBackfill() {
    if (isBackfilling) return;

    const confirmed = window.confirm(
      "Run Meta backfill now? This will update saved Meta spend in the dashboard.",
    );

    if (!confirmed) return;

    setIsBackfilling(true);
    setError("");

    try {
      const response = await fetch("/api/sync/meta/backfill", {
        method: "POST",
      });

      if (!response.ok) {
        let message = "Meta backfill failed.";

        try {
          const body = await response.json();
          message = body?.error || body?.message || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }

        throw new Error(message);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meta backfill failed.");
    } finally {
      setIsBackfilling(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <button
        type="button"
        onClick={handleBackfill}
        disabled={isBackfilling}
        className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBackfilling ? "Backfilling…" : "Backfill Meta"}
      </button>

      {error ? <p className="max-w-[220px] text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
