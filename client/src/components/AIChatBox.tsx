import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
};

const easeOut = [0.23, 1, 0.32, 1] as const;

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = useReducedMotion();

  const displayMessages = messages.filter(msg => msg.role !== "system");

  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;
      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: reduceMotion ? "auto" : "smooth",
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");
    scrollToBottom();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card text-card-foreground",
        className
      )}
      style={{ height }}
    >
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col justify-center p-5 sm:p-7">
            <div className="max-w-xl">
              <span
                aria-hidden="true"
                className="block font-display text-5xl leading-none text-primary/15"
              >
                Aa
              </span>
              <p className="eyebrow mt-4 text-accent-ink">Tutor room</p>
              <h3 className="editorial-title mt-2 text-2xl">{emptyStateMessage}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Write in your own words. The tutor will reply with a correction, a short reason,
                and a more natural option.
              </p>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="eyebrow text-[9px] text-muted-foreground">Try a starting line</p>
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="group flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3.5 py-2.5 text-left text-[13px] leading-5 transition-colors duration-200 hover:border-primary/30 hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{prompt}</span>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-5 p-4 sm:p-5">
              {displayMessages.map((message, index) => {
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <motion.div
                    key={`${message.role}-${index}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: easeOut }}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" ? (
                      <div className="max-w-[92%] border-l-2 border-accent pl-3.5 sm:max-w-[85%] sm:pl-4">
                        <p className="eyebrow text-[9px] text-accent-ink">Tutor</p>
                        <div className="chat-prose mt-1.5 text-foreground/90">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[88%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2.5 text-primary-foreground sm:max-w-[78%] sm:px-4">
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="border-l-2 border-accent pl-3.5">
                    <p className="eyebrow text-[9px] text-accent-ink">Tutor</p>
                    <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="chat-dot size-1 rounded-full bg-muted-foreground" />
                        <span className="chat-dot size-1 rounded-full bg-muted-foreground" />
                        <span className="chat-dot size-1 rounded-full bg-muted-foreground" />
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                        Writing
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="border-t border-border bg-background/55 p-3 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="max-h-32 min-h-10 flex-1 resize-none bg-card py-2.5"
            rows={1}
            aria-label="Message to your tutor"
          />
          <Button
            type="submit"
            size="icon"
            variant="highlight"
            disabled={!input.trim() || isLoading}
            className="size-10 shrink-0"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
            Enter to send · Shift + Enter for a new line
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/70">
            Private
          </span>
        </div>
      </form>
    </div>
  );
}
