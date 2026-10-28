import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Highlighter, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function DailyChallengeCard() {
  const challenge = trpc.challenge.get.useQuery();
  const utils = trpc.useUtils();
  const [response, setResponse] = useState("");
  useEffect(() => {
    if (challenge.data?.response) setResponse(challenge.data.response);
  }, [challenge.data?.response]);

  const complete = trpc.challenge.complete.useMutation({
    onSuccess: () => {
      toast.success("Daily challenge completed. Your streak has been updated.");
      utils.challenge.get.invalidate();
      utils.progress.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (!challenge.data) {
    return (
      <section
        className="study-card h-60 animate-pulse bg-muted/30"
        aria-label="Loading today's challenge"
      />
    );
  }

  const { data } = challenge;

  return (
    <section className="study-card relative overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />
      <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border-b border-border bg-accent-soft/45 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow text-accent-ink">{data.eyebrow}</p>
            <span className="grid size-8 place-items-center rounded-md border border-accent-ink/15 bg-card/70 text-accent-ink">
              <Highlighter className="size-4" aria-hidden="true" />
            </span>
          </div>
          <h2 className="editorial-title mt-4 text-[1.65rem] leading-tight text-foreground">
            {data.title}
          </h2>
          <p className="mt-4 text-sm leading-6 text-foreground/75">{data.prompt}</p>
          <div className="mt-5 flex gap-2.5 border-l-2 border-accent pl-3 text-xs leading-5 text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>{data.note}</span>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <AnimatePresence mode="wait" initial={false}>
            {data.completed ? (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.24, ease: easeOut }}
                className="flex h-full flex-col justify-center"
              >
                <span className="grid size-10 place-items-center rounded-md bg-success-soft text-success">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold">Today&apos;s challenge is complete.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Your response is saved privately and counts toward your learning streak.
                </p>
                <div className="mt-5 border-l-2 border-success/35 bg-secondary/55 p-4 text-sm leading-6">
                  {data.response}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.24, ease: easeOut }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="daily-challenge-response" className="text-sm font-semibold">
                    Your short response
                  </label>
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    {response.length}/1800
                  </span>
                </div>
                <Textarea
                  id="daily-challenge-response"
                  value={response}
                  onChange={event => setResponse(event.target.value)}
                  maxLength={1800}
                  className="mt-3 min-h-36 resize-y rounded-md bg-background p-4 leading-6"
                  placeholder="Write your IT-English response here..."
                />
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="highlight"
                    onClick={() => complete.mutate({ response })}
                    disabled={!response.trim() || complete.isPending}
                    className="w-full sm:w-auto"
                  >
                    {complete.isPending ? "Saving..." : "Complete challenge"}
                    {!complete.isPending && <CheckCircle2 className="size-4" aria-hidden="true" />}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
