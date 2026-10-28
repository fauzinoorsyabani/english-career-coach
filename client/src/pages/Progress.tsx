import { FlashcardDeck } from "@/components/FlashcardDeck";
import { CountUp, FadeUp } from "@/components/motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useReducedMotion } from "framer-motion";
import { BarChart3, BookOpenCheck, BookMarked, Flame, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export default function Progress() {
  const overview = trpc.progress.overview.useQuery();
  const reduceMotion = useReducedMotion();
  const data = overview.data;

  const stats = [
    {
      label: "Current streak",
      value: data?.streak ?? 0,
      unit: "days",
      icon: Flame,
      note: "Consecutive days with a completed moment.",
    },
    {
      label: "Sessions completed",
      value: data?.completedSessions ?? 0,
      unit: "total",
      icon: BookOpenCheck,
      note: "Practice, challenge, and role-play sessions.",
    },
    {
      label: "Words saved",
      value: data?.vocabularyLearned ?? 0,
      unit: "terms",
      icon: BookMarked,
      note: "Terms kept from tutor feedback.",
    },
  ];

  const goal = Math.max(1, data?.dailyGoal ?? 1);
  const today = data?.todaySessions ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5 border-l-2 border-accent pl-4 sm:pl-5">
        <div className="min-w-0">
          <p className="eyebrow text-accent-ink">Learning record / 04</p>
          <h1 className="editorial-title mt-2 text-4xl sm:text-5xl">
            Your progress, in <span className="mark">practice</span>.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            These signals help you notice patterns and keep momentum. They are not an official
            proficiency score.
          </p>
        </div>
        <div className="flex items-center gap-2.5 pb-1">
          <span className="eyebrow text-muted-foreground">Private record</span>
          <span className="grid size-9 place-items-center rounded-md border border-border bg-card text-primary">
            <BarChart3 className="size-4" aria-hidden="true" />
          </span>
        </div>
      </header>

      <section className="study-card grid overflow-hidden sm:grid-cols-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
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
            </div>
          );
        })}
      </section>

      <FlashcardDeck />

      <FadeUp delay={0.06}>
        <section className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
          <div className="study-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-muted-foreground">Common learning patterns</p>
                <h2 className="editorial-title mt-2 text-3xl">Where to focus next</h2>
              </div>
              <Target className="size-5 shrink-0 text-accent-ink" aria-hidden="true" />
            </div>

            {data?.errorCategories?.length ? (
              <>
                <p className="sr-only">
                  Error categories:{" "}
                  {data.errorCategories
                    .map(item => `${item.name}, ${item.value} occurrences`)
                    .join("; ")}
                </p>
                <div className="mt-6 h-64" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.errorCategories}
                      margin={{ top: 10, right: 0, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--secondary)" }}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          fontSize: 12,
                          background: "var(--card)",
                          color: "var(--foreground)",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="var(--chart-1)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={48}
                        isAnimationActive={!reduceMotion}
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-md border border-dashed border-border p-8 text-center">
                <p className="text-sm font-semibold">No patterns to show yet.</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
                  Finish a practice activity to start seeing the categories that deserve extra
                  attention.
                </p>
              </div>
            )}
          </div>

          <div className="study-card p-5 sm:p-6">
            <p className="eyebrow text-muted-foreground">Goal rhythm</p>

            <div className="mt-4 border-y border-border py-5">
              <p className="eyebrow text-[9px] text-muted-foreground">Today&apos;s practice</p>
              <p className="editorial-title mt-2 text-5xl">
                {today}
                <span className="ml-1 font-sans text-xl font-medium tracking-normal text-muted-foreground">
                  / {goal}
                </span>
              </p>
              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {Array.from({ length: Math.min(goal, 8) }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      index < today ? "bg-accent" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Keep the goal deliberately small. A short, high-quality session counts.
              </p>
            </div>

            <p className="eyebrow mt-5 text-muted-foreground">Recent activity</p>
            <div className="mt-3 space-y-3">
              {data?.recentActivity?.length ? (
                data.recentActivity.map(item => (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <span
                      className="mt-1.5 size-[7px] shrink-0 rounded-full bg-success"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                        {new Date(item.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Your completed practice, daily challenge, and career scenarios will appear here.
                </p>
              )}
            </div>
          </div>
        </section>
      </FadeUp>
    </div>
  );
}
