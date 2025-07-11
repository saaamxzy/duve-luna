import Link from "next/link";

// Navigation Card Component
function NavigationCard({
  href,
  title,
  description,
  icon,
  highlight = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <Link
      className={`flex max-w-xs flex-col gap-4 rounded-xl p-6 text-white transition-all duration-200 hover:scale-105 ${
        highlight
          ? "bg-gradient-to-br from-[hsl(280,100%,70%)] to-[hsl(260,100%,60%)] shadow-lg"
          : "bg-white/10 hover:bg-white/20"
      }`}
      href={href}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <h3 className="text-2xl font-bold">{title} →</h3>
      </div>
      <div className="text-lg opacity-90">{description}</div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          <span className="text-[hsl(280,100%,70%)]">Duve</span> Helper
        </h1>
        <p className="max-w-2xl text-center text-xl text-white/80">
          Manage your locks, reservations, and keyboard passwords with ease
        </p>

        {/* Main Navigation - Highlighted Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8">
          <NavigationCard
            href="/daily-task"
            title="Daily Task"
            description="Monitor daily task runs, view failed lock updates, and trigger manual runs."
            icon="📊"
            highlight={true}
          />
          <NavigationCard
            href="/config"
            title="Configuration"
            description="Manage API tokens and credentials for Duve and Sifely services."
            icon="⚙️"
            highlight={true}
          />
        </div>

        {/* Secondary Navigation */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          <NavigationCard
            href="/locks"
            title="Manage Locks"
            description="View and manage all your locks, check their status, and update lock profiles."
            icon="🔒"
          />
          <NavigationCard
            href="/api/locks"
            title="API Access"
            description="Access the locks API for programmatic management and integration."
            icon="🔌"
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/daily-task"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-semibold transition-colors hover:bg-green-700"
          >
            <span>🚀</span>
            View Daily Task Status
          </Link>
          <Link
            href="/config"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold transition-colors hover:bg-blue-700"
          >
            <span>⚙️</span>
            Manage Settings
          </Link>
        </div>
      </div>
    </main>
  );
}
