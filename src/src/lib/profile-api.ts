const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

type UnknownRecord = Record<string, unknown>;

export class ProfileApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

export type ProfileData = {
  id: string;
  alias: string;
  conversationMessages: ProfileConversationMessages;
  locale: 'en' | 'es';
  name: string;
  headline: string;
  description: string;
  details: string[];
  networks: ProfileSocialNetwork[];
};

export type ProfileConversationMessageType = 'fallback_no_answer' | 'initial';

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
  role: 'visitor' | 'profile';
  text: string;
};

export type ChatMessageMedia = {
  ageRestricted?: boolean;
  caption?: string;
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

export type MessageResponse = {
  chatId?: string;
  text: string;
  audioUrl?: string;
  media?: ChatMessageMedia[];
  requestAudioUrl?: string;
  requestMessageId?: string;
  requestText?: string;
};

export type AudioResponse = {
  audioUrl?: string;
  blob?: Blob;
};

export type AvatarMedia = {
  kind: 'image' | 'video';
  url: string;
};

type SocialNetworkDefinition = {
  iconUrl: string;
  key: string;
  name: string;
};

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...extra,
  };

  if (API_TOKEN) {
    return {
      ...headers,
      Authorization: `Bearer ${API_TOKEN}`,
    };
  }

  return headers;
}

export async function fetchProfileByAlias(alias: string): Promise<ProfileData> {
  const profileResponsePromise = fetch(apiUrl(`/api/profile/alias/${encodeURIComponent(alias)}`), {
    headers: authHeaders(),
  });
  const socialNetworksPromise = fetchSocialNetworkDefinitions().catch(() => []);
  const response = await profileResponsePromise;

  if (!response.ok) {
    throw new ProfileApiError(
      await getResponseErrorMessage(response, 'No fue posible cargar el perfil.'),
      response.status,
    );
  }

  const [payload, socialNetworkDefinitions] = await Promise.all([response.json(), socialNetworksPromise]);
  return normalizeProfile(payload, alias, socialNetworkDefinitions);
}

export async function fetchAvatarMedia(profileId: string): Promise<AvatarMedia> {
  const response = await fetch(apiUrl(`/api/avatar/${encodeURIComponent(profileId)}`), {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'No fue posible cargar el avatar.'));
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    const source = unwrapPayload(payload);
    const file =
      pickString(source, ['file', 'url']) ??
      pickNestedString(source, ['ai_video', 'file']) ??
      pickNestedString(source, ['ai_image', 'file']);

    if (!file) {
      throw new Error('El avatar no tiene archivo disponible.');
    }

    return {
      kind: isVideoFile(file) ? 'video' : 'image',
      url: toAssetUrl(file),
    };
  }

  const blob = await response.blob();

  return {
    kind: contentType.includes('video') ? 'video' : 'image',
    url: URL.createObjectURL(blob),
  };
}

export async function requestVoiceTest(profileId: string, text: string): Promise<AudioResponse> {
  const response = await fetch(apiUrl('/api/voice/test'), {
    body: JSON.stringify({ profile_id: normalizeProfileId(profileId), text }),
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'No fue posible generar el audio de prueba.'));
  }

  const audioResponse = await parseAudioResponse(response);

  if (!audioResponse.audioUrl && !audioResponse.blob) {
    throw new Error('El API no devolvió audio para el saludo.');
  }

  return audioResponse;
}

export async function sendProfileMessage(
  profileId: string,
  message: string,
  chatId?: string | null,
): Promise<MessageResponse> {
  const body: Record<string, string | number> = { message };

  if (chatId) {
    body.chat_id = normalizeProfileId(chatId);
  }

  const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(profileId)}/messages`), {
    body: JSON.stringify(body),
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'No fue posible enviar el mensaje.'));
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    return normalizeMessageResponse((await response.json()) as UnknownRecord);
  }

  const blob = await response.blob();
  return {
    audioUrl: URL.createObjectURL(blob),
    text: 'Respuesta de audio recibida.',
  };
}

export async function sendProfileAudioMessage(
  profileId: string,
  audio: Blob,
  chatId?: string | null,
): Promise<MessageResponse> {
  const formData = new FormData();
  const extension = getAudioExtension(audio.type);
  formData.append('audio', audio, `recording.${extension}`);

  if (chatId) {
    formData.append('chat_id', String(normalizeProfileId(chatId)));
  }

  const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(profileId)}/messages/audio`), {
    body: formData,
    headers: authHeaders(),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'No fue posible enviar el audio.'));
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    return normalizeMessageResponse((await response.json()) as UnknownRecord);
  }

  const blob = await response.blob();
  return {
    audioUrl: URL.createObjectURL(blob),
    text: 'Respuesta de audio recibida.',
  };
}

