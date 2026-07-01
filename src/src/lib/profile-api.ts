const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

type UnknownRecord = Record<string, unknown>;

export type ProfileData = {
  id: string;
  alias: string;
  name: string;
  headline: string;
  description: string;
  details: string[];
  networks: ProfileSocialNetwork[];
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
  role: 'visitor' | 'profile';
  text: string;
};

export type MessageResponse = {
  chatId?: string;
  text: string;
  audioUrl?: string;
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
    throw new Error(await getResponseErrorMessage(response, 'No fue posible cargar el perfil.'));
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

  return {
    alias: pickString(source, ['alias', 'slug', 'profile_alias', 'profileAlias']) ?? fallbackAlias,
    description,
    details: buildDetails(source),
    headline,
    id,
    name,
    networks: buildProfileSocialNetworks(source, socialNetworkDefinitions),
  };
}

function normalizeMessageResponse(payload: UnknownRecord): MessageResponse {
  const source = unwrapPayload(payload);

  return {
    audioUrl: normalizeOptionalAssetUrl(
      pickString(source, ['audio_url', 'audioUrl', 'voice_url', 'voiceUrl', 'url']),
    ),
    chatId: pickString(source, ['chat_id', 'chatId']),
    requestAudioUrl: normalizeOptionalAssetUrl(
      pickString(source, ['request_audio_url', 'requestAudioUrl']),
    ),
    requestMessageId: pickString(source, ['request_message_id', 'requestMessageId']),
    requestText: pickString(source, ['request_text', 'requestText']),
    text:
      pickString(source, ['response', 'answer', 'text', 'message', 'content']) ??
      'Respuesta recibida.',
  };
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
    const message = pickString(payload, ['message', 'error']);
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
