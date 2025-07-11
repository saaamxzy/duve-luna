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
      className={`group flex flex-col gap-4 rounded-xl p-6 text-white transition-all duration-200 hover:scale-105 active:scale-95 ${
        highlight
          ? "bg-gradient-to-br from-[hsl(280,100%,70%)] to-[hsl(260,100%,60%)] shadow-lg"
          : "bg-white/10 hover:bg-white/20"
      }`}
      href={href}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl transition-transform group-hover:scale-110 sm:text-3xl">
          {icon}
        </span>
        <h3 className="text-xl font-bold transition-transform group-hover:translate-x-1 sm:text-2xl">
          {title} →
        </h3>
      </div>
      <div className="text-base leading-relaxed opacity-90 sm:text-lg">
        {description}
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-8 sm:gap-12 sm:py-16">
        {/* Hero Section */}
        <div className="space-y-4 text-center sm:space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            <span className="text-[hsl(280,100%,70%)]">Duve</span> Helper
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg lg:text-xl">
            Manage your locks, reservations, and keyboard passwords with ease.
            Monitor daily tasks and configure your system seamlessly.
          </p>
        </div>

        {/* Main Navigation - Highlighted Cards */}
        <div className="mb-6 grid w-full max-w-4xl grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-6 lg:gap-8">
          <NavigationCard
            href="/daily-task"
            title="Daily Task"
            description="Monitor daily task runs, view failed lock updates, and trigger manual runs for comprehensive system management."
            icon="📊"
            highlight={true}
          />
          <NavigationCard
            href="/config"
            title="Configuration"
            description="Manage API tokens and credentials for Duve and Sifely services with secure database storage."
            icon="⚙️"
            highlight={true}
          />
        </div>

        {/* Secondary Navigation */}
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:gap-8">
          <NavigationCard
            href="/locks"
            title="Manage Locks"
            description="View and manage all your locks, check their status, and update lock profiles with detailed information."
            icon="🔒"
          />
          <NavigationCard
            href="/api/locks"
            title="API Access"
            description="Access the locks API for programmatic management and integration with external systems."
            icon="🔌"
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex w-full max-w-md flex-col gap-4 sm:mt-8 sm:flex-row sm:gap-6">
          <Link
            href="/daily-task"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-[#15162c] active:scale-95 sm:py-4"
          >
            <span className="text-lg">🚀</span>
            <span className="text-sm sm:text-base">View Daily Task Status</span>
          </Link>
          <Link
            href="/config"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#15162c] active:scale-95 sm:py-4"
          >
            <span className="text-lg">⚙️</span>
            <span className="text-sm sm:text-base">Manage Settings</span>
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6">
          <div className="rounded-lg bg-white/5 p-4 text-center sm:p-6">
            <div className="mb-2 text-2xl sm:text-3xl">🏠</div>
            <h3 className="mb-2 text-sm font-semibold sm:text-base">
              Property Management
            </h3>
            <p className="text-xs text-white/70 sm:text-sm">
              Manage multiple properties and their lock configurations
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-4 text-center sm:p-6">
            <div className="mb-2 text-2xl sm:text-3xl">🔐</div>
            <h3 className="mb-2 text-sm font-semibold sm:text-base">
              Automated Updates
            </h3>
            <p className="text-xs text-white/70 sm:text-sm">
              Automatic lock code updates synchronized with reservations
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-4 text-center sm:p-6">
            <div className="mb-2 text-2xl sm:text-3xl">📱</div>
            <h3 className="mb-2 text-sm font-semibold sm:text-base">
              Mobile Ready
            </h3>
            <p className="text-xs text-white/70 sm:text-sm">
              Optimized for mobile devices with touch-friendly interface
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/60 sm:mt-12">
          <p className="text-xs sm:text-sm">
            Built with Next.js, TypeScript, and Tailwind CSS
          </p>
        </div>
      </div>
    </main>
  );
}
