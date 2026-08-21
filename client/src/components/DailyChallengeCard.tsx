import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function DailyChallengeCard() {
  const challenge = trpc.challenge.get.useQuery();
  const utils = trpc.useUtils();
  const [response, setResponse] = useState("");
  useEffect(() => { if (challenge.data?.response) setResponse(challenge.data.response); }, [challenge.data?.response]);
  const complete = trpc.challenge.complete.useMutation({
    onSuccess: () => { toast.success("Daily challenge completed — your streak has been updated."); utils.challenge.get.invalidate(); utils.progress.overview.invalidate(); },
    onError: error => toast.error(error.message),
  });

  if (!challenge.data) return <section className="study-card h-60 animate-pulse bg-muted/40" />;
  const { data } = challenge;
  return <section className="study-card overflow-hidden"><div className="grid lg:grid-cols-[0.9fr_1.1fr]"><div className="bg-[#E4F0F4] p-6 sm:p-7"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#34718A]">{data.eyebrow}</p><span className="rounded-xl bg-card p-2 text-[#34718A]"><Sparkles className="size-4" /></span></div><h2 className="editorial-title mt-4 text-3xl font-semibold text-primary">{data.title}</h2><p className="mt-4 text-sm leading-6 text-[#355D70]">{data.prompt}</p><div className="mt-5 flex gap-2 rounded-xl bg-card/60 p-3 text-xs leading-5 text-[#34718A]"><Lightbulb className="mt-0.5 size-4 shrink-0" /><span>{data.note}</span></div></div><div className="p-6 sm:p-7">{data.completed ? <div className="flex h-full flex-col justify-center"><span className="flex size-11 items-center justify-center rounded-full bg-[#E9EFE3] text-[#42623A]"><CheckCircle2 className="size-5" /></span><p className="mt-4 text-sm font-semibold">You completed today’s challenge.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your response is saved privately and counts toward today’s learning streak.</p><div className="mt-5 rounded-xl bg-muted/55 p-4 text-sm leading-6">{data.response}</div></div> : <><label htmlFor="daily-challenge-response" className="text-sm font-semibold">Your short response</label><Textarea id="daily-challenge-response" value={response} onChange={event => setResponse(event.target.value)} maxLength={1800} className="mt-3 min-h-32 resize-y rounded-xl bg-background p-4 leading-6" placeholder="Write your IT-English response here…" /><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{response.length}/1800 characters</p><Button onClick={() => complete.mutate({ response })} disabled={!response.trim() || complete.isPending} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">{complete.isPending ? "Saving…" : "Complete challenge"}</Button></div></>}</div></div></section>;
}
