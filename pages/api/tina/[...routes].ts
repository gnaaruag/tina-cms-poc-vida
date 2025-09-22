import { TinaNodeBackend, LocalBackendAuthProvider } from "@tinacms/datalayer";
import { TinaAuthJSOptions, AuthJsBackendAuthProvider } from "tinacms-authjs";
import databaseClient from "../../../tina/__generated__/databaseClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]"; // adjust path

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

// base handler
const tinaHandler = TinaNodeBackend({
  authProvider: isLocal
    ? LocalBackendAuthProvider()
    : AuthJsBackendAuthProvider({
        authOptions: TinaAuthJSOptions({
          databaseClient,
          secret: process.env.NEXTAUTH_SECRET!,
        }),
      }),
  databaseClient,
});

// wrapper to intercept commit messages
export default async function handler(req, res) {
  // only modify commit requests
  if (req.method === "POST" && req.body?.params?.message) {
    const session = await getServerSession(req, res, authOptions);
    const userName = session?.user?.name || "Unknown editor";

    // inject editor name into commit message
    req.body.params.message = `${req.body.params.message} (edited by ${userName})`;
  }

  // pass to Tina backend
  return tinaHandler(req, res);
}
