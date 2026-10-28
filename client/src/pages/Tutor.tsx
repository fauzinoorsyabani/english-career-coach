import { AIChatBox, Message } from "@/components/AIChatBox";
import { FadeUp } from "@/components/motion";
import { VoiceRoleplayInput } from "@/components/VoiceRoleplayInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  Feather,
  Languages,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const modes = [
  {
    value: "general" as const,
    label: "General English",
    prompt: "Help me say this more naturally: I want improve my English for work.",
  },
  {
    value: "workplace" as const,
    label: "Workplace English",
    prompt: "Help me write a clear update for my project team.",
  },
  {
    value: "interview" as const,
    label: "Interview Practice",
    prompt: "Ask me an interview question for an Information Systems role.",
  },
  {
    value: "it_vocabulary" as const,
    label: "IT Vocabulary",
    prompt: "Help me explain what a database is to a non-technical stakeholder.",
  },
];

export default function Tutor() {
  const fromCareer = new URLSearchParams(window.location.search).get("conversation") || undefined;
  const [conversationId, setConversationId] = useState<string | undefined>(fromCareer);
  const [mode, setMode] = useState<(typeof modes)[number]["value"]>("general");
  const [flashcardTerm, setFlashcardTerm] = useState("");
  const [flashcardDefinition, setFlashcardDefinition] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const utils = trpc.useUtils();
  const conversations = trpc.tutor.listConversations.useQuery();
  const detail = trpc.tutor.getConversation.useQuery(
    { conversationId: conversationId ?? "" },
    { enabled: Boolean(conversationId) }
  );
  const send = trpc.tutor.send.useMutation({
    onSuccess: async data => {
      setConversationId(data.conversationId);
      await Promise.all([
        utils.tutor.listConversations.invalidate(),
        utils.tutor.getConversation.invalidate({ conversationId: data.conversationId }),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const complete = trpc.career.complete.useMutation({
    onSuccess: () => {
      toast.success("Scenario recorded in your progress.");
      utils.career.list.invalidate();
      utils.progress.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const saveFlashcard = trpc.flashcards.save.useMutation({
    onSuccess: () => {
      toast.success("IT vocabulary saved to your personal flashcard deck.");
      setFlashcardTerm("");
      setFlashcardDefinition("");
      utils.flashcards.list.invalidate();
      utils.progress.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const messages: Message[] = (detail.data?.messages ?? []).map(message => ({
    role: message.role,
    content: message.content,
  }));
  const activeScenario = detail.data?.conversation.scenarioSlug;
  const latestTutorMessage =
    [...messages].reverse().find(message => message.role === "assistant")?.content ?? "";
  const startNew = () => {
    setConversationId(undefined);
    setMode("general");
    setShowHistory(false);
    window.history.replaceState({}, "", "/tutor");
  };
  const activeMode = detail.data?.conversation.mode ?? mode;

  const conversationList = conversations.data?.length ? (
    <div className="space-y-1">
      {conversations.data.map(item => {
        const active = conversationId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setConversationId(item.id);
              setMode(item.mode);
              setShowHistory(false);
            }}
            aria-current={active ? "true" : undefined}
            className={cn(
              "relative w-full rounded-md px-3 py-2.5 text-left transition-colors duration-200",
              active
                ? "bg-secondary text-foreground"
                : "text-foreground/80 hover:bg-secondary/60"
            )}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
            <p className="truncate text-[13px] font-semibold">{item.title}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
              {modes.find(modeItem => modeItem.value === item.mode)?.label} ·{" "}
              {new Date(item.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </button>
        );
      })}
    </div>
  ) : (
    <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground">
      Your private conversations will appear here after your first message.
    </p>
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[268px_minmax(0,1fr)]">
      <aside className="study-card hidden h-fit min-w-0 p-3 xl:sticky xl:top-24 xl:block">
        <div className="flex items-center justify-between px-1 pb-2 pt-1">
          <p className="eyebrow text-muted-foreground">Tutor room</p>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={startNew}
            aria-label="Start a new tutor chat"
            className="rounded-md"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <Button onClick={startNew} className="w-full">
          <Plus className="size-4" aria-hidden="true" />
          New conversation
        </Button>
        <div className="mt-4">{conversationList}</div>
      </aside>

      <section className="min-w-0">
        <FadeUp>
          <header className="border-l-2 border-accent pl-4 sm:pl-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow text-accent-ink">AI language coach / 03</p>
                <h1 className="editorial-title mt-2 text-4xl sm:text-5xl">
                  Practise the way you <span className="mark">work</span>.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Share a sentence, rehearse an answer, or ask for a clearer way to explain an IT
                  idea. The tutor will answer, correct, and suggest a natural alternative.
                </p>
              </div>
              <span className="grid size-9 place-items-center rounded-md border border-border bg-card text-primary">
                <Languages className="size-4" aria-hidden="true" />
              </span>
            </div>
          </header>
        </FadeUp>

        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-y border-border py-3">
          <span className="eyebrow mr-2 text-[9px] text-muted-foreground">Mode</span>
          {modes.map(item => {
            const active = activeMode === item.value;
            return (
              <button
                key={item.value}
                onClick={() => {
                  if (!conversationId) setMode(item.value);
                }}
                disabled={Boolean(conversationId)}
                title={conversationId ? "Start a new conversation to change mode" : undefined}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  conversationId && !active && "opacity-55"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 xl:hidden">
          <button
            type="button"
            onClick={() => setShowHistory(value => !value)}
            aria-expanded={showHistory}
            className="study-card flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold">
              {conversationId ? "Conversation history" : "Recent conversations"}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                showHistory && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
          {showHistory && (
            <div className="study-card mt-2 p-3">
              <Button onClick={startNew} className="mb-3 w-full">
                <Plus className="size-4" aria-hidden="true" />
                New conversation
              </Button>
              {conversationList}
            </div>
          )}
        </div>

        <div className="study-card mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Feather className="size-4 text-accent-ink" aria-hidden="true" />
              <span className="text-sm font-semibold">
                {modes.find(item => item.value === activeMode)?.label}
              </span>
            </div>
            {activeScenario && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  complete.mutate({ slug: activeScenario, conversationId: conversationId! })
                }
                disabled={complete.isPending}
                className="border-success/40 text-success hover:bg-success-soft hover:text-success"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Mark scenario complete
              </Button>
            )}
          </div>
          {activeScenario && conversationId && (
            <VoiceRoleplayInput
              conversationId={conversationId}
              disabled={send.isPending}
              onTranscript={text =>
                send.mutate({ conversationId, mode: activeMode, message: text })
              }
            />
          )}
          <AIChatBox
            messages={messages}
            onSendMessage={content => send.mutate({ conversationId, mode, message: content })}
            isLoading={send.isPending || detail.isFetching}
            height="min(64vh, 640px)"
            className="rounded-none border-0 shadow-none"
            placeholder="Write in English. Shift + Enter for a new line."
            emptyStateMessage="Choose a mode, then begin with one useful sentence."
            suggestedPrompts={
              conversationId
                ? undefined
                : modes.filter(item => item.value === mode).map(item => item.prompt)
            }
          />
        </div>

        {latestTutorMessage && (
          <section className="study-card relative mt-5 overflow-hidden p-5">
            <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-accent-ink">Vocabulary capture</p>
                <h2 className="editorial-title mt-2 text-2xl">
                  Keep one IT word from this feedback.
                </h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                  Save the term you want to recall later. The tutor&apos;s latest feedback stays
                  visible above as your reference.
                </p>
              </div>
              <BookmarkPlus className="size-5 shrink-0 text-accent-ink" aria-hidden="true" />
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-[0.7fr_1.3fr_auto]">
              <Input
                value={flashcardTerm}
                onChange={event => setFlashcardTerm(event.target.value)}
                placeholder="IT term, e.g. deployment"
                maxLength={100}
                className="bg-background"
                aria-label="IT term"
              />
              <Input
                value={flashcardDefinition}
                onChange={event => setFlashcardDefinition(event.target.value)}
                placeholder="Short meaning (optional)"
                maxLength={500}
                className="bg-background"
                aria-label="Short meaning"
              />
              <Button
                variant="highlight"
                onClick={() =>
                  saveFlashcard.mutate({
                    term: flashcardTerm,
                    definition: flashcardDefinition || undefined,
                    conversationId,
                  })
                }
                disabled={!flashcardTerm.trim() || saveFlashcard.isPending}
                className="w-full sm:w-auto"
              >
                Save word
              </Button>
            </div>
          </section>
        )}

        <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">
          AI feedback is practice support, not an official language assessment. Your conversations
          and flashcards are saved only to your authenticated account.
        </p>
      </section>
    </div>
  );
}
