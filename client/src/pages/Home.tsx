import { useAuth } from "@/_core/hooks/useAuth";
import { CountUp, FadeUp, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { DailyChallengeCard } from "@/components/DailyChallengeCard";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BookMarked,
  BookOpenCheck,
  BriefcaseBusiness,
  Flame,
  MessagesSquare,
  Target,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";

const quickActions = [
  {
    title: "Ask your tutor",
    copy: "Correct a sentence or rehearse an answer.",
    icon: MessagesSquare,
    path: "/tutor",
  },
  {
    title: "Daily practice",
    copy: "One focused English exercise for today.",
    icon: BookOpenCheck,
    path: "/practice",
  },
  {
    title: "Career English",
    copy: "Role-play a real IT communication moment.",
    icon: BriefcaseBusiness,
    path: "/career",
  },
];

const todayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
}).format(new Date());

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const overview = trpc.progress.overview.useQuery();
  const profile = trpc.profile.get.useQuery();
  const data = overview.data;
  const dailyGoal = Math.max(1, profile.data?.dailyGoal ?? data?.dailyGoal ?? 1);
  const sessions = data?.todaySessions ?? 0;
  const progress = Math.min(100, Math.round((sessions / dailyGoal) * 100));
  const firstName = user?.name?.split(" ")[0] || "learner";
  const remaining = Math.max(dailyGoal - sessions, 0);

  const stats = [
    {
      label: "Current streak",
      value: data?.streak ?? 0,
      unit: "days",
      note: "Consecutive days of practice.",
      icon: Flame,
    },
    {
      label: "Sessions completed",
      value: data?.completedSessions ?? 0,
      unit: "total",
      note: "Practice and career role-plays.",
      icon: TrendingUp,
    },
    {
      label: "Words saved",
      value: data?.vocabularyLearned ?? 0,
      unit: "terms",
      note: "Vocabulary kept from feedback.",
      icon: BookMarked,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <FadeUp>
        <section className="ink-panel rounded-xl border border-primary/20 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -right-3 select-none font-display text-[13rem] leading-none text-primary-foreground/[0.035]"
          >
            Aa
          </div>
          <span
            aria-hidden="true"
            className="eyebrow absolute right-8 top-7 hidden text-[9px] text-primary-foreground/25 sm:block"
          >
            /ˈɪŋ.ɡlɪʃ/
          </span>

          <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div className="min-w-0">
              <p className="eyebrow flex items-center gap-2 text-primary-foreground/55">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                Study desk / {todayLabel}
              </p>
              <h1 className="editorial-title mt-4 max-w-2xl break-words text-4xl leading-[1.06] sm:text-5xl lg:text-[3.25rem]">
                Welcome back,{" "}
                <span className="text-accent-bright">{firstName}</span>.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/65">
                A quiet place to practise the English you need for the IT work you want to do.
              </p>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Button
                  variant="highlight"
                  size="lg"
                  onClick={() => setLocation("/practice")}
                  className="w-full sm:w-auto"
                >
                  Continue today&apos;s practice <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setLocation("/tutor")}
                  className="w-full text-primary-foreground/65 hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
                >
                  Open tutor room
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-primary-foreground/12 bg-primary-foreground/[0.055] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow text-primary-foreground/45">Today / goal</p>
                  <p className="mt-3 flex items-baseline gap-1.5">
                    <span className="editorial-title text-4xl text-primary-foreground">
                      <CountUp value={sessions} />
                    </span>
                    <span className="font-mono text-sm text-primary-foreground/45">
                      / {dailyGoal}
                    </span>
                  </p>
                </div>
                <Target className="size-4 shrink-0 text-accent-bright" aria-hidden="true" />
              </div>

              {dailyGoal <= 6 ? (
                <div className="mt-5 flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: dailyGoal }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors duration-300",
                        index < sessions ? "bg-accent" : "bg-primary-foreground/15"
                      )}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-primary-foreground/15" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-primary-foreground/10 pt-3">
                <span className="text-[11px] leading-4 text-primary-foreground/55">
                  {progress === 100
                    ? "Goal met for today."
                    : `${remaining} short ${remaining === 1 ? "moment" : "moments"} to go.`}
                </span>
                <span className="eyebrow text-[9px] text-primary-foreground/35">Private</span>
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      <Stagger
        className="study-card grid overflow-hidden sm:grid-cols-3"
        delay={0.08}
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <StaggerItem
              key={stat.label}
              className={cn(
                "p-5 sm:p-6",
                index > 0 && "border-t border-border sm:border-l sm:border-t-0"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow text-muted-foreground">
                  <span className="text-muted-foreground/55">0{index + 1}</span> / {stat.label}
                </p>
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="editorial-title mt-4 text-4xl">
                <CountUp value={stat.value} />
                <span className="ml-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">
                  {stat.unit}
                </span>
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.note}</p>
            </StaggerItem>
          );
        })}
      </Stagger>

      <DailyChallengeCard />

      <FadeUp delay={0.12}>
        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
          <div className="study-card overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="eyebrow text-muted-foreground">Choose a desk</p>
                <h2 className="editorial-title mt-2 text-2xl">Where to begin today</h2>
              </div>
              <span className="eyebrow hidden text-[9px] text-muted-foreground sm:block">
                03 rooms
              </span>
            </div>
            <div className="divide-y divide-border">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    onClick={() => setLocation(action.path)}
                    className="group flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors duration-200 hover:bg-secondary/60 sm:gap-4 sm:px-6"
                  >
                    <span className="eyebrow w-4 shrink-0 text-muted-foreground/60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background text-primary transition-colors duration-200 group-hover:border-primary/30 group-hover:bg-card">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{action.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {action.copy}
                      </span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-foreground"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="study-card flex flex-col p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="eyebrow text-muted-foreground">Recent activity</p>
                <h2 className="editorial-title mt-2 text-2xl">Your last notes</h2>
              </div>
              <span className="eyebrow text-[9px] text-muted-foreground">
                {data?.recentActivity?.length ?? 0} entries
              </span>
            </div>

            <div className="mt-5 flex-1">
              {data?.recentActivity?.length ? (
                <ol className="relative">
                  {data.recentActivity.slice(0, 4).map((item, index, list) => (
                    <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < list.length - 1 && (
                        <span
                          className="absolute left-[3px] top-3 h-full w-px bg-border"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className="relative mt-1.5 size-[7px] shrink-0 rounded-full bg-success ring-4 ring-card"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                          {new Date(item.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                          {item.score !== null ? ` · ${item.score}/100` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="rounded-md border border-dashed border-border p-5">
                  <p className="text-sm font-medium">Your learning history will grow here.</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Complete a short practice session or a career role-play to start tracking
                    momentum.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setLocation("/progress")}
              className="mt-5 flex w-full items-center justify-between border-t border-border pt-4 text-sm font-semibold text-primary transition-colors hover:text-primary/75"
            >
              View progress
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      </FadeUp>
    </div>
  );
}
