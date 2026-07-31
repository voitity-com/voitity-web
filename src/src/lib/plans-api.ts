const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

type UnknownRecord = Record<string, unknown>;

export type PublicSubscriptionPlan = {
  capabilities: {
    integrations: Record<string, { selectedMedia: number }>;
    productsPerProfile: number;
    socialLinks: boolean;
  };
  id: string;
  interval: string;
  limits: Record<string, number>;
  name: string;
  priceUsd: number;
};

export async function fetchPublicSubscriptionPlans(): Promise<
  PublicSubscriptionPlan[]
> {
  const response = await fetch(`${API_BASE_URL}/api/subscription/public-plans`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Public subscription plans could not be loaded.");
  }

  const payload = (await response.json()) as UnknownRecord;
  const data = isRecord(payload.data) ? payload.data : {};
  const plans = Array.isArray(data.plans) ? data.plans : [];

  return plans.flatMap((value) => {
    if (!isRecord(value)) {
      return [];
    }

    const id = stringValue(value.id);
    const priceUsd = numberValue(value.price_usd);

    if (!id || priceUsd === undefined) {
      return [];
    }

    const limitsSource = isRecord(value.limits) ? value.limits : {};
    const capabilitiesSource = isRecord(value.capabilities)
      ? value.capabilities
      : {};
    const integrationsSource = isRecord(capabilitiesSource.integrations)
      ? capabilitiesSource.integrations
      : {};

    return [
      {
        capabilities: {
          integrations: Object.fromEntries(
            Object.entries(integrationsSource).flatMap(([provider, raw]) => {
              if (!isRecord(raw)) {
                return [];
              }

              const selectedMedia = numberValue(raw.selected_media);

              return selectedMedia === undefined
                ? []
                : [[provider, { selectedMedia }]];
            }),
          ),
          productsPerProfile:
            numberValue(capabilitiesSource.products_per_profile) ?? 15,
          socialLinks: capabilitiesSource.social_links !== false,
        },
        id,
        interval: stringValue(value.interval) ?? "",
        limits: Object.fromEntries(
          Object.entries(limitsSource).flatMap(([key, raw]) => {
            const numeric = numberValue(raw);

            return numeric === undefined ? [] : [[key, numeric]];
          }),
        ),
        name: stringValue(value.name) ?? id,
        priceUsd,
      },
    ];
  });
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
