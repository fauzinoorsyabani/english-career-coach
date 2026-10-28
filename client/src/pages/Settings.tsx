import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, KeyRound, Laptop, Loader2, LogOut, Mail, Settings2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const focuses = ["Workplace English", "IT Vocabulary", "Interview Practice", "Writing", "Grammar", "Speaking confidence"];

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Settings() {
  const profile = trpc.profile.get.useQuery();
  const me = trpc.auth.me.useQuery();
  const methods = trpc.auth.methods.useQuery();
  const passwordEnabled = methods.data?.password ?? true;
  const trackedSessions =
    me.data?.loginMethod === "password" || me.data?.loginMethod === "local";
  const sessions = trpc.auth.sessions.useQuery(undefined, {
    enabled: trackedSessions,
  });
  const utils = trpc.useUtils();

  const [englishLevel, setEnglishLevel] = useState("Intermediate");
  const [targetRole, setTargetRole] = useState("Information Systems Professional");
  const [focusAreas, setFocusAreas] = useState<string[]>(["Workplace English", "IT Vocabulary"]);
  const [dailyGoal, setDailyGoal] = useState(1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    if (profile.data) {
      setEnglishLevel(profile.data.englishLevel);
      setTargetRole(profile.data.targetRole);
      setFocusAreas(profile.data.focusAreas);
      setDailyGoal(profile.data.dailyGoal);
    }
  }, [profile.data]);

  useEffect(() => {
    if (me.data) {
      setName(me.data.name ?? "");
      setEmail(me.data.email ?? "");
    }
  }, [me.data]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Your learning preferences are saved.");
      utils.profile.get.invalidate();
      utils.progress.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const updateAccount = trpc.auth.updateAccount.useMutation({
    onSuccess: user => {
      toast.success("Your account details are updated.");
      utils.auth.me.setData(undefined, user);
      utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated. Other devices have been signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      utils.auth.sessions.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const revokeSession = trpc.auth.revokeSession.useMutation({
    onSuccess: data => {
      toast.success("Device signed out.");
      if (data.signedOut) {
        utils.auth.me.setData(undefined, null);
        utils.auth.me.invalidate();
      }
      utils.auth.sessions.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const revokeOthers = trpc.auth.revokeOtherSessions.useMutation({
    onSuccess: () => {
      toast.success("All other devices have been signed out.");
      utils.auth.sessions.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteAccount = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Your account and learning data have been deleted.");
      utils.auth.me.setData(undefined, null);
      window.location.href = "/";
    },
    onError: error => toast.error(error.message),
  });

  const toggleFocus = (focus: string) =>
    setFocusAreas(current => {
      if (current.includes(focus)) return current.length > 1 ? current.filter(item => item !== focus) : current;
      return [...current, focus];
    });

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("The new passwords do not match.");
      return;
    }
    changePassword.mutate({ currentPassword: currentPassword || undefined, newPassword });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5 border-l-2 border-accent pl-4 sm:pl-5">
        <div className="min-w-0">
          <p className="eyebrow text-accent-ink">Learner settings / 05</p>
          <h1 className="editorial-title mt-2 text-4xl sm:text-5xl">Shape your study desk.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Your preferences help the tutor and dashboard keep each practice session relevant to
            your IT career goal.
          </p>
        </div>
        <span className="hidden size-9 place-items-center rounded-md border border-border bg-card text-primary sm:grid">
          <Settings2 className="size-4" aria-hidden="true" />
        </span>
      </header>

      <form
        onSubmit={event => {
          event.preventDefault();
          updateProfile.mutate({ englishLevel, targetRole, focusAreas, dailyGoal });
        }}
        className="study-card divide-y divide-border/70"
      >
        <div className="p-5 sm:p-6">
          <h2 className="editorial-title text-2xl font-semibold">Learning preferences</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">These choices shape the examples and feedback you receive.</p>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm font-semibold">
            English level
            <select
              value={englishLevel}
              onChange={event => setEnglishLevel(event.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm font-normal shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option>Beginner</option>
              <option>Elementary</option>
              <option>Intermediate</option>
              <option>Upper-intermediate</option>
              <option>Advanced</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Target IT role
            <Input value={targetRole} onChange={event => setTargetRole(event.target.value)} className="mt-2" maxLength={120} />
          </label>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm font-semibold">Preferred focus areas</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the areas you want to see most often in feedback and practice.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {focuses.map(focus => {
              const active = focusAreas.includes(focus);
              return (
                <button
                  type="button"
                  key={focus}
                  onClick={() => toggleFocus(focus)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200 ${
                    active
                      ? "border-accent-ink/35 bg-accent-soft text-accent-ink"
                      : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {active && <Check className="size-3.5" aria-hidden="true" />}
                  {focus}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold">Daily practice goal</p>
            <p className="mt-1 text-xs text-muted-foreground">How many short learning moments feel realistic for one day?</p>
          </div>
          <div className="flex rounded-lg border border-border bg-secondary/55 p-1">
            {[1, 2, 3, 4].map(value => (
              <button
                type="button"
                key={value}
                onClick={() => setDailyGoal(value)}
                aria-pressed={dailyGoal === value}
                className={`size-9 rounded-md text-sm font-semibold transition-colors duration-200 ${
                  dailyGoal === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end p-5 sm:p-6">
          <Button type="submit" variant="highlight" disabled={updateProfile.isPending} className="w-full sm:w-auto">
            {updateProfile.isPending ? "Saving…" : "Save learning preferences"}
          </Button>
        </div>
      </form>

      <form
        onSubmit={event => {
          event.preventDefault();
          updateAccount.mutate({ name, email });
        }}
        className="study-card divide-y divide-border/70"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="editorial-title text-2xl font-semibold">Account details</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">This name appears in your workspace and on your private learning record.</p>
            </div>
            <UserRound className="size-5 shrink-0 text-accent-ink" />
          </div>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm font-semibold">
            Display name
            <div className="relative mt-2">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={name} onChange={event => setName(event.target.value)} className="pl-9" maxLength={80} required />
            </div>
          </label>
          <label className="text-sm font-semibold">
            Email address
            <div className="relative mt-2">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" value={email} onChange={event => setEmail(event.target.value)} className="pl-9" maxLength={320} required />
            </div>
          </label>
        </div>
        <div className="flex justify-end p-5 sm:p-6">
          <Button type="submit" disabled={updateAccount.isPending} className="w-full sm:w-auto">
            {updateAccount.isPending ? "Updating…" : "Update account"}
          </Button>
        </div>
      </form>

      {passwordEnabled && (
        <form onSubmit={submitPassword} className="study-card divide-y divide-border/70">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="editorial-title text-2xl font-semibold">Password</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {me.data?.hasPassword
                  ? "Use at least 8 characters with one letter and one number. Changing it signs out other devices."
                  : "Set a password so you can sign in with your email address."}
              </p>
            </div>
            <KeyRound className="size-5 shrink-0 text-accent-ink" />
          </div>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
          {me.data?.hasPassword && (
            <label className="text-sm font-semibold">
              Current password
              <Input
                type="password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-2"
                maxLength={128}
                required
              />
            </label>
          )}
          <label className="text-sm font-semibold">
            New password
            <Input
              type="password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-2"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Confirm new password
            <Input
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-2"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        </div>
        <div className="flex justify-end p-5 sm:p-6">
          <Button type="submit" disabled={changePassword.isPending} className="w-full sm:w-auto">
            {changePassword.isPending ? "Updating password…" : "Update password"}
          </Button>
        </div>
      </form>
      )}

      <section className="study-card divide-y divide-border/70">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="editorial-title text-2xl font-semibold">Active sessions</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {trackedSessions
                  ? "Devices currently signed in to your account."
                  : "Single sign-on sessions are managed by your identity provider."}
              </p>
            </div>
            <Laptop className="size-5 shrink-0 text-accent-ink" />
          </div>
        </div>
        <div className="p-5 sm:p-6">
          {trackedSessions ? (
            <>
              <div className="space-y-3">
                {sessions.isLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading sessions…
                  </p>
                ) : sessions.data?.length ? (
                  sessions.data.map(session => (
                    <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-primary">
                          <ShieldCheck className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {session.device}
                            {session.current && (
                              <span className="ml-2 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                This device
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last active {formatDate(session.lastSeenAt)} · {session.ipAddress || "Unknown location"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => revokeSession.mutate({ sessionId: session.id })}
                        disabled={revokeSession.isPending}
                      >
                        <LogOut className="mr-1 size-3.5" aria-hidden="true" />
                        Sign out
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No active sessions found.</p>
                )}
              </div>
              {(sessions.data?.length ?? 0) > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => revokeOthers.mutate()}
                  disabled={revokeOthers.isPending}
                  className="mt-4 w-full sm:w-auto"
                >
                  Sign out all other devices
                </Button>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-border/70 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
              This account signs in through an external provider. To end this session, sign out here or revoke access from your provider.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="editorial-title text-2xl font-semibold text-destructive">Delete account</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              This permanently removes your account, conversations, practice attempts, flashcards, and progress. This cannot be undone.
            </p>
          </div>
          <Trash2 className="size-5 shrink-0 text-destructive" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          {me.data?.hasPassword && (
            <Input
              type="password"
              value={deletePassword}
              onChange={event => setDeletePassword(event.target.value)}
              placeholder="Your password"
              aria-label="Password for account deletion"
              autoComplete="current-password"
              maxLength={128}
            />
          )}
          <Input
            value={deleteConfirmation}
            onChange={event => setDeleteConfirmation(event.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label="Type DELETE to confirm account deletion"
            maxLength={6}
          />
          <Button
            type="button"
            variant="destructive"
            disabled={deleteAccount.isPending || deleteConfirmation !== "DELETE"}
            onClick={() => deleteAccount.mutate({ password: deletePassword || undefined, confirmation: deleteConfirmation })}
          >
            {deleteAccount.isPending ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </section>
    </div>
  );
}
