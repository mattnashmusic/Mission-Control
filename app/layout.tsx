import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";

function NavLinks({
  onClick,
  mobile = false,
}: {
  onClick?: () => void;
  mobile?: boolean;
}) {
  const linkClass = mobile
    ? "text-base text-white/90 hover:text-white"
    : "hover:text-gray-300";

  return (
    <>
      <Link href="/" className={linkClass} onClick={onClick}>
        Home
      </Link>
      <Link href="/fsh" className={linkClass} onClick={onClick}>
        FSH
      </Link>
      <Link href="/email" className={linkClass} onClick={onClick}>
        Email
      </Link>
      <Link href="/tour" className={linkClass} onClick={onClick}>
        Tour
      </Link>
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0b] text-white">
        <div className="flex min-h-screen">
          {/* Desktop Sidebar */}
          <aside className="hidden w-64 border-r border-[#222] bg-[#111] p-6 md:block">
            <h1 className="mb-8 text-xl font-bold">Matt Nash</h1>

            <nav className="flex flex-col gap-4 text-sm">
              <NavLinks />
            </nav>
          </aside>

          {/* Main Content Area */}
          <div className="flex min-h-screen flex-1 flex-col">
            {/* Mobile Top Bar */}
            <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[#222] bg-[#111]/95 px-4 py-4 backdrop-blur md:hidden">
              <div className="text-lg font-bold">Matt Nash</div>

              <details className="relative">
                <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[#333] bg-[#181818] text-white marker:content-none">
                  <span className="sr-only">Open menu</span>
                  <div className="flex flex-col gap-1.5">
                    <span className="block h-0.5 w-5 bg-white" />
                    <span className="block h-0.5 w-5 bg-white" />
                    <span className="block h-0.5 w-5 bg-white" />
                  </div>
                </summary>

                {/* Overlay */}
                <div className="fixed inset-0 z-40 bg-black/50" />

                {/* Drawer */}
                <div className="fixed right-0 top-0 z-50 flex h-screen w-[280px] flex-col border-l border-[#222] bg-[#111] p-6 shadow-2xl">
                  <div className="mb-8 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Menu</h2>
                    <span className="rounded-lg border border-[#333] px-3 py-1 text-sm text-zinc-300">
                      Close
                    </span>
                  </div>

                  <nav className="flex flex-col gap-5">
                    <NavLinks mobile />
                  </nav>
                </div>
              </details>
            </div>

            {/* Page Content */}
            <main className="flex-1 p-4 md:p-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}