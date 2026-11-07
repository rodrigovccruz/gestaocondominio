import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { forgetPrivateAuthData } from "./auth-cache";

const GENERIC_LOGIN_ERROR = "Usuário ou senha inválidos.";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type LoginCredentials = {
  username: string;
  password: string;
};

function isUnauthorized(error: unknown) {
  return (
    error instanceof TRPCClientError &&
    (error.data?.code === "UNAUTHORIZED" || error.data?.code === "FORBIDDEN")
  );
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/sindico" } =
    options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const [loginError, setLoginError] = useState<string | null>(null);

  const login = useCallback(
    async ({ username, password }: LoginCredentials) => {
      setLoginError(null);
      try {
        await loginMutation.mutateAsync({ username, password });
        await utils.auth.me.invalidate();
        await meQuery.refetch();
      } catch {
        setLoginError(GENERIC_LOGIN_ERROR);
        throw new Error(GENERIC_LOGIN_ERROR);
      }
    },
    [loginMutation, meQuery, utils]
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (!isUnauthorized(error)) throw error;
    } finally {
      await forgetPrivateAuthData(queryClient);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  }, [logoutMutation, queryClient, utils]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || meQuery.isLoading || meQuery.data) return;
    if (
      typeof window === "undefined" ||
      window.location.pathname === redirectPath
    )
      return;
    window.history.replaceState({}, "", redirectPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [
    meQuery.data,
    meQuery.isLoading,
    redirectOnUnauthenticated,
    redirectPath,
  ]);

  return {
    user: meQuery.data ?? null,
    loading:
      meQuery.isLoading || loginMutation.isPending || logoutMutation.isPending,
    error: meQuery.error ?? loginError,
    isAuthenticated: Boolean(meQuery.data),
    login,
    refresh: () => meQuery.refetch(),
    logout,
    loginPending: loginMutation.isPending,
  };
}
