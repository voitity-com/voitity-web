import { useEffect } from "react";

import { setPageMetadata } from "../lib/page-metadata";

type NotFoundLocale = "en" | "es";

const notFoundCopy = {
  en: {
    description: "The requested page does not exist on Bigmelo.",
    heading: "Page not found",
    message: "The profile or page you are looking for is not available.",
    returnHome: "Back to Bigmelo",
    title: "Page not found | Bigmelo",
  },
  es: {
    description: "La página solicitada no existe en Bigmelo.",
    heading: "Página no encontrada",
    message: "El perfil o la página que buscas no está disponible.",
    returnHome: "Volver a Bigmelo",
    title: "Página no encontrada | Bigmelo",
  },
} satisfies Record<NotFoundLocale, Record<string, string>>;

function getBrowserLocale(): NotFoundLocale {
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "es";
}

export function NotFound() {
  const locale = getBrowserLocale();
  const copy = notFoundCopy[locale];

  useEffect(() => {
    setPageMetadata({
      canonicalPath: window.location.pathname,
      description: copy.description,
      locale,
      robots: "noindex,follow",
      title: copy.title,
    });
  }, [copy, locale]);

  return (
    <main className="not-found-page">
      <div>
        <p>404</p>
        <h1>{copy.heading}</h1>
        <p>{copy.message}</p>
        <a href="/">{copy.returnHome}</a>
      </div>
    </main>
  );
}
