import { FadeUp } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isLocalAuthEnabled, isOAuthEnabled, startDemoLogin, startOAuthLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "login" | "register";

const benefits = [
  {
    title: "Practise real IT conversations",
    copy: "Correct a sentence, rehearse an interview, or role-play a stand-up.",
  },
  {
    title: "Feedback built for your career",
    copy: "Clear corrections, natural alternatives, and vocabulary worth keeping.",
  },
  {
    title: "A private learning record",
    copy: "Streaks, scores, flashcards, and progress that stay with your account.",
  },
];

const easeOut = [0.23, 1, 0.32, 1] as const;

export function AuthScreen({ returnTo }: { returnTo?: string }) {
  const utils = trpc.useUtils();
  const methods = trpc.auth.methods.useQuery(undefined, { retry: false });
  const passwordEnabled = methods.data?.password ?? true;
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const reduceMotion = useReducedMotion();

  const finishSignIn = async (user: unknown) => {
    utils.auth.me.setData(undefined, user as never);
    await utils.auth.me.invalidate();
    if (returnTo) window.location.replace(returnTo);
  };

  const login = trpc.auth.login.useMutation({
    onSuccess: async user => {
      setError("");
      toast.success("Welcome back.");
      await finishSignIn(user);
    },
    onError: err => setError(err.message),
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: async user => {
      setError("");
      toast.success("Your study desk is ready.");
      await finishSignIn(user);
    },
    onError: err => setError(err.message),
  });

  const pending = login.isPending || register.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "register") {
      register.mutate({ name, email, password });
    } else {
      login.mutate({ email, password });
    }
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setError("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <motion.aside
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="ink-panel relative hidden min-h-screen flex-col px-10 py-9 text-primary-foreground lg:flex xl:px-14 xl:py-11"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-4 select-none font-display text-[15rem] leading-none text-primary-foreground/[0.035]"
        >
          Aa
        </div>
        <span
          aria-hidden="true"
          className="eyebrow absolute right-10 top-10 text-[9px] text-primary-foreground/25"
        >
          /ˈɪŋ.ɡlɪʃ/
        </span>

        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-accent font-mono text-[12px] font-semibold text-accent-foreground">
            EC
          </span>
          <span className="leading-none">
            <span className="editorial-title block text-lg font-semibold">English</span>
            <span className="eyebrow mt-1 block text-[9px] tracking-[0.12em] text-primary-foreground/55">
              Career coach
            </span>
          </span>
        </div>

        <div className="relative my-auto max-w-md py-14">
          <p className="eyebrow text-accent-bright">English for the work ahead</p>
          <h1 className="editorial-title mt-4 text-[2.6rem] leading-[1.05] xl:text-[3.1rem]">
            The English you need for the{" "}
            <span className="text-accent-bright">career</span> you are building.
          </h1>
          <p className="mt-5 text-sm leading-7 text-primary-foreground/65">
            A focused workspace for Information Systems students and IT professionals who want to
            communicate with more confidence at work.
          </p>

          <ul className="mt-9 border-t border-primary-foreground/10">
            {benefits.map((item, index) => (
              <li
                key={item.title}
                className="flex gap-4 border-b border-primary-foreground/10 py-4"
              >
                <span className="eyebrow pt-0.5 text-[9px] text-accent-bright/80">
                  0{index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-primary-foreground/55">
                    {item.copy}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-[11px] leading-5 text-primary-foreground/45">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
          Small, consistent practice builds the confidence to speak up.
        </p>
      </motion.aside>

      <main className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:px-14 lg:py-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-md bg-primary font-mono text-[11px] font-semibold text-primary-foreground">
              EC
            </span>
            <div>
              <p className="editorial-title text-[15px] font-semibold leading-none">English</p>
              <p className="eyebrow mt-1 text-[9px] text-muted-foreground">Career coach</p>
            </div>
          </div>

          <FadeUp>
            <div className="mt-8 lg:mt-0">
              <p className="eyebrow text-accent-ink">
                {passwordEnabled
                  ? mode === "login"
                    ? "Welcome back"
                    : "Create your account"
                  : "Secure access"}
              </p>
              <h2 className="editorial-title mt-2 text-[2.15rem] leading-tight">
                {passwordEnabled
                  ? mode === "login"
                    ? "Pick up where you left off."
                    : "Open your study desk."
                  : "Sign in to your study desk."}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {passwordEnabled
                  ? mode === "login"
                    ? "Sign in to keep your conversations, practice, and progress in one private workspace."
                    : "One account keeps your tutor history, feedback, and learning progress together."
                  : "Use your connected account to keep your conversations, practice, and progress in one private workspace."}
              </p>
            </div>

            {passwordEnabled && (
              <div
                className="mt-6 grid grid-cols-2 gap-1 rounded-md border border-border bg-secondary/60 p-1"
                role="tablist"
                aria-label="Account access"
              >
                {(["login", "register"] as const).map(value => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => changeMode(value)}
                    className={`relative rounded-[6px] px-4 py-2 text-[13px] font-semibold transition-colors ${
                      mode === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === value && (
                      <motion.span
                        layoutId="auth-mode"
                        className="absolute inset-0 rounded-[6px] border border-border bg-card shadow-xs"
                        transition={{ type: "spring", stiffness: 420, damping: 38 }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative">
                      {value === "login" ? "Sign in" : "Create account"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {passwordEnabled && (
              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "register" && (
                  <label className="block text-[13px] font-semibold">
                    Your name
                    <div className="relative mt-1.5">
                      <UserRound
                        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        value={name}
                        onChange={event => setName(event.target.value)}
                        autoComplete="name"
                        placeholder="Alex Morgan"
                        className="h-11 pl-10"
                        maxLength={80}
                        required
                      />
                    </div>
                  </label>
                )}

                <label className="block text-[13px] font-semibold">
                  Email address
                  <div className="relative mt-1.5">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-11 pl-10"
                      maxLength={320}
                      required
                    />
                  </div>
                </label>

                <label className="block text-[13px] font-semibold">
                  Password
                  <div className="relative mt-1.5">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                      className="h-11 px-10"
                      minLength={mode === "register" ? 8 : undefined}
                      maxLength={128}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </label>

                {mode === "register" && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Use at least 8 characters, including one letter and one number.
                  </p>
                )}

                {error && (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-5 text-destructive"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="highlight"
                  disabled={pending}
                  className="h-11 w-full"
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      {mode === "login" ? "Signing in..." : "Creating account..."}
                    </>
                  ) : (
                    <>
                      {mode === "login" ? "Sign in" : "Create my account"}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {passwordEnabled && (isLocalAuthEnabled || isOAuthEnabled) && (
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="eyebrow text-[9px] text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            {!passwordEnabled && (isLocalAuthEnabled || isOAuthEnabled) && <div className="mt-6" />}

            {isLocalAuthEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => startDemoLogin(returnTo)}
                className="h-11 w-full"
              >
                Enter the local demo
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}

            {isOAuthEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => startOAuthLogin(returnTo)}
                className={`h-11 w-full ${isLocalAuthEnabled ? "mt-2.5" : ""}`}
              >
                Continue with single sign-on
              </Button>
            )}

            {!passwordEnabled && !isLocalAuthEnabled && !isOAuthEnabled && (
              <p
                role="alert"
                className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-5 text-destructive"
              >
                Sign-in is not configured for this deployment. Contact the administrator.
              </p>
            )}

            {passwordEnabled && (
              <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
                {mode === "login" ? (
                  <>
                    New here?{" "}
                    <button
                      type="button"
                      onClick={() => changeMode("register")}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => changeMode("login")}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            )}
          </FadeUp>
        </div>

        <p className="mx-auto mt-6 max-w-md text-center font-mono text-[9px] uppercase leading-4 tracking-[0.06em] text-muted-foreground/70">
          Private by default. Your study record stays with your account.
        </p>
      </main>
    </div>
  );
}
