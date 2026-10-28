import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, PencilLine, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const exercises = [
  {
    type: "vocabulary" as const,
    label: "Vocabulary",
    title: "Use one precise IT term",
    prompt:
      "In one or two sentences, explain the difference between a deployment and a release to a colleague.",
    hint: "Try using: environment, available, users, production.",
  },
  {
    type: "grammar" as const,
    label: "Grammar correction",
    title: "Repair a real work sentence",
    prompt:
      "Correct this sentence and make it sound professional: ‘Yesterday I deploy the new version and the users is happy.’",
    hint: "Check the past tense and plural noun.",
  },
  {
    type: "rewrite" as const,
    label: "Sentence rewrite",
    title: "Make a status update clearer",
    prompt:
      "Rewrite this sentence so it is clear and concise: ‘We have some problem in the system so maybe we can finish later.’",
    hint: "Name the issue, its impact, and the next step.",
  },
  {
    type: "writing" as const,
    label: "Writing prompt",
    title: "Write a helpful project update",
    prompt:
      "Write a short message to your team explaining that testing found a bug and you need one extra day before release.",
    hint: "Be clear, accountable, and specific.",
  },
];

const easeOut = [0.23, 1, 0.32, 1] as const;

export default function Practice() {
  const [selected, setSelected] = useState(0);
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] =
    useState<ReturnType<typeof trpc.practice.submit.useMutation>["data"]>();
  const utils = trpc.useUtils();
  const exercise = exercises[selected];
  const submit = trpc.practice.submit.useMutation({
    onSuccess: data => {
      setFeedback(data);
      utils.progress.overview.invalidate();
      toast.success("Practice saved to your progress.");
    },
    onError: error => toast.error(error.message),
  });

  const choose = (index: number) => {
    setSelected(index);
    setResponse("");
    setFeedback(undefined);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5 border-l-2 border-accent pl-4 sm:pl-5">
        <div className="min-w-0">
          <p className="eyebrow text-accent-ink">Daily practice studio / 01</p>
          <h1 className="editorial-title mt-2 text-4xl sm:text-5xl">
            One <span className="mark">clear</span> sentence at a time.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose one short activity. Feedback includes a correction, the reason behind it, and a
            more natural way to say the same thing.
          </p>
        </div>
        <div className="flex items-center gap-2.5 pb-1">
          <span className="eyebrow text-muted-foreground">04 exercises</span>
          <span className="grid size-9 place-items-center rounded-md border border-border bg-card text-primary">
            <PencilLine className="size-4" aria-hidden="true" />
          </span>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.4fr]">
        <div className="study-card h-fit p-3">
          <div className="flex items-baseline justify-between px-2 pb-2 pt-1">
            <p className="eyebrow text-muted-foreground">Select a focus</p>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {String(selected + 1).padStart(2, "0")} / 04
            </span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {exercises.map((item, index) => {
              const active = selected === index;
              return (
                <button
                  key={item.type}
                  onClick={() => choose(index)}
                  aria-pressed={active}
                  className={cn(
                    "relative w-full overflow-hidden rounded-md px-3.5 py-3 text-left transition-colors duration-200",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary/70"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="practice-selected"
                      className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 420, damping: 38 }}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      "eyebrow text-[9px]",
                      active ? "text-primary-foreground/50" : "text-muted-foreground"
                    )}
                  >
                    {String(index + 1).padStart(2, "0")} / {item.label}
                  </span>
                  <span className="mt-1 block text-[13px] font-semibold">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="study-card overflow-hidden">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="eyebrow text-accent-ink">{exercise.label}</p>
              <span className="eyebrow text-[9px] text-muted-foreground">
                {exercise.hint.split(":")[0]}
              </span>
            </div>
            <h2 className="editorial-title mt-2 text-3xl">{exercise.title}</h2>
            <p className="mt-3 text-sm leading-7 text-foreground/85">{exercise.prompt}</p>
            <div className="mt-4 border-l-2 border-accent bg-secondary/45 px-4 py-3 text-xs leading-5 text-muted-foreground">
              <span className="font-semibold text-foreground">Study note: </span>
              {exercise.hint}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {feedback ? (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.26, ease: easeOut }}
                className="p-5 sm:p-6"
                aria-live="polite"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <motion.span
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.22, ease: easeOut }}
                      className="grid size-10 place-items-center rounded-md bg-success-soft text-success"
                    >
                      <CheckCircle2 className="size-5" aria-hidden="true" />
                    </motion.span>
                    <div>
                      <p className="text-sm font-semibold">Practice saved</p>
                      <p className="text-xs text-muted-foreground">
                        Your feedback is below and in your progress record.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 rounded-md border border-border bg-background px-3 py-2">
                    <span className="eyebrow text-[9px] text-muted-foreground">Score</span>
                    <span className="editorial-title text-2xl">{feedback.score}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">/100</span>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  <div className="border-l-2 border-success/50 pl-4">
                    <p className="eyebrow text-success">Correction</p>
                    <p className="mt-2 text-sm leading-6">{feedback.correction}</p>
                  </div>
                  <div className="rounded-md bg-secondary/55 p-4">
                    <p className="eyebrow text-muted-foreground">Why</p>
                    <p className="mt-2 text-sm leading-6">{feedback.explanation}</p>
                  </div>
                  <div className="rounded-md border border-accent/40 bg-accent-soft/55 p-4">
                    <p className="eyebrow text-accent-ink">A more natural way</p>
                    <p className="mt-2 text-sm leading-6 text-foreground/90">
                      {feedback.naturalAlternative}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setResponse("");
                    setFeedback(undefined);
                  }}
                  className="mt-6 w-full sm:w-auto"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Try another exercise
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 sm:p-6"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="practice-response" className="text-sm font-semibold">
                    Your response
                  </label>
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    {response.length}/1800
                  </span>
                </div>
                <div className="relative mt-3">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-4 left-6 top-4 w-px bg-accent/35"
                  />
                  <Textarea
                    id="practice-response"
                    value={response}
                    onChange={event => setResponse(event.target.value)}
                    placeholder="Write your response in English here..."
                    className="min-h-48 resize-y rounded-md bg-background px-4 py-3 pl-10 leading-7"
                    maxLength={1800}
                  />
                </div>
                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground">
                    There is no time limit. One thoughtful sentence is enough.
                  </p>
                  <Button
                    variant="highlight"
                    onClick={() =>
                      submit.mutate({
                        activityType: exercise.type,
                        prompt: exercise.prompt,
                        response,
                      })
                    }
                    disabled={!response.trim() || submit.isPending}
                    className="w-full sm:w-auto"
                  >
                    {submit.isPending ? (
                      "Reviewing your English..."
                    ) : (
                      <>
                        Get feedback <ArrowRight className="size-4" aria-hidden="true" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
