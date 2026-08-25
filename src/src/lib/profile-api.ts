const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");
const VISITOR_ID_STORAGE_KEY = "bigmelo:anonymous-visitor:v1";

type UnknownRecord = Record<string, unknown>;

export class ProfileApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly messagingCapabilities?: ProfileMessagingCapabilities,
  ) {
    super(message);
    this.name = "ProfileApiError";
  }
}

export type ProfileMessagingCapabilities = {
  audioMessagesEnabled: boolean;
  audioMaxDurationSeconds: number;
  reason?: string | null;
  textMessagesEnabled: boolean;
};

export type ProfileData = {
  id: string;
  alias: string;
  conversationMessages: ProfileConversationMessages;
  featureSettings: ProfileFeatureSetting[];
  locale: "en" | "es";
  name: string;
  headline: string;
  description: string;
  details: string[];
  messagingCapabilities: ProfileMessagingCapabilities;
  networks: ProfileSocialNetwork[];
  voiceAutoplayEnabled: boolean;
  voiceEnabled: boolean;
};

export type ProfileFeatureSetting = {
  effective: boolean;
  group: string;
  key: string;
  provider?: string;
};

export type ProfileConversationMessageType = "fallback_no_answer" | "initial";

export type ProfileConversationMessage = {
  audioFormat?: string | null;
  audioSource?: string | null;
  audioUrl?: string;
  enabled: boolean;
  status?: string | null;
  text: string | null;
  type: ProfileConversationMessageType;
};

export type ProfileConversationMessages = {
  fallbackNoAnswer: ProfileConversationMessage;
  initial: ProfileConversationMessage;
};

export type ProfileSocialNetwork = {
  iconUrl: string;
  key: string;
  name: string;
  url: string;
};

export type ChatMessage = {
  audioUrl?: string;
  createdAt?: string;
  id: string;
  media?: ChatMessageMedia[];
  products?: ChatMessageProduct[];
  role: "visitor" | "profile";
  socialLinks?: ChatMessageSocialLink[];
  text: string;
};

export type ChatMessageMedia = {
  actionLabel?: string;
  actionType?: string;
  ageRestricted?: boolean;
  caption?: string;
  channelUrl?: string;
  destinationLabel?: string;
  destinationType?: string;
  id?: string;
  imageUrl?: string;
  mediaUrl?: string;
  observation?: string;
  permalink?: string;
  provider?: string;
  providerKey?: string;
  providerLabel?: string;
  takenAt?: string;
  thumbnailUrl?: string;
  type?: string;
};

export type ChatMessageProduct = {
  actionUrl: string;
  description: string;
  destinationType: "external_url" | "telegram" | "whatsapp";
  id: string;
  imageUrl: string;
  name: string;
  publicUrl: string;
};

export type ChatMessageSocialLink = {
  actionLabel: string;
  providerKey: string;
  providerLabel: string;
  url: string;
};

export type MessageResponse = {
  chatId?: string;
  chatToken?: string;
  text: string;
  audioUrl?: string;
  media?: ChatMessageMedia[];
  products?: ChatMessageProduct[];
  socialLinks?: ChatMessageSocialLink[];
  requestAudioUrl?: string;
  requestMessageId?: string;
  requestText?: string;
  messagingCapabilities?: ProfileMessagingCapabilities;
  pending?: boolean;
};

export type ProfileInteraction = {
  eventType:
    | "media_external_clicked"
    | "media_opened"
    | "product_clicked"
    | "profile_viewed"
    | "social_link_clicked";
  chatId?: string | null;
  destinationType?: "provider_channel" | "provider_video";
  mediaType?: "image" | "video";
  metadata?: { destination_type?: "external_url" | "telegram" | "whatsapp" };
  provider?: string;
  subjectId?: string;
  surface:
    | "chat_media_card"
    | "chat_media_modal"
    | "product_button"
    | "product_image"
    | "profile_page"
    | "widget_chat"
    | "profile_social_nav"
    | "chat_social_link";
};

export type AvatarMedia = {
  kind: "image" | "video";
  url: string;
};

