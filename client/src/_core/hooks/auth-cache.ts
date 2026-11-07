import type { QueryClient } from "@tanstack/react-query";

export function isPrivateQueryKey(key: readonly unknown[]): boolean {
  const first = key[0];
  const namespace = Array.isArray(first) ? first[0] : first;
  return (
    namespace === "condo" || namespace === "auth" || namespace === "access"
  );
}

export async function forgetPrivateAuthData(
  client: QueryClient
): Promise<void> {
  await client.cancelQueries();
  client.removeQueries({
    predicate: query => isPrivateQueryKey(query.queryKey),
  });
  // Mutation variables can contain the submitted password; do not retain them after logout.
  client.getMutationCache().clear();
}
