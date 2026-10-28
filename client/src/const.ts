import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
const appId = import.meta.env.VITE_APP_ID;

/**
 * Local demo sign-in is used when the project runs without Manus OAuth
 * credentials. Set VITE_LOCAL_AUTH=true for a local production build, or omit
 * the OAuth variables during development.
 */
export const isLocalAuthEnabled =
  import.meta.env.VITE_LOCAL_AUTH === "true" ||
  (import.meta.env.DEV && (!oauthPortalUrl || !appId));

export const isOAuthEnabled = Boolean(oauthPortalUrl && appId);

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startOAuthLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startOAuthLogin = (returnToOverride?: string) => {
  const returnTo =
    returnToOverride ??
    `${window.location.pathname}${window.location.search}`;

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  const secure = window.location.protocol === "https:";
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=${secure ? "None" : "Lax"}${secure ? "; Secure" : ""}`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  // Keep the destination for after the OAuth callback.
  try {
    sessionStorage.setItem("oauth-return-to", returnTo);
  } catch {}

  window.location.href = url.toString();
};

export const startLogin = () => {
  const returnTo =
    typeof window === "undefined"
      ? "/"
      : window.location.pathname.startsWith("/login")
        ? "/"
        : `${window.location.pathname}${window.location.search}`;

  window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
};

export const startDemoLogin = (returnTo = "/") => {
  window.location.href = `/api/auth/local?returnTo=${encodeURIComponent(returnTo)}`;
};
