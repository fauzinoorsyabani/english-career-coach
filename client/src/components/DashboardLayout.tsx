import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Loader2,
  LogOut,
  MessagesSquare,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Redirect, useLocation } from "wouter";

const baseNavItems = [
  { label: "Tutor", path: "/tutor", icon: MessagesSquare },
  { label: "Practice", path: "/practice", icon: BookOpenCheck },
  { label: "Career", path: "/career", icon: BriefcaseBusiness },
  { label: "Progress", path: "/progress", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: Settings2 },
] as const;

const adminNavItem = { label: "Admin", path: "/admin/users", icon: ShieldCheck } as const;

const easeOut = [0.23, 1, 0.32, 1] as const;

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          "grid place-items-center rounded-md bg-accent font-mono font-semibold text-accent-foreground",
          compact ? "size-8 text-[11px]" : "size-9 text-[12px]"
        )}
        aria-hidden="true"
      >
        EC
      </span>
      <span className="leading-none">
        <span
          className={cn(
            "editorial-title block font-semibold",
            compact ? "text-[15px]" : "text-[17px]"
          )}
        >
          English
        </span>
        <span className="eyebrow mt-1 block text-[9px] tracking-[0.12em] text-primary-foreground/55">
          Career coach
        </span>
      </span>
    </span>
  );
}

function LoadingScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-5"
      role="status"
      aria-live="polite"
    >
      <section className="study-card w-full max-w-sm p-8">
        <span className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
          <Loader2 className="size-5 animate-spin" />
        </span>
        <p className="eyebrow mt-6 text-accent-ink">English Career Coach</p>
        <h1 className="editorial-title mt-2 text-3xl">Opening your study desk.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Preparing your conversations, practice, and progress.
        </p>
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
        </div>
        <span className="sr-only">Loading your study workspace</span>
      </section>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const navItems = user?.role === "admin" ? [...baseNavItems, adminNavItem] : baseNavItems;
  const current = navItems.find(item => location.startsWith(item.path)) ?? baseNavItems[0];
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());

  if (loading) return <LoadingScreen />;
  if (!user) {
    const returnTo = `${location || "/"}${typeof window === "undefined" ? "" : window.location.search}`;
    return <Redirect to={`/login?returnTo=${encodeURIComponent(returnTo)}`} />;
  }

  const initials = user.name?.slice(0, 1).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-card px-4 py-2 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-border"
      >
        Skip to content
      </a>

      <aside
        aria-label="Workspace sidebar"
        className="hidden border-r border-primary-foreground/10 bg-primary text-primary-foreground lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col"
      >
        <button
          onClick={() => setLocation("/")}
          className="flex items-center px-6 pb-4 pt-7 text-left"
          aria-label="Go to overview"
        >
          <Wordmark />
        </button>

        <div className="mx-6 mt-2 border-t border-primary-foreground/10" />
        <p className="eyebrow px-7 pb-2 pt-6 text-primary-foreground/40">Workspace</p>

        <nav aria-label="Primary navigation" className="space-y-1 px-3">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.startsWith(item.path);
            return (
              <button
                key={item.label}
                onClick={() => setLocation(item.path)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  active
                    ? "text-primary"
                    : "text-primary-foreground/62 hover:bg-primary-foreground/8 hover:text-primary-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-md bg-primary-foreground shadow-[0_1px_0_oklch(0_0_0/8%)]"
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  />
                )}
                <span className="relative flex items-center gap-3">
                  <span
                    className={cn(
                      "h-4 w-[2px] rounded-full transition-colors duration-200",
                      active ? "bg-accent" : "bg-transparent"
                    )}
                    aria-hidden="true"
                  />
                  <Icon className="size-[17px]" strokeWidth={1.9} />
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4">
          <div className="rounded-md border border-primary-foreground/10 bg-primary-foreground/[0.04] p-4">
            <p className="eyebrow text-accent-bright">Practice note</p>
            <p className="editorial-title mt-2 text-[15px] leading-6 text-primary-foreground/90">
              Small sentences build real confidence.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2.5 px-1">
            <Avatar className="size-8 rounded-md">
              <AvatarFallback className="rounded-md bg-accent text-[11px] font-semibold text-accent-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{user.name || "Learner"}</p>
              <p className="truncate text-[11px] text-primary-foreground/45">
                {user.email || "Private workspace"}
              </p>
            </div>
            <button
              aria-label="Sign out"
              onClick={() => void logout()}
              className="rounded-md p-1.5 text-primary-foreground/50 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-3 lg:hidden"
              aria-label="Go to overview"
            >
              <span className="grid size-8 place-items-center rounded-md bg-primary font-mono text-[11px] font-semibold text-primary-foreground">
                EC
              </span>
              <span className="editorial-title text-[15px] font-semibold">English Coach</span>
            </button>

            <div className="hidden items-baseline gap-2.5 lg:flex">
              <span className="eyebrow text-muted-foreground">Study desk</span>
              <span className="text-muted-foreground/50" aria-hidden="true">
                /
              </span>
              <span className="text-sm font-medium text-foreground">{current.label}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="eyebrow hidden text-muted-foreground sm:inline">{today}</span>
              <span className="hidden h-3.5 w-px bg-border sm:block" aria-hidden="true" />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                English for your IT career
              </span>
              <button
                aria-label="Sign out"
                onClick={() => void logout()}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-[1360px] px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
        >
          <motion.div
            key={location}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: easeOut }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <nav
        aria-label="Mobile navigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden",
          navItems.length > 5 ? "grid-cols-6" : "grid-cols-5"
        )}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const active = location.startsWith(item.path);
          return (
            <button
              key={item.label}
              onClick={() => setLocation(item.path)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-active"
                  className="absolute -top-2 h-[2px] w-6 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  aria-hidden="true"
                />
              )}
              <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.9} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
