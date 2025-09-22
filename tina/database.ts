// /tina/database.ts
import { createDatabase, createLocalDatabase } from "@tinacms/datalayer";
import { RedisLevel } from "upstash-redis-level";
import { GitHubProvider } from "tinacms-gitprovider-github";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN as string;
const owner = (process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER) as string;
const repo = (process.env.GITHUB_REPO || process.env.VERCEL_GIT_REPO_SLUG) as string;
const branch = (process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "main") as string;

if (!branch) throw new Error("Branch not found. Set GITHUB_BRANCH or VERCEL_GIT_COMMIT_REF.");

async function getCommitMessage (params, req) {
  // Only run if Tina is actually committing a file
  if (!params || !params.message) {
    // For non-commit requests, return undefined to skip
    return undefined;
  }

  let userName = "Unknown editor";

  try {
    const session = await getServerSession(req, {} as any, authOptions);
    userName = session?.user?.name || userName;
  } catch (err) {
    console.warn("Could not get session for commit message:", err);
  }


  try {
    const session = await getServerSession(req, {} as any, authOptions);
    userName = session?.user?.name || userName;
  } catch (err) {
    console.warn("Could not get session for commit message:", err);
  }

  return `${params.message} (edited by ${userName})`;
}


export default isLocal
  ? createLocalDatabase()
  : createDatabase({
      gitProvider: new GitHubProvider({
        branch,
        owner,
        repo,
        token,
        commitMessage: getCommitMessage as unknown as string,
      }),
      databaseAdapter: new RedisLevel<string, Record<string, any>>({
        redis: {
          url: process.env.KV_REST_API_URL || "http://localhost:8079",
          token: process.env.KV_REST_API_TOKEN || "example_token",
        },
        debug: process.env.DEBUG === "true" || false,
      }),
      namespace: branch,
    });
