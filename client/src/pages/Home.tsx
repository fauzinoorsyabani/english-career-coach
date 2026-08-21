import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DailyChallengeCard } from "@/components/DailyChallengeCard";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BookOpenCheck, BriefcaseBusiness, Flame, MessagesSquare, Sparkles, Target, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

const quickActions = [
  { title: "Ask your tutor", copy: "Correct a sentence or rehearse an answer.", icon: MessagesSquare, path: "/tutor", tone: "bg-[#FDE8DF] text-[#BB5135]" },
  { title: "Daily practice", copy: "One focused English exercise for today.", icon: BookOpenCheck, path: "/practice", tone: "bg-[#E4F0F4] text-[#34718A]" },
  { title: "Career English", copy: "Role-play a real IT communication moment.", icon: BriefcaseBusiness, path: "/career", tone: "bg-[#E9EFE3] text-[#57744B]" },
];

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const overview = trpc.progress.overview.useQuery();
  const profile = trpc.profile.get.useQuery();
  const data = overview.data;
  const dailyGoal = profile.data?.dailyGoal ?? data?.dailyGoal ?? 1;
  const progress = Math.min(100, Math.round(((data?.todaySessions ?? 0) / dailyGoal) * 100));

  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-[28px] bg-primary px-6 py-8 text-primary-foreground sm:px-9 lg:px-11 lg:py-10">
      <div className="absolute -right-20 -top-24 size-80 rounded-full border-[28px] border-accent/30" />
      <div className="absolute bottom-0 right-24 h-24 w-24 rounded-t-full bg-primary-foreground/5" />
      <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Your personal study lab</p><h1 className="editorial-title mt-3 max-w-2xl text-4xl font-semibold leading-[1.02] sm:text-5xl">Welcome back, {user?.name?.split(" ")[0] || "learner"}.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/70">Build confident English through small, practical moments that match the work you want to do in IT.</p><Button onClick={() => setLocation("/practice")} className="mt-6 rounded-xl bg-accent px-5 text-accent-foreground hover:bg-accent/90">Continue today’s practice <ArrowRight className="ml-1 size-4" /></Button></div>
        <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/7 p-5 backdrop-blur"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Today’s goal</p><p className="mt-1 text-xs text-primary-foreground/65">{data?.todaySessions ?? 0} of {dailyGoal} learning moments completed</p></div><Target className="size-5 text-accent" /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-primary-foreground/15"><div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div><p className="mt-3 text-xs text-primary-foreground/65">{progress === 100 ? "Goal met — come back for a little more if you want." : "A short, focused session is enough for today."}</p></div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-3">
      <div className="study-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Current streak</p><p className="mt-3 editorial-title text-4xl font-semibold">{data?.streak ?? 0}<span className="ml-1 text-base font-medium text-muted-foreground">days</span></p></div><span className="rounded-xl bg-[#FDE8DF] p-2.5 text-[#BB5135]"><Flame className="size-5" /></span></div><p className="mt-4 text-xs text-muted-foreground">Practice on consecutive days to grow your streak.</p></div>
      <div className="study-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Completed sessions</p><p className="mt-3 editorial-title text-4xl font-semibold">{data?.completedSessions ?? 0}</p></div><span className="rounded-xl bg-[#E4F0F4] p-2.5 text-[#34718A]"><TrendingUp className="size-5" /></span></div><p className="mt-4 text-xs text-muted-foreground">Practice and career role-plays count here.</p></div>
      <div className="study-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Vocabulary learned</p><p className="mt-3 editorial-title text-4xl font-semibold">{data?.vocabularyLearned ?? 0}</p></div><span className="rounded-xl bg-[#E9EFE3] p-2.5 text-[#57744B]"><Sparkles className="size-5" /></span></div><p className="mt-4 text-xs text-muted-foreground">Earned through strong vocabulary practice.</p></div>
    </section>

    <DailyChallengeCard />

    <section className="grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
      <div className="study-card p-5 sm:p-6"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Choose a focused moment</p><h2 className="editorial-title mt-2 text-3xl font-semibold">Your desk is ready.</h2></div></div><div className="mt-5 grid gap-3 md:grid-cols-3">{quickActions.map(action => { const Icon = action.icon; return <button key={action.title} onClick={() => setLocation(action.path)} className="group rounded-2xl border border-border/80 bg-background p-4 text-left hover:-translate-y-0.5 hover:shadow-md"><span className={`inline-flex rounded-xl p-2 ${action.tone}`}><Icon className="size-4" /></span><p className="mt-5 font-semibold">{action.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{action.copy}</p><ArrowRight className="mt-4 size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></button>; })}</div></div>
      <div className="study-card p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Recent activity</p><div className="mt-4 space-y-3">{data?.recentActivity?.length ? data.recentActivity.map(item => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-muted/55 p-3"><span className={`size-2 shrink-0 rounded-full ${item.kind === "practice" ? "bg-accent" : "bg-chart-3"}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{item.score !== null ? ` · ${item.score}/100` : ""}</p></div></div>) : <div className="rounded-xl border border-dashed border-border p-5"><p className="text-sm font-medium">Your learning history will grow here.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Complete a short practice session or a career role-play to start tracking momentum.</p></div>}</div><Button variant="ghost" onClick={() => setLocation("/progress")} className="mt-4 w-full rounded-xl text-primary hover:bg-secondary">View progress <ArrowRight className="ml-1 size-4" /></Button></div>
    </section>
  </div>;
}
