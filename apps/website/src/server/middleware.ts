import { createMiddleware } from "hono/factory";
import { auth } from "./auth";

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export type AuthedEnv = {
  Variables: {
    user: AuthedUser;
  };
};

/** Derives the user from the Better Auth session cookie. Rejects anonymous requests. */
export const requireAuth = createMiddleware<AuthedEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  });
  await next();
});
