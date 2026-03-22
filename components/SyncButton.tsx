"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleClick() {
    try {
      setIsLoading(true);
      setMessage("");

      const response = await fetch("/api/sync/all", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setMessage("✅ Synced");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? `❌ ${error.message}` : "❌ Sync failed"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Syncing..." : "Sync now"}
      </button>

      {message ? (
        <span className="mt-2 text-xs text-zinc-400">{message}</span>
      ) : null}
    </div>
  );
}