export async function fetchProfileChatMessages(profileId: string, chatId: string): Promise<ChatMessage[]> {
  const firstPage = await fetchProfileChatMessagesPage(profileId, chatId, 1);
  const pagination = isRecord(firstPage.pagination) ? firstPage.pagination : {};
  const lastPageValue = pagination.last_page ?? pagination.lastPage;
  const lastPage = typeof lastPageValue === 'number' ? lastPageValue : Number(lastPageValue || 1);
  const source = lastPage > 1 ? await fetchProfileChatMessagesPage(profileId, chatId, lastPage) : firstPage;
  const messages = Array.isArray(source.messages) ? source.messages : [];

  return messages.flatMap((message) => normalizeChatMessage(message));
}

async function parseAudioResponse(response: Response): Promise<AudioResponse> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as UnknownRecord;
    const source = unwrapPayload(payload);
    const audioUrl = normalizeOptionalAssetUrl(
      pickString(source, ['audio_url', 'audioUrl', 'url', 'voice_url', 'voiceUrl']),
    );
    const audioBase64 = pickString(source, [
      'audio',
      'audio_content',
      'audioContent',
      'audio_base64',
      'audioBase64',
    ]);
    const audioFormat = pickString(source, ['audio_format', 'audioFormat', 'format']) ?? 'mp3';

    if (audioUrl) {
      return { audioUrl };
    }

    if (audioBase64) {
      return { blob: base64ToBlob(audioBase64, audioFormat) };
    }

    return {};
  }

  return { blob: await response.blob() };
}

