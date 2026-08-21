import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BookMarked, CheckCircle2, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function FlashcardDeck() {
  const cards = trpc.flashcards.list.useQuery();
  const utils = trpc.useUtils();
  const [index, setIndex] = useState(0);
  useEffect(() => { if (cards.data && index > Math.max(cards.data.length - 1, 0)) setIndex(0); }, [cards.data, index]);
  const review = trpc.flashcards.markReviewed.useMutation({ onSuccess: () => { toast.success("Flashcard marked as reviewed."); utils.flashcards.list.invalidate(); } });
  const card = cards.data?.[index];
  if (!cards.data?.length) return <section className="study-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Personal flashcard deck</p><h2 className="editorial-title mt-2 text-3xl font-semibold">Save IT words worth keeping.</h2></div><BookMarked className="size-5 text-accent" /></div><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">When the tutor explains a useful IT term, save it from the tutor room. Your private deck will be ready here for fast review.</p></section>;
  if (!card) return <section className="study-card h-64 animate-pulse bg-muted/40" />;
  return <section className="study-card overflow-hidden"><div className="grid md:grid-cols-[0.72fr_1.28fr]"><div className="bg-primary p-6 text-primary-foreground sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">Personal flashcard deck</p><h2 className="editorial-title mt-3 text-3xl font-semibold">Keep the IT words you will use.</h2><p className="mt-3 text-sm leading-6 text-primary-foreground/70">{cards.data.length} saved {cards.data.length === 1 ? "term" : "terms"} from your private tutor feedback.</p><div className="mt-7 flex items-center gap-2 text-xs text-primary-foreground/60"><RotateCcw className="size-4" /> Review one term at a time.</div></div><div className="p-6 sm:p-7"><div className="flex items-center justify-between gap-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Card {index + 1} of {cards.data.length}</p>{card.reviewedAt && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#42623A]"><CheckCircle2 className="size-4" />Reviewed</span>}</div><p className="editorial-title mt-4 text-4xl font-semibold text-primary">{card.term}</p><p className="mt-4 text-sm leading-6 text-foreground">{card.definition}</p><p className="mt-4 rounded-xl bg-muted/55 p-3 text-xs leading-5 text-muted-foreground"><span className="font-bold text-foreground">Use it: </span>{card.example}</p><div className="mt-5 flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => review.mutate({ flashcardId: card.id })} disabled={review.isPending} className="rounded-xl">Mark reviewed</Button><Button onClick={() => setIndex(current => (current + 1) % cards.data.length)} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">Next card <ChevronRight className="ml-1 size-4" /></Button></div></div></div></section>;
}
