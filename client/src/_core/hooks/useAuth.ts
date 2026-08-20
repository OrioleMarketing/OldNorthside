import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type InnkeeperCredentials = { email: string; password: string };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/owner" } = options ?? {};
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const loginMutation = trpc.auth.innkeeperLogin.useMutation({
    onSuccess: user => {
      utils.auth.me.setData(undefined, user);
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const login = useCallback(async (credentials: InnkeeperCredentials) => {
    const user = await loginMutation.mutateAsync(credentials);
    await utils.auth.me.invalidate();
    return user;
  }, [loginMutation, utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || loginMutation.isPending || logoutMutation.isPending,
    error: meQuery.error ?? loginMutation.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [meQuery.data, meQuery.error, meQuery.isLoading, loginMutation.error, loginMutation.isPending, logoutMutation.error, logoutMutation.isPending]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || meQuery.isLoading || logoutMutation.isPending || state.user || typeof window === "undefined") return;
    if (window.location.pathname !== redirectPath) window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, logoutMutation.isPending, meQuery.isLoading, state.user]);

  return { ...state, login, loginError: loginMutation.error, loginPending: loginMutation.isPending, refresh: () => meQuery.refetch(), logout };
}
