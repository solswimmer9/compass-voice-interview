import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { getPaymentsEnvironment } from "@/lib/stripe";
import { getAccountSnapshot } from "@/utils/account.functions";

export function useAccountSnapshot() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["account", user?.id, getPaymentsEnvironment()],
    enabled: Boolean(user),
    queryFn: () => getAccountSnapshot({ data: { environment: getPaymentsEnvironment() } }),
    staleTime: 5_000,
  });
  return { ...query, user, loading: authLoading || (Boolean(user) && query.isLoading) };
}
