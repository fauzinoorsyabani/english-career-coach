const isProduction = process.env.NODE_ENV === "production";
const localMode = process.env.LOCAL_AUTH === "true";

// A predictable development secret keeps local sessions working without extra
// setup. Production deployments must provide a real JWT_SECRET.
const DEV_JWT_SECRET = "english-career-coach-local-development-secret";
const cookieSecret =
  process.env.JWT_SECRET ?? (!isProduction || localMode ? DEV_JWT_SECRET : "");

const localAuthEnabled =
  localMode ||
  (!isProduction && !process.env.OAUTH_SERVER_URL && !process.env.VITE_APP_ID);

if (!process.env.JWT_SECRET && (!isProduction || localMode)) {
  console.warn(
    "[Config] JWT_SECRET is not set; using the local development secret. Do not use this in production."
  );
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  localAuthEnabled,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Optional OpenAI-compatible provider. When present, it takes priority over
  // the managed Forge endpoint. This keeps the app portable.
  llmApiUrl: process.env.LLM_API_URL ?? process.env.OPENAI_BASE_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "",
};
