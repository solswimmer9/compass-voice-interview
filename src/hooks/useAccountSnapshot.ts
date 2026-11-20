import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { getPaymentsEnvironment } from "@/lib/stripe";
import { getAccountSnapshot } from "@/utils/account.functions";

export function useAccountSnapshot() {
  const { user, guest, loading: authLoading } = useAuth();
  // Guests have an allowance too (their free tries), so load it for either kind of session.
  const owner = user ?? guest;
  const query = useQuery({
    queryKey: ["account", owner?.id, getPaymentsEnvironment()],
    enabled: Boolean(owner),
    queryFn: () => getAccountSnapshot({ data: { environment: getPaymentsEnvironment() } }),
    staleTime: 5_000,
  });
  return {
    ...query,
    user,
    guest,
    loading: authLoading || (Boolean(owner) && query.isLoading),
  };
}
