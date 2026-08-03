import { useEffect, useState } from "react";

import {
  getAnalyticsConsent,
  initializeGoogleAnalytics,
  setAnalyticsConsent,
  subscribeToAnalyticsConsent,
  type AnalyticsConsent as AnalyticsConsentValue,
} from "../lib/google-analytics";

type Locale = "en" | "es";

const copy = {
  en: {
    accept: "Accept cookies",
    body: "We use optional Google Analytics cookies to understand aggregate usage. We do not send profile names, chat content, contact information, or payment data.",
    manage: "Cookie preferences",
    privacy: "Privacy policy",
    reject: "Reject Cookies",
    title: "Accept Cookies",
  },
  es: {
    accept: "Aceptar cookies",
    body: "Usamos cookies opcionales de Google Analytics para entender el uso agregado. No enviamos nombres de perfiles, contenido del chat, datos de contacto ni información de pago.",
    manage: "Preferencias de cookies",
    privacy: "Política de privacidad",
    reject: "Rechazar Cookies",
    title: "Aceptar Cookies",
  },
} satisfies Record<Locale, Record<string, string>>;

function getDocumentLocale(): Locale {
  return document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "es";
}

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<AnalyticsConsentValue>(() => getAnalyticsConsent());
  const [isOpen, setIsOpen] = useState(consent === "unset");
  const [locale, setLocale] = useState<Locale>(() => getDocumentLocale());
  const t = copy[locale];

  useEffect(() => {
    setConsent(initializeGoogleAnalytics());

    const unsubscribe = subscribeToAnalyticsConsent((nextConsent) => {
      setConsent(nextConsent);
      setIsOpen(false);
    });
    const languageObserver = new MutationObserver(() => {
      setLocale(getDocumentLocale());
    });
    languageObserver.observe(document.documentElement, { attributeFilter: ["lang"], attributes: true });

    return () => {
      languageObserver.disconnect();
      unsubscribe();
    };
  }, []);

  function chooseConsent(nextConsent: Exclude<AnalyticsConsentValue, "unset">): void {
    setAnalyticsConsent(nextConsent);
  }

  if (!isOpen && consent !== "unset") {
    return (
      <button className="analytics-consent-manage" type="button" onClick={() => setIsOpen(true)}>
        {t.manage}
      </button>
    );
  }

  return (
    <aside aria-label={t.title} className="analytics-consent" role="dialog">
      <div className="analytics-consent-copy">
        <strong>{t.title}</strong>
        <p>{t.body}</p>
        <a href={locale === "en" ? "/privacy" : "/privacidad"}>{t.privacy}</a>
      </div>
      <div className="analytics-consent-actions">
        <button className="button button-secondary" type="button" onClick={() => chooseConsent("denied")}>
          {t.reject}
        </button>
        <button className="button button-primary" type="button" onClick={() => chooseConsent("granted")}>
          {t.accept}
        </button>
      </div>
    </aside>
  );
}
