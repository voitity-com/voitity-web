import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import bigmeloLogo from '../assets/bigmelo-logo.webp';
import { getAdminBaseUrl, getAdminSignInUrl } from '../lib/admin-url';
import { submitContactSubmission } from '../lib/contact-api';
import { trackAnalyticsEvent } from '../lib/google-analytics';
import { setPageMetadata } from '../lib/page-metadata';
import {
  fetchPublicSubscriptionPlans,
  type PublicSubscriptionPlan,
} from '../lib/plans-api';

type Locale = 'es' | 'en';

const LOCALE_STORAGE_KEY = 'bigmelo-locale';

type Plan = {
  cycle: 'month' | 'year';
  name: string;
  planId?: string;
  price: string;
  period: string;
  label: string;
  description: string;
  features: string[];
  cta: string;
  trial: string;
  highlighted?: boolean;
};

const content: Record<
  Locale,
  {
    nav: {
      product: string;
      plans: string;
      contact: string;
      signIn: string;
    };
    hero: {
      eyebrow: string;
      title: string;
      lead: string;
      primaryCta: string;
      secondaryCta: string;
      demoAria: string;
      profileName: string;
      profileRole: string;
      demoAnswerOne: string;
      demoAnswerTwo: string;
      demoIntro: string;
      demoPlanAction: string;
      demoQuestionOne: string;
      demoQuestionTwo: string;
      demoTyping: string;
      demoVideoAction: string;
      demoVideoTitle: string;
    };
    plans: {
      eyebrow: string;
      title: string;
      lead: string;
      items: Plan[];
    };
    video: {
      cta: string;
      eyebrow: string;
      lead: string;
      note: string;
      title: string;
      videoTitle: string;
    };
    contact: {
      eyebrow: string;
      title: string;
      lead: string;
      name: string;
      email: string;
      phoneCountry: string;
      phone: string;
      message: string;
      consent: string;
      submit: string;
      submitting: string;
      success: string;
      error: string;
      captchaRequired: string;
      captchaError: string;
    };
    footer: {
      tagline: string;
      dataDeletion: string;
      privacy: string;
      terms: string;
    };
  }
