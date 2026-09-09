export type AnalyticsConsent = "granted" | "denied" | "unset";

type AnalyticsEventParameter = boolean | number | string;
type AnalyticsEventParameters = Record<string, AnalyticsEventParameter | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const DEFAULT_MEASUREMENT_ID = "G-T9MKE6R87P";
const CONSENT_COOKIE_NAME = "bigmelo_analytics_consent";
const CONSENT_EVENT_NAME = "bigmelo:analytics-consent";
const PREFERENCES_EVENT_NAME = "bigmelo:analytics-preferences";
const SCRIPT_ELEMENT_ID = "bigmelo-google-analytics";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const ATTRIBUTION_PARAMETER_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
] as const;
const DEFAULT_ALLOWED_HOSTS = ["bigmelo.com", ".bigmelo.com"];
const SAFE_ATTRIBUTION_VALUE = /^[a-z0-9._~-]{1,100}$/i;

let consentDefaultsConfigured = false;
let analyticsConfigured = false;
let lastPageViewKey = "";

function getMeasurementId(): string {
  return import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim() || DEFAULT_MEASUREMENT_ID;
}

function isBigmeloHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return normalizedHostname === "bigmelo.com" || normalizedHostname.endsWith(".bigmelo.com");
}

export function isGoogleAnalyticsEnabled(): boolean {
  const configuredHosts = import.meta.env.VITE_GA4_ALLOWED_HOSTS?.trim();
  const allowedHosts = configuredHosts
    ? configuredHosts.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ALLOWED_HOSTS;

  return shouldEnableGoogleAnalytics({
    allowedHosts,
    hostname: window.location.hostname,
    isProduction: import.meta.env.PROD,
    search: window.location.search,
  });
}

export function shouldEnableGoogleAnalytics({
  allowedHosts = DEFAULT_ALLOWED_HOSTS,
  hostname,
  isProduction,
  search,
}: {
  allowedHosts?: string[];
  hostname: string;
  isProduction: boolean;
  search: string;
}): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/u, "");
  const isLocalHost =
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname.endsWith(".localdev.me") ||
    normalizedHostname.endsWith(".nip.io");

  const isLandingDemo = new URLSearchParams(search).get("landing_demo") === "1";
  const isAllowedHost = allowedHosts.some((allowedHost) => {
    const normalizedAllowedHost = allowedHost.trim().toLowerCase();

    return normalizedAllowedHost.startsWith(".")
      ? normalizedHostname.endsWith(normalizedAllowedHost)
      : normalizedHostname === normalizedAllowedHost;
  },
  );

  return isProduction && !isLocalHost && !isLandingDemo && isAllowedHost;
}

function invokeGtag(...args: unknown[]): void {
  window.dataLayer ??= [];
  window.gtag ??= function gtag(): void {
    // Google Tag requires the native Arguments object for queued commands.
    window.dataLayer?.push(arguments);
  };
  window.gtag(...args);
}

function configureConsentDefaults(): void {
  if (consentDefaultsConfigured) {
    return;
  }

  invokeGtag("consent", "default", {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  });
  invokeGtag("set", "ads_data_redaction", true);
  consentDefaultsConfigured = true;
}

export function getAnalyticsConsent(): AnalyticsConsent {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  const value = cookie?.slice(CONSENT_COOKIE_NAME.length + 1);

  return value === "granted" || value === "denied" ? value : "unset";
}

function getConsentCookieAttributes(maxAge: number): string {
  const domain = isBigmeloHost(window.location.hostname) ? "; Domain=.bigmelo.com; Secure" : "";

  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${domain}`;
}

function persistAnalyticsConsent(consent: Exclude<AnalyticsConsent, "unset">): void {
  document.cookie = `${CONSENT_COOKIE_NAME}=${consent}; ${getConsentCookieAttributes(COOKIE_MAX_AGE_SECONDS)}`;
}

function removeAnalyticsCookies(): void {
  const analyticsCookieNames = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));

  analyticsCookieNames.forEach((name) => {
    document.cookie = `${name}=; ${getConsentCookieAttributes(0)}`;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  });
}

function loadGoogleAnalytics(): void {
  if (!isGoogleAnalyticsEnabled() || getAnalyticsConsent() !== "granted") {
    return;
  }

  configureConsentDefaults();
  invokeGtag("consent", "update", { analytics_storage: "granted" });

  if (!analyticsConfigured) {
    const initialPagePath = sanitizePublicPath(window.location.pathname);
    const initialPageLocation = buildSafePageLocation(window.location.pathname, window.location.search);

    invokeGtag("js", new Date());
    invokeGtag("config", getMeasurementId(), {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      page_location: initialPageLocation,
      page_path: initialPagePath,
      page_referrer: getSafePageReferrer(),
      page_title: "Bigmelo",
      send_page_view: false,
    });
    analyticsConfigured = true;
  }

  if (!document.getElementById(SCRIPT_ELEMENT_ID)) {
    const script = document.createElement("script");
    script.async = true;
    script.id = SCRIPT_ELEMENT_ID;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(getMeasurementId())}`;
    script.addEventListener("error", () => script.remove(), { once: true });
    document.head.appendChild(script);
  }
}

