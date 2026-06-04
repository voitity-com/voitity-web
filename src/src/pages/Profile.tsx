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
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(false);
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
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
            role: 'profile',
            text: `Hola, soy ${nextProfile.name}. Puedes preguntarme sobre mi experiencia, historia o proyectos.`,
          },
        ] satisfies ChatMessage[];

        setChatId(storedSession?.chatId ?? null);
        setMessages(storedSession?.messages.length ? storedSession.messages : initialMessages);
        setIsLoading(false);

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

  useEffect(() => {
    if (!shouldScrollToBottomRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      conversationEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    });

    shouldScrollToBottomRef.current = false;
  }, [isSending, messages.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || !draft.trim() || isSending) {
      return;
    }

    const visitorMessage: ChatMessage = {
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      role: 'visitor',
      text: draft.trim(),
    };

    setDraft('');
    setIsSending(true);
    setError(null);
    shouldScrollToBottomRef.current = true;
    setMessages((current) => [...current, visitorMessage]);

    try {
      const response = await sendProfileMessage(profile.id, visitorMessage.text, chatId);

      if (response.chatId) {
        setChatId(response.chatId);
      }

      shouldScrollToBottomRef.current = true;
      setMessages((current) => [
        ...current,
        {
          createdAt: new Date().toISOString(),
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
        {isLoading && !profile ? (
          <div className="profile-state">Cargando perfil...</div>
        ) : null}

        {!isLoading && error && !profile ? (
          <div className="profile-state profile-state-error">{error}</div>
        ) : null}

        {profile ? (
          <>
            <header className="profile-title">
              <h1>{profile.name}</h1>
            </header>

            <section className="profile-conversation" aria-label="Conversación">
              <div className="profile-message-list">
                {messages.map((message) => (
                  <article className={`profile-conversation-row ${message.role}`} key={message.id}>
                    {message.role === 'profile' ? (
                      <div className="profile-thread-message profile">
                        <div className="profile-mini-avatar">
                          {avatarUrl && avatarKind === 'video' ? (
                            <video loop muted playsInline src={avatarUrl} />
                          ) : avatarUrl ? (
                            <img alt="" src={avatarUrl} />
                          ) : null}
                          <span aria-hidden="true">{profile.name.charAt(0).toUpperCase()}</span>
                          <button
                            aria-label={greetingButtonText}
                            className="profile-mini-play-button"
                            disabled={!audioReady || greetingAudioState === 'loading'}
                            title={greetingButtonText}
                            type="button"
                            onClick={playGreeting}
                          >
                            <PlayIcon />
                          </button>
                        </div>
                        <div className="profile-message-copy">
                          <p>{message.text}</p>
                          <time>{formatMessageTime(message.createdAt)}</time>
                        </div>
                      </div>
                    ) : (
                      <div className="profile-thread-message visitor">
                        <div className="profile-message-copy">
                          <p>{message.text}</p>
                          <time>{formatMessageTime(message.createdAt)}</time>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
                {isSending ? (
                  <article className="profile-conversation-row profile">
                    <div className="profile-thread-message profile">
                      <div className="profile-mini-avatar">
                        {avatarUrl && avatarKind === 'video' ? (
                          <video loop muted playsInline src={avatarUrl} />
                        ) : avatarUrl ? (
                          <img alt="" src={avatarUrl} />
                        ) : null}
                        <span aria-hidden="true">{profile.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="profile-message-copy">
                        <p>Escribiendo respuesta...</p>
                      </div>
                    </div>
                  </article>
                ) : null}
                <div ref={conversationEndRef} className="profile-scroll-anchor" />
              </div>

              <section className="profile-avatar-stage" aria-label={profile.name}>
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

                  <button
                    aria-label={greetingButtonText}
                    className="profile-audio-button"
                    disabled={!audioReady || greetingAudioState === 'loading'}
                    title={greetingButtonText}
                    type="button"
                    onClick={playGreeting}
                  >
                    <PlayIcon />
                  </button>
                </div>

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
              </section>
            </section>

            <section className="profile-composer-row">
              {error && profile ? <p className="profile-inline-error">{error}</p> : null}

              <form className="profile-message-form" onSubmit={handleSubmit}>
                <input
                  aria-label="Mensaje"
                  placeholder="Escribe tu mensaje..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button
                  aria-label="Grabar mensaje"
                  className="profile-icon-button"
                  title="Grabar mensaje"
                  type="button"
                >
                  <MicrophoneIcon />
                </button>
                <button
                  aria-label="Enviar mensaje"
                  className="profile-icon-button"
                  disabled={isSending || !draft.trim()}
                  title="Enviar mensaje"
                  type="submit"
                >
                  <SendIcon />
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

function formatMessageTime(value?: string) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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
        ...(message.createdAt ? { createdAt: message.createdAt } : {}),
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

function PlayIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M8.5 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 14.25c1.85 0 3.25-1.43 3.25-3.3V6.3C15.25 4.43 13.85 3 12 3S8.75 4.43 8.75 6.3v4.65c0 1.87 1.4 3.3 3.25 3.3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M5.75 10.75A6.24 6.24 0 0 0 12 17a6.24 6.24 0 0 0 6.25-6.25M12 17v4M9.25 21h5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 12.25 15.5-7.5-3.15 15.1-4.3-6.1-5.95 3.55L4 12.25Zm8.05 1.5 3.95-4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}