> = {
  es: {
    nav: {
      product: 'Producto',
      plans: 'Planes',
      contact: 'Contacto',
      signIn: 'Ingresar',
    },
    hero: {
      eyebrow: 'Presencia digital con inteligencia artificial',
      title: 'Crea tu presencia digital inteligente e interactiva',
      lead:
        'Crea una página pública donde una versión interactiva de ti responde preguntas, comparte tu historia y conversa por texto y audio con información verificada.',
      primaryCta: 'Crear mi presencia digital',
      secondaryCta: 'Ver planes',
      demoAria:
        'Vista previa de una presencia digital con avatar central, mensajes laterales, respuestas de audio y campo de conversación.',
      profileName: 'Valeria Ríos',
      profileRole: '@valeria-rios',
      demoIntro:
        'Soy Valeria Ríos. Acompaño proyectos, marcas personales y equipos que quieren comunicar mejor lo que hacen.',
      demoQuestionOne: '¿Cómo puedo tener mi perfil?',
      demoAnswerOne:
        'En Bigmelo puedes crear tu perfil paso a paso: agrega tu información, elige tu avatar, clona tu voz y publícalo. Mira este video para conocer el proceso.',
      demoQuestionTwo: '¿Y cómo lo adquiero?',
      demoAnswerTwo:
        'Puedes empezar con el plan Starter y usar Bigmelo gratis durante 7 días. Luego decides si quieres mantener tu perfil activo.',
      demoTyping: 'Valeria está escribiendo',
      demoVideoTitle: 'Conoce cómo crear tu perfil en Bigmelo',
      demoVideoAction: 'Ver video en YouTube',
      demoPlanAction: 'Probar Starter gratis',
    },
    plans: {
      eyebrow: 'Planes',
      title: 'Todo lo necesario para lanzar tu primera presencia digital con IA.',
      lead:
        'Incluye presencia pública, avatar con imagen autorizada, un clon de tu propia voz y límites mensuales para chat y audio. Puedes comprar créditos adicionales cuando agotes un límite ampliable.',
      items: [
        {
          cycle: 'month',
          name: 'Starter',
          planId: 'starter',
          price: '$12.99',
          period: 'USD /mes',
          label: 'Mensual',
          description: 'Para crear y validar una presencia digital conversacional.',
          features: [
            '1 presencia digital publicada',
            'Avatar inicial con imagen y video breve',
            '1 clon de tu propia voz',
            'Hasta 1.000 mensajes de visitantes por texto o audio al mes',
            'Hasta 500 audios entrantes al mes, máximo 30 segundos cada uno',
            'Hasta 20.000 caracteres en respuestas de audio al mes',
            'Hasta 15 productos por perfil',
            'Instagram, TikTok con hasta 10 contenidos seleccionados por red',
            'Enlaces públicos a redes sociales',
            'Créditos adicionales disponibles para límites ampliables',
          ],
          cta: 'Elegir Starter mensual',
          trial: 'Prueba gratis por 7 días y luego $12.99 USD/mes.',
        },
        {
          cycle: 'year',
          name: 'Starter',
          planId: 'starter_annual',
          price: '$129',
          period: 'USD /año',
          label: 'Anual',
          description: 'Para mantener tu presencia digital activa todo el año con mejor precio.',
          features: [
            '1 presencia digital publicada',
            'Avatar inicial con imagen y video breve',
            '1 clon de tu propia voz',
            'Hasta 1.000 mensajes de visitantes por texto o audio al mes',
            'Hasta 500 audios entrantes al mes, máximo 30 segundos cada uno',
            'Hasta 20.000 caracteres en respuestas de audio al mes',
            'Hasta 15 productos por perfil',
            'Instagram, TikTok con hasta 10 contenidos seleccionados por red',
            'Enlaces públicos a redes sociales',
            'Créditos adicionales disponibles para límites ampliables',
            'Ahorro de $26.88 frente al pago mensual',
          ],
          cta: 'Elegir Starter anual',
          trial: 'Prueba gratis por 7 días y luego $129 USD/año.',
          highlighted: true,
        },
      ],
    },
    video: {
      cta: 'Prueba 7 días gratis',
      eyebrow: 'Bigmelo en acción',
      lead: 'Convierte tu experiencia, voz y contenido en un perfil inteligente que conversa y conecta por ti.',
      note: 'Sin compromiso. Cancela cuando quieras.',
      title: 'Potencia tu marca personal.',
      videoTitle: 'Bigmelo | La herramienta inteligente para potenciar tu marca personal',
    },
    contact: {
      eyebrow: 'Contacto',
      title: 'Cuéntanos qué presencia digital quieres crear.',
      lead:
        'Ideal para profesionales, creadores, educadores, figuras públicas y marcas personales que quieren responder preguntas con inteligencia artificial.',
      name: 'Nombre',
      email: 'Correo',
      phoneCountry: 'Indicativo',
      phone: 'Teléfono',
      message: 'Mensaje',
      consent: 'Acepto que Bigmelo use estos datos para responder mi solicitud.',
      submit: 'Solicitar mi presencia digital',
      submitting: 'Enviando solicitud...',
      success: 'Gracias. Recibimos tu solicitud.',
      error: 'No fue posible enviar tu solicitud. Intenta de nuevo.',
      captchaRequired: 'Completa la verificación antes de enviar.',
      captchaError: 'No fue posible completar la verificación. Recarga la página e intenta de nuevo.',
    },
    footer: {
      tagline: 'Presencias digitales con inteligencia artificial, tu propia voz clonada e información verificada.',
      dataDeletion: 'Eliminación de datos',
      privacy: 'Privacidad',
      terms: 'Términos',
    },
  },
  en: {
    nav: {
      product: 'Product',
      plans: 'Plans',
      contact: 'Contact',
      signIn: 'Sign in',
    },
    hero: {
      eyebrow: 'AI-powered digital presence',
      title: 'Create your intelligent and interactive digital presence',
      lead:
        'Build a public page where an interactive version of you answers questions, shares your story, and replies with text and audio using verified information.',
      primaryCta: 'Create my digital presence',
      secondaryCta: 'See plans',
      demoAria:
        'Preview of an AI-powered digital presence with a centered avatar, side messages, audio replies, and conversation input.',
      profileName: 'Valeria Ríos',
      profileRole: '@valeria-rios',
      demoIntro:
        'I am Valeria Ríos. I support projects, personal brands, and teams that want to communicate their work more clearly.',
      demoQuestionOne: 'How can I create my profile?',
      demoAnswerOne:
        'With Bigmelo, you can create your profile step by step: add your information, choose your avatar, clone your voice, and publish it. Watch this video to see the process.',
      demoQuestionTwo: 'How do I get it?',
      demoAnswerTwo:
        'You can start with the Starter plan and use Bigmelo free for 7 days. Then you decide whether to keep your profile active.',
      demoTyping: 'Valeria is typing',
      demoVideoTitle: 'See how to create your Bigmelo profile',
      demoVideoAction: 'Watch on YouTube',
      demoPlanAction: 'Try Starter free',
    },
    plans: {
      eyebrow: 'Plans',
      title: 'Everything you need to launch your first AI-powered presence.',
      lead:
        'Includes a public presence, an avatar with an authorized image, a clone of your own voice, and monthly chat and audio limits. You can purchase additional credits after an extendable limit is exhausted.',
      items: [
        {
          cycle: 'month',
          name: 'Starter',
          planId: 'starter',
          price: '$12.99',
          period: 'USD /month',
          label: 'Monthly',
          description: 'For creating and validating one conversational digital presence.',
          features: [
            '1 published digital presence',
            'Initial avatar with image and short video',
            '1 clone of your own voice',
            'Up to 1,000 visitor text or audio messages per month',
            'Up to 500 incoming audios per month, maximum 30 seconds each',
            'Up to 20,000 characters in audio replies per month',
            'Up to 15 products per profile',
            'Instagram and TikTok with up to 10 selected media items per network',
            'Public social network links',
            'Additional credits available for extendable limits',
          ],
          cta: 'Choose Starter monthly',
          trial: 'Try it free for 7 days, then $12.99 USD/month.',
        },
        {
          cycle: 'year',
          name: 'Starter',
          planId: 'starter_annual',
          price: '$129',
          period: 'USD /year',
          label: 'Annual',
          description: 'For keeping your digital presence active all year at a better price.',
          features: [
            '1 published digital presence',
            'Initial avatar with image and short video',
            '1 clone of your own voice',
            'Up to 1,000 visitor text or audio messages per month',
            'Up to 500 incoming audios per month, maximum 30 seconds each',
            'Up to 20,000 characters in audio replies per month',
            'Up to 15 products per profile',
            'Instagram and TikTok with up to 10 selected media items per network',
            'Public social network links',
            'Additional credits available for extendable limits',
            'Save $26.88 compared with monthly billing',
          ],
          cta: 'Choose Starter annual',
          trial: 'Try it free for 7 days, then $129 USD/year.',
          highlighted: true,
        },
      ],
    },
    video: {
      cta: 'Start your 7-day free trial',
      eyebrow: 'Bigmelo in action',
      lead: 'Turn your experience, voice, and content into an intelligent profile that speaks and connects for you.',
      note: 'No commitment. Cancel anytime.',
      title: 'Grow your personal brand.',
      videoTitle: 'Bigmelo | The intelligent tool to grow your personal brand',
    },
    contact: {
      eyebrow: 'Contact us',
      title: 'Tell us what digital presence you want to create.',
      lead:
        'Built for professionals, creators, educators, public figures, and personal brands that want to answer questions with artificial intelligence.',
      name: 'Name',
      email: 'Email',
      phoneCountry: 'Country code',
      phone: 'Phone',
      message: 'Message',
      consent: 'I allow Bigmelo to use this information to reply to my request.',
      submit: 'Request my digital presence',
      submitting: 'Sending request...',
      success: 'Thanks. We received your request.',
      error: 'We could not send your request. Please try again.',
      captchaRequired: 'Complete the verification before sending.',
      captchaError: 'We could not complete the verification. Reload the page and try again.',
    },
    footer: {
      tagline: 'AI-powered digital presences with your own cloned voice and verified information.',
      dataDeletion: 'Data deletion',
      privacy: 'Privacy',
      terms: 'Terms',
    },
  },
};

