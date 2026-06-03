const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

type UnknownRecord = Record<string, unknown>;

export type ProfileData = {
  id: string;
  alias: string;
  name: string;
  headline: string;
  description: string;
  details: string[];
};

export type ChatMessage = {
  id: string;
  role: 'visitor' | 'profile';
  text: string;
};

export type MessageResponse = {
  text: string;
  audioUrl?: string;
};

export type AudioResponse = {
  audioUrl?: string;
  blob?: Blob;
};

export type AvatarMedia = {
  kind: 'image' | 'video';
  url: string;
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
  const response = await fetch(apiUrl(`/api/profile/alias/${encodeURIComponent(alias)}`), {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('No fue posible cargar el perfil.');
  }

  const payload = await response.json();
  return normalizeProfile(payload, alias);
}

export async function fetchAvatarMedia(profileId: string): Promise<AvatarMedia> {
  const response = await fetch(apiUrl(`/api/avatar/${encodeURIComponent(profileId)}`), {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('No fue posible cargar el avatar.');
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
    body: JSON.stringify({ profile_id: profileId, text }),
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('No fue posible generar el audio de prueba.');
  }

  return parseAudioResponse(response);
}

export async function sendProfileMessage(profileId: string, message: string): Promise<MessageResponse> {
  const response = await fetch(apiUrl(`/api/profile/${encodeURIComponent(profileId)}/messages`), {
    body: JSON.stringify({ message }),
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('No fue posible enviar el mensaje.');
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as UnknownRecord;
    const source = unwrapPayload(payload);

    return {
      audioUrl: normalizeOptionalAssetUrl(
        pickString(source, ['audio_url', 'audioUrl', 'voice_url', 'voiceUrl', 'url']),
      ),
      text:
        pickString(source, ['response', 'answer', 'text', 'message', 'content']) ??
        'Respuesta recibida.',
    };
  }

  const blob = await response.blob();
  return {
    audioUrl: URL.createObjectURL(blob),
    text: 'Respuesta de audio recibida.',
  };
}

async function parseAudioResponse(response: Response): Promise<AudioResponse> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as UnknownRecord;
    const source = unwrapPayload(payload);
    const audioUrl = normalizeOptionalAssetUrl(
      pickString(source, ['audio_url', 'audioUrl', 'url', 'voice_url', 'voiceUrl']),
    );
    const audioBase64 = pickString(source, ['audio', 'audio_content', 'audio_base64', 'audioBase64']);

    if (audioUrl) {
      return { audioUrl };
    }

    if (audioBase64) {
      return { blob: base64ToBlob(audioBase64) };
    }

    return {};
  }

  return { blob: await response.blob() };
}

function normalizeProfile(payload: unknown, fallbackAlias: string): ProfileData {
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
  };
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
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) {
    return value;
  }

  const normalizedPath = value.startsWith('/') ? value : `/storage/${value}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function isVideoFile(value: string) {
  return /\.(mp4|mov|webm|m4v)$/i.test(value);
}

function base64ToBlob(value: string) {
  const [metadata, data] = value.includes(',') ? value.split(',') : ['', value];
  const mimeType = metadata.match(/data:(.*);base64/)?.[1] ?? 'audio/mpeg';
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
