import {
  getAnalyticsConsent,
  subscribeToAnalyticsConsent,
  type AnalyticsConsent,
} from "./google-analytics";
import {
  shouldEnableTrainerTikTokPixel,
  TRAINER_TIKTOK_PIXEL_ID,
} from "./tiktok-pixel-config";

const TIKTOK_ANALYTICS_URL = "https://analytics.tiktok.com/i18n/pixel/events.js";
const TIKTOK_SCRIPT_ID = "bigmelo-trainer-tiktok-pixel";
const TIKTOK_METHODS = [
  "page",
  "track",
  "identify",
  "instances",
  "debug",
  "on",
  "off",
  "once",
  "ready",
  "alias",
  "group",
  "enableCookie",
  "disableCookie",
  "holdConsent",
  "revokeConsent",
  "grantConsent",
] as const;

type TikTokOptions = Record<string, unknown>;

interface TikTokQueue extends Array<unknown> {
  [key: string]: unknown;
  _i?: Record<string, TikTokQueue>;
  _o?: Record<string, TikTokOptions>;
  _t?: Record<string, number>;
  _u?: string;
  grantConsent?: () => void;
  instance?: (pixelId: string) => TikTokQueue;
  load?: (pixelId: string, options?: TikTokOptions) => void;
  methods?: readonly string[];
  page?: () => void;
  revokeConsent?: () => void;
  setAndDefer?: (queue: TikTokQueue, method: string) => void;
}

declare global {
  interface Window {
    TiktokAnalyticsObject?: "ttq";
    ttq?: TikTokQueue;
  }
}

let pixelRequested = false;
let pageViewQueued = false;

export function initializeTrainerTikTokPixel(): () => void {
  if (!shouldEnableTrainerTikTokPixel({
    hostname: window.location.hostname,
    isProduction: import.meta.env.PROD,
    pathname: window.location.pathname,
    search: window.location.search,
  })) {
    return () => undefined;
  }

  const applyConsent = (consent: AnalyticsConsent): void => {
    if (consent !== "granted") {
      window.ttq?.revokeConsent?.();
      return;
    }

    const ttq = createTikTokQueue();
    ttq.grantConsent?.();

    if (!pixelRequested) {
      pixelRequested = true;
      ttq.load?.(TRAINER_TIKTOK_PIXEL_ID);
    }

    if (!pageViewQueued) {
      pageViewQueued = true;
      ttq.page?.();
    }
  };

  applyConsent(getAnalyticsConsent());
  return subscribeToAnalyticsConsent(applyConsent);
}

function createTikTokQueue(): TikTokQueue {
  window.TiktokAnalyticsObject = "ttq";
  const ttq = window.ttq ?? ([] as unknown as TikTokQueue);
  window.ttq = ttq;

  if (ttq.setAndDefer && ttq.load) {
    return ttq;
  }

  ttq.methods = TIKTOK_METHODS;
  ttq.setAndDefer = (queue, method) => {
    queue[method] = (...args: unknown[]) => {
      queue.push([method, ...args]);
    };
  };

  TIKTOK_METHODS.forEach((method) => ttq.setAndDefer?.(ttq, method));
  ttq.instance = (pixelId) => {
    ttq._i ??= {};
    const instance = ttq._i[pixelId] ?? ([] as unknown as TikTokQueue);
    ttq._i[pixelId] = instance;
    TIKTOK_METHODS.forEach((method) => ttq.setAndDefer?.(instance, method));
    return instance;
  };
  ttq.load = (pixelId, options = {}) => {
    ttq._i ??= {};
    ttq._t ??= {};
    ttq._o ??= {};
    ttq._i[pixelId] = [] as unknown as TikTokQueue;
    ttq._i[pixelId]._u = TIKTOK_ANALYTICS_URL;
    ttq._t[pixelId] = Date.now();
    ttq._o[pixelId] = options;

    if (document.getElementById(TIKTOK_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.id = TIKTOK_SCRIPT_ID;
    script.src = `${TIKTOK_ANALYTICS_URL}?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`;
    script.addEventListener("error", () => {
      pixelRequested = false;
      script.remove();
    }, { once: true });

    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  };

  return ttq;
}
