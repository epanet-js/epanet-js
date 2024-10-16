import { env } from "src/lib/env_server";
import { OAuthApp, createNodeMiddleware } from "@octokit/oauth-app";

export const app = new OAuthApp({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  defaultScopes: ["gist"],
});

export const middleware = createNodeMiddleware(app);
