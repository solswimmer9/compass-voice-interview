import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator(z.object({ priceId: z.string().min(1).max(100), environment: z.enum(["sandbox", "live"]) }))
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: Array<{ id?: string }>; error?: unknown };
    if (!response.ok) throw new Error(`Price lookup failed [${response.status}]`);
    const id = result.data?.[0]?.id;
    if (!id) throw new Error("Price not found. The product needs to be created first.");
    return id;
  });