export type PublicWidgetConfiguration = {
  launcher: {
    avatarUrl: string | null;
    label: string;
  };
  profile: {
    alias: string;
    id: string;
    locale: "en" | "es";
    name: string;
  };
  publicKey: string;
};

type SocialNetworkDefinition = {
  iconUrl: string;
  key: string;
  name: string;
};

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function publicHeaders(
  extra?: HeadersInit,
  chatToken?: string | null,
): HeadersInit {
  return {
    Accept: "application/json",
    "X-Bigmelo-Visitor-Id": getAnonymousVisitorId(),
    ...extra,
    ...(chatToken ? { "X-Bigmelo-Chat-Token": chatToken } : {}),
  };
}

export async function recordProfileInteraction(
  profileId: string,
  interaction: ProfileInteraction,
): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/public/profiles/${encodeURIComponent(profileId)}/interactions`),
    {
      body: JSON.stringify({
        event_id: crypto.randomUUID(),
        visitor_id: getAnonymousVisitorId(),
        event_type: interaction.eventType,
        chat_id: interaction.chatId
          ? normalizeProfileId(interaction.chatId)
          : undefined,
        destination_type: interaction.destinationType,
        subject_id: interaction.subjectId,
        provider: interaction.provider,
        surface: interaction.surface,
        media_type: interaction.mediaType,
        metadata: interaction.metadata,
      }),
      headers: publicHeaders({ "Content-Type": "application/json" }),
      keepalive: true,
      method: "POST",
    },
  );

  if (!response.ok) {
    throw await createProfileApiError(
      response,
      "No fue posible registrar la interacción.",
    );
  }
}

function getAnonymousVisitorId(): string {
  try {
    const stored = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);

    if (stored) {
      return stored;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, created);

    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export async function fetchProfileByAlias(alias: string): Promise<ProfileData> {
  const profileResponsePromise = fetch(
    apiUrl(`/api/public/profiles/${encodeURIComponent(alias)}`),
    {
      headers: publicHeaders(),
    },
  );
  const socialNetworksPromise = fetchSocialNetworkDefinitions().catch(() => []);
  const response = await profileResponsePromise;

  if (!response.ok) {
    throw await createProfileApiError(
      response,
      "No fue posible cargar el perfil.",
    );
  }

  const [payload, socialNetworkDefinitions] = await Promise.all([
    response.json(),
    socialNetworksPromise,
  ]);
  return normalizeProfile(payload, alias, socialNetworkDefinitions);
}

export async function fetchProfileByDomain(hostname: string): Promise<ProfileData> {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  const profileResponsePromise = fetch(
    apiUrl(
      `/api/public/profiles/by-domain/${encodeURIComponent(normalizedHostname)}`,
    ),
    { headers: publicHeaders() },
  );
  const socialNetworksPromise = fetchSocialNetworkDefinitions().catch(() => []);
  const response = await profileResponsePromise;

  if (!response.ok) {
    throw await createProfileApiError(
      response,
      "No fue posible cargar el perfil.",
    );
  }

  const [payload, socialNetworkDefinitions] = await Promise.all([
    response.json(),
    socialNetworksPromise,
  ]);

  return normalizeProfile(payload, normalizedHostname, socialNetworkDefinitions);
}

export async function fetchPublicWidgetConfiguration(
  publicKey: string,
): Promise<PublicWidgetConfiguration> {
  const response = await fetch(
    apiUrl(`/api/public/widgets/${encodeURIComponent(publicKey)}`),
    { headers: publicHeaders() },
  );

  if (!response.ok) {
    throw await createProfileApiError(
      response,
      "El widget no está disponible.",
    );
  }

  const source = unwrapPayload((await response.json()) as UnknownRecord);
  const widget = isRecord(source.widget) ? source.widget : source;
  const profile = isRecord(widget.profile) ? widget.profile : {};
  const launcher = isRecord(widget.launcher) ? widget.launcher : {};
  const alias = pickString(profile, ["alias"]);
  const name = pickString(profile, ["name"]);
  const resolvedPublicKey = pickString(widget, ["public_key", "publicKey"]);

  if (!alias || !name || !resolvedPublicKey) {
    throw new ProfileApiError("El widget no está disponible.", 502);
  }

  return {
    launcher: {
      avatarUrl: normalizeOptionalAssetUrl(
        pickString(launcher, ["avatar_url", "avatarUrl"]),
      ) ?? null,
      label:
        pickString(launcher, ["label"]) ??
        (profile.locale === "en" ? "Talk to me" : "Habla conmigo"),
    },
    profile: {
      alias,
      id:
        pickString(profile, ["id", "profile_id", "profileId"]) ?? alias,
      locale: profile.locale === "en" ? "en" : "es",
      name,
    },
    publicKey: resolvedPublicKey,
  };
}

export async function fetchAvatarMedia(
  profileId: string,
): Promise<AvatarMedia> {
  const response = await fetch(
    apiUrl(`/api/public/profiles/${encodeURIComponent(profileId)}/avatar`),
    {
      headers: publicHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "No fue posible cargar el avatar.",
      ),
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();
    const source = unwrapPayload(payload);
    const file =
      pickString(source, ["file", "url"]) ??
      pickNestedString(source, ["ai_video", "file"]) ??
      pickNestedString(source, ["ai_image", "file"]);

    if (!file) {
      throw new Error("El avatar no tiene archivo disponible.");
    }

    return {
      kind: isVideoFile(file) ? "video" : "image",
      url: toAssetUrl(file),
    };
  }

  const blob = await response.blob();

  return {
    kind: contentType.includes("video") ? "video" : "image",
    url: URL.createObjectURL(blob),
  };
}

export async function sendProfileMessage(
  profileId: string,
  message: string,
  chatId?: string | null,
  chatToken?: string | null,
  audioResponseEnabled = true,
): Promise<MessageResponse> {
  const body: Record<string, boolean | number | string> = {
    audio_response_enabled: audioResponseEnabled,
    message,
  };

  if (chatId) {
    body.chat_id = normalizeProfileId(chatId);
  }

  const response = await fetch(
    apiUrl(`/api/public/profiles/${encodeURIComponent(profileId)}/messages`),
    {
      body: JSON.stringify(body),
      headers: publicHeaders({ "Content-Type": "application/json" }, chatToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw await createProfileApiError(
      response,
      "No fue posible enviar el mensaje.",
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const normalized = normalizeMessageResponse(
      (await response.json()) as UnknownRecord,
      response.status === 202,
    );

    return normalized.pending
      ? waitForProfileMessage(profileId, normalized, chatToken)
      : normalized;
  }

  const blob = await response.blob();
  return {
    audioUrl: URL.createObjectURL(blob),
    text: "Respuesta de audio recibida.",
  };
}

export async function sendProfileAudioMessage(
  profileId: string,
  audio: Blob,
  chatId?: string | null,
  chatToken?: string | null,
  audioResponseEnabled = true,
): Promise<MessageResponse> {
  const formData = new FormData();
  const extension = getAudioExtension(audio.type);
  formData.append("audio", audio, `recording.${extension}`);
  formData.append("audio_response_enabled", audioResponseEnabled ? "1" : "0");

  if (chatId) {
    formData.append("chat_id", String(normalizeProfileId(chatId)));
  }

  const response = await fetch(
    apiUrl(
      `/api/public/profiles/${encodeURIComponent(profileId)}/messages/audio`,
    ),
    {
      body: formData,
      headers: publicHeaders(undefined, chatToken),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw await createProfileApiError(
      response,
      "No fue posible enviar el audio.",
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const normalized = normalizeMessageResponse(
      (await response.json()) as UnknownRecord,
      response.status === 202,
    );

    return normalized.pending
      ? waitForProfileMessage(profileId, normalized, chatToken)
      : normalized;
  }

  const blob = await response.blob();
  return {
    audioUrl: URL.createObjectURL(blob),
    text: "Respuesta de audio recibida.",
  };
}

export async function fetchProfileMessagingCapabilities(
  profileId: string,
): Promise<ProfileMessagingCapabilities> {
  const response = await fetch(
    apiUrl(
      `/api/public/profiles/${encodeURIComponent(profileId)}/messaging-capabilities`,
    ),
    {
      headers: publicHeaders(),
    },
  );

  if (!response.ok) {
    throw await createProfileApiError(
      response,
      "No fue posible actualizar la disponibilidad de mensajes.",
    );
  }

  return normalizeMessagingCapabilities(
    unwrapPayload((await response.json()) as UnknownRecord),
  );
}

async function fetchSocialNetworkDefinitions(): Promise<
  SocialNetworkDefinition[]
> {
  const response = await fetch(apiUrl("/api/public/social-networks"), {
    headers: publicHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  const source = unwrapPayload((await response.json()) as UnknownRecord);
  const networks = isRecord(source.networks) ? source.networks : {};

  return Object.entries(networks).flatMap(([key, value]) => {
    if (!isRecord(value)) {
      return [];
    }

    return [
      {
        iconUrl: normalizeOptionalAssetUrl(pickString(value, ["icon"])) ?? "",
        key,
        name: pickString(value, ["name"]) ?? formatNetworkName(key),
      },
    ];
  });
}

function normalizeProfile(
  payload: unknown,
  fallbackAlias: string,
  socialNetworkDefinitions: SocialNetworkDefinition[] = [],
): ProfileData {
  const source = unwrapPayload(payload);

  const id =
    pickString(source, ["id", "profile_id", "profileId", "uuid"]) ??
    fallbackAlias;
  const name =
    pickString(source, [
      "name",
      "full_name",
      "fullName",
      "display_name",
      "displayName",
    ]) ?? fallbackAlias;
  const headline =
    pickString(source, [
      "headline",
      "title",
      "profession",
      "role",
      "occupation",
    ]) ?? "Perfil interactivo";
  const description =
    pickString(source, [
      "description",
      "bio",
      "biography",
      "summary",
      "about",
    ]) ?? "Haz una pregunta para conversar con este perfil.";
  const locale = normalizeLocale(
    pickString(source, ["locale", "language", "language_code", "languageCode"]),
  );
  const data = isRecord(source.data) ? source.data : {};
  const voiceEnabled =
    pickBoolean(source, ["voice_enabled", "voiceEnabled"]) ??
    pickBoolean(data, ["voice_enabled", "voiceEnabled"]) ??
    true;
  const voiceAutoplayEnabled =
    voiceEnabled &&
    (pickBoolean(source, ["voice_autoplay_enabled", "voiceAutoplayEnabled"]) ??
      pickBoolean(data, ["voice_autoplay_enabled", "voiceAutoplayEnabled"]) ??
      true);

  return {
    alias:
      pickString(source, ["alias", "slug", "profile_alias", "profileAlias"]) ??
      fallbackAlias,
    conversationMessages: buildConversationMessages(source, name, locale),
    description,
    details: buildDetails(source),
    featureSettings: normalizeProfileFeatureSettings(
      source.feature_settings ?? source.featureSettings,
    ),
    headline,
    id,
    locale,
    messagingCapabilities: normalizeMessagingCapabilities(
      source.messaging_capabilities ?? source.messagingCapabilities,
    ),
    name,
    networks: buildProfileSocialNetworks(source, socialNetworkDefinitions),
    voiceAutoplayEnabled,
    voiceEnabled,
  };
}

function normalizeProfileFeatureSettings(
  value: unknown,
): ProfileFeatureSetting[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const key = pickString(item, ["key"]);
    const group = pickString(item, ["group"]);

    if (!key || !group) {
      return [];
    }

    return [
      {
        effective: pickBoolean(item, ["effective"]) ?? false,
        group,
        key,
        ...(pickString(item, ["provider"])
          ? { provider: pickString(item, ["provider"]) }
          : {}),
      },
    ];
  });
}

function normalizeMessageResponse(
  payload: UnknownRecord,
  allowPending = false,
): MessageResponse {
  const source = unwrapPayload(payload);
  const audioUrl = normalizeOptionalAssetUrl(
    pickString(source, [
      "audio_url",
      "audioUrl",
      "voice_url",
      "voiceUrl",
      "url",
    ]),
  );
  const media = normalizeMessageMedia(source.media);
  const products = normalizeMessageProducts(source.products);
  const socialLinks = normalizeMessageSocialLinks(
    source.social_links ?? source.socialLinks,
  );
  const text = pickString(source, [
    "response",
    "answer",
    "text",
    "message",
    "content",
  ]);
  const requestMessageId = pickString(source, [
    "request_message_id",
    "requestMessageId",
    "message_id",
    "messageId",
  ]);

  if (allowPending && !text && !audioUrl) {
    return {
      chatId: pickString(source, ["chat_id", "chatId"]),
      chatToken: pickString(source, ["chat_token", "chatToken"]),
      messagingCapabilities: normalizeMessagingCapabilities(
        source.messaging_capabilities ?? source.messagingCapabilities,
      ),
      pending: true,
      requestAudioUrl: normalizeOptionalAssetUrl(
        pickString(source, ["request_audio_url", "requestAudioUrl"]),
      ),
      requestMessageId,
      requestText: pickString(source, ["request_text", "requestText"]),
      text: "",
    };
  }

  if (
    !text &&
    !audioUrl &&
    media.length === 0 &&
    products.length === 0 &&
    socialLinks.length === 0
  ) {
    throw new Error(getMessageResponseError(payload, source));
  }

  return {
    audioUrl,
    chatId: pickString(source, ["chat_id", "chatId"]),
    chatToken: pickString(source, ["chat_token", "chatToken"]),
    requestAudioUrl: normalizeOptionalAssetUrl(
      pickString(source, ["request_audio_url", "requestAudioUrl"]),
    ),
    requestMessageId,
    requestText: pickString(source, ["request_text", "requestText"]),
    messagingCapabilities: normalizeMessagingCapabilities(
      source.messaging_capabilities ?? source.messagingCapabilities,
    ),
    ...(media.length ? { media } : {}),
    ...(products.length ? { products } : {}),
    ...(socialLinks.length ? { socialLinks } : {}),
    text: text ?? "Respuesta de audio recibida.",
  };
}

async function waitForProfileMessage(
  profileId: string,
  pending: MessageResponse,
  previousChatToken?: string | null,
): Promise<MessageResponse> {
  const messageId = pending.requestMessageId;
  const chatToken = pending.chatToken ?? previousChatToken ?? undefined;

  if (!messageId || !chatToken) {
    throw new Error("No fue posible consultar la respuesta en proceso.");
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, attempt < 5 ? 750 : 1500),
    );

    const response = await fetch(
      apiUrl(
        `/api/public/profiles/${encodeURIComponent(profileId)}/messages/${encodeURIComponent(messageId)}/status`,
      ),
      { headers: publicHeaders(undefined, chatToken) },
    );

    if (response.status === 202) {
      continue;
    }

    if (!response.ok) {
      throw await createProfileApiError(
        response,
        "No fue posible completar la respuesta.",
      );
    }

    const result = normalizeMessageResponse(
      (await response.json()) as UnknownRecord,
    );

    return {
      ...result,
      chatId: result.chatId ?? pending.chatId,
      chatToken,
    };
  }

  throw new Error(
    "La respuesta está tardando más de lo esperado. Intenta de nuevo en unos segundos.",
  );
}

function normalizeMessagingCapabilities(
  value: unknown,
): ProfileMessagingCapabilities {
  const source = isRecord(value) ? value : {};

  return {
    audioMessagesEnabled:
      pickBoolean(source, [
        "audio_messages_enabled",
        "audioMessagesEnabled",
      ]) ?? true,
    audioMaxDurationSeconds: Math.max(
      1,
      Number(
        pickString(source, [
          "audio_max_duration_seconds",
          "audioMaxDurationSeconds",
        ]) ?? 30,
      ),
    ),
    reason: pickString(source, ["reason"]) ?? null,
    textMessagesEnabled:
      pickBoolean(source, ["text_messages_enabled", "textMessagesEnabled"]) ??
      true,
  };
}

function normalizeMessageMedia(value: unknown): ChatMessageMedia[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const mediaType = pickString(item, ["media_type", "mediaType", "type"]);
    const mediaUrl = normalizeOptionalAssetUrl(
      pickString(item, ["media_url", "mediaUrl"]),
    );
    const thumbnailUrl = normalizeOptionalAssetUrl(
      pickString(item, ["thumbnail_url", "thumbnailUrl"]),
    );
    const imageUrl =
      thumbnailUrl ??
      normalizeOptionalAssetUrl(pickString(item, ["image_url", "imageUrl"])) ??
      (mediaType?.toUpperCase().includes("VIDEO") ? undefined : mediaUrl);
    const permalink = pickString(item, [
      "permalink",
      "link",
      "instagram_url",
      "instagramUrl",
    ]);
    const channelUrl = pickString(item, ["channel_url", "channelUrl"]);

    if (!imageUrl && !mediaUrl && !permalink) {
      return [];
    }

    return [
      {
        ...(pickBoolean(item, ["age_restricted", "ageRestricted"]) !== undefined
          ? {
              ageRestricted: pickBoolean(item, [
                "age_restricted",
                "ageRestricted",
              ]),
            }
          : {}),
        ...(pickString(item, ["caption"])
          ? { caption: pickString(item, ["caption"]) }
          : {}),
        ...(pickString(item, ["action_label", "actionLabel"])
          ? { actionLabel: pickString(item, ["action_label", "actionLabel"]) }
          : {}),
        ...(pickString(item, ["action_type", "actionType"])
          ? { actionType: pickString(item, ["action_type", "actionType"]) }
          : {}),
        ...(channelUrl ? { channelUrl } : {}),
        ...(pickString(item, ["destination_label", "destinationLabel"])
          ? {
              destinationLabel: pickString(item, [
                "destination_label",
                "destinationLabel",
              ]),
            }
          : {}),
        ...(pickString(item, ["destination_type", "destinationType"])
          ? {
              destinationType: pickString(item, [
                "destination_type",
                "destinationType",
              ]),
            }
          : {}),
        ...(pickString(item, ["id", "media_id", "mediaId"])
          ? { id: pickString(item, ["id", "media_id", "mediaId"]) }
          : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(pickString(item, ["observation", "note"])
          ? { observation: pickString(item, ["observation", "note"]) }
          : {}),
        ...(permalink ? { permalink } : {}),
        ...(pickString(item, ["provider"])
          ? { provider: pickString(item, ["provider"]) }
          : {}),
        ...(pickString(item, ["provider_key", "providerKey"])
          ? { providerKey: pickString(item, ["provider_key", "providerKey"]) }
          : {}),
        ...(pickString(item, ["provider_label", "providerLabel"])
          ? {
              providerLabel: pickString(item, [
                "provider_label",
                "providerLabel",
              ]),
            }
          : {}),
        ...(pickString(item, ["taken_at", "takenAt", "timestamp"])
          ? { takenAt: pickString(item, ["taken_at", "takenAt", "timestamp"]) }
          : {}),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        ...(mediaType ? { type: mediaType } : {}),
      },
    ];
  });
}

function normalizeMessageProducts(value: unknown): ChatMessageProduct[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const actionUrl = pickString(item, ["action_url", "actionUrl"]);
    const description = pickString(item, ["description"]);
    const destinationType = pickString(item, [
      "destination_type",
      "destinationType",
    ]);
    const id = pickString(item, ["id", "public_id", "publicId"]);
    const imageUrl = normalizeOptionalAssetUrl(
      pickString(item, ["image_url", "imageUrl"]),
    );
    const name = pickString(item, ["name"]);
    const publicUrl = pickString(item, ["public_url", "publicUrl"]);

    if (
      !actionUrl ||
      !description ||
      !id ||
      !imageUrl ||
      !name ||
      !publicUrl ||
      !["external_url", "telegram", "whatsapp"].includes(destinationType ?? "")
    ) {
      return [];
    }

    return [
      {
        actionUrl,
        description,
        destinationType:
          destinationType as ChatMessageProduct["destinationType"],
        id,
        imageUrl,
        name,
        publicUrl,
      },
    ];
  });
}

function normalizeMessageSocialLinks(value: unknown): ChatMessageSocialLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const actionLabel = pickString(item, ["action_label", "actionLabel"]);
    const providerKey = pickString(item, ["provider_key", "providerKey"]);
    const providerLabel = pickString(item, [
      "provider_label",
      "providerLabel",
    ]);
    const url = pickString(item, ["url"]);

    if (!actionLabel || !providerKey || !providerLabel || !url) {
      return [];
    }

    return [{ actionLabel, providerKey, providerLabel, url }];
  });
}

function getMessageResponseError(
  payload: UnknownRecord,
  source: UnknownRecord,
) {
  const status = (
    pickString(source, ["status"]) ??
    pickNestedString(source, ["chat_ai", "status"]) ??
    ""
  ).toLowerCase();
  const topLevelMessage = pickString(payload, ["message", "error"]);
  const providerError =
    pickString(source, ["error"]) ??
    pickNestedString(source, ["chat_ai", "response", "error", "message"]) ??
    pickNestedString(source, ["chat_ai", "response", "error"]);

  if (
    status === "pending" ||
    status === "processing" ||
    topLevelMessage?.toLowerCase().includes("pending")
  ) {
    return "La respuesta todavía se está procesando. Intenta de nuevo en unos segundos.";
  }

  return (
    providerError ??
    topLevelMessage ??
    "El API no devolvió una respuesta para mostrar."
  );
}

function unwrapPayload(payload: unknown): UnknownRecord {
  if (!isRecord(payload)) {
    return {};
  }

  const nested = payload.data ?? payload.profile ?? payload.result;
  return isRecord(nested) ? nested : payload;
}

function buildDetails(source: UnknownRecord): string[] {
  const values = [
    pickString(source, ["location", "city", "country"]),
    pickString(source, ["website", "url"]),
    pickString(source, ["category", "type", "genre"]),
    pickString(source, ["personality"]),
  ];

  return values.filter((value): value is string => Boolean(value));
}

function buildProfileSocialNetworks(
  source: UnknownRecord,
  socialNetworkDefinitions: SocialNetworkDefinition[],
): ProfileSocialNetwork[] {
  const profileNetworks = isRecord(source.networks) ? source.networks : {};
  const definitionsByKey = new Map(
    socialNetworkDefinitions.map((definition) => [definition.key, definition]),
  );
  const orderedKeys = Object.keys(profileNetworks);

  return orderedKeys.flatMap((key) => {
    const url = profileNetworks[key];

    if (typeof url !== "string" || !url.trim()) {
      return [];
    }

    const definition = definitionsByKey.get(key);

    return [
      {
        iconUrl: definition?.iconUrl ?? "",
        key,
        name: definition?.name ?? formatNetworkName(key),
        url: url.trim(),
      },
    ];
  });
}

function buildConversationMessages(
  source: UnknownRecord,
  profileName: string,
  locale: "en" | "es",
): ProfileConversationMessages {
  const rawMessages =
    source.conversation_messages ?? source.conversationMessages;
  const messages = isRecord(rawMessages) ? rawMessages : {};

  return {
    fallbackNoAnswer: normalizeConversationMessage(
      messages.fallback_no_answer ?? messages.fallbackNoAnswer,
      "fallback_no_answer",
      null,
      false,
    ),
    initial: normalizeConversationMessage(
      messages.initial,
      "initial",
      buildDefaultInitialMessage(profileName, locale),
      true,
    ),
  };
}

function normalizeConversationMessage(
  value: unknown,
  type: ProfileConversationMessageType,
  fallbackText: string | null,
  fallbackEnabled: boolean,
): ProfileConversationMessage {
  const source = isRecord(value) ? value : {};
  const text =
    pickString(source, ["text", "message", "content"]) ?? fallbackText;
  const enabled = pickBoolean(source, ["enabled"]) ?? fallbackEnabled;

  return {
    audioFormat:
      pickString(source, ["audio_format", "audioFormat", "format"]) ?? null,
    audioSource:
      pickString(source, ["audio_source", "audioSource", "source"]) ?? null,
    audioUrl: normalizeOptionalAssetUrl(
      pickString(source, ["audio_url", "audioUrl", "url"]),
    ),
    enabled,
    status: pickString(source, ["status"]) ?? null,
    text,
    type,
  };
}

function buildDefaultInitialMessage(profileName: string, locale: "en" | "es") {
  const name = profileName.trim() || "Bigmelo";

  if (locale === "en") {
    return `Hi, I am ${name}. Ask me about my work, my projects, or anything you want to know about me.`;
  }

  return `Hola, soy ${name}. Pregúntame sobre mi trabajo, mis proyectos o lo que quieres conocer de mí.`;
}

function normalizeLocale(value: null | string | undefined): "en" | "es" {
  return value?.toLowerCase().split("-")[0] === "en" ? "en" : "es";
}

function formatNetworkName(key: string) {
  if (key.toLowerCase() === "x") {
    return "X";
  }

  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function pickString(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return undefined;
}

function pickNestedString(source: UnknownRecord, path: string[]) {
  let current: unknown = source;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  if (typeof current === "string" && current.trim()) {
    return current.trim();
  }

  if (typeof current === "number") {
    return String(current);
  }

  return undefined;
}

function pickBoolean(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value === 1;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();

      if (["1", "true", "yes"].includes(normalizedValue)) {
        return true;
      }

      if (["0", "false", "no"].includes(normalizedValue)) {
        return false;
      }
    }
  }

  return undefined;
}

function normalizeOptionalAssetUrl(value?: string) {
  return value ? toAssetUrl(value) : undefined;
}

function toAssetUrl(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("blob:") || trimmedValue.startsWith("data:")) {
    return trimmedValue;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return normalizeLocalAssetUrl(trimmedValue);
  }

  const normalizedPath = trimmedValue.startsWith("/")
    ? trimmedValue
    : trimmedValue.startsWith("storage/")
      ? `/${trimmedValue}`
      : `/storage/${trimmedValue}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function isVideoFile(value: string) {
  return /\.(mp4|mov|webm|m4v)$/i.test(value);
}

