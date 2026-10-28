import { Stagger, StaggerItem } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Mail,
  MessagesSquare,
  ShieldAlert,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const icons = [MessagesSquare, UserRoundSearch, Mail, ShieldAlert, ClipboardList];

const scenarioFallback = [
  {
    slug: "daily-stand-up",
    title: "Daily stand-up",
    topic: "Stand-ups",
    description:
      "Share progress, name a blocker, and make a clear next-step commitment.",
    prompt:
      "Give a 45-second update about an Information Systems project you are working on.",
    completed: false,
  },
  {
    slug: "technical-interview",
    title: "Technical interview",
    topic: "Interviews",
    description:
      "Introduce your background and explain an information system with confident, direct language.",
    prompt:
      "Tell me about a system, project, or assignment that demonstrates your strengths.",
    completed: false,
  },
  {
    slug: "professional-email",
    title: "Professional email",
    topic: "Emails",
    description:
      "Write an update that is polite, concise, and clear for a stakeholder or teammate.",
    prompt:
      "Write an email explaining that a project deadline needs one extra day because testing is incomplete.",
    completed: false,
  },
  {
    slug: "incident-report",
    title: "Incident report",
    topic: "Incident reports",
    description:
      "Describe a production issue, its impact, current status, and the next action without blame.",
    prompt:
      "Give a concise incident update after a customer-facing portal becomes unavailable.",
    completed: false,
  },
  {
    slug: "requirements-gathering",
    title: "Requirements gathering",
    topic: "Requirements gathering",
    description:
      "Ask useful follow-up questions and restate business needs accurately.",
    prompt:
      "Open a meeting with a stakeholder who wants a new reporting dashboard but has not defined the requirements.",
    completed: false,
  },
] as const;

export default function Career() {
  const [, setLocation] = useLocation();
  const scenarios = trpc.career.list.useQuery();
  const start = trpc.career.start.useMutation({
    onSuccess: data => setLocation(`/tutor?conversation=${data.conversationId}`),
    onError: error => toast.error(error.message),
  });
  const scenarioCards = scenarios.data ?? scenarioFallback;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5 border-l-2 border-accent pl-4 sm:pl-5">
        <div className="min-w-0">
          <p className="eyebrow text-accent-ink">Career English lab / 05</p>
          <h1 className="editorial-title mt-2 max-w-3xl text-4xl sm:text-5xl">
            The <span className="mark">conversations</span> your IT career will ask of you.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Each role-play is one practical situation: clarify requirements, report an incident,
            explain your work, or commit to a next step.
          </p>
        </div>
        <div className="flex items-center gap-2.5 pb-1">
          <span className="eyebrow text-muted-foreground">
            {String(scenarioCards.length).padStart(2, "0")} scenarios
          </span>
          <span className="grid size-9 place-items-center rounded-md border border-border bg-card text-primary">
            <BriefcaseBusiness className="size-4" aria-hidden="true" />
          </span>
        </div>
      </header>

      <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" delay={0.05}>
        {scenarioCards.map((scenario, index) => {
          const Icon = icons[index] ?? MessagesSquare;
          return (
            <StaggerItem key={scenario.slug}>
              <article className="study-card lift group flex h-full min-h-72 flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                  <span className="eyebrow text-[9px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")} / {scenario.topic}
                  </span>
                  {scenario.completed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-semibold text-success">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Completed
                    </span>
                  ) : (
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <span className="grid size-9 place-items-center rounded-md border border-border bg-background text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h2 className="editorial-title mt-4 text-[1.45rem] leading-tight">
                    {scenario.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {scenario.description}
                  </p>

                  <div className="mt-auto pt-4">
                    <p className="border-l-2 border-accent pl-3 text-xs leading-5 text-muted-foreground">
                      <span className="font-semibold text-foreground">First prompt: </span>
                      {scenario.prompt}
                    </p>
                    <button
                      onClick={() => start.mutate({ slug: scenario.slug })}
                      disabled={start.isPending}
                      className="mt-3.5 flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary/30 hover:bg-secondary disabled:opacity-50"
                    >
                      Start role-play
                      <ArrowRight
                        className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </article>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
