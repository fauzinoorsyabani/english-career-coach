import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="study-card grid w-full max-w-3xl overflow-hidden sm:grid-cols-[1.15fr_0.85fr]">
        <div className="p-7 sm:p-10">
          <p className="eyebrow text-accent-ink">Error / 404</p>
          <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">
            This page left the <span className="mark">syllabus</span>.
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            That page is not part of your study desk. It may have moved, or the link may be
            incomplete.
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setLocation("/")} variant="highlight" className="w-full sm:w-auto">
              <ArrowLeft aria-hidden="true" />
              Back to your workspace
            </Button>
            <Button onClick={() => window.history.back()} variant="ghost" className="w-full sm:w-auto">
              Go back
            </Button>
          </div>
        </div>
        <div className="ink-panel relative hidden flex-col justify-between p-8 sm:flex" aria-hidden="true">
          <span className="eyebrow text-primary-foreground/55">Study desk</span>
          <p className="editorial-title text-8xl text-primary-foreground/15">404</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary-foreground/45">
            Page not found
          </p>
        </div>
      </section>
    </main>
  );
}
