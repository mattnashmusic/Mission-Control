import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Marketing Hub</h1>
      <p className="text-gray-400 mb-8">
        Overview of your business systems
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* FSH */}
        <Link href="/fsh">
          <div className="bg-[#111] border border-[#222] p-6 rounded-xl hover:border-white transition">
            <h2 className="text-xl font-semibold mb-2">FSH</h2>
            <p className="text-sm text-gray-400">
              Track funnel performance, revenue, and profit
            </p>
          </div>
        </Link>

        {/* Email */}
        <Link href="/email">
          <div className="bg-[#111] border border-[#222] p-6 rounded-xl hover:border-white transition">
            <h2 className="text-xl font-semibold mb-2">Email</h2>
            <p className="text-sm text-gray-400">
              Visualise your audience and build geo segments
            </p>
          </div>
        </Link>

        {/* Tour */}
        <Link href="/tour">
          <div className="bg-[#111] border border-[#222] p-6 rounded-xl hover:border-white transition">
            <h2 className="text-xl font-semibold mb-2">Tour</h2>
            <p className="text-sm text-gray-400">
              Track shows, ads, and ticket performance
            </p>
          </div>
        </Link>

      </div>
    </div>
  );
}