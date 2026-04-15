"use client";

import Link from "next/link";
import { useState } from "react";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[#222] bg-[#111]/95 px-4 py-4 backdrop-blur md:hidden">
        <div className="text-lg font-bold">Matt Nash</div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#181818] text-white"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <div className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-5 bg-white" />
            <span className="block h-0.5 w-5 bg-white" />
            <span className="block h-0.5 w-5 bg-white" />
          </div>
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            onClick={closeMenu}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />

          <div className="fixed right-0 top-0 z-50 flex h-screen w-[280px] flex-col border-l border-[#222] bg-[#111] p-6 shadow-2xl md:hidden">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-lg font-bold">Menu</h2>

              <button
                type="button"
                onClick={closeMenu}
                className="rounded-lg border border-[#333] px-3 py-1 text-sm text-zinc-300 hover:text-white"
                aria-label="Close menu"
              >
                Close
              </button>
            </div>

            <nav className="flex flex-col gap-5">
              <Link
                href="/"
                className="text-base text-white/90 hover:text-white"
                onClick={closeMenu}
              >
                Home
              </Link>
              <Link
                href="/fsh"
                className="text-base text-white/90 hover:text-white"
                onClick={closeMenu}
              >
                FSH
              </Link>
              <Link
                href="/email"
                className="text-base text-white/90 hover:text-white"
                onClick={closeMenu}
              >
                Email
              </Link>
              <Link
                href="/tour"
                className="text-base text-white/90 hover:text-white"
                onClick={closeMenu}
              >
                Tour
              </Link>
              <Link
                href="/tour-vote"
                className="text-base text-white/90 hover:text-white"
                onClick={closeMenu}
              >
                Tour Vote
              </Link>
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}