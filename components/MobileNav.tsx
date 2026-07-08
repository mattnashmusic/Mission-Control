import Link from "next/link";

export default function MobileNav() {
  return (
    <nav className="sticky top-0 z-50 grid grid-cols-3 gap-3 border-b border-[#222] bg-[#111]/95 px-4 py-3 backdrop-blur md:hidden">
      <Link
        href="/"
        aria-label="Home"
        className="flex h-12 items-center justify-center rounded-xl border border-[#333] bg-[#181818] text-2xl"
      >
        🏠
      </Link>

      <Link
        href="/fsh"
        aria-label="FSH"
        className="flex h-12 items-center justify-center rounded-xl border border-[#333] bg-[#181818] text-2xl"
      >
        🎣
      </Link>

      <Link
        href="/tour"
        aria-label="Tour"
        className="flex h-12 items-center justify-center rounded-xl border border-[#333] bg-[#181818] text-2xl"
      >
        🌍
      </Link>
    </nav>
  );
}