function normalizeProfileId(profileId: string) {
  return /^\d+$/.test(profileId) ? Number(profileId) : profileId;
}

async function getResponseErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return fallback;
  }

  try {
    const payload = (await response.json()) as UnknownRecord;
    const source = unwrapPayload(payload);
    const message =
      pickString(payload, ["message", "error"]) ??
      pickString(source, ["error"]) ??
      pickNestedString(source, ["chat_ai", "response", "error", "message"]) ??
      pickNestedString(source, ["chat_ai", "response", "error"]);
    return message ?? fallback;
  } catch {
    return fallback;
  }
}

async function createProfileApiError(
  response: Response,
  fallback: string,
): Promise<ProfileApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return new ProfileApiError(fallback, response.status);
  }

  try {
    const payload = (await response.json()) as UnknownRecord;
    const source = unwrapPayload(payload);
    const message =
      pickString(payload, ["message", "error"]) ??
      pickString(source, ["error"]) ??
      fallback;
    const capabilitiesValue =
      source.messaging_capabilities ?? source.messagingCapabilities;

    return new ProfileApiError(
      message,
      response.status,
      pickString(payload, ["code"]),
      isRecord(capabilitiesValue)
        ? normalizeMessagingCapabilities(capabilitiesValue)
        : undefined,
    );
  } catch {
    return new ProfileApiError(fallback, response.status);
  }
}

function normalizeLocalAssetUrl(value: string) {
  try {
    const assetUrl = new URL(value);
    const baseUrl = new URL(API_BASE_URL);
    const isLocalHost =
      assetUrl.hostname === "localhost" || assetUrl.hostname === "127.0.0.1";

    if (isLocalHost && !assetUrl.port && baseUrl.port) {
      assetUrl.protocol = baseUrl.protocol;
      assetUrl.host = baseUrl.host;
      return assetUrl.toString();
    }
  } catch {
    return value;
  }

  return value;
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("webm")) {
    return "webm";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  if (mimeType.includes("mp4") || mimeType.includes("aac")) {
    return "m4a";
  }

  return "mp3";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
