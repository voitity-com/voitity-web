import { FormEvent, useEffect, useRef, useState } from 'react';

import {
  ChatMessage,
  fetchAvatarMedia,
  fetchProfileChatMessages,
  fetchProfileByAlias,
  ProfileApiError,
  ProfileData,
  requestVoiceTest,
  sendProfileAudioMessage,
  sendProfileMessage,
} from '../lib/profile-api';

type ProfileProps = {
  onProfileNotFound: () => void;
  profileAlias: string;
};

type GreetingAudioState = 'idle' | 'loading' | 'ready' | 'blocked' | 'unavailable';
type RecordingState = 'idle' | 'preparing' | 'recording' | 'preview';

type AudioDraft = {
  blob: Blob;
  duration: number;
  url: string;
};

type ProfileSession = {
  chatId: string | null;
  messages: ChatMessage[];
};

const PROFILE_SESSION_KEY_PREFIX = 'bigmelo:profile-session:v2:';
const WAVEFORM_BAR_COUNT = 22;

export function Profile({ onProfileNotFound, profileAlias }: ProfileProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const audioDraftRef = useRef<AudioDraft | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingCanceledRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const isComponentMountedRef = useRef(true);
  const messageAudioBlobUrlsRef = useRef<Set<string>>(new Set());
  const messageListRef = useRef<HTMLDivElement | null>(null);
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
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greetingAudioState, setGreetingAudioState] = useState<GreetingAudioState>('idle');
  const [greetingAudioError, setGreetingAudioError] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDraft, setAudioDraft] = useState<AudioDraft | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewDurationSeconds, setPreviewDurationSeconds] = useState(0);
  const [previewPlaybackSeconds, setPreviewPlaybackSeconds] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const audio = audioRef.current;
    let nextAvatarUrl = '';

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);
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
            text: `Hola, soy ${nextProfile.name}. Pregúntame sobre mi trabajo, mis proyectos o lo que quieres conocer de mí.`,
          },
        ] satisfies ChatMessage[];

        setChatId(storedSession?.chatId ?? null);
        shouldScrollToBottomRef.current = true;
        setMessages(storedSession?.messages.length ? storedSession.messages : initialMessages);
        setIsLoading(false);

        document.title = `${nextProfile.name} | Bigmelo`;

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
          if (greetingAudio.audioUrl) {
            setMessages((current) =>
              current.map((message, index) =>
                index === 0 && message.role === 'profile'
                  ? { ...message, audioUrl: greetingAudio.audioUrl }
                  : message,
              ),
            );
          }
          setGreetingAudioState('ready');
          setGreetingAudioError(null);
          audio.play().catch(() => {
            if (isMounted) {
              setGreetingAudioState('blocked');
            }
          });
        } catch (voiceError) {
          if (isMounted) {
            setGreetingAudioState('unavailable');
            setGreetingAudioError(
              voiceError instanceof Error ? voiceError.message : 'No fue posible generar el audio inicial.',
            );
          }
        }
      } catch (loadError) {
        if (loadError instanceof ProfileApiError && loadError.status === 404) {
          onProfileNotFound();
          return;
        }

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
  }, [onProfileNotFound, profileAlias]);

  useEffect(() => {
    isComponentMountedRef.current = true;

    return () => {
      isComponentMountedRef.current = false;
      clearRecordingTimer();
      stopRecordingStream();

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        recordingCanceledRef.current = true;
        mediaRecorderRef.current.stop();
      }

      if (audioDraftRef.current?.url.startsWith('blob:')) {
        URL.revokeObjectURL(audioDraftRef.current.url);
      }

      messageAudioBlobUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      messageAudioBlobUrlsRef.current.clear();
    };
  }, []);

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
      scrollToConversationBottom();
    });
    const scrollTimeout = window.setTimeout(() => {
      scrollToConversationBottom();
    }, 120);

    shouldScrollToBottomRef.current = false;

    return () => {
      window.clearTimeout(scrollTimeout);
    };
  }, [isSending, messages.length, profile?.id]);

  useEffect(() => {
    function updateScrollButton() {
      setShowScrollToBottom(getScrollDistanceFromBottom() > 96);
    }

    updateScrollButton();
    window.addEventListener('scroll', updateScrollButton, { passive: true });
    window.addEventListener('resize', updateScrollButton);

    return () => {
      window.removeEventListener('scroll', updateScrollButton);
      window.removeEventListener('resize', updateScrollButton);
    };
  }, [isSending, messages.length, profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (audioDraft) {
      await sendAudioDraft();
      return;
    }

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
          audioUrl: response.audioUrl,
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          role: 'profile',
          text: response.text,
        },
      ]);

      if (response.audioUrl && audioRef.current) {
        setAudioSource(audioRef.current, response.audioUrl);
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

  async function startAudioRecording() {
    if (isSending || recordingState !== 'idle') {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Tu navegador no permite grabar audio desde esta pantalla.');
      return;
    }

    const recordingSessionId = recordingSessionRef.current + 1;
    recordingSessionRef.current = recordingSessionId;

    try {
      clearAudioDraft();
      setError(null);
      setIsPreviewPlaying(false);
      setRecordingSeconds(0);
      setRecordingState('preparing');
      recordingCanceledRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (
        recordingCanceledRef.current ||
        recordingSessionId !== recordingSessionRef.current ||
        !isComponentMountedRef.current
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const mimeType = getPreferredRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = 0;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('start', () => {
        if (
          recordingCanceledRef.current ||
          recordingSessionId !== recordingSessionRef.current ||
          !isComponentMountedRef.current
        ) {
          return;
        }

        recordingStartedAtRef.current = Date.now();
        setRecordingSeconds(0);
        setRecordingState('recording');
        clearRecordingTimer();
        recordingTimerRef.current = window.setInterval(() => {
          setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)));
        }, 250);
      });

      recorder.addEventListener('stop', () => {
        clearRecordingTimer();
        stopRecordingStream();

        if (
          recordingCanceledRef.current ||
          recordingSessionId !== recordingSessionRef.current ||
          !isComponentMountedRef.current
        ) {
          recordingChunksRef.current = [];
          setRecordingState('idle');
          setRecordingSeconds(0);
          return;
        }

        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type: recordedMimeType });
        const startedAt = recordingStartedAtRef.current || Date.now();
        const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const url = URL.createObjectURL(blob);

        recordingChunksRef.current = [];
        setNextAudioDraft({ blob, duration, url });
        setRecordingSeconds(duration);
        setRecordingState('preview');
      });

      recorder.start();
    } catch (recordingError) {
      clearRecordingTimer();
      stopRecordingStream();
      setRecordingState('idle');
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : 'No fue posible acceder al micrófono.',
      );
    }
  }

  function stopAudioRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    try {
      recorder.requestData();
    } catch {
      // Some browsers can transition the recorder state between the guard and this call.
    }
    recorder.stop();
  }

  function cancelAudioRecording() {
    recordingCanceledRef.current = true;
    recordingSessionRef.current += 1;
    stopAudioRecording();
    clearRecordingTimer();
    stopRecordingStream();
    setRecordingState('idle');
    setRecordingSeconds(0);
  }

  function clearAudioDraft() {
    const currentDraft = audioDraftRef.current;

    if (currentDraft?.url.startsWith('blob:')) {
      URL.revokeObjectURL(currentDraft.url);
    }

    setNextAudioDraft(null);
    setRecordingState('idle');
    setRecordingSeconds(0);
    setIsPreviewPlaying(false);
    setPreviewDurationSeconds(0);
    setPreviewPlaybackSeconds(0);

    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      recordingAudioRef.current.removeAttribute('src');
      recordingAudioRef.current.load();
    }
  }

  async function playAudioDraft() {
    if (!audioDraft || !recordingAudioRef.current) {
      return;
    }

    const audio = recordingAudioRef.current;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    if (audio.src !== audioDraft.url) {
      audio.src = audioDraft.url;
    }

    const duration = audioDraft.duration;

    if (duration > 0 && audio.currentTime >= duration) {
      audio.currentTime = 0;
    }

    updatePreviewPlayback(audio);
    audio.play().catch(() => {
      setIsPreviewPlaying(false);
    });
  }

  async function sendAudioDraft() {
    if (!profile || !audioDraft || isSending) {
      return;
    }

    const pendingMessageId = crypto.randomUUID();
    const localAudioUrl = audioDraft.url;
    const localAudioBlob = audioDraft.blob;
    const localDuration = audioDraft.duration;
    const pendingMessage: ChatMessage = {
      audioUrl: localAudioUrl,
      createdAt: new Date().toISOString(),
      id: pendingMessageId,
      role: 'visitor',
      text: 'Procesando audio...',
    };

    setNextAudioDraft(null);
    setRecordingState('idle');
    setRecordingSeconds(0);
    setIsPreviewPlaying(false);
    setPreviewDurationSeconds(0);
    setPreviewPlaybackSeconds(0);
    setIsSending(true);
    setError(null);
    shouldScrollToBottomRef.current = true;
    messageAudioBlobUrlsRef.current.add(localAudioUrl);
    setMessages((current) => [...current, pendingMessage]);

    try {
      const response = await sendProfileAudioMessage(profile.id, localAudioBlob, chatId);
      const nextChatId = response.chatId ?? chatId;

      if (nextChatId) {
        setChatId(nextChatId);
      }

      const resolvedVisitorMessage = response.requestText
        ? {
            ...pendingMessage,
            audioUrl: response.requestAudioUrl ?? localAudioUrl,
            id: response.requestMessageId ?? pendingMessageId,
            text: response.requestText,
          }
        : nextChatId
        ? await resolveSentAudioMessage(profile.id, nextChatId, pendingMessageId, localAudioUrl, localDuration)
        : {
            ...pendingMessage,
            text: 'Mensaje de audio enviado.',
          };

      if (resolvedVisitorMessage.audioUrl !== localAudioUrl && localAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localAudioUrl);
        messageAudioBlobUrlsRef.current.delete(localAudioUrl);
      }

      shouldScrollToBottomRef.current = true;
      setMessages((current) => [
        ...current.map((message) => (message.id === pendingMessageId ? resolvedVisitorMessage : message)),
        {
          audioUrl: response.audioUrl,
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          role: 'profile',
          text: response.text,
        },
      ]);

      if (response.audioUrl && audioRef.current) {
        setAudioSource(audioRef.current, response.audioUrl);
        audioRef.current.play().catch(() => {
          setGreetingAudioState('blocked');
        });
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'No fue posible enviar el audio.');
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessageId
            ? { ...message, text: 'No fue posible procesar este audio.' }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  async function resolveSentAudioMessage(
    profileId: string,
    nextChatId: string,
    pendingMessageId: string,
    localAudioUrl: string,
    localDuration: number,
  ): Promise<ChatMessage> {
    try {
      const chatMessages = await fetchProfileChatMessages(profileId, nextChatId);
      const latestAudioVisitorMessage = [...chatMessages]
        .reverse()
        .find((message) => message.role === 'visitor' && message.audioUrl);

      if (latestAudioVisitorMessage) {
        return {
          ...latestAudioVisitorMessage,
          id: pendingMessageId,
        };
      }
    } catch {
      // The answer was already created; keep the local audio bubble if history lookup fails.
    }

    return {
      audioUrl: localAudioUrl,
      createdAt: new Date().toISOString(),
      id: pendingMessageId,
      role: 'visitor',
      text: `Mensaje de audio (${formatRecordingDuration(localDuration)})`,
    };
  }

  function playMessageAudio(message: ChatMessage) {
    if (!message.audioUrl || !audioRef.current) {
      return;
    }

    setAudioSource(audioRef.current, message.audioUrl);
    audioRef.current.play().catch(() => {
      setGreetingAudioState('blocked');
    });
  }

  function scrollToConversationBottom() {
    setShowScrollToBottom(false);
    scrollMessageListToBottom();
    window.requestAnimationFrame(() => {
      scrollMessageListToBottom();
      conversationEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    });
  }

  function scrollMessageListToBottom() {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  }

  function setNextAudioDraft(nextDraft: AudioDraft | null) {
    audioDraftRef.current = nextDraft;
    setAudioDraft(nextDraft);
    setPreviewPlaybackSeconds(0);
    setPreviewDurationSeconds(nextDraft?.duration ?? 0);
  }

  function updatePreviewPlayback(audio: HTMLAudioElement | null = recordingAudioRef.current) {
    const currentDraft = audioDraftRef.current;

    if (!currentDraft || !audio) {
      setPreviewPlaybackSeconds(0);
      setPreviewDurationSeconds(0);
      return;
    }

    const duration = currentDraft.duration;
    const currentTime = Number.isFinite(audio.currentTime) ? Math.min(audio.currentTime, duration) : 0;

    setPreviewDurationSeconds(duration);
    setPreviewPlaybackSeconds(currentTime);
  }

  function resetPreviewPlayback(audio: HTMLAudioElement | null = recordingAudioRef.current) {
    if (audio) {
      audio.currentTime = 0;
    }

    setPreviewPlaybackSeconds(0);
    setPreviewDurationSeconds(audioDraftRef.current?.duration ?? 0);
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  const previewDuration = audioDraft ? previewDurationSeconds || audioDraft.duration : 0;
  const previewProgress = previewDuration > 0 ? Math.min(1, previewPlaybackSeconds / previewDuration) : 0;
  const previewRemainingSeconds = audioDraft
    ? Math.max(0, Math.ceil(previewDuration - previewPlaybackSeconds))
    : 0;

  return (
    <main className="profile-page">
      <audio
        ref={audioRef}
        onEnded={() => setIsAudioPlaying(false)}
        onPause={() => setIsAudioPlaying(false)}
        onPlay={() => setIsAudioPlaying(true)}
      />
      <audio
        ref={recordingAudioRef}
        onEnded={(event) => {
          resetPreviewPlayback(event.currentTarget);
          setIsPreviewPlaying(false);
        }}
        onLoadedMetadata={(event) => updatePreviewPlayback(event.currentTarget)}
        onPause={(event) => {
          updatePreviewPlayback(event.currentTarget);
          setIsPreviewPlaying(false);
        }}
        onPlay={(event) => {
          updatePreviewPlayback(event.currentTarget);
          setIsPreviewPlaying(true);
        }}
        onTimeUpdate={(event) => updatePreviewPlayback(event.currentTarget)}
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
              {profile.networks.length ? (
                <nav aria-label="Redes sociales" className="profile-social-links">
                  {profile.networks.map((network) => (
                    <a
                      aria-label={network.name}
                      className="profile-social-link"
                      href={network.url}
                      key={network.key}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={network.name}
                    >
                      {network.iconUrl ? (
                        <img alt={network.name} src={network.iconUrl} title={network.name} />
                      ) : (
                        <span aria-hidden="true">{getNetworkInitial(network.name)}</span>
                      )}
                    </a>
                  ))}
                </nav>
              ) : null}
            </header>

            <section className="profile-conversation" aria-label="Conversación">
              <div ref={messageListRef} className="profile-message-list">
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
                            aria-label="Reproducir audio del mensaje"
                            className="profile-mini-play-button"
                            disabled={!message.audioUrl}
                            title="Reproducir audio del mensaje"
                            type="button"
                            onClick={() => playMessageAudio(message)}
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
                        <div className={message.audioUrl ? 'profile-message-copy has-audio' : 'profile-message-copy'}>
                          {message.audioUrl ? (
                            <button
                              aria-label="Reproducir audio del mensaje"
                              className="profile-message-play-button"
                              title="Reproducir audio del mensaje"
                              type="button"
                              onClick={() => playMessageAudio(message)}
                            >
                              <PlayIcon />
                            </button>
                          ) : null}
                          <div className="profile-message-text">
                            <p>{message.text}</p>
                            <time>{formatMessageTime(message.createdAt)}</time>
                          </div>
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
                </div>
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

              <form
                className={recordingState !== 'idle' || audioDraft ? 'profile-message-form is-voice-mode' : 'profile-message-form'}
                onSubmit={handleSubmit}
              >
                {recordingState === 'preparing' ? (
                  <div className="profile-voice-recorder preparing" aria-live="polite">
                    <span className="profile-recording-dot is-waiting" />
                    <span className="profile-recording-status">Preparando...</span>
                    <VoiceWaveform />
                  </div>
                ) : recordingState === 'recording' ? (
                  <div className="profile-voice-recorder" aria-live="polite">
                    <span className="profile-recording-dot" />
                    <span className="profile-recording-time">{formatRecordingDuration(recordingSeconds)}</span>
                    <VoiceWaveform isRecording />
                  </div>
                ) : audioDraft ? (
                  <div className="profile-voice-recorder preview" aria-live="polite">
                    <button
                      aria-label={isPreviewPlaying ? 'Pausar audio grabado' : 'Reproducir audio grabado'}
                      className="profile-voice-play-button"
                      title={isPreviewPlaying ? 'Pausar audio grabado' : 'Reproducir audio grabado'}
                      type="button"
                      onClick={playAudioDraft}
                    >
                      {isPreviewPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <VoiceWaveform isPlaying={isPreviewPlaying} progress={previewProgress} />
                    <span className="profile-recording-time">{formatRecordingDuration(previewRemainingSeconds)}</span>
                  </div>
                ) : (
                  <input
                    aria-label="Mensaje"
                    disabled={isSending}
                    placeholder="Escribe tu mensaje..."
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                )}

                {recordingState === 'preparing' ? (
                  <>
                    <button
                      aria-label="Cancelar grabación"
                      className="profile-icon-button"
                      disabled={isSending}
                      title="Cancelar grabación"
                      type="button"
                      onClick={cancelAudioRecording}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      aria-label="Detener grabación"
                      className="profile-icon-button recording-stop"
                      disabled
                      title="Detener grabación"
                      type="button"
                    >
                      <StopIcon />
                    </button>
                  </>
                ) : recordingState === 'recording' ? (
                  <>
                    <button
                      aria-label="Cancelar grabación"
                      className="profile-icon-button"
                      disabled={isSending}
                      title="Cancelar grabación"
                      type="button"
                      onClick={cancelAudioRecording}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      aria-label="Detener grabación"
                      className="profile-icon-button recording-stop"
                      disabled={isSending}
                      title="Detener grabación"
                      type="button"
                      onClick={stopAudioRecording}
                    >
                      <StopIcon />
                    </button>
                  </>
                ) : audioDraft ? (
                  <>
                    <button
                      aria-label="Descartar audio"
                      className="profile-icon-button"
                      disabled={isSending}
                      title="Descartar audio"
                      type="button"
                      onClick={clearAudioDraft}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      aria-label="Enviar audio"
                      className="profile-icon-button"
                      disabled={isSending}
                      title="Enviar audio"
                      type="button"
                      onClick={sendAudioDraft}
                    >
                      <SendIcon />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      aria-label="Grabar mensaje"
                      className="profile-icon-button"
                      disabled={isSending}
                      title="Grabar mensaje"
                      type="button"
                      onClick={startAudioRecording}
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
                  </>
                )}
              </form>

              <footer className="profile-footer-note">
                © 2026 <a href="/">bigmelo.com</a> All rights Reserved.
              </footer>
            </section>

            {showScrollToBottom ? (
              <button
                aria-label="Ir al final de la conversación"
                className="profile-scroll-bottom-button"
                title="Ir al final de la conversación"
                type="button"
                onClick={scrollToConversationBottom}
              >
                <ChevronDownIcon />
              </button>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
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

function formatRecordingDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getNetworkInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function getPreferredRecordingMimeType() {
  const supportedTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  return supportedTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
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

function getScrollDistanceFromBottom() {
  const documentElement = document.documentElement;
  const scrollTop = window.scrollY || documentElement.scrollTop;
  const viewportHeight = window.innerHeight || documentElement.clientHeight;

  return documentElement.scrollHeight - scrollTop - viewportHeight;
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
        ...(message.audioUrl ? { audioUrl: message.audioUrl } : {}),
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

function VoiceWaveform({
  isPlaying = false,
  isRecording = false,
  progress = 0,
}: {
  isPlaying?: boolean;
  isRecording?: boolean;
  progress?: number;
}) {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const activeBars = safeProgress > 0 ? Math.ceil(safeProgress * WAVEFORM_BAR_COUNT) : isPlaying ? 1 : 0;
  const currentBar = activeBars > 0 ? activeBars - 1 : -1;
  const className = [
    'profile-voice-waveform',
    isRecording ? 'is-recording' : '',
    isPlaying ? 'is-playing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} aria-hidden="true">
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
        <span
          className={[
            index < activeBars ? 'is-active' : '',
            isPlaying && index === currentBar ? 'is-current' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          key={index}
        />
      ))}
    </span>
  );
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

function PauseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M8 5.5h3v13H8v-13ZM13 5.5h3v13h-3v-13Z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M7 7h10v10H7V7Z" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.5 8.5v9M12 8.5v9M15.5 8.5v9M5.5 6h13M9 6l.8-2h4.4l.8 2M7 6l.8 15h8.4L17 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}
