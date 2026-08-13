import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { trackAnalyticsEvent } from "../lib/google-analytics";
import { profileDescription, setPageMetadata } from "../lib/page-metadata";
import {
  ChatMessage,
  ChatMessageMedia,
  ChatMessageProduct,
  ChatMessageSocialLink,
  fetchAvatarMedia,
  fetchProfileByAlias,
  fetchProfileMessagingCapabilities,
  ProfileApiError,
  ProfileData,
  ProfileFeatureSetting,
  ProfileMessagingCapabilities,
  recordProfileInteraction,
  sendProfileAudioMessage,
  sendProfileMessage,
} from "../lib/profile-api";

type ProfileProps = {
  embedded?: boolean;
  onProfileNotFound: () => void;
  profileAlias: string;
};

type GreetingAudioState =
  "idle" | "loading" | "ready" | "blocked" | "unavailable";
type RecordingState = "idle" | "preparing" | "recording" | "preview";
type ProfileLocale = ProfileData["locale"];

type AudioDraft = {
  blob: Blob;
  duration: number;
  url: string;
};

type ProfileSession = {
  chatId: string | null;
  chatToken: string | null;
  messages: ChatMessage[];
};

type PulseMedia = {
  mediaKey: string;
  messageId: string;
};

const PROFILE_SESSION_KEY_PREFIX = "bigmelo:profile-session:v3:";
const ADULT_CONTENT_SESSION_KEY_PREFIX = "bigmelo:adult-content:v1:";
const AVATAR_VIDEO_LOOP_DELAY_MS = 5000;
const MEDIA_MODAL_CLOSE_TRANSITION_MS = 460;
const MEDIA_PULSE_DURATION_MS = 2000;
const WAVEFORM_BAR_COUNT = 22;
const DEFAULT_MESSAGING_CAPABILITIES: ProfileMessagingCapabilities = {
  audioMessagesEnabled: true,
  audioMaxDurationSeconds: 30,
  reason: null,
  textMessagesEnabled: true,
};

const profileCopy = {
  en: {
    audioInitialUnavailable: "Initial audio is not available for this profile.",
    adultContentBody:
      "This promotional media is marked for adults. Confirm that you are at least 18 years old to continue.",
    adultContentCancel: "Cancel",
    adultContentConfirm: "I am 18 or older",
    adultContentTitle: "Adult content",
    audioMessage: "Play message audio",
    audioLimitReached:
      "This profile reached its monthly incoming audio limit. You can continue by text.",
    audioMaxDuration: (seconds: string) =>
      `Audio messages can be up to ${seconds} seconds long.`,
    audioMuted: "Audio muted",
    audioOn: "Audio on",
    cancelRecording: "Cancel recording",
    chatLimitReached:
      "This profile reached its monthly visitor message limit.",
    defaultInitial: (name: string) =>
      `Hi, I am ${name}. Ask me about my work, my projects, or anything you want to know about me.`,
    discardAudio: "Discard audio",
    footerRights: "All rights Reserved.",
    goToBottom: "Go to the end of the conversation",
    goToChannel: "Go to channel",
    loading: "Loading profile...",
    messagePlaceholder: "Write your message...",
    modalClose: "Close media",
    modalTitle: "Media detail",
    openPhoto: "Open photo",
    openVideo: "Play video",
    pauseRecordedAudio: "Pause recorded audio",
    preparing: "Preparing...",
    playRecordedAudio: "Play recorded audio",
    recordingNotAvailable:
      "Your browser does not allow audio recording from this screen.",
    subscriptionInactive:
      "This profile is not available for new messages right now.",
    sendAudio: "Send audio",
    sendFailed: "The message could not be sent.",
    sendMessage: "Send message",
    socialNav: "Social networks",
    startRecording: "Record message",
    stopRecording: "Stop recording",
    typing: "Writing response...",
    voiceDisabled: "Profile voice is disabled",
    viewOnProvider: (provider: string) => `View on ${provider}`,
    viewOnYouTube: "View on YouTube",
    viewVideo: "View video",
    viewProduct: "View product",
    contactOnTelegram: "Contact on Telegram",
    contactOnWhatsapp: "Contact on WhatsApp",
  },
  es: {
    audioInitialUnavailable: "Audio inicial no disponible para este perfil.",
    adultContentBody:
      "Este contenido promocional está marcado para adultos. Confirma que tienes al menos 18 años para continuar.",
    adultContentCancel: "Cancelar",
    adultContentConfirm: "Soy mayor de 18 años",
    adultContentTitle: "Contenido para adultos",
    audioMessage: "Reproducir audio del mensaje",
    audioLimitReached:
      "Este perfil alcanzó el límite mensual de audios entrantes. Puedes continuar por texto.",
    audioMaxDuration: (seconds: string) =>
      `Los mensajes de audio pueden durar máximo ${seconds} segundos.`,
    audioMuted: "Audio silenciado",
    audioOn: "Audio activado",
    cancelRecording: "Cancelar grabación",
    chatLimitReached:
      "Este perfil alcanzó el límite mensual de mensajes de visitantes.",
    defaultInitial: (name: string) =>
      `Hola, soy ${name}. Pregúntame sobre mi trabajo, mis proyectos o lo que quieres conocer de mí.`,
    discardAudio: "Descartar audio",
    footerRights: "Todos los derechos reservados.",
    goToBottom: "Ir al final de la conversación",
    goToChannel: "Ir al canal",
    loading: "Cargando perfil...",
    messagePlaceholder: "Escribe tu mensaje...",
    modalClose: "Cerrar contenido",
    modalTitle: "Detalle del contenido",
    openPhoto: "Abrir foto",
    openVideo: "Reproducir video",
    pauseRecordedAudio: "Pausar audio grabado",
    preparing: "Preparando...",
    playRecordedAudio: "Reproducir audio grabado",
    recordingNotAvailable:
      "Tu navegador no permite grabar audio desde esta pantalla.",
    subscriptionInactive:
      "Este perfil no está disponible para nuevos mensajes en este momento.",
    sendAudio: "Enviar audio",
    sendFailed: "No fue posible enviar el mensaje.",
    sendMessage: "Enviar mensaje",
    socialNav: "Redes sociales",
    startRecording: "Grabar mensaje",
    stopRecording: "Detener grabación",
    typing: "Escribiendo respuesta...",
    voiceDisabled: "La voz del perfil está deshabilitada",
    viewOnProvider: (provider: string) => `Ver en ${provider}`,
    viewOnYouTube: "Ver en YouTube",
    viewVideo: "Ver video",
    viewProduct: "Ver producto",
    contactOnTelegram: "Contactar por Telegram",
    contactOnWhatsapp: "Contactar por WhatsApp",
  },
} satisfies Record<
  ProfileLocale,
  Record<string, string | ((value: string) => string)>
>;

function getProfileCopy(locale: ProfileLocale) {
  return profileCopy[locale] as typeof profileCopy.es;
}

function ProfileSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div aria-busy="true" className="profile-skeleton" role="status">
      <span className="profile-skeleton-status">{loadingLabel}</span>

      <div aria-hidden="true" className="profile-skeleton-visual">
        <header className="profile-skeleton-header">
          <span className="profile-skeleton-shape profile-skeleton-name" />
          <span className="profile-skeleton-shape profile-skeleton-alias" />
          <div className="profile-skeleton-socials">
            <span className="profile-skeleton-shape" />
            <span className="profile-skeleton-shape" />
            <span className="profile-skeleton-shape" />
          </div>
        </header>

        <div className="profile-skeleton-body">
          <div className="profile-skeleton-message is-profile">
            <span className="profile-skeleton-shape profile-skeleton-mini-avatar" />
            <span className="profile-skeleton-bubble">
              <span className="profile-skeleton-shape is-long" />
              <span className="profile-skeleton-shape is-medium" />
              <span className="profile-skeleton-shape is-short" />
            </span>
          </div>

          <span className="profile-skeleton-shape profile-skeleton-avatar" />

          <div className="profile-skeleton-message is-visitor">
            <span className="profile-skeleton-bubble">
              <span className="profile-skeleton-shape is-medium" />
              <span className="profile-skeleton-shape is-short" />
            </span>
          </div>
        </div>

        <div className="profile-skeleton-composer">
          <span className="profile-skeleton-shape profile-skeleton-input" />
          <span className="profile-skeleton-shape profile-skeleton-button" />
          <span className="profile-skeleton-shape profile-skeleton-button" />
          <span className="profile-skeleton-shape profile-skeleton-footer" />
        </div>
      </div>
    </div>
  );
}

