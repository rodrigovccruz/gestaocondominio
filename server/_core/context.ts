import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import type { SyndicSession } from "@shared/syndic";
import { getSyndicSessionFromRequest } from "../syndic-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  syndic?: SyndicSession | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let syndic: SyndicSession | null = null;

  try {
    syndic = await getSyndicSessionFromRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures. A database or session
    // lookup failure must never turn into a synthetic authenticated user.
    syndic = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user: null,
    syndic,
  };
}
