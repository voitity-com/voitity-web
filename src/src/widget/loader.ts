type WidgetConfiguration = {
  launcher: {
    avatar_url: string | null;
    label: string;
  };
  profile: {
    alias: string;
    id: number | string;
    locale: "en" | "es";
    name: string;
  };
  public_key: string;
};

type UnknownRecord = Record<string, unknown>;

(() => {
  const initializedKeys = new Set<string>();

  function initializeAvailableScripts(): void {
    const currentScript =
      document.currentScript instanceof HTMLScriptElement
        ? document.currentScript
        : null;
    const scripts = currentScript?.dataset.bigmeloWidget
      ? [currentScript]
      : Array.from(
          document.querySelectorAll<HTMLScriptElement>(
            "script[data-bigmelo-widget]",
          ),
        );

    scripts.forEach((script) => {
      initializeWidget(script).catch(() => {
        // A third-party widget must never break the host page.
      });
    });
  }

  async function initializeWidget(script: HTMLScriptElement): Promise<void> {
    const publicKey = script.dataset.bigmeloWidget?.trim() ?? "";

    if (!publicKey || initializedKeys.has(publicKey)) {
      return;
    }

    initializedKeys.add(publicKey);

    const webBaseUrl = new URL(script.src, window.location.href).origin;
    const apiBaseUrl = resolveApiBaseUrl(script, webBaseUrl);
    const response = await fetch(
      `${apiBaseUrl}/api/public/widgets/${encodeURIComponent(publicKey)}`,
      {
        credentials: "omit",
        headers: { Accept: "application/json" },
        mode: "cors",
        referrerPolicy: "no-referrer",
      },
    );

    if (!response.ok) {
      return;
    }

    const configuration = normalizeConfiguration(await response.json());

    if (!configuration) {
      return;
    }

    mountWidget(configuration, webBaseUrl);
  }

  function mountWidget(
    configuration: WidgetConfiguration,
    webBaseUrl: string,
  ): void {
    const mount = document.createElement("div");
    mount.dataset.bigmeloWidgetRoot = configuration.public_key;
    const shadowRoot = mount.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = widgetStyles;

    const wrapper = document.createElement("div");
    wrapper.className = "bigmelo-widget";
    wrapper.dir = "ltr";

    const launcher = document.createElement("button");
    launcher.className = "bigmelo-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", configuration.launcher.label);

    const label = document.createElement("span");
    label.className = "bigmelo-launcher-label";
    label.textContent = configuration.launcher.label;

    const avatar = document.createElement("span");
    avatar.className = "bigmelo-launcher-avatar";
    const fallback = document.createElement("span");
    fallback.className = "bigmelo-launcher-fallback";
    fallback.textContent = initialFor(configuration.profile.name);
    avatar.append(fallback);

    if (configuration.launcher.avatar_url) {
      const image = document.createElement("img");
      image.alt = configuration.profile.name;
      image.decoding = "async";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.src = configuration.launcher.avatar_url;
      image.addEventListener("load", () => {
        fallback.hidden = true;
      });
      image.addEventListener("error", () => {
        image.remove();
        fallback.hidden = false;
      });
      avatar.append(image);
    }

    launcher.append(label, avatar);
    wrapper.append(launcher);
    shadowRoot.append(style, wrapper);
    (document.body ?? document.documentElement).append(mount);

    let panel: HTMLDivElement | null = null;
    let iframe: HTMLIFrameElement | null = null;

    const closeWidget = (): void => {
      if (!panel) {
        return;
      }

      panel.dataset.open = "false";
      panel.hidden = true;
      launcher.hidden = false;
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus({ preventScroll: true });
    };

    const openWidget = (): void => {
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "bigmelo-panel";
        panel.dataset.open = "true";
        panel.setAttribute("aria-label", `${configuration.launcher.label}: ${configuration.profile.name}`);
        panel.setAttribute("role", "dialog");

        const closeButton = document.createElement("button");
        closeButton.className = "bigmelo-close";
        closeButton.type = "button";
        closeButton.setAttribute(
          "aria-label",
          configuration.profile.locale === "en" ? "Close chat" : "Cerrar chat",
        );
        closeButton.textContent = "×";
        closeButton.addEventListener("click", closeWidget);

        iframe = document.createElement("iframe");
        iframe.className = "bigmelo-frame";
        iframe.allow = "microphone";
        iframe.referrerPolicy = "no-referrer";
        iframe.sandbox.add(
          "allow-forms",
          "allow-popups",
          "allow-popups-to-escape-sandbox",
          "allow-same-origin",
          "allow-scripts",
        );
        iframe.src = `${webBaseUrl}/?widget=${encodeURIComponent(configuration.public_key)}`;
        iframe.title = `${configuration.launcher.label}: ${configuration.profile.name}`;

        panel.append(closeButton, iframe);
        wrapper.prepend(panel);
      } else {
        panel.hidden = false;
        panel.dataset.open = "true";
      }

      launcher.setAttribute("aria-expanded", "true");
      launcher.hidden = true;
      panel.querySelector<HTMLButtonElement>(".bigmelo-close")?.focus({
        preventScroll: true,
      });
    };

    launcher.addEventListener("click", () => {
      if (panel?.dataset.open === "true") {
        closeWidget();
      } else {
        openWidget();
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel?.dataset.open === "true") {
        closeWidget();
      }
    });
  }

  function resolveApiBaseUrl(
    script: HTMLScriptElement,
    webBaseUrl: string,
  ): string {
    const configured = script.dataset.bigmeloApi?.trim();

    if (configured) {
      return configured.replace(/\/+$/, "");
    }

    const webUrl = new URL(webBaseUrl);

    if (webUrl.hostname === "localhost" || webUrl.hostname === "127.0.0.1") {
      return `${webUrl.protocol}//${webUrl.hostname}:8000`;
    }

    return `${webUrl.protocol}//api.${webUrl.hostname.replace(/^www\./, "")}`;
  }

  function normalizeConfiguration(payload: unknown): WidgetConfiguration | null {
    if (!isRecord(payload)) {
      return null;
    }

    const data = isRecord(payload.data) ? payload.data : payload;
    const widget = isRecord(data.widget) ? data.widget : data;
    const profile = isRecord(widget.profile) ? widget.profile : null;
    const launcher = isRecord(widget.launcher) ? widget.launcher : null;
    const publicKey = stringValue(widget.public_key);
    const alias = profile ? stringValue(profile.alias) : null;
    const name = profile ? stringValue(profile.name) : null;
    const label = launcher ? stringValue(launcher.label) : null;

    if (!profile || !launcher || !publicKey || !alias || !name || !label) {
      return null;
    }

    return {
      launcher: {
        avatar_url: stringValue(launcher.avatar_url),
        label,
      },
      profile: {
        alias,
        id: stringValue(profile.id) ?? numberValue(profile.id) ?? alias,
        locale: profile.locale === "en" ? "en" : "es",
        name,
      },
      public_key: publicKey,
    };
  }

  function initialFor(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "B";
  }

  function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function stringValue(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  const widgetStyles = `
    :host {
      all: initial;
      position: fixed;
      z-index: 2147483000;
      right: max(20px, env(safe-area-inset-right));
      bottom: max(20px, env(safe-area-inset-bottom));
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    *, *::before, *::after { box-sizing: border-box; }

    .bigmelo-widget { position: relative; }

    .bigmelo-launcher {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0;
      color: #101624;
      background: transparent;
      border: 0;
      cursor: pointer;
      filter: drop-shadow(0 12px 28px rgba(16, 22, 36, 0.2));
    }

    .bigmelo-launcher[hidden] { display: none; }

    .bigmelo-launcher:focus-visible {
      outline: 3px solid #536dfe;
      outline-offset: 4px;
      border-radius: 999px;
    }

    .bigmelo-launcher-label {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0 17px;
      background: #ffffff;
      border: 1px solid rgba(16, 22, 36, 0.1);
      border-radius: 999px;
      box-shadow: 0 10px 30px rgba(16, 22, 36, 0.14);
      font-size: 15px;
      font-weight: 750;
      line-height: 1;
      white-space: nowrap;
    }

    .bigmelo-launcher-avatar {
      position: relative;
      width: 66px;
      height: 66px;
      flex: 0 0 66px;
      display: grid;
      place-items: center;
      overflow: hidden;
      color: #ffffff;
      background: linear-gradient(145deg, #536dfe, #1bb7a6);
      border: 4px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 12px 32px rgba(16, 22, 36, 0.24);
    }

    .bigmelo-launcher-avatar img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .bigmelo-launcher-fallback {
      font-size: 24px;
      font-weight: 800;
    }

    .bigmelo-panel {
      position: fixed;
      right: max(20px, env(safe-area-inset-right));
      bottom: max(20px, env(safe-area-inset-bottom));
      width: min(390px, calc(100vw - 32px));
      height: min(720px, calc(100dvh - 40px));
      overflow: hidden;
      background: #ffffff;
      border: 1px solid rgba(16, 22, 36, 0.12);
      border-radius: 22px;
      box-shadow: 0 26px 80px rgba(16, 22, 36, 0.25);
      animation: bigmelo-open 180ms ease-out;
    }

    .bigmelo-frame {
      width: 100%;
      height: 100%;
      display: block;
      background: #ffffff;
      border: 0;
    }

    .bigmelo-close {
      position: absolute;
      z-index: 3;
      top: max(10px, env(safe-area-inset-top));
      right: 10px;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      padding: 0 0 3px;
      color: #101624;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(16, 22, 36, 0.12);
      border-radius: 50%;
      box-shadow: 0 7px 18px rgba(16, 22, 36, 0.14);
      cursor: pointer;
      font: 400 28px/1 system-ui, sans-serif;
    }

    .bigmelo-close:focus-visible {
      outline: 3px solid #536dfe;
      outline-offset: 2px;
    }

    @keyframes bigmelo-open {
      from { opacity: 0; transform: translateY(10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (max-width: 620px) {
      :host {
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
      }

      .bigmelo-launcher-avatar {
        width: 60px;
        height: 60px;
        flex-basis: 60px;
      }

      .bigmelo-panel {
        top: calc(16px + env(safe-area-inset-top, 0px));
        right: calc(16px + env(safe-area-inset-right, 0px));
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        left: calc(16px + env(safe-area-inset-left, 0px));
        width: auto;
        height: auto;
        border: 1px solid rgba(16, 22, 36, 0.18);
        border-radius: 24px;
        box-shadow: 0 24px 72px rgba(16, 22, 36, 0.34);
      }

      .bigmelo-close {
        top: 12px;
        right: 12px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .bigmelo-panel { animation: none; }
    }
  `;

  if (document.body) {
    initializeAvailableScripts();
  } else {
    window.addEventListener("DOMContentLoaded", initializeAvailableScripts, {
      once: true,
    });
  }
})();
