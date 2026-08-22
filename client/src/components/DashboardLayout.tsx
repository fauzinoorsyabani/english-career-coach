import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { BarChart3, BookOpenCheck, BriefcaseBusiness, Loader2, LogOut, MessageCircleHeart, Settings2, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Tutor", path: "/tutor", icon: MessageCircleHeart },
  { label: "Practice", path: "/practice", icon: BookOpenCheck },
  { label: "Career", path: "/career", icon: BriefcaseBusiness },
  { label: "Progress", path: "/progress", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: Settings2 },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const current = navItems.find(item => location.startsWith(item.path));

  if (loading) return (
    <div className="min-h-screen bg-background ink-grid flex items-center justify-center p-5" role="status" aria-live="polite">
      <section className="study-card w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Loader2 className="size-6 animate-spin" /></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-accent">English Career Coach</p>
        <h1 className="editorial-title mt-2 text-3xl font-semibold">Opening your study lab.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Preparing your personal English-learning workspace.</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div>
        <span className="sr-only">Loading your study workspace</span>
      </section>
    </div>
  );
  if (!user) return (
    <div className="min-h-screen ink-grid flex items-center justify-center p-5">
      <section className="study-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="size-6" /></div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent">Your English study lab</p>
        <h1 className="editorial-title text-4xl font-semibold">Make English part of your IT career.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Sign in to save tutor conversations, practice feedback, and career progress in one private workspace.</p>
        <Button onClick={() => startLogin()} className="mt-7 w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">Sign in to begin</Button>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r border-border/70 bg-primary text-primary-foreground">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 px-7 pt-8 text-left">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground font-bold">EC</span>
          <span><span className="block editorial-title text-lg font-semibold leading-none">English</span><span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.16em] text-primary-foreground/60">Career Coach</span></span>
        </button>
        <div className="mx-7 mt-9 border-t border-primary-foreground/10" />
        <nav aria-label="Primary navigation" className="mt-5 space-y-1 px-4">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.startsWith(item.path);
            return <button key={item.label} onClick={() => setLocation(item.path)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${active ? "bg-primary-foreground text-primary shadow-sm" : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"}`}><Icon className="size-[18px]" />{item.label}</button>;
          })}
        </nav>
        <div className="mt-auto p-5">
          <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/8 p-4">
            <p className="text-xs text-primary-foreground/60">Today’s principle</p>
            <p className="mt-2 editorial-title text-base leading-5">Small sentences build real confidence.</p>
          </div>
          <div className="mt-5 flex items-center gap-3 px-1">
            <Avatar className="size-9 border border-primary-foreground/15"><AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{user.name?.slice(0, 1).toUpperCase() || "U"}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name || "Learner"}</p><p className="truncate text-xs text-primary-foreground/55">{user.email || "Private workspace"}</p></div>
            <button aria-label="Sign out" onClick={logout} className="rounded-lg p-2 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"><LogOut className="size-4" /></button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:pl-72">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur lg:px-10">
          <button onClick={() => setLocation("/")} className="flex items-center gap-3 lg:hidden"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">EC</span><span className="editorial-title text-lg font-semibold">English Career Coach</span></button>
          <div className="hidden lg:block"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Study workspace</p><p className="mt-0.5 text-sm font-semibold">{current?.label || "Overview"}</p></div>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:block">Learning for your IT career</span><span className="pulse-dot size-2 rounded-full bg-accent" /></div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 pb-28 lg:px-10 lg:py-10">{children}</main>
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/80 bg-card/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        {navItems.map(item => { const Icon = item.icon; const active = location.startsWith(item.path); return <button key={item.label} onClick={() => setLocation(item.path)} className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-semibold ${active ? "text-accent" : "text-muted-foreground"}`}><Icon className="size-[18px]" />{item.label}</button>; })}
      </nav>
    </div>
  );
}