export function initializeGoogleAnalytics(): AnalyticsConsent {
  configureConsentDefaults();
  const consent = getAnalyticsConsent();

  if (consent === "granted") {
    loadGoogleAnalytics();
  }

  return consent;
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, "unset">): void {
  configureConsentDefaults();
  persistAnalyticsConsent(consent);
  invokeGtag("consent", "update", { analytics_storage: consent });

  if (consent === "granted") {
    loadGoogleAnalytics();
  } else {
    lastPageViewKey = "";
    removeAnalyticsCookies();
  }

  window.dispatchEvent(new CustomEvent(CONSENT_EVENT_NAME, { detail: consent }));
}

export function subscribeToAnalyticsConsent(listener: (consent: AnalyticsConsent) => void): () => void {
  const handleConsentChange = (event: Event): void => {
    listener((event as CustomEvent<AnalyticsConsent>).detail);
  };

  window.addEventListener(CONSENT_EVENT_NAME, handleConsentChange);

  return () => {
    window.removeEventListener(CONSENT_EVENT_NAME, handleConsentChange);
  };
}

export function openAnalyticsPreferences(): void {
  window.dispatchEvent(new Event(PREFERENCES_EVENT_NAME));
}

export function subscribeToAnalyticsPreferences(listener: () => void): () => void {
  window.addEventListener(PREFERENCES_EVENT_NAME, listener);

  return () => {
    window.removeEventListener(PREFERENCES_EVENT_NAME, listener);
  };
}

export function sanitizePublicPath(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/u, "").toLowerCase();
  const firstSegment = normalizedPath.split("/").filter(Boolean)[0];
  const knownPaths = new Set([
    "data-deletion",
    "eliminacion-datos",
    "eliminacion-de-datos",
    "privacy",
    "privacidad",
    "terms",
    "terminos",
    "user-data-deletion",
  ]);

  if (!firstSegment) {
    return "/";
  }

  if (normalizedPath === "/landing/entrenadores" || normalizedPath === "/landing/entrenadorv51") {
    return "/landing/entrenadores";
  }

  if (normalizedPath === "/landing/homev01") {
    return "/";
  }

  if (["/landing/homev02", "/landing/homev03"].includes(normalizedPath)) {
    return normalizedPath;
  }

  return knownPaths.has(firstSegment) ? `/${firstSegment}` : "/profile/:alias";
}

export function trackPageView(
  pathname: string,
  pageTitle: string,
  parameters: AnalyticsEventParameters = {},
): void {
  if (getAnalyticsConsent() !== "granted" || !isGoogleAnalyticsEnabled()) {
    return;
  }

  const pagePath = sanitizePublicPath(pathname);
  const pageLocation = buildSafePageLocation(pathname, window.location.search);
  const pageViewKey = `${pageLocation}|${pageTitle}`;

  if (lastPageViewKey === pageViewKey) {
    return;
  }

  lastPageViewKey = pageViewKey;
  loadGoogleAnalytics();
  invokeGtag("config", getMeasurementId(), {
    page_location: pageLocation,
    page_path: pagePath,
    page_referrer: getSafePageReferrer(),
    page_title: pageTitle,
    send_page_view: false,
    update: true,
  });
  invokeGtag("event", "page_view", {
    app_surface: "public",
    page_location: pageLocation,
    page_path: pagePath,
    page_title: pageTitle,
    ...sanitizeEventParameters(parameters),
  });
}

export function trackAnalyticsEvent(eventName: string, parameters: AnalyticsEventParameters = {}): void {
  if (getAnalyticsConsent() !== "granted" || !isGoogleAnalyticsEnabled()) {
    return;
  }

  if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) {
    return;
  }

  const safeParameters = sanitizeEventParameters(parameters);

  loadGoogleAnalytics();
  invokeGtag("event", eventName, { app_surface: "public", ...safeParameters });
}

export function buildSafePageLocation(pathname: string, search: string): string {
  const safeUrl = new URL(sanitizePublicPath(pathname), window.location.origin);
  const incoming = new URLSearchParams(search);

  ATTRIBUTION_PARAMETER_KEYS.forEach((key) => {
    const value = incoming.get(key)?.trim();

    if (value && SAFE_ATTRIBUTION_VALUE.test(value)) {
      safeUrl.searchParams.set(key, value);
    }
  });

  return safeUrl.toString();
}

function getSafePageReferrer(): string {
  if (!document.referrer) {
    return "";
  }

  try {
    const referrer = new URL(document.referrer);

    if (isBigmeloHost(referrer.hostname)) {
      return `${referrer.origin}${sanitizePublicPath(referrer.pathname)}`;
    }

    return referrer.origin;
  } catch {
    return "";
  }
}

export function sanitizeEventParameters(parameters: AnalyticsEventParameters): Record<string, AnalyticsEventParameter> {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      (entry): entry is [string, AnalyticsEventParameter] => {
        const [key, value] = entry;

        return (
          /^[a-z][a-z0-9_]{0,39}$/.test(key) &&
          value !== undefined &&
          value !== null &&
          (typeof value !== "string" || /^[a-z0-9_.:-]{1,100}$/i.test(value))
        );
      },
    ),
  );
}