function trackProfileInteraction(
  profileId: string,
  interaction: Parameters<typeof recordProfileInteraction>[1],
): void {
  recordProfileInteraction(profileId, interaction).catch(() => {
    // Analytics must never block the visitor's navigation or chat interaction.
  });
}

function getMessagingUnavailableMessage(
  capabilities: ProfileMessagingCapabilities,
  copy: ReturnType<typeof getProfileCopy>,
): string {
  if (
    capabilities.textMessagesEnabled &&
    !capabilities.audioMessagesEnabled
  ) {
    return copy.audioLimitReached;
  }

  if (capabilities.reason === "chat_message_limit_reached") {
    return copy.chatLimitReached;
  }

  return copy.subscriptionInactive;
}

export function Profile({ embedded = false, onProfileNotFound, profileAlias }: ProfileProps) {
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
  const hasTrackedChatStartRef = useRef(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatToken, setChatToken] = useState<string | null>(null);
  const [avatarKind, setAvatarKind] = useState<"image" | "video">("image");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greetingAudioState, setGreetingAudioState] =
    useState<GreetingAudioState>("idle");
  const [greetingAudioError, setGreetingAudioError] = useState<string | null>(
    null,
  );
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDraft, setAudioDraft] = useState<AudioDraft | null>(null);
  const [messagingCapabilities, setMessagingCapabilities] =
    useState<ProfileMessagingCapabilities>(DEFAULT_MESSAGING_CAPABILITIES);
  const [pulseMedia, setPulseMedia] = useState<PulseMedia | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewDurationSeconds, setPreviewDurationSeconds] = useState(0);
  const copy = getProfileCopy(profile?.locale ?? "es");
  const audioMaxDurationSeconds = Math.max(
    1,
    messagingCapabilities.audioMaxDurationSeconds,
  );
  const [previewPlaybackSeconds, setPreviewPlaybackSeconds] = useState(0);
  const [hasConfirmedAdultContent, setHasConfirmedAdultContent] = useState(() =>
    readAdultContentConfirmation(profileAlias),
  );

  useEffect(() => {
    setHasConfirmedAdultContent(readAdultContentConfirmation(profileAlias));
  }, [profileAlias]);

  useEffect(() => {
    let isMounted = true;
    const audio = audioRef.current;
    let nextAvatarUrl = "";

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);
        setChatId(null);
        setChatToken(null);
        setPulseMedia(null);
        setGreetingAudioState("idle");
        setGreetingAudioError(null);
        setIsAudioPlaying(false);
        setIsVoiceMuted(false);
        setMessagingCapabilities(DEFAULT_MESSAGING_CAPABILITIES);
        hasTrackedChatStartRef.current = false;

        const nextProfile = await fetchProfileByAlias(profileAlias);

        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
        setIsVoiceMuted(
          !nextProfile.voiceEnabled || !nextProfile.voiceAutoplayEnabled,
        );
        trackProfileInteraction(nextProfile.id, {
          eventType: "profile_viewed",
          surface: embedded ? "widget_chat" : "profile_page",
        });
        trackAnalyticsEvent("profile_view");
        setMessagingCapabilities(nextProfile.messagingCapabilities);
        const storedSession = readProfileSession(profileAlias);
        const initialMessage = nextProfile.conversationMessages.initial;
        const hasStoredMessages = Boolean(storedSession?.messages.length);
        const initialMessages = [
          {
            audioUrl: initialMessage.audioUrl,
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
            role: "profile",
            text:
              initialMessage.text ??
              getProfileCopy(nextProfile.locale).defaultInitial(
                nextProfile.name,
              ),
          },
        ] satisfies ChatMessage[];

        const hasStoredChatSession = Boolean(
          storedSession?.chatId && storedSession.chatToken,
        );
        setChatId(hasStoredChatSession ? storedSession?.chatId ?? null : null);
        setChatToken(
          hasStoredChatSession ? storedSession?.chatToken ?? null : null,
        );
        shouldScrollToBottomRef.current = true;
        setMessages(
          hasStoredMessages
            ? filterMessagesByProfileFeatures(
                storedSession!.messages,
                nextProfile.featureSettings,
                nextProfile.networks,
                nextProfile.locale,
              )
            : initialMessages,
        );
        setIsLoading(false);

        if (!embedded) {
          const description = profileDescription(
            nextProfile.name,
            nextProfile.alias,
            nextProfile.locale,
          );
          setPageMetadata({
            canonicalPath: `/${nextProfile.alias}`,
            description,
            locale: nextProfile.locale,
            structuredData: {
              "@context": "https://schema.org",
              "@type": "ProfilePage",
              mainEntity: {
                "@type": "Person",
                alternateName: `@${nextProfile.alias}`,
                name: nextProfile.name,
                sameAs: nextProfile.networks.map((network) => network.url),
                url: `https://bigmelo.com/${encodeURIComponent(nextProfile.alias)}`,
              },
              url: `https://bigmelo.com/${encodeURIComponent(nextProfile.alias)}`,
            },
            title: `${nextProfile.name} (@${nextProfile.alias}) | Bigmelo`,
            type: "profile",
          });
        }

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
              setAvatarKind("image");
            }
          });

        const greetingAudioUrl = hasStoredMessages
          ? undefined
          : initialMessage.audioUrl;
        const currentAudio = audioRef.current ?? audio;

        if (
          nextProfile.voiceEnabled &&
          nextProfile.voiceAutoplayEnabled &&
          greetingAudioUrl &&
          currentAudio
        ) {
          setAudioSource(currentAudio, greetingAudioUrl);
          setGreetingAudioState("ready");
          setGreetingAudioError(null);
          currentAudio.play().catch(() => {
            if (isMounted) {
              setGreetingAudioState("blocked");
            }
          });
        }
      } catch (loadError) {
        if (loadError instanceof ProfileApiError && loadError.status === 404) {
          onProfileNotFound();
          return;
        }

        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No fue posible cargar el perfil.",
          );
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
  }, [embedded, onProfileNotFound, profileAlias]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let active = true;

    const refreshCapabilities = () => {
      fetchProfileMessagingCapabilities(profile.id)
        .then((capabilities) => {
          if (active) {
            setMessagingCapabilities(capabilities);
          }
        })
        .catch(() => {
          // The latest known server state remains in effect until the next request.
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshCapabilities();
      }
    };

    window.addEventListener("focus", refreshCapabilities);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshCapabilities);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profile]);

  useEffect(() => {
    isComponentMountedRef.current = true;

    return () => {
      isComponentMountedRef.current = false;
      clearRecordingTimer();
      stopRecordingStream();

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        recordingCanceledRef.current = true;
        mediaRecorderRef.current.stop();
      }

      if (audioDraftRef.current?.url.startsWith("blob:")) {
        URL.revokeObjectURL(audioDraftRef.current.url);
      }

      messageAudioBlobUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      messageAudioBlobUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (profile?.voiceEnabled === false) {
      setIsVoiceMuted(true);
      audioRef.current?.pause();
    }
  }, [profile?.voiceEnabled]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    writeProfileSession(profileAlias, {
      chatId,
      chatToken,
      messages,
    });
  }, [chatId, chatToken, messages, profile, profileAlias]);

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
    window.addEventListener("scroll", updateScrollButton, { passive: true });
    window.addEventListener("resize", updateScrollButton);

    return () => {
      window.removeEventListener("scroll", updateScrollButton);
      window.removeEventListener("resize", updateScrollButton);
    };
  }, [isSending, messages.length, profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (audioDraft) {
      if (!messagingCapabilities.audioMessagesEnabled) {
        setError(getMessagingUnavailableMessage(messagingCapabilities, copy));
        return;
      }

      await sendAudioDraft();
      return;
    }

    if (
      !profile ||
      !draft.trim() ||
      isSending ||
      !messagingCapabilities.textMessagesEnabled
    ) {
      if (!messagingCapabilities.textMessagesEnabled) {
        setError(getMessagingUnavailableMessage(messagingCapabilities, copy));
      }

      return;
    }

    const visitorMessage: ChatMessage = {
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      role: "visitor",
      text: draft.trim(),
    };

    setDraft("");
    setIsSending(true);
    setError(null);
    shouldScrollToBottomRef.current = true;
    setMessages((current) => [...current, visitorMessage]);

    try {
      const shouldRequestAudioResponse =
        profile.voiceEnabled && !isVoiceMuted;
      const response = await sendProfileMessage(
        profile.id,
        visitorMessage.text,
        chatId,
        chatToken,
        shouldRequestAudioResponse,
      );

      trackAnalyticsEvent("chat_message_sent", { input_type: "text" });
      trackAnalyticsEvent("chat_answer_received", { input_type: "text" });
      if (!hasTrackedChatStartRef.current) {
        hasTrackedChatStartRef.current = true;
        trackAnalyticsEvent("chat_started", { input_type: "text" });
      }

      if (response.chatId) {
        setChatId(response.chatId);
      }
      if (response.chatToken) {
        setChatToken(response.chatToken);
      }
      if (response.messagingCapabilities) {
        setMessagingCapabilities(response.messagingCapabilities);
      }

      const answerMessageId = crypto.randomUUID();
      const responseMedia = filterMediaByProfileFeatures(
        response.media ?? [],
        profile.featureSettings,
      );
      const responseProducts = filterProductsByProfileFeatures(
        response.products ?? [],
        profile.featureSettings,
      );
      const responseSocialLinks = response.socialLinks ?? [];

      shouldScrollToBottomRef.current = true;
      setMessages((current) => [
        ...current,
        {
          audioUrl: response.audioUrl,
          createdAt: new Date().toISOString(),
          id: answerMessageId,
          ...(responseMedia.length ? { media: responseMedia } : {}),
          ...(responseProducts.length ? { products: responseProducts } : {}),
          ...(responseSocialLinks.length
            ? { socialLinks: responseSocialLinks }
            : {}),
          role: "profile",
          text: response.text,
        },
      ]);

      if (responseMedia.length) {
        setPulseMedia({
          mediaKey: getMediaItemKey(responseMedia[0], 0),
          messageId: answerMessageId,
        });
      }

      if (shouldRequestAudioResponse && response.audioUrl && audioRef.current) {
        setAudioSource(audioRef.current, response.audioUrl);
        audioRef.current.play().catch(() => {
          setGreetingAudioState("blocked");
        });
      }
    } catch (sendError) {
      if (
        sendError instanceof ProfileApiError &&
        sendError.code === "CHAT_SESSION_INVALID"
      ) {
        setChatId(null);
        setChatToken(null);
      }
      if (
        sendError instanceof ProfileApiError &&
        sendError.messagingCapabilities
      ) {
        setMessagingCapabilities(sendError.messagingCapabilities);
      }
      setError(
        sendError instanceof Error ? sendError.message : copy.sendFailed,
      );
    } finally {
      setIsSending(false);
    }
  }

  async function startAudioRecording() {
    if (
      isSending ||
      recordingState !== "idle" ||
      !messagingCapabilities.audioMessagesEnabled
    ) {
      if (!messagingCapabilities.audioMessagesEnabled) {
        setError(getMessagingUnavailableMessage(messagingCapabilities, copy));
      }

      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(copy.recordingNotAvailable);
      return;
    }

    const recordingSessionId = recordingSessionRef.current + 1;
    recordingSessionRef.current = recordingSessionId;

    try {
      clearAudioDraft();
      setError(null);
      setIsPreviewPlaying(false);
      setRecordingSeconds(0);
      setRecordingState("preparing");
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
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = 0;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("start", () => {
        if (
          recordingCanceledRef.current ||
          recordingSessionId !== recordingSessionRef.current ||
          !isComponentMountedRef.current
        ) {
          return;
        }

        recordingStartedAtRef.current = Date.now();
        setRecordingSeconds(0);
        setRecordingState("recording");
        clearRecordingTimer();
        recordingTimerRef.current = window.setInterval(() => {
          const elapsedSeconds = Math.max(
            0,
            Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
          );

          setRecordingSeconds(
            Math.min(audioMaxDurationSeconds, elapsedSeconds),
          );

          if (elapsedSeconds >= audioMaxDurationSeconds) {
            stopAudioRecording();
          }
        }, 250);
      });

      recorder.addEventListener("stop", () => {
        clearRecordingTimer();
        stopRecordingStream();

        if (
          recordingCanceledRef.current ||
          recordingSessionId !== recordingSessionRef.current ||
          !isComponentMountedRef.current
        ) {
          recordingChunksRef.current = [];
          setRecordingState("idle");
          setRecordingSeconds(0);
          return;
        }

        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, {
          type: recordedMimeType,
        });
        const startedAt = recordingStartedAtRef.current || Date.now();
        const duration = Math.max(
          1,
          Math.min(
            audioMaxDurationSeconds,
            Math.round((Date.now() - startedAt) / 1000),
          ),
        );
        const url = URL.createObjectURL(blob);

        recordingChunksRef.current = [];
        setNextAudioDraft({ blob, duration, url });
        setRecordingSeconds(duration);
        setRecordingState("preview");
      });

      recorder.start();
    } catch (recordingError) {
      clearRecordingTimer();
      stopRecordingStream();
      setRecordingState("idle");
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "No fue posible acceder al micrófono.",
      );
    }
  }

  function stopAudioRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
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
    setRecordingState("idle");
    setRecordingSeconds(0);
  }

  function clearAudioDraft() {
    const currentDraft = audioDraftRef.current;

    if (currentDraft?.url.startsWith("blob:")) {
      URL.revokeObjectURL(currentDraft.url);
    }

    setNextAudioDraft(null);
    setRecordingState("idle");
    setRecordingSeconds(0);
    setIsPreviewPlaying(false);
    setPreviewDurationSeconds(0);
    setPreviewPlaybackSeconds(0);

    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      recordingAudioRef.current.removeAttribute("src");
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
    if (
      !profile ||
      !audioDraft ||
      isSending ||
      !messagingCapabilities.audioMessagesEnabled
    ) {
      if (!messagingCapabilities.audioMessagesEnabled) {
        setError(getMessagingUnavailableMessage(messagingCapabilities, copy));
      }

      return;
    }

    if (audioDraft.duration > audioMaxDurationSeconds) {
      setError(copy.audioMaxDuration(String(audioMaxDurationSeconds)));
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
      role: "visitor",
      text: "Procesando audio...",
    };

    setNextAudioDraft(null);
    setRecordingState("idle");
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
      const shouldRequestAudioResponse =
        profile.voiceEnabled && !isVoiceMuted;
      const response = await sendProfileAudioMessage(
        profile.id,
        localAudioBlob,
        chatId,
        chatToken,
        shouldRequestAudioResponse,
      );
      trackAnalyticsEvent("chat_message_sent", { input_type: "audio" });
      trackAnalyticsEvent("chat_answer_received", { input_type: "audio" });
      if (!hasTrackedChatStartRef.current) {
        hasTrackedChatStartRef.current = true;
        trackAnalyticsEvent("chat_started", { input_type: "audio" });
      }
      const nextChatId = response.chatId ?? chatId;

      if (nextChatId) {
        setChatId(nextChatId);
      }
      if (response.chatToken) {
        setChatToken(response.chatToken);
      }
      if (response.messagingCapabilities) {
        setMessagingCapabilities(response.messagingCapabilities);
      }

      const resolvedVisitorMessage = response.requestText
        ? {
            ...pendingMessage,
            audioUrl: response.requestAudioUrl ?? localAudioUrl,
            id: response.requestMessageId ?? pendingMessageId,
            text: response.requestText,
          }
        : nextChatId
          ? resolveSentAudioMessage(
              pendingMessageId,
              localAudioUrl,
              localDuration,
            )
          : {
              ...pendingMessage,
              text: "Mensaje de audio enviado.",
            };

      if (
        resolvedVisitorMessage.audioUrl !== localAudioUrl &&
        localAudioUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(localAudioUrl);
        messageAudioBlobUrlsRef.current.delete(localAudioUrl);
      }

      const answerMessageId = crypto.randomUUID();
      const responseMedia = filterMediaByProfileFeatures(
        response.media ?? [],
        profile.featureSettings,
      );
      const responseProducts = filterProductsByProfileFeatures(
        response.products ?? [],
        profile.featureSettings,
      );
      const responseSocialLinks = response.socialLinks ?? [];

      shouldScrollToBottomRef.current = true;
      setMessages((current) => [
        ...current.map((message) =>
          message.id === pendingMessageId ? resolvedVisitorMessage : message,
        ),
        {
          audioUrl: response.audioUrl,
          createdAt: new Date().toISOString(),
          id: answerMessageId,
          ...(responseMedia.length ? { media: responseMedia } : {}),
          ...(responseProducts.length ? { products: responseProducts } : {}),
          ...(responseSocialLinks.length
            ? { socialLinks: responseSocialLinks }
            : {}),
          role: "profile",
          text: response.text,
        },
      ]);

      if (responseMedia.length) {
        setPulseMedia({
          mediaKey: getMediaItemKey(responseMedia[0], 0),
          messageId: answerMessageId,
        });
      }

      if (shouldRequestAudioResponse && response.audioUrl && audioRef.current) {
        setAudioSource(audioRef.current, response.audioUrl);
        audioRef.current.play().catch(() => {
          setGreetingAudioState("blocked");
        });
      }
    } catch (sendError) {
      if (
        sendError instanceof ProfileApiError &&
        sendError.code === "CHAT_SESSION_INVALID"
      ) {
        setChatId(null);
        setChatToken(null);
      }
      if (
        sendError instanceof ProfileApiError &&
        sendError.messagingCapabilities
      ) {
        setMessagingCapabilities(sendError.messagingCapabilities);
      }
      setError(
        sendError instanceof Error ? sendError.message : copy.sendFailed,
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessageId
            ? { ...message, text: "No fue posible procesar este audio." }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  function resolveSentAudioMessage(
    pendingMessageId: string,
    localAudioUrl: string,
    localDuration: number,
  ): ChatMessage {
    return {
      audioUrl: localAudioUrl,
      createdAt: new Date().toISOString(),
      id: pendingMessageId,
      role: "visitor",
      text: `Mensaje de audio (${formatRecordingDuration(localDuration)})`,
    };
  }

  function playMessageAudio(message: ChatMessage) {
    if (
      !profile?.voiceEnabled ||
      isVoiceMuted ||
      !message.audioUrl ||
      !audioRef.current
    ) {
      return;
    }

    setAudioSource(audioRef.current, message.audioUrl);
    audioRef.current.play().catch(() => {
      setGreetingAudioState("blocked");
    });
  }

  function toggleVoiceMute() {
    if (!profile?.voiceEnabled) {
      return;
    }

    if (!isVoiceMuted) {
      setIsVoiceMuted(true);
      audioRef.current?.pause();
      return;
    }

    setIsVoiceMuted(false);
  }

  function scrollToConversationBottom() {
    setShowScrollToBottom(false);
    scrollMessageListToBottom();
    window.requestAnimationFrame(() => {
      scrollMessageListToBottom();
      conversationEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
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

  function updatePreviewPlayback(
    audio: HTMLAudioElement | null = recordingAudioRef.current,
  ) {
    const currentDraft = audioDraftRef.current;

    if (!currentDraft || !audio) {
      setPreviewPlaybackSeconds(0);
      setPreviewDurationSeconds(0);
      return;
    }

    const duration = currentDraft.duration;
    const currentTime = Number.isFinite(audio.currentTime)
      ? Math.min(audio.currentTime, duration)
      : 0;

    setPreviewDurationSeconds(duration);
    setPreviewPlaybackSeconds(currentTime);
  }

  function resetPreviewPlayback(
    audio: HTMLAudioElement | null = recordingAudioRef.current,
  ) {
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

  const previewDuration = audioDraft
    ? previewDurationSeconds || audioDraft.duration
    : 0;
  const previewProgress =
    previewDuration > 0
      ? Math.min(1, previewPlaybackSeconds / previewDuration)
      : 0;
  const previewRemainingSeconds = audioDraft
    ? Math.max(0, Math.ceil(previewDuration - previewPlaybackSeconds))
    : 0;
  const canUseVoicePlayback = Boolean(profile?.voiceEnabled && !isVoiceMuted);
  const voiceToggleLabel = !profile?.voiceEnabled
    ? copy.voiceDisabled
    : isVoiceMuted
      ? copy.audioMuted
      : copy.audioOn;

  return (
    <main className={`profile-page${embedded ? " is-embedded" : ""}`}>
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
          <ProfileSkeleton loadingLabel={copy.loading} />
        ) : null}

        {!isLoading && error && !profile ? (
          <div className="profile-state profile-state-error">{error}</div>
        ) : null}

        {profile ? (
          <>
            <header className="profile-title">
              <h1>{profile.name}</h1>
              <p className="profile-alias">@{profile.alias}</p>
              {profile.networks.length ? (
                <nav
                  aria-label={copy.socialNav}
                  className="profile-social-links"
                >
                  {profile.networks.map((network) => (
                    <a
                      aria-label={network.name}
                      className="profile-social-link"
                      href={network.url}
                      key={network.key}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={network.name}
                      onClick={() => {
                        trackProfileInteraction(profile.id, {
                          eventType: "social_link_clicked",
                          provider: network.key,
                          surface: "profile_social_nav",
                        });
                      }}
                    >
                      {network.iconUrl ? (
                        <img
                          alt={network.name}
                          src={network.iconUrl}
                          title={network.name}
                        />
                      ) : (
                        <span aria-hidden="true">
                          {getNetworkInitial(network.name)}
                        </span>
                      )}
                    </a>
                  ))}
                </nav>
              ) : null}
            </header>

            <section className="profile-conversation" aria-label="Conversación">
              <div ref={messageListRef} className="profile-message-list">
                {messages.map((message) => (
                  <article
                    className={`profile-conversation-row ${message.role}`}
                    key={message.id}
                  >
                    {message.role === "profile" ? (
                      <div className="profile-thread-message profile">
                        <div className="profile-mini-avatar">
                          {avatarUrl && avatarKind === "video" ? (
                            <ProfileAvatarVideo src={avatarUrl} />
                          ) : avatarUrl ? (
                            <img alt="" src={avatarUrl} />
                          ) : null}
                          <span aria-hidden="true">
                            {profile.name.charAt(0).toUpperCase()}
                          </span>
                          {message.audioUrl && canUseVoicePlayback ? (
                            <button
                              aria-label={copy.audioMessage}
                              className="profile-mini-play-button"
                              title={copy.audioMessage}
                              type="button"
                              onClick={() => playMessageAudio(message)}
                            >
                              <PlayIcon />
                            </button>
                          ) : null}
                        </div>
                        <div
                          className={
                            message.media?.length ||
                            message.products?.length ||
                            message.socialLinks?.length
                              ? "profile-message-content has-assets"
                              : "profile-message-content"
                          }
                        >
                          <div className="profile-message-copy">
                            <p>{message.text}</p>
                            <time>{formatMessageTime(message.createdAt)}</time>
                          </div>
                          {message.media?.length ? (
                            <ProfileMessageMedia
                              chatId={chatId}
                              copy={copy}
                              hasConfirmedAdultContent={
                                hasConfirmedAdultContent
                              }
                              media={message.media}
                              profileId={profile.id}
                              onConfirmAdultContent={() => {
                                writeAdultContentConfirmation(profileAlias);
                                setHasConfirmedAdultContent(true);
                              }}
                              onPulseComplete={() => {
                                setPulseMedia((current) =>
                                  current?.messageId === message.id
                                    ? null
                                    : current,
                                );
                              }}
                              pulseMediaKey={
                                pulseMedia?.messageId === message.id
                                  ? pulseMedia.mediaKey
                                  : null
                              }
                            />
                          ) : null}
                          {message.socialLinks?.length ? (
                            <ProfileMessageSocialLinks
                              chatId={chatId}
                              profileId={profile.id}
                              socialLinks={message.socialLinks}
                            />
                          ) : null}
                          {message.products?.length ? (
                            <ProfileMessageProducts
                              chatId={chatId}
                              copy={copy}
                              profileId={profile.id}
                              products={message.products}
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="profile-thread-message visitor">
                        <div
                          className={
                            message.audioUrl && canUseVoicePlayback
                              ? "profile-message-copy has-audio"
                              : "profile-message-copy"
                          }
                        >
                          {message.audioUrl && canUseVoicePlayback ? (
                            <button
                              aria-label={copy.audioMessage}
                              className="profile-message-play-button"
                              title={copy.audioMessage}
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
                        {avatarUrl && avatarKind === "video" ? (
                          <ProfileAvatarVideo src={avatarUrl} />
                        ) : avatarUrl ? (
                          <img alt="" src={avatarUrl} />
                        ) : null}
                        <span aria-hidden="true">
                          {profile.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="profile-message-copy">
                        <p>{copy.typing}</p>
                      </div>
                    </div>
                  </article>
                ) : null}
                <div
                  ref={conversationEndRef}
                  className="profile-scroll-anchor"
                />
              </div>

              <section
                className="profile-avatar-stage"
                aria-label={profile.name}
              >
                <div
                  className={
                    isAudioPlaying && canUseVoicePlayback
                      ? "profile-avatar is-speaking"
                      : "profile-avatar"
                  }
                >
                  <span className="voice-ring voice-ring-one" />
                  <span className="voice-ring voice-ring-two" />
                  <span className="voice-ring voice-ring-three" />

                  {avatarUrl && avatarKind === "video" ? (
                    <ProfileAvatarVideo autoPlay src={avatarUrl} />
                  ) : avatarUrl ? (
                    <img
                      alt={profile.name}
                      src={avatarUrl}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}

                  <div className="avatar-fallback" aria-hidden="true">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <button
                    aria-label={voiceToggleLabel}
                    aria-pressed={profile.voiceEnabled ? !isVoiceMuted : false}
                    className={
                      profile.voiceEnabled && !isVoiceMuted
                        ? "profile-audio-toggle"
                        : "profile-audio-toggle is-muted"
                    }
                    disabled={!profile.voiceEnabled}
                    title={voiceToggleLabel}
                    type="button"
                    onClick={toggleVoiceMute}
                  >
                    <SpeakerIcon muted={!profile.voiceEnabled || isVoiceMuted} />
                  </button>
                </div>
                {greetingAudioState === "unavailable" ? (
                  <p className="profile-audio-note profile-audio-note-error">
                    {greetingAudioError
                      ? `${copy.audioInitialUnavailable}: ${greetingAudioError}`
                      : copy.audioInitialUnavailable}
                  </p>
                ) : null}
              </section>
            </section>

            <section className="profile-composer-row">
              {error && profile ? (
                <p className="profile-inline-error">{error}</p>
              ) : null}

              <form
                className={
                  recordingState !== "idle" || audioDraft
                    ? "profile-message-form is-voice-mode"
                    : "profile-message-form"
                }
                onSubmit={handleSubmit}
              >
                {recordingState === "preparing" ? (
                  <div
                    className="profile-voice-recorder preparing"
                    aria-live="polite"
                  >
                    <span className="profile-recording-dot is-waiting" />
                    <span className="profile-recording-status">
                      {copy.preparing}
                    </span>
                    <VoiceWaveform />
                  </div>
                ) : recordingState === "recording" ? (
                  <div className="profile-voice-recorder" aria-live="polite">
                    <span className="profile-recording-dot" />
                    <span className="profile-recording-time">
                      {formatRecordingDuration(recordingSeconds)} /{" "}
                      {formatRecordingDuration(audioMaxDurationSeconds)}
                    </span>
                    <VoiceWaveform isRecording />
                  </div>
                ) : audioDraft ? (
                  <div
                    className="profile-voice-recorder preview"
                    aria-live="polite"
                  >
                    <button
                      aria-label={
                        isPreviewPlaying
                          ? copy.pauseRecordedAudio
                          : copy.playRecordedAudio
                      }
                      className="profile-voice-play-button"
                      title={
                        isPreviewPlaying
                          ? copy.pauseRecordedAudio
                          : copy.playRecordedAudio
                      }
                      type="button"
                      onClick={playAudioDraft}
                    >
                      {isPreviewPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <VoiceWaveform
                      isPlaying={isPreviewPlaying}
                      progress={previewProgress}
                    />
                    <span className="profile-recording-time">
                      {formatRecordingDuration(previewRemainingSeconds)}
                    </span>
                  </div>
                ) : (
                  <input
                    aria-label="Mensaje"
                    disabled={
                      isSending || !messagingCapabilities.textMessagesEnabled
                    }
                    placeholder={
                      messagingCapabilities.textMessagesEnabled
                        ? copy.messagePlaceholder
                        : getMessagingUnavailableMessage(
                            messagingCapabilities,
                            copy,
                          )
                    }
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                )}

                {recordingState === "preparing" ? (
                  <>
                    <button
                      aria-label={copy.cancelRecording}
                      className="profile-icon-button"
                      disabled={isSending}
                      title={copy.cancelRecording}
                      type="button"
                      onClick={cancelAudioRecording}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      aria-label={copy.stopRecording}
                      className="profile-icon-button recording-stop"
                      disabled
                      title={copy.stopRecording}
                      type="button"
                    >
                      <StopIcon />
                    </button>
                  </>
                ) : recordingState === "recording" ? (
                  <>
                    <button
                      aria-label={copy.cancelRecording}
                      className="profile-icon-button"
                      disabled={isSending}
                      title={copy.cancelRecording}
                      type="button"
                      onClick={cancelAudioRecording}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      aria-label={copy.stopRecording}
                      className="profile-icon-button recording-stop"
                      disabled={isSending}
                      title={copy.stopRecording}
                      type="button"
                      onClick={stopAudioRecording}
                    >
                      <StopIcon />
                    </button>
                  </>
                ) : audioDraft ? (
                  <>
                    <button
                      aria-label={copy.discardAudio}
                      className="profile-icon-button"
                      disabled={isSending}
                      title={copy.discardAudio}
                      type="button"
                      onClick={clearAudioDraft}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      aria-label={copy.sendAudio}
                      className="profile-icon-button"
                      disabled={
                        isSending ||
                        !messagingCapabilities.audioMessagesEnabled
                      }
                      title={
                        messagingCapabilities.audioMessagesEnabled
                          ? copy.sendAudio
                          : getMessagingUnavailableMessage(
                              messagingCapabilities,
                              copy,
                            )
                      }
                      type="button"
                      onClick={sendAudioDraft}
                    >
                      <SendIcon />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      aria-label={copy.startRecording}
                      className="profile-icon-button"
                      disabled={
                        isSending ||
                        !messagingCapabilities.audioMessagesEnabled
                      }
                      title={
                        messagingCapabilities.audioMessagesEnabled
                          ? `${copy.startRecording}. ${copy.audioMaxDuration(String(audioMaxDurationSeconds))}`
                          : getMessagingUnavailableMessage(
                              messagingCapabilities,
                              copy,
                            )
                      }
                      type="button"
                      onClick={startAudioRecording}
                    >
                      <MicrophoneIcon />
                    </button>
                    <button
                      aria-label={copy.sendMessage}
                      className="profile-icon-button"
                      disabled={
                        isSending ||
                        !draft.trim() ||
                        !messagingCapabilities.textMessagesEnabled
                      }
                      title={copy.sendMessage}
                      type="submit"
                    >
                      <SendIcon />
                    </button>
                  </>
                )}
              </form>

              <footer className="profile-footer-note">
                <span className="profile-footer-full">
                  © 2026{" "}
                  <a
                    href="https://bigmelo.com/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    bigmelo.com
                  </a>{" "}
                  {copy.footerRights}
                </span>
                <span className="profile-footer-powered">
                  Powered by{" "}
                  <a
                    href="https://bigmelo.com/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    bigmelo.com
                  </a>
                </span>
              </footer>
            </section>

            {showScrollToBottom ? (
              <button
                aria-label={copy.goToBottom}
                className="profile-scroll-bottom-button"
                title={copy.goToBottom}
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
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRecordingDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getNetworkInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function ProfileAvatarVideo({
  autoPlay = false,
  src,
}: {
  autoPlay?: boolean;
  src: string;
}) {
  const replayTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function clearReplayTimer() {
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  }

  function playFromStart() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
      video.currentTime = 0;
    } catch {
      // Some browsers can reject seeking before metadata is ready.
    }

    const playPromise = video.play();

    if (playPromise) {
      playPromise.catch(() => {
        // Autoplay can be blocked in some browser contexts.
      });
    }
  }

  useEffect(() => {
    clearReplayTimer();

    if (autoPlay) {
      playFromStart();
    }

    return clearReplayTimer;
  }, [autoPlay, src]);

  return (
    <video
      autoPlay={autoPlay}
      muted
      playsInline
      ref={videoRef}
      src={src}
      onEnded={() => {
        const video = videoRef.current;

        if (video) {
          try {
            video.currentTime = 0;
          } catch {
            // Some browsers can reject seeking before metadata is ready.
          }

          video.pause();
        }

        clearReplayTimer();
        replayTimerRef.current = window.setTimeout(() => {
          replayTimerRef.current = null;
          playFromStart();
        }, AVATAR_VIDEO_LOOP_DELAY_MS);
      }}
    />
  );
}

function ProfileMessageMedia({
  chatId,
  copy,
  hasConfirmedAdultContent,
  media,
  profileId,
  onConfirmAdultContent,
  onPulseComplete,
  pulseMediaKey,
}: {
  chatId: string | null;
  copy: ReturnType<typeof getProfileCopy>;
  hasConfirmedAdultContent: boolean;
  media: ChatMessageMedia[];
  profileId: string;
  onConfirmAdultContent: () => void;
  onPulseComplete?: () => void;
  pulseMediaKey?: string | null;
}) {
  const [selectedMedia, setSelectedMedia] = useState<ChatMessageMedia | null>(
    null,
  );
  const [modalPhase, setModalPhase] = useState<"opening" | "open" | "closing">(
    "opening",
  );
  const [pulsingMediaKey, setPulsingMediaKey] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const handledPulseKeyRef = useRef<string | null>(null);
  const modalPhaseRef = useRef<"opening" | "open" | "closing">("opening");
  const pulseTimerRef = useRef<number | null>(null);
  const selectedMediaRef = useRef<ChatMessageMedia | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function clearPulseTimer() {
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
  }

  function finishCloseMedia() {
    selectedMediaRef.current = null;
    modalPhaseRef.current = "opening";
    setSelectedMedia(null);
    setModalPhase("opening");
  }

  function trackMediaOpened(item: ChatMessageMedia) {
    trackAnalyticsEvent("media_opened", {
      media_type: isVideoMedia(item) ? "video" : "image",
      provider: getAnalyticsMediaProvider(item),
      surface: "chat_media_card",
    });

    if (item.id) {
      trackProfileInteraction(profileId, {
        chatId,
        eventType: "media_opened",
        mediaType: isVideoMedia(item) ? "video" : "image",
        provider: getMediaProviderKey(item),
        subjectId: item.id,
        surface: "chat_media_card",
      });
    }
  }

  function trackMediaExternalClick(
    item: ChatMessageMedia,
    destinationType: "provider_channel" | "provider_video",
    surface: "chat_media_card" | "chat_media_modal",
  ) {
    trackAnalyticsEvent("media_external_clicked", {
      destination_type: destinationType,
      media_type: isVideoMedia(item) ? "video" : "image",
      provider: getAnalyticsMediaProvider(item),
      surface,
    });

    if (item.id) {
      trackProfileInteraction(profileId, {
        chatId,
        destinationType,
        eventType: "media_external_clicked",
        mediaType: isVideoMedia(item) ? "video" : "image",
        provider: getMediaProviderKey(item),
        subjectId: item.id,
        surface,
      });
    }
  }

  function openMedia(item: ChatMessageMedia) {
    if (!item.ageRestricted || hasConfirmedAdultContent) {
      trackMediaOpened(item);
    }

    clearCloseTimer();
    selectedMediaRef.current = item;
    modalPhaseRef.current = "opening";
    setSelectedMedia(item);
    setModalPhase("opening");
    window.requestAnimationFrame(() => {
      modalPhaseRef.current = "open";
      setModalPhase("open");
    });
  }

  function closeMedia() {
    if (!selectedMediaRef.current || modalPhaseRef.current === "closing") {
      return;
    }

    modalPhaseRef.current = "closing";
    setModalPhase("closing");
    clearCloseTimer();

    const shouldReduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (shouldReduceMotion) {
      finishCloseMedia();
      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      finishCloseMedia();
      closeTimerRef.current = null;
    }, MEDIA_MODAL_CLOSE_TRANSITION_MS);
  }

  function startMediaPulse(mediaKey: string) {
    if (
      !pulseMediaKey ||
      mediaKey !== pulseMediaKey ||
      handledPulseKeyRef.current === mediaKey
    ) {
      return;
    }

    handledPulseKeyRef.current = mediaKey;
    clearPulseTimer();
    setPulsingMediaKey(mediaKey);
    pulseTimerRef.current = window.setTimeout(() => {
      setPulsingMediaKey(null);
      pulseTimerRef.current = null;
      onPulseComplete?.();
    }, MEDIA_PULSE_DURATION_MS);
  }

  useEffect(() => {
    return () => {
      clearCloseTimer();
      clearPulseTimer();
    };
  }, []);

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

  useEffect(() => {
    modalPhaseRef.current = modalPhase;
  }, [modalPhase]);

  useEffect(() => {
    if (!pulseMediaKey) {
      handledPulseKeyRef.current = null;
      return undefined;
    }

    return () => {
      clearPulseTimer();
      setPulsingMediaKey(null);
    };
  }, [pulseMediaKey]);

  useEffect(() => {
    if (!selectedMedia) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMedia();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalPhase, selectedMedia]);

  useEffect(() => {
    if (!selectedMedia) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedMedia]);

  const selectedMediaIsVideo = selectedMedia
    ? isVideoMedia(selectedMedia)
    : false;
  const selectedMediaEmbedUrl =
    selectedMedia && selectedMediaIsVideo
      ? getVideoEmbedUrl(selectedMedia)
      : null;
  const selectedMediaIsLocked = Boolean(
    selectedMedia?.ageRestricted && !hasConfirmedAdultContent,
  );
  const selectedMediaIsYouTube = Boolean(
    selectedMedia && getMediaProviderKey(selectedMedia).includes("youtube"),
  );

  const modal = selectedMedia
    ? createPortal(
        <div
          aria-label={copy.modalTitle}
          aria-modal="true"
          className={`profile-media-modal is-${modalPhase}`}
          role="dialog"
          onClick={() => {
            closeMedia();
          }}
        >
          <div
            className="profile-media-modal-panel"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              aria-label={copy.modalClose}
              className="profile-media-modal-close"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                closeMedia();
              }}
            >
              <CloseIcon />
            </button>
            {selectedMediaIsLocked ? (
              <div className="profile-media-modal-age-gate">
                <strong>{copy.adultContentTitle}</strong>
                <p>{copy.adultContentBody}</p>
                <div>
                  <button type="button" onClick={closeMedia}>
                    {copy.adultContentCancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      trackMediaOpened(selectedMedia);
                      onConfirmAdultContent();
                    }}
                  >
                    {copy.adultContentConfirm}
                  </button>
                </div>
              </div>
            ) : selectedMediaIsVideo && selectedMediaEmbedUrl ? (
              <iframe
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                className={`profile-media-modal-embed${selectedMediaIsYouTube ? " is-youtube" : ""}`}
                src={selectedMediaEmbedUrl}
                title={`${copy.openVideo}: ${getMediaProviderLabel(selectedMedia)}`}
              />
            ) : selectedMediaIsVideo && selectedMedia.mediaUrl ? (
              <video
                autoPlay
                className="profile-media-modal-video"
                controls
                playsInline
                poster={selectedMedia.imageUrl}
                src={selectedMedia.mediaUrl}
              />
            ) : selectedMedia.imageUrl ? (
              <img
                alt={
                  selectedMedia.observation ??
                  selectedMedia.caption ??
                  getMediaProviderLabel(selectedMedia)
                }
                className="profile-media-modal-image"
                src={selectedMedia.imageUrl}
              />
            ) : null}
            {!selectedMediaIsLocked && selectedMediaIsYouTube ? (
              <div className="profile-media-modal-actions">
                {selectedMedia.permalink ? (
                  <a
                    className="profile-media-modal-link"
                    href={selectedMedia.permalink}
                    rel="noopener noreferrer"
                    target="_blank"
                    onClick={() => {
                      trackMediaExternalClick(selectedMedia, "provider_video", "chat_media_modal");
                    }}
                  >
                    {copy.viewOnYouTube}
                  </a>
                ) : null}
                {selectedMedia.channelUrl ? (
                  <a
                    className="profile-media-modal-link is-secondary"
                    href={selectedMedia.channelUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                    onClick={() => {
                      trackMediaExternalClick(selectedMedia, "provider_channel", "chat_media_modal");
                    }}
                  >
                    {copy.goToChannel}
                  </a>
                ) : null}
              </div>
            ) : !selectedMediaIsLocked && selectedMedia.permalink ? (
              <a
                className="profile-media-modal-link"
                href={selectedMedia.permalink}
                rel="noopener noreferrer"
                target="_blank"
                onClick={() => {
                  trackMediaExternalClick(selectedMedia, "provider_video", "chat_media_modal");
                }}
              >
                {selectedMedia.actionLabel ?? copy.viewOnProvider(getMediaProviderLabel(selectedMedia))}
              </a>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="profile-message-media-list">
        {media.map((item, index) => {
          const mediaKey = getMediaItemKey(item, index);
          const provider = getMediaProviderLabel(item);
          const isVideo = isVideoMedia(item);
          const isYouTube = getMediaProviderKey(item).includes("youtube");
          const isAgeRestricted = Boolean(
            item.ageRestricted && !hasConfirmedAdultContent,
          );

          return (
            <article
              className={
                pulsingMediaKey === mediaKey
                  ? `profile-message-media-card is-pulsing${isAgeRestricted ? " is-age-restricted" : ""}${isYouTube ? " is-youtube" : ""}`
                  : `profile-message-media-card${isAgeRestricted ? " is-age-restricted" : ""}${isYouTube ? " is-youtube" : ""}`
              }
              key={mediaKey}
            >
              <button
                aria-label={`${isVideo ? copy.openVideo : copy.openPhoto}: ${provider}`}
                className="profile-message-media-preview"
                type="button"
                onClick={() => {
                  openMedia(item);
                }}
              >
                {item.imageUrl ? (
                  <img
                    alt={item.observation ?? item.caption ?? provider}
                    src={item.imageUrl}
                    onError={() => {
                      startMediaPulse(mediaKey);
                    }}
                    onLoad={() => {
                      startMediaPulse(mediaKey);
                    }}
                  />
                ) : null}
                {isVideo && !isAgeRestricted ? (
                  <span
                    aria-hidden="true"
                    className="profile-message-media-play"
                  >
                    <PlayIcon />
                  </span>
                ) : null}
                {isAgeRestricted ? (
                  <span className="profile-message-media-age-gate">
                    <strong>18+</strong>
                    <span>{copy.adultContentTitle}</span>
                  </span>
                ) : null}
              </button>
              {isYouTube && !isAgeRestricted ? (
                <div className="profile-message-media-actions">
                  <button
                    className="profile-message-media-link"
                    type="button"
                    onClick={() => {
                      openMedia(item);
                    }}
                  >
                    {copy.viewVideo}
                  </button>
                  {item.channelUrl ? (
                    <a
                      className="profile-message-media-link is-secondary"
                      href={item.channelUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      onClick={() => {
                        trackMediaExternalClick(item, "provider_channel", "chat_media_card");
                      }}
                    >
                      {copy.goToChannel}
                    </a>
                  ) : null}
                </div>
              ) : item.permalink && !isAgeRestricted ? (
                <a
                  className="profile-message-media-link"
                  href={item.permalink}
                  rel="noopener noreferrer"
                  target="_blank"
                  onClick={() => {
                    trackMediaExternalClick(item, "provider_video", "chat_media_card");
                  }}
                >
                  {item.actionLabel ?? copy.viewOnProvider(provider)}
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
      {modal}
    </>
  );
}

function getMediaProviderLabel(item: ChatMessageMedia): string {
  return item.providerLabel ?? item.provider ?? "Instagram";
}

function ProfileMessageSocialLinks({
  chatId,
  profileId,
  socialLinks,
}: {
  chatId: string | null;
  profileId: string;
  socialLinks: ChatMessageSocialLink[];
}) {
  return (
    <div className="profile-message-social-links">
      {socialLinks.map((link) => (
        <a
          aria-label={link.actionLabel}
          className="profile-message-media-link"
          href={link.url}
          key={`${link.providerKey}:${link.url}`}
          rel="noopener noreferrer"
          target="_blank"
          onClick={() => {
            trackProfileInteraction(profileId, {
              chatId,
              eventType: "social_link_clicked",
              provider: link.providerKey,
              surface: "chat_social_link",
            });
          }}
        >
          {link.actionLabel}
        </a>
      ))}
    </div>
  );
}

function ProfileMessageProducts({
  chatId,
  copy,
  profileId,
  products,
}: {
  chatId: string | null;
  copy: ReturnType<typeof getProfileCopy>;
  profileId: string;
  products: ChatMessageProduct[];
}) {
  return (
    <div className="profile-message-product-list">
      {products.map((product) => (
        <article className="profile-message-product-card" key={product.id}>
          <a
            aria-label={`${product.name}: ${getProductActionLabel(product, copy)}`}
            className="profile-message-product-image"
            href={product.actionUrl}
            rel="noopener noreferrer"
            target="_blank"
            onClick={() => {
              trackAnalyticsEvent("product_clicked", {
                destination_type: product.destinationType,
                surface: "product_image",
              });
              trackProfileInteraction(profileId, {
                chatId,
                eventType: "product_clicked",
                metadata: { destination_type: product.destinationType },
                subjectId: product.id,
                surface: "product_image",
              });
            }}
          >
            <img alt={product.name} src={product.imageUrl} />
          </a>
          <div className="profile-message-product-body">
            <strong>{product.name}</strong>
            <p>{product.description}</p>
            <a
              href={product.actionUrl}
              rel="noopener noreferrer"
              target="_blank"
              onClick={() => {
                trackAnalyticsEvent("product_clicked", {
                  destination_type: product.destinationType,
                  surface: "product_button",
                });
                trackProfileInteraction(profileId, {
                  chatId,
                  eventType: "product_clicked",
                  metadata: { destination_type: product.destinationType },
                  subjectId: product.id,
                  surface: "product_button",
                });
              }}
            >
              {getProductActionLabel(product, copy)}
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function getProductActionLabel(
  product: ChatMessageProduct,
  copy: ReturnType<typeof getProfileCopy>,
): string {
  if (product.destinationType === "whatsapp") {
    return copy.contactOnWhatsapp;
  }

  if (product.destinationType === "telegram") {
    return copy.contactOnTelegram;
  }

  return copy.viewProduct;
}

function getMediaProviderKey(item: ChatMessageMedia): string {
  return (item.providerKey ?? item.provider ?? item.providerLabel ?? "")
    .trim()
    .toLowerCase();
}

function getAnalyticsMediaProvider(item: ChatMessageMedia): string {
  const providerKey = getMediaProviderKey(item);

  for (const knownProvider of ["instagram", "onlyfans", "tiktok", "youtube"]) {
    if (providerKey.includes(knownProvider)) {
      return knownProvider;
    }
  }

  return "other";
}

function isVideoMedia(item: ChatMessageMedia): boolean {
  const type = item.type?.trim().toUpperCase() ?? "";

  if (type.includes("VIDEO")) {
    return true;
  }

  if (type.includes("IMAGE") || type.includes("PHOTO")) {
    return false;
  }

  const providerKey = getMediaProviderKey(item);

  if (providerKey.includes("tiktok") || providerKey.includes("youtube")) {
    return true;
  }

  return (
    providerKey.includes("instagram") &&
    typeof item.permalink === "string" &&
    /\/(?:reel|reels|tv)\//i.test(item.permalink)
  );
}

function getVideoEmbedUrl(item: ChatMessageMedia): string | null {
  if (getMediaProviderKey(item).includes("youtube")) {
    for (const value of [item.mediaUrl, item.permalink]) {
      if (!value) {
        continue;
      }

      try {
        const url = new URL(value);
        const pathParts = url.pathname.split("/").filter(Boolean);
        const videoId = url.hostname.endsWith("youtu.be")
          ? pathParts[0]
          : url.searchParams.get("v") ||
            (["embed", "live", "shorts"].includes(pathParts[0] ?? "")
              ? pathParts[1]
              : null);

        if (videoId && /^[\w-]{11}$/.test(videoId)) {
          return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
        }
      } catch {
        // Ignore malformed provider URLs and try the next candidate.
      }
    }

    return null;
  }

  if (getMediaProviderKey(item).includes("tiktok")) {
    const candidates = item.mediaUrl
      ? [item.mediaUrl]
      : item.permalink
        ? [item.permalink]
        : [];

    for (const value of candidates) {
      if (!value) {
        continue;
      }

      try {
        const url = new URL(value);
        const videoId = url.pathname.match(/\/(?:video|v1|v2)\/(\d+)/)?.[1];

        if (videoId) {
          return `https://www.tiktok.com/player/v1/${videoId}?autoplay=1`;
        }
      } catch {
        // Ignore malformed provider URLs and fall back to the original link.
      }
    }

    // A direct provider media URL is rendered by the native video player;
    // the permalink remains available as the separately tracked external exit.
    return null;
  }

  if (
    getMediaProviderKey(item).includes("instagram") &&
    !item.mediaUrl &&
    item.permalink
  ) {
    try {
      const url = new URL(item.permalink);

      if (
        url.hostname === "instagram.com" ||
        url.hostname.endsWith(".instagram.com")
      ) {
        return `${url.origin}${url.pathname.replace(/\/+$/, "")}/embed/`;
      }
    } catch {
      // A direct media URL may still be available for playback.
    }
  }

  return null;
}

function getMediaItemKey(item: ChatMessageMedia, index: number): string {
  return `${item.id ?? item.permalink ?? item.mediaUrl ?? item.imageUrl ?? getMediaProviderLabel(item)}-${index}`;
}

function getPreferredRecordingMimeType() {
  const supportedTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return (
    supportedTypes.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) ?? ""
  );
}

function setAudioSource(
  audio: HTMLAudioElement,
  audioUrl?: string,
  blob?: Blob,
) {
  if (audio.src.startsWith("blob:")) {
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
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.sessionStorage.getItem(
      getProfileSessionKey(profileAlias),
    );

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<ProfileSession>;
    const messages = normalizeStoredMessages(parsedValue.messages);

    return {
      chatId:
        typeof parsedValue.chatId === "string" && parsedValue.chatId
          ? parsedValue.chatId
          : null,
      chatToken:
        typeof parsedValue.chatToken === "string" && parsedValue.chatToken
          ? parsedValue.chatToken
          : null,
      messages,
    };
  } catch {
    return null;
  }
}

function writeProfileSession(profileAlias: string, session: ProfileSession) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getProfileSessionKey(profileAlias),
      JSON.stringify({
        chatId: session.chatId,
        chatToken: session.chatToken,
        messages: session.messages,
      }),
    );
  } catch {
    // sessionStorage can be unavailable in private or restricted browser contexts.
  }
}

function readAdultContentConfirmation(profileAlias: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.sessionStorage.getItem(getAdultContentSessionKey(profileAlias)) ===
      "confirmed"
    );
  } catch {
    return false;
  }
}

function writeAdultContentConfirmation(profileAlias: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getAdultContentSessionKey(profileAlias),
      "confirmed",
    );
  } catch {
    // The confirmation remains active in React state for the current page.
  }
}

function filterMessagesByProfileFeatures(
  messages: ChatMessage[],
  features: ProfileFeatureSetting[],
  networks: ProfileData["networks"],
  locale: ProfileLocale,
) {
  return messages.map((message, index) => {
    const media = message.media
      ? filterMediaByProfileFeatures(message.media, features)
      : [];
    const products = message.products
      ? filterProductsByProfileFeatures(message.products, features)
      : [];
    const socialLinks = message.socialLinks?.length
      ? message.socialLinks
      : inferStoredSocialLinks(
          message,
          messages[index - 1]?.role === "visitor"
            ? messages[index - 1].text
            : "",
          networks,
          locale,
          media,
        );

    return {
      ...message,
      ...(media.length ? { media } : { media: undefined }),
      ...(products.length ? { products } : { products: undefined }),
      ...(socialLinks.length
        ? { socialLinks }
        : { socialLinks: undefined }),
    };
  });
}

function inferStoredSocialLinks(
  message: ChatMessage,
  questionText: string,
  networks: ProfileData["networks"],
  locale: ProfileLocale,
  media: ChatMessageMedia[],
): ChatMessageSocialLink[] {
  if (message.role !== "profile" || !networks.length) {
    return [];
  }

  const normalizedAnswer = normalizeSocialMentionText(message.text);
  const normalizedQuestion = normalizeSocialMentionText(questionText);
  const isGenericSocialRequest = /\b(redes? sociales|tus redes|donde (?:puedo )?seguirte|social (?:media|networks?)|your socials|where can i follow)\b/.test(
    normalizedQuestion,
  );
  const hasLinkIntent = /\b(aqui|here|enlace|link|ver|visitar|visit|see|find)\b/.test(
    normalizedAnswer,
  );
  const mediaDestinations = new Set(
    media
      .filter((item) => item.permalink || item.channelUrl)
      .flatMap((item) => [
        normalizeFeatureProvider(item.providerKey),
        normalizeFeatureProvider(item.destinationType),
      ]),
  );

  return networks.flatMap((network) => {
    const providerKey = normalizeFeatureProvider(network.key);

    if (!providerKey || mediaDestinations.has(providerKey)) {
      return [];
    }

    const providerMentionedInAnswer = textMentionsSocialNetwork(
      normalizedAnswer,
      network.key,
      network.name,
    );
    const providerMentionedInQuestion = textMentionsSocialNetwork(
      normalizedQuestion,
      network.key,
      network.name,
    );

    if (
      !isGenericSocialRequest &&
      !providerMentionedInAnswer &&
      !(providerMentionedInQuestion && hasLinkIntent)
    ) {
      return [];
    }

    if (
      !isGenericSocialRequest &&
      providerMentionedInAnswer &&
      !providerMentionedInQuestion &&
      !hasLinkIntent
    ) {
      return [];
    }

    return [
      {
        actionLabel:
          locale === "en" ? `Go to ${network.name}` : `Ir a ${network.name}`,
        providerKey: network.key,
        providerLabel: network.name,
        url: network.url,
      },
    ];
  });
}

function textMentionsSocialNetwork(
  normalizedText: string,
  providerKey: string,
  providerLabel: string,
) {
  const aliases = [
    providerKey,
    providerLabel,
    ...(normalizeFeatureProvider(providerKey) === "x" ? ["twitter"] : []),
  ];

  return aliases.some((alias) => {
    const normalizedAlias = normalizeSocialMentionText(alias);

    return normalizedAlias
      ? new RegExp(
          `(^|[^a-z0-9])${escapeRegExp(normalizedAlias).replace(/\\ /g, "\\s+")}([^a-z0-9]|$)`,
        ).test(normalizedText)
      : false;
  });
}

function normalizeSocialMentionText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filterMediaByProfileFeatures(
  media: ChatMessageMedia[],
  features: ProfileFeatureSetting[],
) {
  const enabledProviders = new Set(
    features
      .filter(
        (feature) =>
          feature.group === "integrations" &&
          feature.effective &&
          feature.provider,
      )
      .map((feature) => normalizeFeatureProvider(feature.provider)),
  );

  if (!enabledProviders.size) {
    return [];
  }

  return media.filter((item) =>
    enabledProviders.has(normalizeMediaProvider(item)),
  );
}

function filterProductsByProfileFeatures(
  products: ChatMessageProduct[],
  features: ProfileFeatureSetting[],
) {
  return features.some(
    (feature) => feature.key === "products" && feature.effective,
  )
    ? products
    : [];
}

function normalizeMediaProvider(item: ChatMessageMedia) {
  return normalizeFeatureProvider(
    item.providerKey ?? item.provider ?? item.providerLabel ?? "",
  );
}

function normalizeFeatureProvider(value?: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getAdultContentSessionKey(profileAlias: string) {
  return `${ADULT_CONTENT_SESSION_KEY_PREFIX}${encodeURIComponent(profileAlias)}`;
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
        ...(message.media?.length
          ? { media: message.media.filter(isStoredMessageMedia) }
          : {}),
        ...(message.products?.length
          ? { products: message.products.filter(isStoredMessageProduct) }
          : {}),
        ...(message.socialLinks?.length
          ? {
              socialLinks: message.socialLinks.filter(
                isStoredMessageSocialLink,
              ),
            }
          : {}),
      },
    ];
  });
}

function isStoredMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  const hasValidRole = message.role === "visitor" || message.role === "profile";

  return (
    typeof message.id === "string" &&
    hasValidRole &&
    typeof message.text === "string"
  );
}

function isStoredMessageMedia(value: unknown): value is ChatMessageMedia {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const media = value as Partial<ChatMessageMedia>;
  const hasMediaOrLink =
    typeof media.imageUrl === "string" ||
    typeof media.mediaUrl === "string" ||
    typeof media.permalink === "string";

  return hasMediaOrLink;
}

function isStoredMessageProduct(value: unknown): value is ChatMessageProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const product = value as Partial<ChatMessageProduct>;

  return (
    typeof product.actionUrl === "string" &&
    typeof product.description === "string" &&
    typeof product.id === "string" &&
    typeof product.imageUrl === "string" &&
    typeof product.name === "string" &&
    typeof product.publicUrl === "string" &&
    ["external_url", "telegram", "whatsapp"].includes(
      product.destinationType ?? "",
    )
  );
}

function isStoredMessageSocialLink(
  value: unknown,
): value is ChatMessageSocialLink {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const link = value as Partial<ChatMessageSocialLink>;

  return (
    typeof link.actionLabel === "string" &&
    typeof link.providerKey === "string" &&
    typeof link.providerLabel === "string" &&
    typeof link.url === "string"
  );
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
  const activeBars =
    safeProgress > 0
      ? Math.ceil(safeProgress * WAVEFORM_BAR_COUNT)
      : isPlaying
        ? 1
        : 0;
  const currentBar = activeBars > 0 ? activeBars - 1 : -1;
  const className = [
    "profile-voice-waveform",
    isRecording ? "is-recording" : "",
    isPlaying ? "is-playing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className} aria-hidden="true">
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
        <span
          className={[
            index < activeBars ? "is-active" : "",
            isPlaying && index === currentBar ? "is-current" : "",
          ]
            .filter(Boolean)
            .join(" ")}
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

function SpeakerIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 14.5h3.1l4.9 4V5.5l-4.9 4H4.5v5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M16 9.2c.8.78 1.25 1.78 1.25 2.8S16.8 14.02 16 14.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M18.4 6.6A7.3 7.3 0 0 1 20.75 12a7.3 7.3 0 0 1-2.35 5.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      {muted ? (
        <path
          d="m4.75 4.75 14.5 14.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      ) : null}
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

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m6.5 6.5 11 11M17.5 6.5l-11 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
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
