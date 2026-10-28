import { AuthScreen } from "@/components/AuthScreen";
import { safeReturnTo } from "@/lib/returnTo";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useSearch } from "wouter";

export default function Login() {
  const search = useSearch();
  const returnTo = safeReturnTo(new URLSearchParams(search).get("returnTo"));
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (me.data) window.location.replace(returnTo);
  }, [me.data, returnTo]);

  if (me.isLoading || me.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-5" role="status" aria-live="polite">
        <div className="study-card w-full max-w-sm p-8">
          <span className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
            <Loader2 className="size-5 animate-spin" />
          </span>
          <p className="eyebrow mt-6 text-accent-ink">English Career Coach</p>
          <h1 className="editorial-title mt-2 text-3xl">
            {me.data ? "Taking you back." : "Opening sign-in."}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {me.data ? "Your session is active." : "Preparing your account options."}
          </p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
          </div>
        </div>
      </div>
    );
  }

  return <AuthScreen returnTo={returnTo} />;
}
