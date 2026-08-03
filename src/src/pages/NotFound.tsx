import { useEffect } from "react";

import { setPageMetadata } from "../lib/page-metadata";

export function NotFound() {
  useEffect(() => {
    setPageMetadata({
      canonicalPath: window.location.pathname,
      description: "La página solicitada no existe en Bigmelo.",
      robots: "noindex,follow",
      title: "Página no encontrada | Bigmelo",
    });
  }, []);

  return (
    <main className="not-found-page">
      <div>
        <p>404</p>
        <h1>Página no encontrada</h1>
        <p>El perfil o la página que buscas no está disponible.</p>
        <a href="/">Volver a Bigmelo</a>
      </div>
    </main>
  );
}