const TURNSTILE_SITE_KEY = ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim();
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LANDING_DEMO_IMAGE_URL = '/media/landing/valeria-rios-avatar-512.webp';
const LANDING_DEMO_THUMBNAIL_URL = '/media/landing/valeria-rios-avatar-96.webp';
const LANDING_DEMO_VIDEO_URL = '/media/landing/valeria-rios-avatar-480.mp4';
const LANDING_YOUTUBE_URL = 'https://www.youtube.com/watch?v=pBxiwqnSBqo';
const LANDING_YOUTUBE_THUMBNAIL_URL = '/media/landing/bigmelo-overview-video-480.webp';
const LANDING_VIDEO_EMBED_URL = 'https://www.youtube-nocookie.com/embed/pBxiwqnSBqo?rel=0&playsinline=1&autoplay=1';
const ContactPhoneFields = lazy(async () => {
  const module = await import('../components/ContactPhoneFields');

  return { default: module.ContactPhoneFields };
});

type TurnstileWidgetId = string;

type TurnstileRenderOptions = {
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  language?: string;
  sitekey: string;
  theme?: 'auto' | 'dark' | 'light';
};

declare global {
  interface Window {
    turnstile?: {
      remove?: (widgetId: TurnstileWidgetId) => void;
      render: (container: HTMLElement, options: TurnstileRenderOptions) => TurnstileWidgetId;
      reset: (widgetId?: TurnstileWidgetId) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    try {
      const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

      if (storedLocale === 'es' || storedLocale === 'en') {
        return storedLocale;
      }
    } catch {
      return 'es';
    }
  }

  return 'es';
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true });

      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true });

    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

