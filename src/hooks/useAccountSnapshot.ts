import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getAccountSnapshot } from "@/utils/account.functions";

export function useAccountSnapshot() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["account", user?.id, getPaddleEnvironment()],
    enabled: Boolean(user),
    queryFn: () => getAccountSnapshot({ data: { environment: getPaddleEnvironment() } }),
    staleTime: 5_000,
  });
  return { ...query, user, loading: authLoading || (Boolean(user) && query.isLoading) };
}
