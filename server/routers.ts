import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  loginSyndic,
  logoutSyndic,
  getSyndicIdentity,
  syndicLoginInputSchema,
} from "./syndic-auth";
import { getPublicDashboard } from "./publicDashboard";
import { condoRouter } from "./condo";

export const appRouter = router({
  // Platform health/config routes remain public; project admin access is not.
  system: systemRouter,
  auth: router({
    login: publicProcedure
      .input(syndicLoginInputSchema)
      .mutation(({ ctx, input }) => loginSyndic(input, ctx.req, ctx.res)),
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.syndic) return null;
      return getSyndicIdentity(ctx.syndic.ownerId);
    }),
    logout: publicProcedure.mutation(({ ctx }) =>
      logoutSyndic(ctx.req, ctx.res)
    ),
  }),
  publicDashboard: router({
    get: publicProcedure.query(() => getPublicDashboard()),
  }),
  condo: condoRouter,
});

export type AppRouter = typeof appRouter;
