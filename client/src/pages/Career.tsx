import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, ClipboardList, Mail, MessagesSquare, ShieldAlert, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const icons = [MessagesSquare, UserRoundSearch, Mail, ShieldAlert, ClipboardList];

const scenarioFallback = [
  { slug: "daily-stand-up", title: "Daily stand-up", topic: "Stand-ups", description: "Share progress, name a blocker, and make a clear next-step commitment.", prompt: "Give a 45-second update about an Information Systems project you are working on.", completed: false },
  { slug: "technical-interview", title: "Technical interview", topic: "Interviews", description: "Introduce your background and explain an information system with confident, direct language.", prompt: "Tell me about a system, project, or assignment that demonstrates your strengths.", completed: false },
  { slug: "professional-email", title: "Professional email", topic: "Emails", description: "Write an update that is polite, concise, and clear for a stakeholder or teammate.", prompt: "Write an email explaining that a project deadline needs one extra day because testing is incomplete.", completed: false },
  { slug: "incident-report", title: "Incident report", topic: "Incident reports", description: "Describe a production issue, its impact, current status, and the next action without blame.", prompt: "Give a concise incident update after a customer-facing portal becomes unavailable.", completed: false },
  { slug: "requirements-gathering", title: "Requirements gathering", topic: "Requirements gathering", description: "Ask useful follow-up questions and restate business needs accurately.", prompt: "Open a meeting with a stakeholder who wants a new reporting dashboard but has not defined the requirements.", completed: false },
] as const;

export default function Career() {
  const [, setLocation] = useLocation();
  const scenarios = trpc.career.list.useQuery();
  const start = trpc.career.start.useMutation({ onSuccess: data => setLocation(`/tutor?conversation=${data.conversationId}`), onError: error => toast.error(error.message) });
  const scenarioCards = scenarios.data ?? scenarioFallback;
  return <div className="space-y-6"><section className="rounded-[28px] bg-[#E9EFE3] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#57744B]">Career English lab</p><h1 className="editorial-title mt-3 max-w-3xl text-4xl font-semibold text-primary">Practise the conversations your IT career will ask of you.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#4D5947]">Each role-play is designed for one practical situation: clarify requirements, report an incident, explain your work, or make an informed next step.</p></section><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{scenarioCards.map((scenario, index) => { const Icon = icons[index] ?? MessagesSquare; return <article key={scenario.slug} className="study-card flex min-h-72 flex-col p-5"><div className="flex items-start justify-between"><span className="rounded-xl bg-secondary p-2.5 text-primary"><Icon className="size-5" /></span>{scenario.completed && <span className="inline-flex items-center gap-1 rounded-full bg-[#E9EFE3] px-2.5 py-1 text-[11px] font-bold text-[#42623A]"><CheckCircle2 className="size-3.5" />Completed</span>}</div><p className="mt-6 text-xs font-bold uppercase tracking-[0.13em] text-accent">{scenario.topic}</p><h2 className="editorial-title mt-2 text-2xl font-semibold">{scenario.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{scenario.description}</p><div className="mt-auto pt-5"><p className="rounded-xl bg-muted/55 p-3 text-xs leading-5 text-muted-foreground"><span className="font-bold text-foreground">First prompt: </span>{scenario.prompt}</p><Button variant="ghost" onClick={() => start.mutate({ slug: scenario.slug })} disabled={start.isPending} className="mt-3 w-full justify-between rounded-xl text-primary hover:bg-secondary">Start role-play <ArrowRight className="size-4" /></Button></div></article>; })}</section></div>;
}
