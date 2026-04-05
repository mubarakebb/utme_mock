const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

function readEnv(name: string, options: { required?: boolean } = {}) {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (options.required) {
    const message = `[ENV] Missing required environment variable: ${name}`;
    if (isProduction) {
      throw new Error(message);
    }
    if (isDevelopment) {
      console.warn(message);
    }
  }

  return "";
}

export const ENV = {
  appId: readEnv("VITE_APP_ID", { required: true }),
  frontendUrl: readEnv("FRONTEND_URL", { required: true }),
  cookieSecret: readEnv("JWT_SECRET", { required: true }),
  databaseUrl: readEnv("DATABASE_URL", { required: true }),
  oAuthServerUrl: readEnv("OAUTH_SERVER_URL", { required: true }),
  oAuthCallbackUrl: readEnv("OAUTH_CALLBACK_URL", { required: true }),
  ownerOpenId: readEnv("OWNER_OPEN_ID"),
  isProduction,
  forgeApiUrl: readEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: readEnv("BUILT_IN_FORGE_API_KEY"),
};
