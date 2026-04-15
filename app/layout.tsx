import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";
import MobileNav from "@/components/MobileNav";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0b] text-white">
        <div className="flex min-h-screen">
          <aside className="hidden w-64 border-r border-[#222] bg-[#111] p-6 md:block">
            <h1 className="mb-8 text-xl font-bold">Matt Nash</h1>

            <nav className="flex flex-col gap-4 text-sm">
              <Link href="/" className="hover:text-gray-300">
                Home
              </Link>
              <Link href="/fsh" className="hover:text-gray-300">
                FSH
              </Link>
              <Link href="/email" className="hover:text-gray-300">
                Email
              </Link>
              <Link href="/tour" className="hover:text-gray-300">
                Tour
              </Link>
              <Link href="/tour-vote">Tour Vote</Link>
            </nav>
          </aside>

          <div className="flex min-h-screen flex-1 flex-col">
            <MobileNav />
            <main className="flex-1 p-4 md:p-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}