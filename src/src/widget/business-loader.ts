type BusinessWidgetConfiguration = {
  business_name: string;
  button_label: string;
  locale: "en" | "es";
  position: "bottom-left" | "bottom-right";
  primary_color: string;
  title: string;
  welcome_message: string | null;
};

type BusinessRuntimeMessage = { content: string; id: number | string; role: "assistant" | "visitor" };
type BusinessUnknownRecord = Record<string, unknown>;

(() => {
  const initialized = new Set<string>();
  const current = document.currentScript instanceof HTMLScriptElement ? document.currentScript : null;
  const scripts = current?.dataset.bigmeloBusiness
    ? [current]
    : Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-bigmelo-business]"));

  scripts.forEach((script) => {
    initialize(script).catch(() => {
      // The host application must keep working if the widget cannot load.
    });
  });

  async function initialize(script: HTMLScriptElement): Promise<void> {
    const key = script.dataset.bigmeloBusiness?.trim() ?? "";
    if (!key || initialized.has(key)) return;
    initialized.add(key);
    const apiBase = resolveApiBase(script);
    const response = await businessFetch(apiBase, key, "/api/business/widget");
    if (!response.ok) return;
    const configuration = normalizeConfiguration(await response.json());
    if (!configuration) return;
    mount(configuration, key, apiBase);
  }

  function mount(configuration: BusinessWidgetConfiguration, key: string, apiBase: string): void {
    const root = document.createElement("div");
    root.dataset.bigmeloBusinessRoot = "true";
    const shadow = root.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles(configuration.primary_color, configuration.position);
    const wrapper = element("div", "business-widget");
    const launcher = element("button", "launcher", configuration.button_label) as HTMLButtonElement;
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", configuration.button_label);
    launcher.append(element("span", "launcher-icon", "✦"));

    const panel = element("section", "panel");
    panel.hidden = true;
    panel.setAttribute("aria-label", configuration.title);
    panel.setAttribute("role", "dialog");
    const header = element("header", "header");
    const heading = element("div", "heading");
    heading.append(element("strong", "title", configuration.title), element("span", "subtitle", configuration.business_name));
    const close = element("button", "close", "×") as HTMLButtonElement;
    close.type = "button";
    close.setAttribute("aria-label", configuration.locale === "en" ? "Close chat" : "Cerrar chat");
    header.append(heading, close);
    const messages = element("div", "messages");
    messages.setAttribute("aria-live", "polite");
    const form = document.createElement("form");
    form.className = "composer";
    const input = document.createElement("textarea");
    input.rows = 1;
    input.maxLength = 10_000;
    input.placeholder = configuration.locale === "en" ? "Write your message…" : "Escribe tu mensaje…";
    input.setAttribute("aria-label", input.placeholder);
    const send = element("button", "send", "➤") as HTMLButtonElement;
    send.type = "submit";
    send.setAttribute("aria-label", configuration.locale === "en" ? "Send message" : "Enviar mensaje");
    const completed = element(
      "div",
      "completed",
      configuration.locale === "en"
        ? "Conversation completed. Thank you for contacting us."
        : "Conversación finalizada. Gracias por contactarnos.",
    );
    completed.hidden = true;
    completed.setAttribute("role", "status");
    form.append(input, send);
    panel.append(header, messages, completed, form);
    wrapper.append(panel, launcher);
    shadow.append(style, wrapper);
    (document.body ?? document.documentElement).append(root);

    let conversationId = "";
    let session = "";
    let starting: Promise<void> | null = null;
    let finished = false;

    const append = (role: "assistant" | "visitor", content: string): void => {
      const bubble = element("div", `message ${role}`, content);
      messages.append(bubble);
      messages.scrollTop = messages.scrollHeight;
    };
    const appendRuntime = (items: BusinessRuntimeMessage[]): void => {
      items.filter((item) => item.role === "assistant").forEach((item) => append("assistant", item.content));
    };
    const setBusy = (busy: boolean): void => {
      input.disabled = busy || finished;
      send.disabled = busy || finished;
      panel.toggleAttribute("data-busy", busy);
    };
    const start = (): Promise<void> => {
      if (starting) return starting;
      starting = (async () => {
        setBusy(true);
        if (configuration.welcome_message) append("assistant", configuration.welcome_message);
        const visitorId = getVisitorId();
        const response = await businessFetch(apiBase, key, "/api/business/conversations", {
          body: JSON.stringify({ locale: configuration.locale, visitor_id: visitorId }), method: "POST",
        });
        if (!response.ok) throw new Error("Unable to start business conversation");
        const data = dataRecord(await response.json());
        conversationId = stringValue(data.conversation_id) ?? "";
        session = stringValue(data.session) ?? "";
        appendRuntime(normalizeMessages(data.messages));
        if (!conversationId || !session) throw new Error("Invalid business conversation response");
      })().catch(() => {
        append("assistant", configuration.locale === "en" ? "Chat is temporarily unavailable." : "El chat no está disponible temporalmente.");
      }).finally(() => { setBusy(false); });
      return starting;
    };

    const open = (): void => {
      panel.hidden = false;
      launcher.hidden = true;
      launcher.setAttribute("aria-expanded", "true");
      start().then(() => { input.focus(); }).catch(() => undefined);
    };
    const hide = (): void => {
      panel.hidden = true;
      launcher.hidden = false;
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus({ preventScroll: true });
    };
    launcher.addEventListener("click", open);
    close.addEventListener("click", hide);
    window.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) hide(); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const content = input.value.trim();
      if (!content || !conversationId || !session || finished) return;
      input.value = "";
      append("visitor", content);
      setBusy(true);
      businessFetch(apiBase, key, `/api/business/conversations/${encodeURIComponent(conversationId)}/messages`, {
        body: JSON.stringify({ locale: configuration.locale, message: content }),
        headers: { "Idempotency-Key": crypto.randomUUID(), "X-Bigmelo-Business-Session": session },
        method: "POST",
      }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to send message");
        const data = dataRecord(await response.json());
        appendRuntime(normalizeMessages(data.messages));
        finished = data.finished === true;
        if (finished) {
          form.hidden = true;
          completed.hidden = false;
        }
      }).catch(() => {
        append("assistant", configuration.locale === "en" ? "We could not send your message. Please try again." : "No pudimos enviar el mensaje. Intenta de nuevo.");
      }).finally(() => { setBusy(false); });
    });
  }

  function businessFetch(apiBase: string, key: string, path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${apiBase}${path}`, {
      ...init,
      credentials: "omit",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Bigmelo-Business-Key": key, ...(init.headers ?? {}) },
      mode: "cors",
      referrerPolicy: "strict-origin-when-cross-origin",
    });
  }

  function resolveApiBase(script: HTMLScriptElement): string {
    const configured = script.dataset.bigmeloApi?.trim();
    if (configured) return configured.replace(/\/+$/, "");
    const scriptUrl = new URL(script.src, location.href);
    return scriptUrl.hostname === "localhost" || scriptUrl.hostname === "127.0.0.1"
      ? `${scriptUrl.protocol}//${scriptUrl.hostname}:8000`
      : `${scriptUrl.protocol}//api.${scriptUrl.hostname.replace(/^www\./, "")}`;
  }

  function normalizeConfiguration(payload: unknown): BusinessWidgetConfiguration | null {
    const data = dataRecord(payload);
    const name = stringValue(data.business_name);
    const button = stringValue(data.button_label);
    const title = stringValue(data.title);
    const color = stringValue(data.primary_color);
    if (!name || !button || !title || !color) return null;
    return {
      business_name: name,
      button_label: button,
      locale: data.locale === "en" ? "en" : "es",
      position: data.position === "bottom-left" ? "bottom-left" : "bottom-right",
      primary_color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#6366F1",
      title,
      welcome_message: stringValue(data.welcome_message),
    };
  }

  function normalizeMessages(value: unknown): BusinessRuntimeMessage[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): BusinessRuntimeMessage[] => {
      if (!isRecord(item)) return [];
      const content = stringValue(item.content);
      if (!content || (item.role !== "assistant" && item.role !== "visitor")) return [];
      return [{ content, id: stringValue(item.id) ?? numberValue(item.id) ?? crypto.randomUUID(), role: item.role }];
    });
  }

  function getVisitorId(): string {
    const key = "bigmelo_business_visitor";
    try {
      const current = localStorage.getItem(key);
      if (current) return current;
      const created = crypto.randomUUID();
      localStorage.setItem(key, created);
      return created;
    } catch { return crypto.randomUUID(); }
  }

  function element(tag: string, className: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function dataRecord(value: unknown): BusinessUnknownRecord {
    if (!isRecord(value)) return {};
    return isRecord(value.data) ? value.data : value;
  }
  function isRecord(value: unknown): value is BusinessUnknownRecord { return typeof value === "object" && value !== null && !Array.isArray(value); }
  function stringValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
  function numberValue(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }

  function styles(color: string, position: "bottom-left" | "bottom-right"): string {
    const side = position === "bottom-left" ? "left" : "right";
    return `
      :host { all: initial; position: fixed; z-index: 2147483000; ${side}: max(20px, env(safe-area-inset-${side})); bottom: max(20px, env(safe-area-inset-bottom)); color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      *, *::before, *::after { box-sizing: border-box; }
      .business-widget { position: relative; }
      button, textarea { font: inherit; }
      .launcher { align-items: center; background: ${color}; border: 0; border-radius: 999px; box-shadow: 0 16px 45px color-mix(in srgb, ${color} 35%, transparent); color: #fff; cursor: pointer; display: flex; font-size: 15px; font-weight: 750; gap: 9px; min-height: 52px; padding: 0 18px; }
      .launcher[hidden] { display: none; }
      .launcher-icon { font-size: 20px; }
      .launcher:focus-visible, .close:focus-visible, .send:focus-visible, textarea:focus-visible { outline: 3px solid color-mix(in srgb, ${color} 45%, white); outline-offset: 2px; }
      .panel { background: #fff; border: 1px solid rgba(15,23,42,.1); border-radius: 20px; box-shadow: 0 24px 70px rgba(15,23,42,.24); display: flex; flex-direction: column; height: min(640px, calc(100vh - 40px)); overflow: hidden; width: min(390px, calc(100vw - 40px)); }
      .panel[hidden] { display: none; }
      .header { align-items: center; background: ${color}; color: #fff; display: flex; justify-content: space-between; min-height: 76px; padding: 16px 18px; }
      .heading { display: flex; flex-direction: column; gap: 2px; }
      .title { font-size: 16px; }.subtitle { font-size: 12px; opacity: .82; }
      .close { background: rgba(255,255,255,.14); border: 0; border-radius: 50%; color: #fff; cursor: pointer; font-size: 24px; height: 36px; line-height: 1; width: 36px; }
      .messages { background: #f8fafc; display: flex; flex: 1; flex-direction: column; gap: 10px; overflow-y: auto; padding: 18px; }
      .message { border-radius: 16px; font-size: 14px; line-height: 1.5; max-width: 84%; overflow-wrap: anywhere; padding: 10px 13px; white-space: pre-wrap; }
      .message.assistant { align-self: flex-start; background: #fff; border: 1px solid #e2e8f0; color: #1e293b; border-bottom-left-radius: 5px; }
      .message.visitor { align-self: flex-end; background: ${color}; color: #fff; border-bottom-right-radius: 5px; }
      .composer { align-items: flex-end; background: #fff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; padding: 12px; }
      .composer[hidden], .completed[hidden] { display: none; }
      .completed { background: #eef2ff; border-top: 1px solid #c7d2fe; color: #3730a3; font-size: 13px; font-weight: 700; padding: 14px 18px; text-align: center; }
      textarea { border: 1px solid #cbd5e1; border-radius: 14px; color: #0f172a; flex: 1; max-height: 120px; min-height: 44px; padding: 11px 12px; resize: none; }
      .send { align-items: center; background: ${color}; border: 0; border-radius: 50%; color: #fff; cursor: pointer; display: flex; height: 44px; justify-content: center; width: 44px; }
      .send:disabled, textarea:disabled { cursor: not-allowed; opacity: .55; }
      @media (max-width: 520px) { :host { bottom: 12px; ${side}: 12px; } .panel { height: calc(100vh - 24px); width: calc(100vw - 24px); } }
      @media (prefers-reduced-motion: no-preference) { .launcher { transition: transform .18s ease; }.launcher:hover { transform: translateY(-2px); } }
    `;
  }
})();