function getPlanCheckoutUrl(plan: Plan, locale: Locale): string {
  const url = new URL('/auth/custom/sign-up', getAdminBaseUrl());

  url.searchParams.set('intent', 'trial');
  url.searchParams.set('plan', plan.planId ?? 'starter');
  url.searchParams.set('cycle', plan.cycle);
  url.searchParams.set('locale', locale);

  if (typeof window !== 'undefined') {
    const landingParams = new URLSearchParams(window.location.search);

    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
      const value = landingParams.get(key)?.trim().slice(0, 255);

      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

function applyPublicPlanData(
  plan: Plan,
  locale: Locale,
  publicPlans: PublicSubscriptionPlan[],
): Plan {
  const planId = plan.cycle === 'year' ? 'starter_annual' : 'starter';
  const publicPlan = publicPlans.find((candidate) => candidate.id === planId);

  if (! publicPlan) {
    return plan;
  }

  const price = formatUsd(publicPlan.priceUsd);

  return {
    ...plan,
    planId,
    price,
    trial:
      locale === 'es'
        ? `Prueba gratis por 7 días y luego ${price} USD/${plan.cycle === 'year' ? 'año' : 'mes'}.`
        : `Try it free for 7 days, then ${price} USD/${plan.cycle === 'year' ? 'year' : 'month'}.`,
    features: buildPlanFeatures(publicPlan, publicPlans, locale),
  };
}

function buildPlanFeatures(
  plan: PublicSubscriptionPlan,
  publicPlans: PublicSubscriptionPlan[],
  locale: Locale,
): string[] {
  const number = (value: number) =>
    new Intl.NumberFormat(locale === 'es' ? 'es-CO' : 'en-US').format(value);
  const profiles = plan.limits.profiles ?? 1;
  const chatMessages = plan.limits.chat_messages ?? 1000;
  const incomingAudio = plan.limits.incoming_audio_messages ?? 500;
  const incomingAudioSeconds = plan.limits.incoming_audio_seconds ?? 15000;
  const audioMaxSeconds = incomingAudio > 0
    ? Math.floor(incomingAudioSeconds / incomingAudio)
    : 30;
  const ttsCharacters = plan.limits.tts_characters ?? 20000;
  const products = plan.capabilities.productsPerProfile ?? 15;
  const selectedMedia = Object.values(plan.capabilities.integrations)[0]?.selectedMedia ?? 10;
  const monthly = publicPlans.find((candidate) => candidate.id === 'starter');
  const savings =
    plan.id === 'starter_annual' && monthly
      ? Math.max(0, monthly.priceUsd * 12 - plan.priceUsd)
      : 0;

  if (locale === 'en') {
    return [
      `${number(profiles)} published digital presence`,
      'Initial avatar with image and short video',
      '1 clone of your own voice',
      `Up to ${number(chatMessages)} visitor text or audio messages per month`,
      `Up to ${number(incomingAudio)} incoming audios per month, maximum ${number(audioMaxSeconds)} seconds each`,
      `Up to ${number(ttsCharacters)} characters in audio replies per month`,
      `Up to ${number(products)} products per profile`,
      `Instagram and TikTok with up to ${number(selectedMedia)} selected media items per network`,
      'Public social network links',
      'Additional credits available for extendable limits',
      ...(savings > 0
        ? [`Save ${formatUsd(savings)} compared with monthly billing`]
        : []),
    ];
  }

  return [
    `${number(profiles)} presencia digital publicada`,
    'Avatar inicial con imagen y video breve',
    '1 clon de tu propia voz',
    `Hasta ${number(chatMessages)} mensajes de visitantes por texto o audio al mes`,
    `Hasta ${number(incomingAudio)} audios entrantes al mes, máximo ${number(audioMaxSeconds)} segundos cada uno`,
    `Hasta ${number(ttsCharacters)} caracteres en respuestas de audio al mes`,
    `Hasta ${number(products)} productos por perfil`,
    `Instagram, TikTok con hasta ${number(selectedMedia)} contenidos seleccionados por red`,
    'Enlaces públicos a redes sociales',
    'Créditos adicionales disponibles para límites ampliables',
    ...(savings > 0
      ? [`Ahorro de ${formatUsd(savings)} frente al pago mensual`]
      : []),
  ];
}

function formatUsd(value: number): string {
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)}`;
}

function ContactPhoneFieldsFallback({
  countryLabel,
  phoneLabel,
}: {
  countryLabel: string;
  phoneLabel: string;
}) {
  return (
    <div aria-busy="true" className="contact-phone-row contact-phone-row-loading">
      <label>
        {countryLabel}
        <select aria-label={countryLabel} defaultValue="+57" disabled>
          <option value="+57">Colombia (+57)</option>
        </select>
      </label>
      <label>
        {phoneLabel}
        <input aria-label={phoneLabel} disabled type="tel" />
      </label>
    </div>
  );
}

export function Home() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publicPlans, setPublicPlans] = useState<PublicSubscriptionPlan[]>([]);
  const [demoPhase, setDemoPhase] = useState(0);
  const [demoTypedText, setDemoTypedText] = useState('');
  const [isDemoVisible, setIsDemoVisible] = useState(false);
  const [isBrandVideoLoaded, setIsBrandVideoLoaded] = useState(false);
  const [isContactNearViewport, setIsContactNearViewport] = useState(false);
  const [shouldLoadDemoVideo, setShouldLoadDemoVideo] = useState(false);
  const [shouldLoadPlans, setShouldLoadPlans] = useState(false);
  const contactSectionRef = useRef<HTMLElement | null>(null);
  const demoContainerRef = useRef<HTMLDivElement | null>(null);
  const demoConversationRef = useRef<HTMLDivElement | null>(null);
  const demoVideoRef = useRef<HTMLVideoElement | null>(null);
  const plansSectionRef = useRef<HTMLElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const t = content[locale];
  const planItems = useMemo(
    () => t.plans.items.map((plan) => applyPublicPlanData(plan, locale, publicPlans)),
    [locale, publicPlans, t.plans.items],
  );
  const starterPlan = planItems.find((plan) => plan.cycle === 'month') ?? t.plans.items[0];
  const adminSignInUrl = getAdminSignInUrl(locale);
  const isCaptchaEnabled = TURNSTILE_SITE_KEY !== '';
  const heroProof =
    locale === 'es'
      ? ['Presencia con IA', 'Imagen autorizada', 'Tu voz clonada', 'Disponible 24/7']
      : ['AI presence', 'Authorized image', 'Your cloned voice', 'Available 24/7'];
  const contactHighlights =
    locale === 'es'
      ? ['Presencia pública lista para compartir', 'Mensajes por texto y audio', 'Respuestas basadas en información verificada']
      : ['Public presence ready to share', 'Text and audio messages', 'Replies based on verified information'];
  const demoSocials = [
    { href: 'https://instagram.com/', icon: 'instagram', label: 'Instagram' },
    { href: 'https://github.com/', icon: 'github', label: 'GitHub' },
    { href: 'https://linkedin.com/', icon: 'linkedin', label: 'LinkedIn' },
  ] as const;

  useEffect(() => {
    const isSpanish = locale === 'es';
    const title = isSpanish
      ? 'Bigmelo: perfiles interactivos con IA, imagen y voz'
      : 'Bigmelo: interactive AI profiles with image and voice';
    const description = isSpanish
      ? 'Crea una presencia digital interactiva con IA, imagen y voz para compartir tu experiencia, responder preguntas y conectar tus redes oficiales.'
      : 'Create an interactive digital presence with AI, image and voice to share your experience, answer questions and connect your official social profiles.';
    setPageMetadata({
      canonicalPath: '/',
      description,
      locale,
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Bigmelo', url: 'https://bigmelo.com/' },
          {
            '@type': 'Organization',
            logo: 'https://bigmelo.com/bigmelo-icon.png',
            name: 'Bigmelo',
            url: 'https://bigmelo.com/',
          },
          {
            '@type': 'SoftwareApplication',
            applicationCategory: 'BusinessApplication',
            name: 'Bigmelo',
            operatingSystem: 'Web',
            url: 'https://bigmelo.com/',
          },
        ],
      },
      title,
    });

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore blocked storage; language still works for the current session.
    }
  }, [locale]);

  useEffect(() => {
    const plansSection = plansSectionRef.current;

    if (! plansSection || typeof IntersectionObserver === 'undefined') {
      setShouldLoadPlans(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadPlans(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(plansSection);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (! shouldLoadPlans) {
      return undefined;
    }

    let cancelled = false;

    fetchPublicSubscriptionPlans()
      .then((plans) => {
        if (! cancelled) {
          setPublicPlans(plans);
        }
      })
      .catch(() => {
        // The localized catalog above remains available while the API is offline.
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoadPlans]);

  useEffect(() => {
    const contactSection = contactSectionRef.current;

    if (! contactSection || typeof IntersectionObserver === 'undefined') {
      setIsContactNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsContactNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '500px 0px' },
    );

    observer.observe(contactSection);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const demoContainer = demoContainerRef.current;

    if (! demoContainer || typeof IntersectionObserver === 'undefined') {
      setIsDemoVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsDemoVisible(entry.isIntersecting);
      },
      { threshold: 0.2 },
    );

    observer.observe(demoContainer);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (! isDemoVisible || shouldLoadDemoVideo) {
      return undefined;
    }

    const connection = (navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }).connection;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersReducedData = connection?.saveData === true
      || connection?.effectiveType === 'slow-2g'
      || connection?.effectiveType === '2g';

    if (prefersReducedMotion || prefersReducedData) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldLoadDemoVideo(true);
    }, 1_500);

    return () => window.clearTimeout(timeoutId);
  }, [isDemoVisible, shouldLoadDemoVideo]);

  useEffect(() => {
    const video = demoVideoRef.current;

    if (! video) {
      return;
    }

    if (isDemoVisible) {
      void video.play().catch(() => {
        // Browsers may still reject autoplay; the optimized poster remains visible.
      });
    } else {
      video.pause();
    }
  }, [isDemoVisible, shouldLoadDemoVideo]);

  useEffect(() => {
    setDemoPhase(0);
    setDemoTypedText('');
  }, [locale]);

  useEffect(() => {
    if (! isDemoVisible) {
      return undefined;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDemoPhase(6);
      setDemoTypedText('');
      return undefined;
    }

    let intervalId: number | undefined;
    let timeoutId: number | undefined;
    const typingText = demoPhase === 1
      ? t.hero.demoQuestionOne
      : demoPhase === 4
        ? t.hero.demoQuestionTwo
        : '';

    if (typingText) {
      let characterIndex = 0;
      setDemoTypedText('');
      intervalId = window.setInterval(() => {
        characterIndex += 1;
        setDemoTypedText(typingText.slice(0, characterIndex));

        if (characterIndex >= typingText.length) {
          window.clearInterval(intervalId);
          timeoutId = window.setTimeout(() => {
            setDemoPhase((currentPhase) => currentPhase + 1);
          }, 450);
        }
      }, 52);
    } else {
      setDemoTypedText('');
      const phaseDuration = [2200, 0, 1100, 5200, 0, 1100, 6000][demoPhase] ?? 2200;
      timeoutId = window.setTimeout(() => {
        setDemoPhase((currentPhase) => currentPhase >= 6 ? 0 : currentPhase + 1);
      }, phaseDuration);
    }

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [demoPhase, isDemoVisible, t.hero.demoQuestionOne, t.hero.demoQuestionTwo]);

  useEffect(() => {
    const conversation = demoConversationRef.current;

    if (! conversation || ! isDemoVisible) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      conversation.scrollTo({
        behavior: demoPhase === 0 ? 'auto' : 'smooth',
        top: demoPhase === 0 ? 0 : conversation.scrollHeight,
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [demoPhase, isDemoVisible]);

  useEffect(() => {
    if (! isCaptchaEnabled || ! isContactNearViewport) {
      return undefined;
    }

    let isCancelled = false;
    setCaptchaToken('');
    setCaptchaError(false);

    loadTurnstileScript()
      .then(() => {
        if (isCancelled || ! turnstileContainerRef.current || ! window.turnstile) {
          return;
        }

        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          language: locale,
          callback: (token) => {
            setCaptchaToken(token);
            setCaptchaError(false);
          },
          'expired-callback': () => {
            setCaptchaToken('');
          },
          'error-callback': () => {
            setCaptchaToken('');
            setCaptchaError(true);
          },
        });
      })
      .catch(() => {
        if (! isCancelled) {
          setCaptchaError(true);
        }
      });

    return () => {
      isCancelled = true;

      if (turnstileWidgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
      }

      turnstileWidgetIdRef.current = null;
    };
  }, [isCaptchaEnabled, isContactNearViewport, locale]);

  function resetCaptchaWidget() {
    if (! isCaptchaEnabled) {
      return;
    }

    setCaptchaToken('');

    if (turnstileWidgetIdRef.current) {
      window.turnstile?.reset(turnstileWidgetIdRef.current);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fieldValue = (name: string) => String(formData.get(name) ?? '').trim();

    setIsSubmitted(false);
    setSubmitError(null);
    setIsSubmitting(true);

    if (isCaptchaEnabled && ! captchaToken) {
      setSubmitError(t.contact.captchaRequired);
      setIsSubmitting(false);

      return;
    }

    try {
      await submitContactSubmission({
        captchaToken: captchaToken || undefined,
        consentAccepted: formData.get('consent_accepted') === 'on',
        email: fieldValue('email'),
        locale,
        message: fieldValue('message'),
        name: fieldValue('name'),
        pageUrl: window.location.href,
        phoneCountryCode: fieldValue('phone_country_code'),
        phoneNumber: fieldValue('phone_number'),
        referrer: document.referrer || undefined,
        source: 'landing_page',
      });

      form.reset();
      setIsSubmitted(true);
      trackAnalyticsEvent('generate_lead', { form_name: 'landing_contact' });
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : t.contact.error);
    } finally {
      resetCaptchaWidget();
      setIsSubmitting(false);
    }
  }

  return (
    <main className="landing-page">
      <header className="site-header" aria-label="Bigmelo">
        <a className="brand" href="#top" aria-label="Bigmelo">
          <img className="brand-logo" alt="Bigmelo" height="98" src={bigmeloLogo} width="382" />
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a href="#product">{t.nav.product}</a>
          <a href="#plans">{t.nav.plans}</a>
          <a href="#contact">{t.nav.contact}</a>
        </nav>

        <div className="header-actions">
          <a className="admin-link" href={adminSignInUrl}>
            {t.nav.signIn}
          </a>

          <div className="language-switch" aria-label={locale === 'es' ? 'Idioma' : 'Language'}>
            <button
              className={locale === 'es' ? 'is-active' : ''}
              type="button"
              onClick={() => setLocale('es')}
            >
              ES
            </button>
            <button
              className={locale === 'en' ? 'is-active' : ''}
              type="button"
              onClick={() => setLocale('en')}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <section className="hero-section" id="top">
        <div className="hero-scene" aria-hidden="true">
          <div className="scene-grid" />
          <div className="scene-glow scene-glow-one" />
          <div className="scene-glow scene-glow-two" />
        </div>

        <div className="hero-content" id="product">
          <p className="eyebrow">{t.hero.eyebrow}</p>
          <h1>{t.hero.title}</h1>
          <p className="hero-lead">{t.hero.lead}</p>

          <div className="hero-actions">
            <a className="button button-primary hero-avatar-button" href="#contact">
              <img alt="" height="96" src={LANDING_DEMO_THUMBNAIL_URL} width="96" />
              <span>{t.hero.primaryCta}</span>
            </a>
            <a className="button button-secondary button-arrow" href="#plans">
              <span>{t.hero.secondaryCta}</span>
              <i aria-hidden="true" />
            </a>
          </div>

          <div className="hero-proof" aria-label="Highlights">
            {heroProof.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div
          aria-label={t.hero.demoAria}
          className="hero-product-demo"
          id="profile-demo"
          ref={demoContainerRef}
          role="region"
        >
          <div className="demo-profile-name">{t.hero.profileName}</div>
          <div className="demo-profile-alias">{t.hero.profileRole}</div>
          <div className="demo-social-links" aria-label={locale === 'es' ? 'Redes de ejemplo' : 'Example social links'}>
            {demoSocials.map((network) => (
              <a
                aria-label={network.label}
                className="demo-social-link"
                href={network.href}
                key={network.label}
                rel="noopener noreferrer"
                target="_blank"
                title={network.label}
              >
                <DemoSocialIcon name={network.icon} />
              </a>
            ))}
          </div>

          <div className="demo-chat-surface">
            <div className="demo-avatar-stage">
              <span className="demo-ring demo-ring-one" />
              <span className="demo-ring demo-ring-two" />
              <span className="demo-ring demo-ring-three" />
              <div className="landing-avatar">
                {shouldLoadDemoVideo ? (
                  <video
                    aria-hidden="true"
                    autoPlay
                    className="landing-avatar-image"
                    height="480"
                    loop
                    muted
                    playsInline
                    poster={LANDING_DEMO_IMAGE_URL}
                    preload="metadata"
                    ref={demoVideoRef}
                    width="480"
                  >
                    <source src={LANDING_DEMO_VIDEO_URL} type="video/mp4" />
                  </video>
                ) : (
                  <img
                    alt=""
                    className="landing-avatar-image"
                    decoding="async"
                    fetchPriority="high"
                    height="512"
                    src={LANDING_DEMO_IMAGE_URL}
                    width="512"
                  />
                )}
              </div>
              <div className="demo-avatar-audio" aria-hidden="true">
                <SpeakerIcon />
              </div>
            </div>

            <div
              aria-live="off"
              className="demo-conversation-viewport"
              ref={demoConversationRef}
            >
              <div className="demo-conversation-list">
                <div className="demo-message-row assistant">
                  <article className="demo-message assistant is-entering">
                    <span className="demo-message-avatar-wrap">
                      <img alt="" className="demo-message-avatar" height="96" src={LANDING_DEMO_THUMBNAIL_URL} width="96" />
                      <i className="demo-message-play" aria-hidden="true" />
                    </span>
                    <div className="demo-message-content">
                      <p>{t.hero.demoIntro}</p>
                      <time>10:30 AM</time>
                    </div>
                  </article>
                </div>

                {demoPhase >= 2 ? (
                  <div className="demo-message-row visitor">
                    <article className="demo-message visitor is-entering">
                      <div className="demo-message-content">
                        <p>{t.hero.demoQuestionOne}</p>
                        <time>10:31 AM</time>
                      </div>
                    </article>
                  </div>
                ) : null}

                {demoPhase === 2 ? (
                  <div className="demo-message-row assistant">
                    <article className="demo-message assistant is-entering">
                      <span className="demo-message-avatar-wrap">
                        <img alt="" className="demo-message-avatar" height="96" src={LANDING_DEMO_THUMBNAIL_URL} width="96" />
                      </span>
                      <div className="demo-message-content demo-typing-message" aria-label={t.hero.demoTyping}>
                        <span />
                        <span />
                        <span />
                      </div>
                    </article>
                  </div>
                ) : null}

                {demoPhase >= 3 ? (
                  <div className="demo-message-row assistant">
                    <article className="demo-message assistant is-entering">
                      <span className="demo-message-avatar-wrap">
                        <img alt="" className="demo-message-avatar" height="96" src={LANDING_DEMO_THUMBNAIL_URL} width="96" />
                        <i className="demo-message-play" aria-hidden="true" />
                      </span>
                      <div className="demo-message-stack">
                        <div className="demo-message-content">
                          <p>{t.hero.demoAnswerOne}</p>
                          <time>10:31 AM</time>
                        </div>
                        <a
                          className="demo-youtube-card"
                          href={LANDING_YOUTUBE_URL}
                          rel="noopener noreferrer"
                          target="_blank"
                          onClick={() => {
                            trackAnalyticsEvent('select_content', {
                              content_type: 'landing_chat_video',
                              item_id: 'profile_creation_video',
                            });
                          }}
                        >
                          <span className="demo-youtube-thumbnail">
                            <img alt="" decoding="async" height="360" loading="lazy" src={LANDING_YOUTUBE_THUMBNAIL_URL} width="480" />
                            <i aria-hidden="true" />
                          </span>
                          <span className="demo-youtube-copy">
                            <strong>{t.hero.demoVideoTitle}</strong>
                            <small>{t.hero.demoVideoAction}</small>
                          </span>
                        </a>
                      </div>
                    </article>
                  </div>
                ) : null}

                {demoPhase >= 5 ? (
                  <div className="demo-message-row visitor">
                    <article className="demo-message visitor is-entering">
                      <div className="demo-message-content">
                        <p>{t.hero.demoQuestionTwo}</p>
                        <time>10:32 AM</time>
                      </div>
                    </article>
                  </div>
                ) : null}

                {demoPhase === 5 ? (
                  <div className="demo-message-row assistant">
                    <article className="demo-message assistant is-entering">
                      <span className="demo-message-avatar-wrap">
                        <img alt="" className="demo-message-avatar" height="96" src={LANDING_DEMO_THUMBNAIL_URL} width="96" />
                      </span>
                      <div className="demo-message-content demo-typing-message" aria-label={t.hero.demoTyping}>
                        <span />
                        <span />
                        <span />
                      </div>
                    </article>
                  </div>
                ) : null}

                {demoPhase >= 6 ? (
                  <div className="demo-message-row assistant">
                    <article className="demo-message assistant is-entering">
                      <span className="demo-message-avatar-wrap">
                        <img alt="" className="demo-message-avatar" height="96" src={LANDING_DEMO_THUMBNAIL_URL} width="96" />
                        <i className="demo-message-play" aria-hidden="true" />
                      </span>
                      <div className="demo-message-stack">
                        <div className="demo-message-content">
                          <p>{t.hero.demoAnswerTwo}</p>
                          <time>10:32 AM</time>
                        </div>
                        <article className="demo-starter-card">
                          <div className="demo-starter-image">
                            <img alt="Bigmelo" height="98" loading="lazy" src={bigmeloLogo} width="382" />
                          </div>
                          <div className="demo-starter-copy">
                            <span>{starterPlan.label}</span>
                            <strong>{starterPlan.name}</strong>
                            <p>{starterPlan.price} {starterPlan.period}</p>
                            <a
                              href={getPlanCheckoutUrl(starterPlan, locale)}
                              onClick={() => {
                                trackAnalyticsEvent('select_content', {
                                  content_type: 'landing_chat_plan',
                                  item_id: 'starter_monthly',
                                });
                              }}
                            >
                              {t.hero.demoPlanAction}
                            </a>
                          </div>
                        </article>
                      </div>
                    </article>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="demo-composer">
              <div className={demoTypedText ? 'demo-input is-typing' : 'demo-input'}>
                <span>{demoTypedText || (locale === 'es' ? 'Escribe tu mensaje...' : 'Write your message...')}</span>
                {demoTypedText ? <i aria-hidden="true" /> : null}
              </div>
              <div className="demo-action" aria-hidden="true">
                <MicrophoneIcon />
              </div>
              <div
                aria-hidden="true"
                className={demoTypedText ? 'demo-action demo-send-action is-active' : 'demo-action demo-send-action'}
              >
                <SendIcon />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="plans-section section-shell" id="plans" ref={plansSectionRef}>
        <div className="section-heading">
          <p className="eyebrow">{t.plans.eyebrow}</p>
          <h2>{t.plans.title}</h2>
          <p>{t.plans.lead}</p>
        </div>

        <div className="plans-grid">
          {planItems.map((plan) => (
            <article className={plan.highlighted ? 'plan-card highlighted' : 'plan-card'} key={`${plan.name}-${plan.period}`}>
              <div>
                <span className="plan-label">{plan.label}</span>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>

              <div className="plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
              </div>

              <p className="plan-trial">{plan.trial}</p>

              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <a className="button plan-button" href={getPlanCheckoutUrl(plan, locale)}>
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="brand-video-section section-shell" aria-labelledby="brand-video-title">
        <div className="brand-video-card">
          <div className="brand-video-copy">
            <p className="eyebrow">{t.video.eyebrow}</p>
            <h2 id="brand-video-title">{t.video.title}</h2>
            <p>{t.video.lead}</p>

            <div className="brand-video-actions">
              <a
                className="button button-primary brand-video-button"
                href={getPlanCheckoutUrl(starterPlan, locale)}
                onClick={() => {
                  trackAnalyticsEvent('select_content', {
                    content_type: 'landing_video_cta',
                    item_id: 'starter_monthly',
                  });
                }}
              >
                {t.video.cta}
              </a>
              <p className="brand-video-trial">{t.video.note}</p>
            </div>
          </div>

          <div className="brand-video-media">
            <div className="brand-video-frame">
              {isBrandVideoLoaded ? (
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={LANDING_VIDEO_EMBED_URL}
                  title={t.video.videoTitle}
                />
              ) : (
                <button
                  aria-label={t.video.videoTitle}
                  className="brand-video-placeholder"
                  onClick={() => {
                    setIsBrandVideoLoaded(true);
                    trackAnalyticsEvent('select_content', {
                      content_type: 'landing_video_play',
                      item_id: 'bigmelo_overview',
                    });
                  }}
                  type="button"
                >
                  <img
                    alt=""
                    decoding="async"
                    height="360"
                    loading="lazy"
                    src={LANDING_YOUTUBE_THUMBNAIL_URL}
                    width="480"
                  />
                  <span aria-hidden="true" className="brand-video-play" />
                </button>
              )}
            </div>
            <p>{t.video.videoTitle}</p>
          </div>
        </div>
      </section>

      <section className="contact-section section-shell" id="contact" ref={contactSectionRef}>
        <div className="contact-copy">
          <p className="eyebrow">{t.contact.eyebrow}</p>
          <h2>{t.contact.title}</h2>
          <p>{t.contact.lead}</p>

          <div className="contact-highlights">
            {contactHighlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <form
          aria-busy={isSubmitting}
          className="contact-form"
          onFocusCapture={() => setIsContactNearViewport(true)}
          onPointerDownCapture={() => setIsContactNearViewport(true)}
          onSubmit={handleSubmit}
        >
          <label>
            {t.contact.name}
            <input name="name" autoComplete="name" required />
          </label>

          <label>
            {t.contact.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <Suspense
            fallback={(
              <ContactPhoneFieldsFallback
                countryLabel={t.contact.phoneCountry}
                phoneLabel={t.contact.phone}
              />
            )}
          >
            {isContactNearViewport ? (
              <ContactPhoneFields
                countryLabel={t.contact.phoneCountry}
                locale={locale}
                phoneLabel={t.contact.phone}
              />
            ) : (
              <ContactPhoneFieldsFallback
                countryLabel={t.contact.phoneCountry}
                phoneLabel={t.contact.phone}
              />
            )}
          </Suspense>

          <label>
            {t.contact.message}
            <textarea name="message" rows={5} required />
          </label>

          <label className="contact-consent">
            <input name="consent_accepted" type="checkbox" required />
            <span>{t.contact.consent}</span>
          </label>

          {isCaptchaEnabled ? (
            <div className="contact-captcha">
              <div ref={turnstileContainerRef} />
              {captchaError ? (
                <p className="form-error" role="alert">
                  {t.contact.captchaError}
                </p>
              ) : null}
            </div>
          ) : null}

          <button className="button button-primary" disabled={isSubmitting || (isCaptchaEnabled && ! captchaToken)} type="submit">
            {isSubmitting ? t.contact.submitting : t.contact.submit}
          </button>

          {submitError ? (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          ) : null}
          {isSubmitted ? <p className="form-success">{t.contact.success}</p> : null}
        </form>
      </section>

      <footer className="site-footer">
        <a className="brand" href="#top" aria-label="Bigmelo">
          <img className="brand-logo" alt="Bigmelo" height="98" loading="lazy" src={bigmeloLogo} width="382" />
        </a>

        <p>{t.footer.tagline}</p>

        <div>
          <a href={locale === 'es' ? '/privacidad' : '/privacy'}>{t.footer.privacy}</a>
          <a href={locale === 'es' ? '/terminos' : '/terms'}>{t.footer.terms}</a>
          <a href={locale === 'es' ? '/eliminacion-datos' : '/data-deletion'}>{t.footer.dataDeletion}</a>
        </div>
      </footer>
    </main>
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

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 14.5h3.1l4.9 4V5.5l-4.9 4H4.5v5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M16 9.2c.8.78 1.25 1.78 1.25 2.8S16.8 14.02 16 14.8M18.4 6.6A7.3 7.3 0 0 1 20.75 12a7.3 7.3 0 0 1-2.35 5.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function DemoSocialIcon({ name }: { name: 'instagram' | 'github' | 'linkedin' }) {
  if (name === 'instagram') {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <rect height="15.5" rx="4.2" stroke="currentColor" strokeWidth="1.9" width="15.5" x="4.25" y="4.25" />
        <circle cx="12" cy="12" r="3.35" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="16.75" cy="7.35" fill="currentColor" r="1.05" />
      </svg>
    );
  }

  if (name === 'github') {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 3.75a8.45 8.45 0 0 0-2.67 16.47c.42.08.58-.18.58-.4v-1.42c-2.36.52-2.86-1-2.86-1-.38-.96-.92-1.22-.92-1.22-.75-.52.06-.5.06-.5.83.06 1.27.86 1.27.86.74 1.27 1.95.9 2.42.69.08-.54.29-.9.53-1.11-1.88-.22-3.86-.94-3.86-4.18 0-.92.33-1.68.86-2.27-.09-.22-.38-1.08.08-2.24 0 0 .7-.23 2.32.86A7.9 7.9 0 0 1 12 7.99c.72 0 1.45.1 2.13.29 1.61-1.09 2.31-.86 2.31-.86.46 1.16.17 2.02.08 2.24.54.59.86 1.35.86 2.27 0 3.25-1.98 3.96-3.87 4.17.3.26.57.78.57 1.58v2.14c0 .22.15.49.59.4A8.45 8.45 0 0 0 12 3.75Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M6.4 9.8v8.1M6.4 6.15v.08M10.4 17.9v-8.1M10.4 13.45c0-2.1 1.25-3.85 3.35-3.85 1.9 0 3.25 1.23 3.25 3.73v4.57" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}