async function fetchSocialNetworkDefinitions(): Promise<SocialNetworkDefinition[]> {
  const response = await fetch(apiUrl('/api/profile/social-networks'), {
    headers: authHeaders(),
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
        iconUrl: normalizeOptionalAssetUrl(pickString(value, ['icon'])) ?? '',
        key,
        name: pickString(value, ['name']) ?? formatNetworkName(key),
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

  const id = pickString(source, ['id', 'profile_id', 'profileId', 'uuid']) ?? fallbackAlias;
  const name =
    pickString(source, ['name', 'full_name', 'fullName', 'display_name', 'displayName']) ??
    fallbackAlias;
  const headline =
    pickString(source, ['headline', 'title', 'profession', 'role', 'occupation']) ??
    'Perfil interactivo';
  const description =
    pickString(source, ['description', 'bio', 'biography', 'summary', 'about']) ??
    'Haz una pregunta para conversar con este perfil.';
  const locale = normalizeLocale(pickString(source, ['locale', 'language', 'language_code', 'languageCode']));

  return {
    alias: pickString(source, ['alias', 'slug', 'profile_alias', 'profileAlias']) ?? fallbackAlias,
    conversationMessages: buildConversationMessages(source, name, locale),
    description,
    details: buildDetails(source),
    headline,
    id,
    locale,
    name,
    networks: buildProfileSocialNetworks(source, socialNetworkDefinitions),
  };
}

function normalizeMessageResponse(payload: UnknownRecord): MessageResponse {
  const source = unwrapPayload(payload);
  const audioUrl = normalizeOptionalAssetUrl(
    pickString(source, ['audio_url', 'audioUrl', 'voice_url', 'voiceUrl', 'url']),
  );
  const media = normalizeMessageMedia(source.media);
  const text = pickString(source, ['response', 'answer', 'text', 'message', 'content']);

  if (!text && !audioUrl && media.length === 0) {
    throw new Error(getMessageResponseError(payload, source));
  }

  return {
    audioUrl,
    chatId: pickString(source, ['chat_id', 'chatId']),
    requestAudioUrl: normalizeOptionalAssetUrl(
      pickString(source, ['request_audio_url', 'requestAudioUrl']),
    ),
    requestMessageId: pickString(source, ['request_message_id', 'requestMessageId']),
    requestText: pickString(source, ['request_text', 'requestText']),
    ...(media.length ? { media } : {}),
    text: text ?? 'Respuesta de audio recibida.',
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

    const mediaType = pickString(item, ['media_type', 'mediaType', 'type']);
    const mediaUrl = normalizeOptionalAssetUrl(pickString(item, ['media_url', 'mediaUrl']));
    const thumbnailUrl = normalizeOptionalAssetUrl(
      pickString(item, ['thumbnail_url', 'thumbnailUrl']),
    );
    const imageUrl =
      thumbnailUrl ??
      normalizeOptionalAssetUrl(pickString(item, ['image_url', 'imageUrl'])) ??
      (mediaType?.toUpperCase().includes('VIDEO') ? undefined : mediaUrl);
    const permalink = pickString(item, ['permalink', 'link', 'instagram_url', 'instagramUrl']);

    if (!imageUrl && !mediaUrl && !permalink) {
      return [];
    }

    return [
      {
        ...(pickBoolean(item, ['age_restricted', 'ageRestricted']) !== undefined
          ? { ageRestricted: pickBoolean(item, ['age_restricted', 'ageRestricted']) }
          : {}),
        ...(pickString(item, ['caption']) ? { caption: pickString(item, ['caption']) } : {}),
        ...(pickString(item, ['id', 'media_id', 'mediaId']) ? { id: pickString(item, ['id', 'media_id', 'mediaId']) } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(pickString(item, ['observation', 'note']) ? { observation: pickString(item, ['observation', 'note']) } : {}),
        ...(permalink ? { permalink } : {}),
        ...(pickString(item, ['provider']) ? { provider: pickString(item, ['provider']) } : {}),
        ...(pickString(item, ['provider_key', 'providerKey']) ? { providerKey: pickString(item, ['provider_key', 'providerKey']) } : {}),
        ...(pickString(item, ['provider_label', 'providerLabel']) ? { providerLabel: pickString(item, ['provider_label', 'providerLabel']) } : {}),
        ...(pickString(item, ['taken_at', 'takenAt', 'timestamp']) ? { takenAt: pickString(item, ['taken_at', 'takenAt', 'timestamp']) } : {}),
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        ...(mediaType ? { type: mediaType } : {}),
      },
    ];
  });
}

function getMessageResponseError(payload: UnknownRecord, source: UnknownRecord) {
  const status = (
    pickString(source, ['status']) ??
    pickNestedString(source, ['chat_ai', 'status']) ??
    ''
  ).toLowerCase();
  const topLevelMessage = pickString(payload, ['message', 'error']);
  const providerError =
    pickString(source, ['error']) ??
    pickNestedString(source, ['chat_ai', 'response', 'error', 'message']) ??
    pickNestedString(source, ['chat_ai', 'response', 'error']);

  if (status === 'pending' || status === 'processing' || topLevelMessage?.toLowerCase().includes('pending')) {
    return 'La respuesta todavía se está procesando. Intenta de nuevo en unos segundos.';
  }

  return providerError ?? topLevelMessage ?? 'El API no devolvió una respuesta para mostrar.';
}

async function fetchProfileChatMessagesPage(profileId: string, chatId: string, page: number): Promise<UnknownRecord> {
  const searchParams = new URLSearchParams({
    chat_id: String(normalizeProfileId(chatId)),
    page: String(page),
    profile_id: String(normalizeProfileId(profileId)),
  });
  const response = await fetch(apiUrl(`/api/profile/chats/messages?${searchParams.toString()}`), {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'No fue posible cargar los mensajes del chat.'));
  }

  return unwrapPayload((await response.json()) as UnknownRecord);
}

function normalizeChatMessage(value: unknown): ChatMessage[] {
  if (!isRecord(value)) {
    return [];
  }

  const data = isRecord(value.data) ? value.data : {};
  const media = normalizeMessageMedia(value.media ?? data.media);
  const text = pickString(value, ['text', 'message', 'content']);
  const id = pickString(value, ['id', 'message_id', 'messageId']);
  const source = pickString(value, ['source']);
  const type = pickString(value, ['type']);

  if (!id || !text) {
    return [];
  }

  return [
    {
      audioUrl: normalizeOptionalAssetUrl(pickString(value, ['audio', 'audio_url', 'audioUrl'])),
      createdAt: pickString(value, ['created_at', 'createdAt']),
      id,
      ...(media.length ? { media } : {}),
      role: source === 'api' || type === 'question' ? 'visitor' : 'profile',
      text,
    },
  ];
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
    pickString(source, ['location', 'city', 'country']),
    pickString(source, ['website', 'url']),
    pickString(source, ['category', 'type', 'genre']),
    pickString(source, ['personality']),
  ];

  return values.filter((value): value is string => Boolean(value));
}

function buildProfileSocialNetworks(
  source: UnknownRecord,
  socialNetworkDefinitions: SocialNetworkDefinition[],
): ProfileSocialNetwork[] {
  const profileNetworks = isRecord(source.networks) ? source.networks : {};
  const definitionsByKey = new Map(socialNetworkDefinitions.map((definition) => [definition.key, definition]));
  const orderedKeys = Object.keys(profileNetworks);

  return orderedKeys.flatMap((key) => {
    const url = profileNetworks[key];

    if (typeof url !== 'string' || !url.trim()) {
      return [];
    }

    const definition = definitionsByKey.get(key);

    return [
      {
        iconUrl: definition?.iconUrl ?? '',
        key,
        name: definition?.name ?? formatNetworkName(key),
        url: url.trim(),
      },
    ];
  });
}

