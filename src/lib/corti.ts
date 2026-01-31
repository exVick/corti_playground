import { CortiClient, CortiAuth, CortiEnvironment } from "@corti/sdk";

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

// Singleton client reused across requests
let client: CortiClient | null = null;

export function getCortiClient(): CortiClient {
  if (!client) {
    client = new CortiClient({
      environment: getEnvVar("CORTI_ENV"),
      tenantName: getEnvVar("CORTI_TENANT"),
      auth: {
        clientId: getEnvVar("CORTI_CLIENT_ID"),
        clientSecret: getEnvVar("CORTI_CLIENT_SECRET"),
      },
    });
  }
  return client;
}

// Get a raw access token string for the browser to use with the WebSocket URL.
// The CortiClient manages tokens internally but doesn't expose the raw string,
// so we use CortiAuth directly.
export async function getAccessToken(): Promise<string> {
  const env = getEnvVar("CORTI_ENV");
  const tenant = getEnvVar("CORTI_TENANT");

  const auth = new CortiAuth({
    environment: env === "us" ? CortiEnvironment.Us : CortiEnvironment.Eu,
    tenantName: tenant,
  });

  const response = await auth.getToken({
    clientId: getEnvVar("CORTI_CLIENT_ID"),
    clientSecret: getEnvVar("CORTI_CLIENT_SECRET"),
  });

  return response.accessToken;
}
