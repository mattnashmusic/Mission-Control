import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0b] text-white">
        <div className="flex min-h-screen">
          
          {/* Sidebar */}
          <aside className="w-64 bg-[#111] border-r border-[#222] p-6">
            <h1 className="text-xl font-bold mb-8">Matt Nash</h1>

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
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}