function buildConversationMessages(source: UnknownRecord, profileName: string, locale: 'en' | 'es'): ProfileConversationMessages {
  const rawMessages = source.conversation_messages ?? source.conversationMessages;
  const messages = isRecord(rawMessages) ? rawMessages : {};

  return {
    fallbackNoAnswer: normalizeConversationMessage(
      messages.fallback_no_answer ?? messages.fallbackNoAnswer,
      'fallback_no_answer',
      null,
      false,
    ),
    initial: normalizeConversationMessage(
      messages.initial,
      'initial',
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
  const text = pickString(source, ['text', 'message', 'content']) ?? fallbackText;
  const enabled = pickBoolean(source, ['enabled']) ?? fallbackEnabled;

  return {
    audioFormat: pickString(source, ['audio_format', 'audioFormat', 'format']) ?? null,
    audioSource: pickString(source, ['audio_source', 'audioSource', 'source']) ?? null,
    audioUrl: normalizeOptionalAssetUrl(pickString(source, ['audio_url', 'audioUrl', 'url'])),
    enabled,
    status: pickString(source, ['status']) ?? null,
    text,
    type,
  };
}

function buildDefaultInitialMessage(profileName: string, locale: 'en' | 'es') {
  const name = profileName.trim() || 'Bigmelo';

  if (locale === 'en') {
    return `Hi, I am ${name}. Ask me about my work, my projects, or anything you want to know about me.`;
  }

  return `Hola, soy ${name}. Pregúntame sobre mi trabajo, mis proyectos o lo que quieres conocer de mí.`;
}

function normalizeLocale(value: null | string | undefined): 'en' | 'es' {
  return value?.toLowerCase().split('-')[0] === 'en' ? 'en' : 'es';
}

function formatNetworkName(key: string) {
  if (key.toLowerCase() === 'x') {
    return 'X';
  }

  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function pickString(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number') {
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

  if (typeof current === 'string' && current.trim()) {
    return current.trim();
  }

  if (typeof current === 'number') {
    return String(current);
  }

  return undefined;
}

function pickBoolean(source: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    if (typeof value === 'string') {
      const normalizedValue = value.trim().toLowerCase();

      if (['1', 'true', 'yes'].includes(normalizedValue)) {
        return true;
      }

      if (['0', 'false', 'no'].includes(normalizedValue)) {
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

  if (trimmedValue.startsWith('blob:') || trimmedValue.startsWith('data:')) {
    return trimmedValue;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return normalizeLocalAssetUrl(trimmedValue);
  }

  const normalizedPath = trimmedValue.startsWith('/')
    ? trimmedValue
    : trimmedValue.startsWith('storage/')
      ? `/${trimmedValue}`
      : `/storage/${trimmedValue}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function isVideoFile(value: string) {
  return /\.(mp4|mov|webm|m4v)$/i.test(value);
}

function base64ToBlob(value: string, audioFormat = 'mp3') {
  const [metadata, data] = value.includes(',') ? value.split(',') : ['', value];
  const mimeType = metadata.match(/data:(.*);base64/)?.[1] ?? getAudioMimeType(audioFormat);
  const binary = window.atob(data.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function normalizeProfileId(profileId: string) {
  return /^\d+$/.test(profileId) ? Number(profileId) : profileId;
}

async function getResponseErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (!contentType.includes('application/json')) {
    return fallback;
  }

  try {
    const payload = (await response.json()) as UnknownRecord;
    const source = unwrapPayload(payload);
    const message =
      pickString(payload, ['message', 'error']) ??
      pickString(source, ['error']) ??
      pickNestedString(source, ['chat_ai', 'response', 'error', 'message']) ??
      pickNestedString(source, ['chat_ai', 'response', 'error']);
    return message ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeLocalAssetUrl(value: string) {
  try {
    const assetUrl = new URL(value);
    const baseUrl = new URL(API_BASE_URL);
    const isLocalHost = assetUrl.hostname === 'localhost' || assetUrl.hostname === '127.0.0.1';

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

function getAudioMimeType(audioFormat: string) {
  const normalizedFormat = audioFormat.toLowerCase().replace(/^\./, '');

  if (normalizedFormat === 'wav') {
    return 'audio/wav';
  }

  if (normalizedFormat === 'ogg' || normalizedFormat === 'oga') {
    return 'audio/ogg';
  }

  if (normalizedFormat === 'webm') {
    return 'audio/webm';
  }

  if (normalizedFormat === 'm4a' || normalizedFormat === 'mp4') {
    return 'audio/mp4';
  }

  return 'audio/mpeg';
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes('webm')) {
    return 'webm';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  if (mimeType.includes('wav')) {
    return 'wav';
  }

  if (mimeType.includes('mp4') || mimeType.includes('aac')) {
    return 'm4a';
  }

  return 'mp3';
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
