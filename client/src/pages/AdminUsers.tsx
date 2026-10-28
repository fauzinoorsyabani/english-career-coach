import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { trpc } from "@/lib/trpc";
import {
  KeyRound,
  Laptop,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserRound,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type AdminUserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  status: "active" | "disabled";
  loginMethod: string | null;
  createdAt: Date;
  lastSignedIn: Date;
  activeSessions: number;
  hasPassword: boolean;
  isDemo: boolean;
};

type ConfirmAction = {
  kind: "disable" | "demote" | "revoke";
  user: AdminUserRow;
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(value: string | null) {
  return value?.trim().slice(0, 1).toUpperCase() || "U";
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.listUsers.useQuery(undefined, {
    enabled: currentUser?.role === "admin",
  });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success("User updated.");
      void utils.admin.listUsers.invalidate();
    },
    onError: error => toast.error(error.message),
    onSettled: () => setConfirm(null),
  });

  const revokeSessions = trpc.admin.revokeUserSessions.useMutation({
    onSuccess: () => {
      toast.success("That user has been signed out on every device.");
      void utils.admin.listUsers.invalidate();
    },
    onError: error => toast.error(error.message),
    onSettled: () => setConfirm(null),
  });

  const users = usersQuery.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(row => {
      const matchesSearch =
        !term ||
        [row.name, row.email, row.loginMethod].some(value =>
          value?.toLowerCase().includes(term)
        );
      const matchesRole = roleFilter === "all" || row.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(
    () => [
      { label: "Accounts", value: users.length, icon: Users },
      {
        label: "Active admins",
        value: users.filter(row => row.role === "admin" && row.status === "active")
          .length,
        icon: ShieldCheck,
      },
      {
        label: "Disabled",
        value: users.filter(row => row.status === "disabled").length,
        icon: ShieldOff,
      },
      {
        label: "Open sessions",
        value: users.reduce((total, row) => total + row.activeSessions, 0),
        icon: Laptop,
      },
    ],
    [users]
  );

  const busy = updateUser.isPending || revokeSessions.isPending;

  const runUpdate = (
    target: AdminUserRow,
    values: { role?: "user" | "admin"; status?: "active" | "disabled" }
  ) => {
    updateUser.mutate({ userId: target.id, ...values });
  };

  const confirmTitle =
    confirm?.kind === "revoke"
      ? `Sign out ${confirm.user.name || "this user"}?`
      : confirm?.kind === "disable"
        ? `Disable ${confirm.user.name || "this account"}?`
        : `Remove administrator access from ${confirm?.user.name || "this user"}?`;

  const confirmDescription =
    confirm?.kind === "revoke"
      ? "Every active session for this account will end immediately. The user can sign in again with their password."
      : confirm?.kind === "disable"
        ? "The account will be disabled and all active sessions will be revoked. The user cannot sign in until you re-enable it."
        : "This user will lose access to the admin panel immediately. Their learning data and sessions stay intact.";

  const confirmLabel =
    confirm?.kind === "revoke"
      ? "Sign out everywhere"
      : confirm?.kind === "disable"
        ? "Disable account"
        : "Make user";

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "revoke") {
      revokeSessions.mutate({ userId: confirm.user.id });
    } else if (confirm.kind === "disable") {
      runUpdate(confirm.user, { status: "disabled" });
    } else {
      runUpdate(confirm.user, { role: "user" });
    }
  };

  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="study-card p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <ShieldOff className="size-5" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-5 text-destructive">Restricted area</p>
          <h1 className="editorial-title mt-2 text-3xl font-semibold">Administrator access required.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You are signed in, but this area is limited to administrators.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Back to your workspace
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="ink-panel rounded-xl border border-primary/20 px-5 py-7 sm:px-8 sm:py-9">
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-accent-bright">Administration / 06</p>
            <h1 className="editorial-title mt-2 text-4xl sm:text-5xl">People and access.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/70">
              Review accounts, change roles, disable access, and sign out devices. Passwords and private learning data are never shown here.
            </p>
          </div>
          <span className="hidden rounded-md border border-primary-foreground/15 bg-primary-foreground/5 p-3 sm:block">
            <ShieldCheck className="size-5 text-accent-bright" aria-hidden="true" />
          </span>
        </div>
      </section>

      <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(item => {
          const Icon = item.icon;
          return (
            <StaggerItem key={item.label}>
              <div className="study-card flex h-full items-center gap-4 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="eyebrow text-muted-foreground">{item.label}</p>
                  <p className="editorial-title mt-1 text-2xl font-semibold">
                    <CountUp value={item.value} />
                  </p>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      <section className="study-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="editorial-title text-2xl font-semibold">All accounts</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {usersQuery.isLoading
                ? "Loading accounts…"
                : `${filtered.length} of ${users.length} account${users.length === 1 ? "" : "s"} shown.`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search name or email"
                aria-label="Search accounts"
                className="h-10 pl-9 sm:w-64"
              />
            </div>
            <select
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value)}
              aria-label="Filter by role"
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="all">All roles</option>
              <option value="admin">Admins</option>
              <option value="user">Users</option>
            </select>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void usersQuery.refetch()}
              disabled={usersQuery.isFetching}
              aria-label="Refresh accounts"
            >
              <RefreshCw className={`size-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading accounts…
            </div>
          ) : usersQuery.isError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-destructive">{usersQuery.error.message}</p>
              <Button variant="outline" className="mt-4" onClick={() => void usersQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-semibold">No accounts match those filters.</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different search, role, or status.</p>
            </div>
          ) : (
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-3">Account</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="pr-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => {
                  const isSelf = currentUser?.id === row.id;
                  const isProtected = isSelf || row.isDemo;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="pl-3">
                        <div className="flex items-center gap-3 py-1">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                            {initials(row.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                              {row.name || "Unnamed learner"}
                              {isSelf && <Badge variant="secondary">You</Badge>}
                              {row.isDemo && <Badge variant="outline">Demo</Badge>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{row.email || "No email"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.role === "admin" ? "default" : "secondary"}>
                          {row.role === "admin" ? "Admin" : "User"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            row.status === "active"
                              ? "border-transparent bg-success-soft text-success"
                              : "border-transparent bg-destructive/10 text-destructive"
                          }
                        >
                          {row.status === "active" ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Laptop className="size-3.5 text-muted-foreground" />
                          {row.activeSessions}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(row.lastSignedIn)}</TableCell>
                      <TableCell className="pr-3">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isProtected || busy}
                            title={
                              isSelf
                                ? "You cannot change your own role."
                                : row.isDemo
                                  ? "The demo account cannot be moderated."
                                  : undefined
                            }
                            onClick={() => {
                              if (row.role === "admin") {
                                setConfirm({ kind: "demote", user: row });
                              } else {
                                runUpdate(row, { role: "admin" });
                              }
                            }}
                          >
                            {row.role === "admin" ? "Make user" : "Make admin"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={row.status === "active" ? "outline" : "secondary"}
                            disabled={isProtected || busy}
                            title={
                              isSelf
                                ? "You cannot change your own account status."
                                : row.isDemo
                                  ? "The demo account cannot be moderated."
                                  : undefined
                            }
                            onClick={() => {
                              if (row.status === "active") {
                                setConfirm({ kind: "disable", user: row });
                              } else {
                                runUpdate(row, { status: "active" });
                              }
                            }}
                          >
                            {row.status === "active" ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isProtected || busy || row.activeSessions === 0}
                            title={
                              isSelf
                                ? "Manage your own sessions from Settings."
                                : row.isDemo
                                  ? "The demo account cannot be moderated."
                                  : row.activeSessions === 0
                                    ? "No active sessions."
                                    : undefined
                            }
                            onClick={() => setConfirm({ kind: "revoke", user: row })}
                          >
                            <KeyRound className="size-3.5" />
                            Sign out
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="border-t border-border/70 bg-secondary/40 px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-6">
          Administrators cannot change their own role or status, moderate the demo account, or remove the last active administrator.
        </div>
      </section>

      <AlertDialog open={confirm !== null} onOpenChange={open => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                handleConfirm();
              }}
              disabled={busy}
              className={
                confirm?.kind === "revoke" || confirm?.kind === "disable"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
