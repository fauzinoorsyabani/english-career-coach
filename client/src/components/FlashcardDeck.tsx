import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookMarked, CheckCircle2, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function FlashcardDeck() {
  const cards = trpc.flashcards.list.useQuery();
  const utils = trpc.useUtils();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (cards.data && index > Math.max(cards.data.length - 1, 0)) setIndex(0);
  }, [cards.data, index]);

  const review = trpc.flashcards.markReviewed.useMutation({
    onSuccess: () => {
      toast.success("Flashcard marked as reviewed.");
      utils.flashcards.list.invalidate();
    },
  });

  const card = cards.data?.[index];

  if (!cards.data?.length) {
    return (
      <section className="study-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">Personal flashcard deck</p>
            <h2 className="editorial-title mt-2 text-3xl">Save IT words worth keeping.</h2>
          </div>
          <BookMarked className="size-5 shrink-0 text-accent-ink" aria-hidden="true" />
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          When the tutor explains a useful IT term, save it from the tutor room. Your private deck
          will be ready here for fast review.
        </p>
      </section>
    );
  }

  if (!card) return <section className="study-card h-64 animate-pulse bg-muted/30" />;

  return (
    <section className="study-card overflow-hidden">
      <div className="grid md:grid-cols-[0.7fr_1.3fr]">
        <div className="ink-panel bg-primary p-5 text-primary-foreground sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-8 -right-2 select-none font-display text-[8rem] leading-none text-primary-foreground/[0.04]"
          >
            Aa
          </div>
          <div className="relative">
            <p className="eyebrow text-accent-bright">Personal flashcard deck</p>
            <h2 className="editorial-title mt-3 text-3xl">Keep the IT words you will use.</h2>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/65">
              {cards.data.length} saved {cards.data.length === 1 ? "term" : "terms"} from your
              private tutor feedback.
            </p>
            <div className="mt-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-primary-foreground/45">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              One term at a time
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow text-muted-foreground">
              Card {index + 1} of {cards.data.length}
            </p>
            {card.reviewedAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-semibold text-success">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Reviewed
              </span>
            ) : (
              <span className="eyebrow text-[9px] text-muted-foreground/70">Not reviewed</span>
            )}
          </div>

          <div aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={card.id}
                initial={reduceMotion ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                transition={{ duration: 0.22, ease: easeOut }}
              >
                <p className="editorial-title mt-4 break-words text-4xl text-primary">
                  {card.term}
                </p>
                <p className="mt-4 text-sm leading-6 text-foreground/90">{card.definition}</p>
                <p className="mt-4 border-l-2 border-accent bg-secondary/45 p-3.5 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">Use it: </span>
                  {card.example}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
            <Button
              variant="outline"
              onClick={() => review.mutate({ flashcardId: card.id })}
              disabled={review.isPending}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Mark reviewed
            </Button>
            <Button
              variant="highlight"
              onClick={() => setIndex(current => (current + 1) % cards.data.length)}
            >
              Next card <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
