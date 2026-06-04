import { FormEvent, useEffect, useRef, useState } from 'react';

import {
  ChatMessage,
  fetchAvatarMedia,
  fetchProfileByAlias,
  ProfileData,
  requestVoiceTest,
  sendProfileMessage,
} from '../lib/profile-api';

type ProfileProps = {
  profileAlias: string;
};

type GreetingAudioState = 'idle' | 'loading' | 'ready' | 'blocked' | 'unavailable';

type ProfileSession = {
  chatId: string | null;
  messages: ChatMessage[];
};

const PROFILE_SESSION_KEY_PREFIX = 'voitity:profile-session:';

export function Profile({ profileAlias }: ProfileProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [avatarKind, setAvatarKind] = useState<'image' | 'video'>('image');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [greetingAudioState, setGreetingAudioState] = useState<GreetingAudioState>('idle');
  const [greetingAudioError, setGreetingAudioError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const audio = audioRef.current;
    let nextAvatarUrl = '';

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);
        setAudioReady(false);
        setChatId(null);
        setGreetingAudioState('idle');
        setGreetingAudioError(null);
        setIsAudioPlaying(false);

        const nextProfile = await fetchProfileByAlias(profileAlias);

        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
        const storedSession = readProfileSession(profileAlias);
        const initialMessages = [
          {
            id: crypto.randomUUID(),
            role: 'profile',
            text: `Hola, soy ${nextProfile.name}. Puedes preguntarme sobre mi experiencia, historia o proyectos.`,
          },
        ] satisfies ChatMessage[];

        setChatId(storedSession?.chatId ?? null);
        setMessages(storedSession?.messages.length ? storedSession.messages : initialMessages);

        document.title = `${nextProfile.name} | Voitity`;

        fetchAvatarMedia(nextProfile.id)
          .then((media) => {
            if (isMounted) {
              nextAvatarUrl = media.url;
              setAvatarKind(media.kind);
              setAvatarUrl(media.url);
            } else {
              URL.revokeObjectURL(media.url);
            }
          })
          .catch(() => {
            if (isMounted) {
              setAvatarKind('image');
            }
          });

        const greetingText = `Hola, un placer hablar contigo mi nombre es ${nextProfile.name}`;

        try {
          setGreetingAudioState('loading');
          const greetingAudio = await requestVoiceTest(nextProfile.id, greetingText);

          if (!isMounted || !audio) {
            return;
          }

          setAudioSource(audio, greetingAudio.audioUrl, greetingAudio.blob);
          setAudioReady(true);
          setGreetingAudioState('ready');
          setGreetingAudioError(null);
          audio.play().catch(() => {
            if (isMounted) {
              setGreetingAudioState('blocked');
            }
          });
        } catch (voiceError) {
          if (isMounted) {
            setAudioReady(false);
            setGreetingAudioState('unavailable');
            setGreetingAudioError(
              voiceError instanceof Error ? voiceError.message : 'No fue posible generar el audio inicial.',
            );
          }
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar el perfil.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;

      if (nextAvatarUrl) {
        URL.revokeObjectURL(nextAvatarUrl);
      }
    };
  }, [profileAlias]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    writeProfileSession(profileAlias, {
      chatId,
      messages,
    });
  }, [chatId, messages, profile, profileAlias]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || !draft.trim() || isSending) {
      return;
    }

    const visitorMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'visitor',
      text: draft.trim(),
    };

    setDraft('');
    setIsSending(true);
    setError(null);
    setMessages((current) => [...current, visitorMessage]);

    try {
      const response = await sendProfileMessage(profile.id, visitorMessage.text, chatId);

      if (response.chatId) {
        setChatId(response.chatId);
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'profile',
          text: response.text,
        },
      ]);

      if (response.audioUrl && audioRef.current) {
        setAudioSource(audioRef.current, response.audioUrl);
        setAudioReady(true);
        audioRef.current.play().catch(() => {
          setGreetingAudioState('blocked');
        });
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'No fue posible enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  }

  function playGreeting() {
    audioRef.current?.play().catch(() => {
      setGreetingAudioState('blocked');
    });
  }

  const greetingButtonText = getGreetingButtonText(greetingAudioState);

  return (
    <main className="profile-page">
      <audio
        ref={audioRef}
        onEnded={() => setIsAudioPlaying(false)}
        onPause={() => setIsAudioPlaying(false)}
        onPlay={() => setIsAudioPlaying(true)}
      />

      <section className="profile-shell" aria-live="polite">
        {isLoading ? (
          <div className="profile-state">Cargando perfil...</div>
        ) : null}

        {!isLoading && error && !profile ? (
          <div className="profile-state profile-state-error">{error}</div>
        ) : null}

        {profile ? (
          <>
            <aside className="profile-avatar-panel">
              <div className={isAudioPlaying ? 'profile-avatar is-speaking' : 'profile-avatar'}>
                <span className="voice-ring voice-ring-one" />
                <span className="voice-ring voice-ring-two" />
                <span className="voice-ring voice-ring-three" />

                {avatarUrl && avatarKind === 'video' ? (
                  <video autoPlay loop muted playsInline src={avatarUrl} />
                ) : avatarUrl ? (
                  <img
                    alt={profile.name}
                    src={avatarUrl}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}

                <div className="avatar-fallback" aria-hidden="true">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              </div>

              <button
                className="profile-audio-button"
                disabled={!audioReady || greetingAudioState === 'loading'}
                type="button"
                onClick={playGreeting}
              >
                {greetingButtonText}
              </button>
              {greetingAudioState === 'blocked' ? (
                <p className="profile-audio-note">Toca reproducir saludo para activar el audio.</p>
              ) : null}
              {greetingAudioState === 'unavailable' ? (
                <p className="profile-audio-note profile-audio-note-error">
                  {greetingAudioError
                    ? `Audio inicial no disponible: ${greetingAudioError}`
                    : 'Audio inicial no disponible para este perfil.'}
                </p>
              ) : null}
            </aside>

            <section className="profile-chat-panel">
              <header className="profile-header-card">
                <div>
                  <p className="profile-kicker">Perfil interactivo</p>
                  <h1>{profile.name}</h1>
                  <p>{profile.headline}</p>
                </div>
                <a className="profile-home-link" href="/">
                  Voitity
                </a>
              </header>

              <article className="profile-bio-card">
                <p>{profile.description}</p>
                {profile.details.length ? (
                  <div className="profile-tags">
                    {profile.details.map((detail) => (
                      <span key={detail}>{detail}</span>
                    ))}
                  </div>
                ) : null}
              </article>

              <div className="profile-messages" aria-label="Conversación">
                {messages.map((message) => (
                  <div className={`profile-message ${message.role}`} key={message.id}>
                    {message.text}
                  </div>
                ))}
                {isSending ? <div className="profile-message profile">Escribiendo respuesta...</div> : null}
              </div>

              {error && profile ? <p className="profile-inline-error">{error}</p> : null}

              <form className="profile-message-form" onSubmit={handleSubmit}>
                <input
                  aria-label="Mensaje"
                  placeholder={`Escríbele a ${profile.name}`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button disabled={isSending || !draft.trim()} type="submit">
                  Enviar
                </button>
              </form>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

function getGreetingButtonText(state: GreetingAudioState) {
  if (state === 'loading') {
    return 'Generando saludo...';
  }

  if (state === 'unavailable') {
    return 'Saludo no disponible';
  }

  return 'Reproducir saludo';
}

function setAudioSource(audio: HTMLAudioElement, audioUrl?: string, blob?: Blob) {
  if (audio.src.startsWith('blob:')) {
    URL.revokeObjectURL(audio.src);
  }

  if (blob) {
    audio.src = URL.createObjectURL(blob);
    return;
  }

  if (audioUrl) {
    audio.src = audioUrl;
  }
}

function readProfileSession(profileAlias: string): ProfileSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.sessionStorage.getItem(getProfileSessionKey(profileAlias));

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<ProfileSession>;
    const messages = normalizeStoredMessages(parsedValue.messages);

    return {
      chatId: typeof parsedValue.chatId === 'string' && parsedValue.chatId ? parsedValue.chatId : null,
      messages,
    };
  } catch {
    return null;
  }
}

function writeProfileSession(profileAlias: string, session: ProfileSession) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getProfileSessionKey(profileAlias),
      JSON.stringify({
        chatId: session.chatId,
        messages: session.messages,
      }),
    );
  } catch {
    // sessionStorage can be unavailable in private or restricted browser contexts.
  }
}

function getProfileSessionKey(profileAlias: string) {
  return `${PROFILE_SESSION_KEY_PREFIX}${encodeURIComponent(profileAlias)}`;
}

function normalizeStoredMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((message) => {
    if (!isStoredMessage(message)) {
      return [];
    }

    return [
      {
        id: message.id,
        role: message.role,
        text: message.text,
      },
    ];
  });
}

function isStoredMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  const hasValidRole = message.role === 'visitor' || message.role === 'profile';

  return typeof message.id === 'string' && hasValidRole && typeof message.text === 'string';
}
