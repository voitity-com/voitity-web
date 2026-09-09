import { lazy, Suspense, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import bigmeloLogo from '../assets/bigmelo-logo.webp';
import homeSeo from '../content/home-seo.json';
import { getAdminBaseUrl, getAdminSignInUrl } from '../lib/admin-url';
import { submitContactSubmission } from '../lib/contact-api';
import { openAnalyticsPreferences, trackAnalyticsEvent } from '../lib/google-analytics';
import { setPageMetadata } from '../lib/page-metadata';
import { fetchPublicSubscriptionPlans, type PublicSubscriptionPlan } from '../lib/plans-api';
import '../styles/home-proposals.css';

export type HomeProposalVariant = 'homev01' | 'homev02' | 'homev03';
type Locale = 'es' | 'en';
type DemoDevice = 'desktop' | 'mobile';
type BillingCycle = 'month' | 'year';
type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

type ProposalCopy = {
  concept: string;
  demoLead: string;
  demoTitle: string;
  eyebrow: string;
  lead: string;
  mobileLead: string;
  mobileTitle: string;
  title: string;
};

type DisplayPlan = {
  cycle: BillingCycle;
  description: string;
  features: string[];
  highlighted?: boolean;
  id: string;
  label: string;
  period: string;
  price: string;
};

const ContactPhoneFields = lazy(async () => {
  const module = await import('../components/ContactPhoneFields');

  return { default: module.ContactPhoneFields };
});

const DEMO_PROFILE_URL = 'https://bigmelo.com/bigsofia';
const DEMO_PROFILE_EMBED_URL = `${DEMO_PROFILE_URL}?landing_demo=1`;
const VIDEO_URL = 'https://www.youtube.com/watch?v=pBxiwqnSBqo';
const VIDEO_EMBED_URL = 'https://www.youtube-nocookie.com/embed/pBxiwqnSBqo?rel=0&playsinline=1&autoplay=1';
const VIDEO_THUMBNAIL_URL = '/media/landing/bigmelo-overview-video-480.webp';
const TURNSTILE_SITE_KEY = ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim();
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOCALE_STORAGE_KEY = 'bigmelo-locale';
const DEMO_MOBILE_QUERY = '(max-width: 700px)';

function isDemoMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(DEMO_MOBILE_QUERY).matches;
}

const proposalCopy: Record<Locale, Record<HomeProposalVariant, ProposalCopy>> = {
  es: {
    homev01: {
      concept: 'CLARIDAD EDITORIAL',
      demoLead: 'Abre el perfil real de Sofía, conversa por texto o audio y explóralo sin salir de la página.',
      demoTitle: 'Conoce una presencia que ya está conversando.',
      eyebrow: 'TU PRESENCIA, SIEMPRE LISTA',
      lead: 'Convierte tu experiencia, tu contenido y tu voz en un perfil inteligente que responde incluso cuando tú no estás.',
      mobileLead: 'Tu historia, tus respuestas y tus productos conservan toda su claridad en una pantalla pequeña.',
      mobileTitle: 'Diseñado para donde tu audiencia ya está: su teléfono.',
      title: 'Una versión de ti que conversa, orienta y conecta.',
    },
    homev02: {
      concept: 'EXPERIENCIA INMERSIVA',
      demoLead: 'Prueba el perfil real de Sofía aquí mismo. Haz una pregunta, escucha su voz y mira cómo cambia al formato móvil.',
      demoTitle: 'La mejor explicación es una conversación real.',
      eyebrow: 'PRESENCIA DIGITAL CON IA',
      lead: 'Bigmelo transforma tu conocimiento en una experiencia viva: habla, responde y acerca a cada persona a lo que ofreces.',
      mobileLead: 'Una interfaz táctil, directa y personal para conversar, escuchar y descubrir sin fricción.',
      mobileTitle: 'Tu presencia entra en escena, en cualquier pantalla.',
      title: 'No publiques otro link. Publica una conversación.',
    },
    homev03: {
      concept: 'ESTUDIO DE IDENTIDAD',
      demoLead: 'Explora a BigSofia como visitante desde un lienzo web o dentro de un teléfono. El contenido es real y está activo.',
      demoTitle: 'Mira cómo se siente tener un perfil que sabe responder.',
      eyebrow: 'TU MUNDO EN UN SOLO LUGAR',
      lead: 'Una página pública con tu identidad, tu voz y respuestas basadas únicamente en la información que tú apruebas.',
      mobileLead: 'Cada bloque se ordena alrededor de la conversación para que tu audiencia encuentre respuestas y el siguiente paso.',
      mobileTitle: 'Tu identidad no se encoge en móvil. Se vuelve más cercana.',
      title: 'Todo lo que sabes. Ahora sí puede responder.',
    },
  },
  en: {
    homev01: {
      concept: 'EDITORIAL CLARITY',
      demoLead: "Open Sofía's live profile, talk by text or audio, and explore it without leaving the page.",
      demoTitle: 'Meet a presence that is already having conversations.',
      eyebrow: 'YOUR PRESENCE, ALWAYS READY',
      lead: 'Turn your experience, content, and voice into an intelligent profile that answers even when you are away.',
      mobileLead: 'Your story, answers, and products stay clear and easy to explore on a small screen.',
      mobileTitle: 'Designed for where your audience already is: their phone.',
      title: 'A version of you that talks, guides, and connects.',
    },
    homev02: {
      concept: 'IMMERSIVE EXPERIENCE',
      demoLead: "Try Sofía's live profile right here. Ask a question, hear her voice, and see how it adapts to mobile.",
      demoTitle: 'The best explanation is a real conversation.',
      eyebrow: 'AI-POWERED DIGITAL PRESENCE',
      lead: 'Bigmelo turns your knowledge into a living experience that speaks, answers, and brings every visitor closer to what you offer.',
      mobileLead: 'A direct, personal, touch-first interface for talking, listening, and discovering without friction.',
      mobileTitle: 'Your presence steps into view on every screen.',
      title: 'Do not publish another link. Publish a conversation.',
    },
    homev03: {
      concept: 'IDENTITY STUDIO',
      demoLead: 'Explore BigSofia as a visitor on a web canvas or inside a phone. The content is real and active.',
      demoTitle: 'See what it feels like to have a profile that knows how to answer.',
      eyebrow: 'YOUR WORLD IN ONE PLACE',
      lead: 'A public page with your identity, voice, and answers based only on the information you approve.',
      mobileLead: 'Every block is organized around the conversation so your audience can find answers and the next step.',
      mobileTitle: 'Your identity does not shrink on mobile. It feels closer.',
      title: 'Everything you know can finally answer.',
    },
  },
};

const pageCopy = {
  es: {
    header: {
      contact: 'Contacto',
      english: 'English',
      language: 'Idioma',
      linkInBio: 'Link in bio',
      menu: 'Menú',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      navLabel: 'Navegación principal',
      plans: 'Planes',
      signIn: 'Ingresar',
      spanish: 'Español',
      trial: 'Probar 7 días',
    },
    hero: {
      altBack: 'Vista móvil alternativa de un perfil Bigmelo',
      altFront: 'Vista móvil alternativa de otro perfil Bigmelo',
      altMain: 'Conversación móvil de Sofía Mendoza en Bigmelo',
      create: 'Crear mi Bigmelo',
      demo: 'Ver demo real',
      live: 'DEMO REAL',
      previewAria: 'Tres vistas previas móviles reales de Bigmelo',
      trial: '7 días gratis · Requiere tarjeta · Cancela antes del primer cobro.',
    },
    signal: {
      aria: 'Capacidades principales',
      items: ['Texto y audio', 'Tu imagen y voz', 'Contenido verificado', 'Productos y enlaces', 'Disponible 24/7'],
    },
    mobile: {
      alts: ['Portada de un perfil móvil Bigmelo', 'Conversación móvil real de Bigmelo', 'Contenido y producto en Bigmelo móvil'],
      cards: ['01 · Presencia', '02 · Conversación', '03 · Acción'],
      eyebrow: 'EXPERIENCIA MÓVIL',
    },
    bio: {
      aria: 'Recorrido desde Instagram hasta Bigmelo',
      animationAria: 'Animación: una mano toca el enlace de Bigmelo en el perfil de Instagram de Sofía y aparece su perfil conversacional de Bigmelo.',
      eyebrow: 'DE INSTAGRAM A UNA CONVERSACIÓN',
      lead: 'Tu audiencia toca el enlace de tu perfil y llega a una presencia que explica, conversa y recomienda, incluso cuando tú no estás.',
      steps: [
        { strong: 'Te descubre', text: 'en el contenido que ya publicas.' },
        { strong: 'Abre tu enlace', text: 'desde la bio de Instagram.' },
        { strong: 'Bigmelo continúa', text: 'con una conversación útil.' },
      ],
      title: 'El link en bio que responde por ti.',
    },
    demo: {
      close: 'Cerrar demo',
      dialogEyebrow: 'BIGSOFIA · DEMO REAL',
      dialogTitle: 'Conversa con Sofía',
      eyebrow: 'BIGSOFIA · PERFIL EN VIVO',
      iframeTitle: 'Demo interactiva de Sofía Mendoza en Bigmelo',
      launchButton: 'Abrir demo interactiva',
      launchEyebrow: 'DEMO INTERACTIVA · TEXTO Y AUDIO',
      live: 'PERFIL EN VIVO',
      loading: 'Cargando el perfil real de Sofía…',
      mobile: 'Móvil',
      newTab: 'Nueva pestaña',
      openBigSofia: 'Abrir BigSofia',
      openTab: 'Abrir en otra pestaña',
      slow: 'La demo está tardando más de lo esperado.',
      toggleAria: 'Tamaño de la demostración',
      web: 'Web',
    },
    capabilities: {
      eyebrow: 'CÓMO FUNCIONA',
      items: [
        { title: 'Responde con lo que tú apruebas.', text: 'Agrega tu historia, experiencia y fuentes. Bigmelo utiliza esa información para orientar cada conversación.' },
        { title: 'Suena y se siente como tu marca.', text: 'Personaliza la apariencia, el avatar y una voz clonada con autorización para construir una presencia coherente.' },
        { title: 'Convierte interés en un siguiente paso.', text: 'Presenta productos, contenido y redes dentro de la conversación cuando realmente son relevantes.' },
      ],
      title: 'Tu experiencia deja de ser contenido suelto y se vuelve útil.',
    },
    plans: {
      allIncluded: 'TODO INCLUIDO',
      allIncludedTitle: 'El mismo Starter completo en ambos planes.',
      bestValue: 'Mejor valor',
      eyebrow: 'PLANES ACTUALES',
      fallbackSource: 'Precios disponibles actualmente',
      lead: 'Ambas opciones incluyen siete días de prueba y las funciones necesarias para publicar tu primera presencia digital.',
      liveSource: 'Precios sincronizados con Bigmelo',
      select: 'Elegir Starter',
      title: 'Empieza completo. Elige cómo pagarlo.',
      trial: '7 días gratis. Cancela antes del primer cobro.',
    },
    video: {
      eyebrow: 'BIGMELO EN ACCIÓN',
      iframeTitle: 'Bigmelo, la herramienta inteligente para potenciar tu marca personal',
      lead: 'Conoce cómo Bigmelo convierte experiencia, contenido, imagen y voz en una presencia digital lista para conversar.',
      playAria: 'Reproducir video promocional de Bigmelo',
      title: 'Tu marca personal, disponible incluso cuando tú no estás.',
      titleAlternative: 'Tu marca personal puede estar disponible incluso cuando tú no lo estás.',
      thumbnailAlt: 'Vista previa del video promocional de Bigmelo',
      watch: 'Ver en YouTube',
    },
    contact: {
      benefits: ['Perfil público listo para compartir', 'Conversaciones por texto y audio', 'Información verificada por ti'],
      captchaError: 'No fue posible cargar la verificación. Recarga la página.',
      captchaRequired: 'Completa la verificación antes de enviar.',
      consent: 'Acepto que Bigmelo use estos datos para responder mi solicitud.',
      country: 'Indicativo',
      email: 'Correo',
      emailPlaceholder: 'nombre@correo.com',
      error: 'No fue posible enviar tu solicitud. Intenta de nuevo.',
      eyebrow: 'CONTACTO',
      lead: 'Cuéntanos quién eres y qué quieres que tu audiencia pueda descubrir, preguntar o hacer.',
      message: '¿Qué quieres crear?',
      messagePlaceholder: 'Cuéntanos sobre tu perfil, audiencia u objetivo…',
      name: 'Nombre',
      namePlaceholder: 'Tu nombre',
      phone: 'Teléfono',
      submit: 'Quiero hablar con Bigmelo',
      submitting: 'Enviando…',
      success: 'Gracias. Recibimos tu solicitud y te contactaremos pronto.',
      title: 'Hablemos de la presencia digital que quieres crear.',
    },
    footer: {
      cta: 'Crear mi Bigmelo',
      data: 'Datos',
      eyebrow: 'LISTO CUANDO TÚ LO ESTÉS',
      legalAria: 'Enlaces legales',
      preferences: 'Preferencias de cookies',
      privacy: 'Privacidad',
      tagline: 'Perfiles interactivos con inteligencia artificial, imagen y voz.',
      terms: 'Términos',
      title: 'Tu presencia puede empezar a responder hoy.',
    },
  },
  en: {
    header: {
      contact: 'Contact',
      english: 'English',
      language: 'Language',
      linkInBio: 'Link in bio',
      menu: 'Menu',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      navLabel: 'Main navigation',
      plans: 'Plans',
      signIn: 'Sign in',
      spanish: 'Español',
      trial: 'Try 7 days',
    },
    hero: {
      altBack: 'Alternative mobile view of a Bigmelo profile',
      altFront: 'Alternative mobile view of another Bigmelo profile',
      altMain: 'Sofía Mendoza mobile conversation on Bigmelo',
      create: 'Create my Bigmelo',
      demo: 'See live demo',
      live: 'LIVE DEMO',
      previewAria: 'Three real mobile previews of Bigmelo',
      trial: '7-day free trial · Card required · Cancel before your first charge.',
    },
    signal: {
      aria: 'Core capabilities',
      items: ['Text and audio', 'Your image and voice', 'Verified content', 'Products and links', 'Available 24/7'],
    },
    mobile: {
      alts: ['Cover of a mobile Bigmelo profile', 'Real Bigmelo mobile conversation', 'Content and product in Bigmelo mobile'],
      cards: ['01 · Presence', '02 · Conversation', '03 · Action'],
      eyebrow: 'MOBILE EXPERIENCE',
    },
    bio: {
      aria: 'Journey from Instagram to Bigmelo',
      animationAria: "Animation: a hand taps the Bigmelo link on Sofía's Instagram profile and her conversational Bigmelo profile appears.",
      eyebrow: 'FROM INSTAGRAM TO A CONVERSATION',
      lead: 'Your audience taps the link in your profile and reaches a presence that explains, talks, and recommends, even when you are away.',
      steps: [
        { strong: 'They discover you', text: 'through the content you already publish.' },
        { strong: 'They open your link', text: 'from your Instagram bio.' },
        { strong: 'Bigmelo continues', text: 'with a useful conversation.' },
      ],
      title: 'The link in bio that answers for you.',
    },
    demo: {
      close: 'Close demo',
      dialogEyebrow: 'BIGSOFIA · LIVE DEMO',
      dialogTitle: 'Talk with Sofía',
      eyebrow: 'BIGSOFIA · LIVE PROFILE',
      iframeTitle: 'Interactive demo of Sofía Mendoza on Bigmelo',
      launchButton: 'Open interactive demo',
      launchEyebrow: 'INTERACTIVE DEMO · TEXT AND AUDIO',
      live: 'LIVE PROFILE',
      loading: "Loading Sofía's live profile…",
      mobile: 'Mobile',
      newTab: 'New tab',
      openBigSofia: 'Open BigSofia',
      openTab: 'Open in a new tab',
      slow: 'The demo is taking longer than expected.',
      toggleAria: 'Demo viewport size',
      web: 'Web',
    },
    capabilities: {
      eyebrow: 'HOW IT WORKS',
      items: [
        { title: 'Answers with what you approve.', text: 'Add your story, experience, and sources. Bigmelo uses that information to guide every conversation.' },
        { title: 'Looks and sounds like your brand.', text: 'Customize the look, avatar, and an authorized cloned voice to build a consistent presence.' },
        { title: 'Turns interest into a next step.', text: 'Shows products, content, and social profiles inside the conversation when they are truly relevant.' },
      ],
      title: 'Your experience stops being scattered content and becomes useful.',
    },
    plans: {
      allIncluded: 'EVERYTHING INCLUDED',
      allIncludedTitle: 'The same complete Starter experience in both plans.',
      bestValue: 'Best value',
      eyebrow: 'CURRENT PLANS',
      fallbackSource: 'Current prices available',
      lead: 'Both options include a seven-day trial and everything you need to publish your first digital presence.',
      liveSource: 'Prices synced with Bigmelo',
      select: 'Choose Starter',
      title: 'Start complete. Choose how to pay.',
      trial: '7 days free. Cancel before your first charge.',
    },
    video: {
      eyebrow: 'BIGMELO IN ACTION',
      iframeTitle: 'Bigmelo, the intelligent tool for growing your personal brand',
      lead: 'See how Bigmelo turns experience, content, image, and voice into a digital presence ready to have conversations.',
      playAria: 'Play the Bigmelo promotional video',
      title: 'Your personal brand, available even when you are away.',
      titleAlternative: 'Your personal brand can be available even when you are away.',
      thumbnailAlt: 'Preview of the Bigmelo promotional video',
      watch: 'Watch on YouTube',
    },
    contact: {
      benefits: ['Public profile ready to share', 'Text and audio conversations', 'Information verified by you'],
      captchaError: 'We could not load the verification. Reload the page.',
      captchaRequired: 'Complete the verification before sending.',
      consent: 'I allow Bigmelo to use this information to reply to my request.',
      country: 'Country code',
      email: 'Email',
      emailPlaceholder: 'name@email.com',
      error: 'We could not send your request. Please try again.',
      eyebrow: 'CONTACT',
      lead: 'Tell us who you are and what you want your audience to discover, ask, or do.',
      message: 'What do you want to create?',
      messagePlaceholder: 'Tell us about your profile, audience, or goal…',
      name: 'Name',
      namePlaceholder: 'Your name',
      phone: 'Phone',
      submit: 'Talk with Bigmelo',
      submitting: 'Sending…',
      success: 'Thanks. We received your request and will contact you soon.',
      title: 'Let us talk about the digital presence you want to create.',
    },
    footer: {
      cta: 'Create my Bigmelo',
      data: 'Data',
      eyebrow: 'READY WHEN YOU ARE',
      legalAria: 'Legal links',
      preferences: 'Cookie preferences',
      privacy: 'Privacy',
      tagline: 'Interactive profiles with artificial intelligence, image, and voice.',
      terms: 'Terms',
      title: 'Your presence can start answering today.',
    },
  },
} satisfies Record<Locale, object>;

const heroScreens: Record<HomeProposalVariant, [string, string, string]> = {
  homev01: [
    '/landing/real-mobile/profile01-initial.png',
    '/landing/real-mobile/profile02-conversation.png',
    '/landing/real-mobile/profile02-chat-product.png',
  ],
  homev02: [
    '/landing/real-mobile/profile04-initial.png',
    '/landing/real-mobile/profile02-conversation.png',
    '/landing/real-mobile/profile03-initial.png',
  ],
  homev03: [
    '/landing/real-mobile/profile03-initial.png',
    '/landing/real-mobile/profile02-chat-product.png',
    '/landing/real-mobile/profile05-initial.png',
  ],
};

const fallbackFeatures: Record<Locale, string[]> = {
  es: [
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
  en: [
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
};

const fallbackPlans: Record<Locale, DisplayPlan[]> = {
  es: [
    {
      cycle: 'month',
      description: 'Para crear, probar y lanzar tu primera presencia conversacional.',
      features: fallbackFeatures.es,
      id: 'starter',
      label: 'Mensual',
      period: 'USD /mes',
      price: '$12.99',
    },
    {
      cycle: 'year',
      description: 'La misma experiencia completa, con mejor precio durante todo el año.',
      features: [...fallbackFeatures.es, 'Ahorro de $26.88 frente al pago mensual'],
      highlighted: true,
      id: 'starter_annual',
      label: 'Anual',
      period: 'USD /año',
      price: '$129',
    },
  ],
  en: [
    {
      cycle: 'month',
      description: 'For creating, testing, and launching your first conversational presence.',
      features: fallbackFeatures.en,
      id: 'starter',
      label: 'Monthly',
      period: 'USD /month',
      price: '$12.99',
    },
    {
      cycle: 'year',
      description: 'The same complete experience at a better price throughout the year.',
      features: [...fallbackFeatures.en, 'Save $26.88 compared with monthly billing'],
      highlighted: true,
      id: 'starter_annual',
      label: 'Annual',
      period: 'USD /year',
      price: '$129',
    },
  ],
};

type TurnstileWidgetId = string;
type TurnstileRenderOptions = {
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  language?: string;
  sitekey: string;
  size?: 'compact' | 'flexible' | 'normal';
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

export function HomeProposal({ variant }: { variant: HomeProposalVariant }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const copy = proposalCopy[locale][variant];
  const signupUrl = useMemo(() => createSignupUrl('starter', 'month', variant, locale), [locale, variant]);

  useEffect(() => {
    const isPrimaryHome = variant === 'homev01';
    const primarySeo = homeSeo[locale];

    setPageMetadata({
      canonicalPath: isPrimaryHome ? '/' : window.location.pathname,
      description: isPrimaryHome ? primarySeo.description : copy.lead,
      image: isPrimaryHome ? homeSeo.image : 'https://bigmelo.com/landing/real-mobile/profile02-chat-product.png',
      imageAlt: isPrimaryHome ? homeSeo.imageAlt[locale] : copy.title,
      imageHeight: isPrimaryHome ? homeSeo.imageHeight : undefined,
      imageType: isPrimaryHome ? homeSeo.imageType : undefined,
      imageWidth: isPrimaryHome ? homeSeo.imageWidth : undefined,
      locale,
      robots: isPrimaryHome
        ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
        : 'noindex,follow',
      structuredData: isPrimaryHome ? buildHomeStructuredData(locale) : undefined,
      title: isPrimaryHome ? primarySeo.title : `${copy.title} | Bigmelo`,
    });

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // The selector still works for the current visit when storage is blocked.
    }
  }, [copy.lead, copy.title, locale, variant]);

  useEffect(() => {
    document.body.classList.add('home-proposal-active');
    document.documentElement.classList.add('home-proposal-active-root');
    const variantClass = `home-proposal-${variant}-active`;
    document.body.classList.add(variantClass);
    document.documentElement.classList.add(variantClass);
    return () => {
      document.body.classList.remove('home-proposal-active');
      document.documentElement.classList.remove('home-proposal-active-root');
      document.body.classList.remove(variantClass);
      document.documentElement.classList.remove(variantClass);
    };
  }, [variant]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return undefined;

    let targetId = hash;
    try {
      targetId = decodeURIComponent(hash);
    } catch {
      // Keep the literal hash when it is not valid percent-encoded text.
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useProposalMotion(variant);
  useLandingSectionTracking(variant, locale);

  const demo = <LiveDemo copy={copy} locale={locale} variant={variant} />;
  const mobileStory = <MobileStory copy={copy} locale={locale} variant={variant} />;

  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    trackLandingEvent('landing_language_change', variant, nextLocale, { selected_locale: nextLocale });
  };

  return (
    <main className={`home-proposal ${variant}`}>
      <Header locale={locale} onLocaleChange={changeLocale} variant={variant} />
      <Hero copy={copy} locale={locale} signupUrl={signupUrl} variant={variant} />
      <SignalStrip locale={locale} />
      {variant === 'homev02' ? demo : mobileStory}
      {variant === 'homev01' ? <LinkInBio locale={locale} /> : null}
      {variant === 'homev02' ? mobileStory : demo}
      <CapabilityGrid locale={locale} />
      <Plans locale={locale} variant={variant} />
      <PromoVideo locale={locale} variant={variant} />
      <Contact locale={locale} variant={variant} />
      <Footer locale={locale} signupUrl={signupUrl} variant={variant} />
    </main>
  );
}

function Header({
  locale,
  onLocaleChange,
  variant,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  variant: HomeProposalVariant;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuDialogRef = useRef<HTMLDialogElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const t = pageCopy[locale].header;
  const linkInBioHref = variant === 'homev01' ? '#link-en-bio' : '/#link-en-bio';
  const links = [
    { destination: 'link_in_bio', href: linkInBioHref, label: t.linkInBio },
    { destination: 'plans', href: '#planes', label: t.plans },
    { destination: 'contact', href: '#contacto', label: t.contact },
  ];

  useEffect(() => {
    const dialog = menuDialogRef.current;
    if (!dialog) return;

    if (isMenuOpen && !dialog.open) dialog.showModal();
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 960px)');
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches && menuDialogRef.current?.open) menuDialogRef.current.close();
    };

    desktopQuery.addEventListener('change', closeAtDesktop);
    return () => desktopQuery.removeEventListener('change', closeAtDesktop);
  }, []);

  const closeMenu = () => {
    const dialog = menuDialogRef.current;
    if (dialog?.open) dialog.close();
    else setIsMenuOpen(false);
  };

  return (
    <header className="hp-header">
      <a aria-label="Bigmelo" className="hp-logo" href="#inicio" onClick={closeMenu}>
        <img alt="Bigmelo" height="98" src={bigmeloLogo} width="382" />
      </a>
      <nav aria-label={t.navLabel} className="hp-header-nav">
        {links.map((link) => (
          <a
            href={link.href}
            key={link.href}
            onClick={() => trackLandingEvent('landing_nav_click', variant, locale, {
              destination: link.destination,
              nav_location: 'header',
            })}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="hp-header-actions">
        <a
          className="hp-login"
          href={getAdminSignInUrl(locale)}
          onClick={() => trackLandingEvent('landing_login_click', variant, locale, { nav_location: 'header' })}
        >
          {t.signIn}
        </a>
        <LanguageSwitch className="hp-header-language" locale={locale} onLocaleChange={onLocaleChange} />
        <button
          aria-controls="hp-mobile-menu"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? t.closeMenu : t.openMenu}
          className="hp-menu-trigger"
          onClick={() => {
            setIsMenuOpen(true);
            trackLandingEvent('landing_menu_open', variant, locale, { nav_location: 'mobile_menu' });
          }}
          ref={menuTriggerRef}
          type="button"
        >
          <span aria-hidden="true"><i /><i /><i /></span>
        </button>
      </div>
      <dialog
        aria-labelledby="hp-mobile-menu-title"
        className="hp-mobile-menu"
        id="hp-mobile-menu"
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
        onClose={() => {
          setIsMenuOpen(false);
          if (window.matchMedia('(max-width: 959px)').matches) {
            window.requestAnimationFrame(() => menuTriggerRef.current?.focus({ preventScroll: true }));
          }
        }}
        ref={menuDialogRef}
      >
        <div className="hp-mobile-menu-panel">
          <div className="hp-mobile-menu-head">
            <strong id="hp-mobile-menu-title">{t.menu}</strong>
            <button aria-label={t.closeMenu} autoFocus className="hp-mobile-menu-close" onClick={closeMenu} type="button"><CloseIcon /></button>
          </div>
          <nav aria-label={t.navLabel} className="hp-mobile-menu-nav">
            {links.map((link) => (
              <a
                href={link.href}
                key={link.href}
                onClick={() => {
                  trackLandingEvent('landing_nav_click', variant, locale, {
                    destination: link.destination,
                    nav_location: 'mobile_menu',
                  });
                  closeMenu();
                }}
              >
                {link.label} <Arrow />
              </a>
            ))}
          </nav>
          <div className="hp-mobile-menu-language">
            <span>{t.language}</span>
            <LanguageSwitch locale={locale} onLocaleChange={(nextLocale) => {
              onLocaleChange(nextLocale);
              closeMenu();
            }} />
          </div>
        </div>
      </dialog>
    </header>
  );
}

function LanguageSwitch({
  className = '',
  locale,
  onLocaleChange,
}: {
  className?: string;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) {
  const t = pageCopy[locale].header;

  return (
    <div aria-label={t.language} className={`hp-language-switch ${className}`.trim()} role="group">
      <button aria-label={t.spanish} aria-pressed={locale === 'es'} onClick={() => onLocaleChange('es')} type="button">ES</button>
      <button aria-label={t.english} aria-pressed={locale === 'en'} onClick={() => onLocaleChange('en')} type="button">EN</button>
    </div>
  );
}

function Hero({
  copy,
  locale,
  signupUrl,
  variant,
}: {
  copy: ProposalCopy;
  locale: Locale;
  signupUrl: string;
  variant: HomeProposalVariant;
}) {
  const screens = heroScreens[variant];
  const t = pageCopy[locale].hero;

  return (
    <section className="hp-hero" data-hp-scene="inicio" data-hp-snap="strong" id="inicio">
      <div className="hp-hero-copy" data-hp-reveal>
        <span className="hp-concept">{copy.concept}</span>
        <span className="hp-eyebrow">{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
        <div className="hp-actions">
          <a className="hp-button" href={signupUrl} onClick={() => trackCta(variant, locale, 'hero')}>
            {t.create} <Arrow />
          </a>
          <a
            className="hp-text-link"
            href="#demo"
            onClick={() => trackLandingEvent('landing_demo_click', variant, locale, { demo_location: 'hero' })}
          >
            {t.demo} <Arrow />
          </a>
        </div>
        <small>{t.trial}</small>
      </div>

      <div aria-label={t.previewAria} className="hp-phone-fan" data-hp-reveal>
        <span aria-hidden="true" className="hp-orbit hp-orbit--one" />
        <span aria-hidden="true" className="hp-orbit hp-orbit--two" />
        <figure className="hp-phone hp-phone--back">
          <img alt={t.altBack} decoding="async" height="932" loading="lazy" src={screens[0]} width="430" />
        </figure>
        <figure className="hp-phone hp-phone--main">
          <img alt={t.altMain} decoding="async" fetchPriority="high" height="932" src={screens[1]} width="430" />
        </figure>
        <figure className="hp-phone hp-phone--front">
          <img alt={t.altFront} decoding="async" height="932" loading="lazy" src={screens[2]} width="430" />
        </figure>
        <span className="hp-live-pill"><i /> {t.live}</span>
      </div>
    </section>
  );
}

function SignalStrip({ locale }: { locale: Locale }) {
  const t = pageCopy[locale].signal;

  return (
    <section aria-label={t.aria} className="hp-signal-strip">
      <div>
        {t.items.map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}

function MobileStory({
  copy,
  locale,
  variant,
}: {
  copy: ProposalCopy;
  locale: Locale;
  variant: HomeProposalVariant;
}) {
  const screenSets: Record<HomeProposalVariant, [string, string, string]> = {
    homev01: [
      '/landing/real-mobile/profile01-initial.png',
      '/landing/real-mobile/profile02-conversation.png',
      '/landing/real-mobile/profile02-chat-product.png',
    ],
    homev02: [
      '/landing/real-mobile/profile04-initial.png',
      '/landing/real-mobile/profile02-conversation.png',
      '/landing/real-mobile/profile02-chat-product.png',
    ],
    homev03: [
      '/landing/real-mobile/profile03-initial.png',
      '/landing/real-mobile/profile02-conversation.png',
      '/landing/real-mobile/profile02-chat-product.png',
    ],
  };
  const screens = screenSets[variant];
  const t = pageCopy[locale].mobile;

  return (
    <section className="hp-mobile-story hp-section-shell" data-hp-scene="experiencia" data-hp-snap="strong" data-magnetic="true" id="experiencia">
      <div className="hp-section-heading" data-hp-reveal>
        <span>{t.eyebrow}</span>
        <h2>{copy.mobileTitle}</h2>
        <p>{copy.mobileLead}</p>
      </div>
      <div className="hp-mobile-gallery" data-hp-reveal>
        {screens.map((screen, index) => (
          <figure className={`hp-showcase-phone hp-showcase-phone--${index + 1}`} key={screen}>
            <span>{t.cards[index]}</span>
            <img alt={t.alts[index]} decoding="async" height="932" loading="lazy" src={screen} width="430" />
          </figure>
        ))}
      </div>
    </section>
  );
}

function LinkInBio({ locale }: { locale: Locale }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isBioMotionActive, setIsBioMotionActive] = useState(false);
  const t = pageCopy[locale].bio;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateFromRect = () => {
      const rect = stage.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      setIsBioMotionActive(!reducedMotion.matches && visibleHeight / Math.max(rect.height, 1) >= 0.35);
    };

    if (!('IntersectionObserver' in window)) {
      updateFromRect();
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsBioMotionActive(!reducedMotion.matches && entry.isIntersecting && entry.intersectionRatio >= 0.35);
    }, { threshold: [0, 0.35, 0.7] });
    const handleMotionPreference = () => updateFromRect();

    observer.observe(stage);
    reducedMotion.addEventListener('change', handleMotionPreference);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener('change', handleMotionPreference);
    };
  }, []);

  return (
    <section className="hp-link-bio" data-hp-scene="link-en-bio" data-hp-snap="strong" id="link-en-bio">
      <div className="hp-link-bio-layout hp-section-shell">
        <div className="hp-link-bio-copy" data-hp-reveal>
          <span>{t.eyebrow}</span>
          <h2>{t.title}</h2>
          <p>{t.lead}</p>
          <ol aria-label={t.aria}>
            {t.steps.map((step, index) => (
              <li key={step.strong}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <span><strong>{step.strong}</strong> {step.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="hp-instagram-stage" data-bio-motion={isBioMotionActive ? 'running' : 'stopped'} data-hp-reveal ref={stageRef}>
          <span aria-hidden="true" className="hp-instagram-route">
            <i><InstagramIcon /></i><span>Instagram</span><Arrow /><strong>Bigmelo</strong>
          </span>
          <figure
            aria-label={t.animationAria}
            className="hp-instagram-phone hp-bio-animation"
            role="img"
          >
            <div aria-hidden="true" className="hp-bio-screen hp-bio-screen--instagram">
              <div className="hp-instagram-shot">
                <span className="hp-instagram-shot-segment hp-instagram-shot-segment--top" />
                <span className="hp-instagram-shot-segment hp-instagram-shot-segment--bottom" />
              </div>
            </div>
            <div aria-hidden="true" className="hp-bio-screen hp-bio-screen--bigmelo">
              <img alt="" decoding="async" height="932" loading="lazy" src="/landing/real-mobile/profile02-conversation.png" width="430" />
            </div>
            <img aria-hidden="true" className="hp-bio-hand" height="1269" src="/landing/instagram/hand-cursor-transparent.webp" width="1240" />
            <span aria-hidden="true" className="hp-bio-click-pulse" />
          </figure>
        </div>
      </div>
    </section>
  );
}

function LiveDemo({
  copy,
  locale,
  variant,
}: {
  copy: ProposalCopy;
  locale: Locale;
  variant: HomeProposalVariant;
}) {
  const [device, setDevice] = useState<DemoDevice>(() => isDemoMobileViewport() ? 'mobile' : 'desktop');
  const [isMobileViewport, setIsMobileViewport] = useState(isDemoMobileViewport);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const deviceToggleRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasTrackedFrameResultRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const t = pageCopy[locale].demo;
  const effectiveDevice: DemoDevice = isMobileViewport ? 'mobile' : device;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isLoaded) return undefined;
    const timeout = window.setTimeout(() => setIsSlow(true), 10_000);
    return () => window.clearTimeout(timeout);
  }, [isOpen, isLoaded]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DEMO_MOBILE_QUERY);
    const syncViewport = (matches: boolean) => {
      const toggleHadFocus = Boolean(deviceToggleRef.current?.contains(document.activeElement));
      setIsMobileViewport(matches);

      if (matches) {
        setDevice('mobile');
        if (toggleHadFocus) {
          window.requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }));
        }
      }
    };
    const handleChange = (event: MediaQueryListEvent) => syncViewport(event.matches);

    syncViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const openDemo = () => {
    const opensOnMobile = isDemoMobileViewport();
    setIsMobileViewport(opensOnMobile);
    setDevice(opensOnMobile ? 'mobile' : 'desktop');
    setIsLoaded(false);
    setIsSlow(false);
    hasTrackedFrameResultRef.current = false;
    setIsOpen(true);
    trackLandingEvent('landing_demo_click', variant, locale, { demo_location: 'demo_modal' });
  };

  const closeDemo = () => {
    if (isOpen) {
      trackLandingEvent('landing_demo_close', variant, locale, { demo_viewport: effectiveDevice });
    }
    setIsOpen(false);
  };

  const changeDevice = (nextDevice: DemoDevice) => {
    if (nextDevice === device) return;
    setDevice(nextDevice);
    trackLandingEvent('landing_demo_viewport_change', variant, locale, { demo_viewport: nextDevice });
  };

  return (
    <section className="hp-live-demo" data-hp-scene="demo" data-hp-snap="soft" id="demo">
      <div className="hp-section-shell">
        {variant === 'homev01' ? (
          <div className="hp-demo-layout">
            <div className="hp-demo-copy" data-hp-reveal>
              <span>{t.eyebrow}</span>
              <h2>{copy.demoTitle}</h2>
              <p>{copy.demoLead}</p>
              <div className="hp-demo-inline-actions">
                <button className="hp-button" onClick={openDemo} ref={triggerRef} type="button">{t.launchButton} <Arrow /></button>
                <a href={DEMO_PROFILE_URL} onClick={() => trackLandingEvent('landing_demo_click', variant, locale, { demo_location: 'demo_external' })} rel="noreferrer" target="_blank">
                  {t.openTab} <Arrow />
                </a>
              </div>
            </div>
            <div aria-hidden="true" className="hp-demo-integrated-visual" data-hp-reveal>
              <span className="hp-demo-launch-orbit" />
              <img alt="" decoding="async" height="932" loading="lazy" src="/landing/real-mobile/profile02-conversation.png" width="430" />
              <span className="hp-demo-launch-pill"><i /> {t.live}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="hp-demo-heading" data-hp-reveal>
              <div>
                <span>{t.eyebrow}</span>
                <h2>{copy.demoTitle}</h2>
                <p>{copy.demoLead}</p>
              </div>
              <div className="hp-demo-actions">
                <a href={DEMO_PROFILE_URL} onClick={() => trackLandingEvent('landing_demo_click', variant, locale, { demo_location: 'demo_external' })} rel="noreferrer" target="_blank">
                  {t.openTab} <Arrow />
                </a>
              </div>
            </div>

            <div className="hp-demo-launch" data-hp-reveal>
              <div className="hp-demo-launch-copy">
                <span>{t.launchEyebrow}</span>
                <button className="hp-button" onClick={openDemo} ref={triggerRef} type="button">{t.launchButton} <Arrow /></button>
              </div>
              <div aria-hidden="true" className="hp-demo-launch-visual">
                <span className="hp-demo-launch-orbit" />
                <img alt="" decoding="async" height="932" loading="lazy" src="/landing/real-mobile/profile02-conversation.png" width="430" />
                <span className="hp-demo-launch-pill"><i /> {t.live}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <dialog
        aria-labelledby="hp-demo-dialog-title"
        className="hp-demo-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeDemo();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDemo();
        }}
        onClose={() => {
          setIsOpen(false);
          setIsLoaded(false);
          setIsSlow(false);
          triggerRef.current?.focus({ preventScroll: true });
        }}
        ref={dialogRef}
      >
        <div className="hp-demo-dialog-shell">
          <header className="hp-demo-dialog-header">
            <div>
              <span>{t.dialogEyebrow}</span>
              <h2 id="hp-demo-dialog-title">{t.dialogTitle}</h2>
            </div>
            <div className="hp-demo-dialog-actions">
              {!isMobileViewport ? (
                <div aria-label={t.toggleAria} className="hp-device-toggle" ref={deviceToggleRef} role="group">
                  <button aria-pressed={device === 'desktop'} onClick={() => changeDevice('desktop')} type="button"><DesktopIcon /> {t.web}</button>
                  <button aria-pressed={device === 'mobile'} onClick={() => changeDevice('mobile')} type="button"><MobileIcon /> {t.mobile}</button>
                </div>
              ) : null}
              <a href={DEMO_PROFILE_URL} onClick={() => trackLandingEvent('landing_demo_click', variant, locale, { demo_location: 'demo_modal_external' })} rel="noreferrer" target="_blank">{t.newTab} <Arrow /></a>
              <button aria-label={t.close} className="hp-demo-close" onClick={closeDemo} ref={closeButtonRef} type="button"><CloseIcon /></button>
            </div>
          </header>
          <div className="hp-demo-dialog-body">
            <div className={`hp-live-stage is-${effectiveDevice}`}>
              <div aria-hidden="true" className="hp-browser-bar"><i /><i /><i /><span>bigmelo.com/bigsofia</span></div>
              <div className={`hp-live-frame${isLoaded ? ' is-loaded' : ''}`}>
                {!isLoaded ? (
                  <div aria-live="polite" className="hp-frame-loader">
                    <span>{isSlow ? t.slow : t.loading}</span>
                    {isSlow ? (
                      <a
                        href={DEMO_PROFILE_URL}
                        onClick={() => trackLandingEvent('landing_demo_click', variant, locale, { demo_location: 'demo_slow_fallback' })}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t.openBigSofia} <Arrow />
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {isOpen ? (
                  <iframe
                    allow="microphone; autoplay; clipboard-write"
                    allowFullScreen
                    onError={() => {
                      setIsSlow(true);
                      if (!hasTrackedFrameResultRef.current) {
                        hasTrackedFrameResultRef.current = true;
                        trackLandingEvent('landing_demo_error', variant, locale, { error_type: 'iframe_load' });
                      }
                    }}
                    onLoad={() => {
                      setIsLoaded(true);
                      setIsSlow(false);
                      if (!hasTrackedFrameResultRef.current) {
                        hasTrackedFrameResultRef.current = true;
                        trackLandingEvent('landing_demo_loaded', variant, locale, { demo_viewport: effectiveDevice });
                      }
                    }}
                    referrerPolicy="no-referrer"
                    sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                    src={DEMO_PROFILE_EMBED_URL}
                    title={t.iframeTitle}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </section>
  );
}

function CapabilityGrid({ locale }: { locale: Locale }) {
  const t = pageCopy[locale].capabilities;

  return (
    <section className="hp-capabilities hp-section-shell" data-hp-scene="capacidades" data-hp-snap="strong">
      <div className="hp-section-heading" data-hp-reveal>
        <span>{t.eyebrow}</span>
        <h2>{t.title}</h2>
      </div>
      <div className="hp-capability-grid" data-hp-reveal>
        {t.items.map((item, index) => (
          <article key={item.title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Plans({ locale, variant }: { locale: Locale; variant: HomeProposalVariant }) {
  const [publicPlans, setPublicPlans] = useState<PublicSubscriptionPlan[]>([]);
  const [usesLiveData, setUsesLiveData] = useState(false);
  const [shouldLoadPlans, setShouldLoadPlans] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const t = pageCopy[locale].plans;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      setShouldLoadPlans(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldLoadPlans(true);
      observer.disconnect();
    }, { rootMargin: '600px 0px' });
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoadPlans) return undefined;
    let cancelled = false;

    fetchPublicSubscriptionPlans()
      .then((plans) => {
        if (!cancelled && plans.length > 0) {
          setPublicPlans(plans);
          setUsesLiveData(['starter', 'starter_annual'].every((id) => plans.some((plan) => plan.id === id)));
        }
      })
      .catch(() => {
        // Keep the production fallback visible when the local API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoadPlans]);

  const plans = useMemo(
    () => fallbackPlans[locale].map((plan) => applyPublicPlan(plan, publicPlans, locale)),
    [locale, publicPlans],
  );
  const sharedFeatures = plans.length > 1
    ? plans[0].features.filter((feature) => plans.slice(1).every((plan) => plan.features.includes(feature)))
    : plans[0]?.features ?? fallbackFeatures[locale];

  return (
    <section className="hp-plans hp-section-shell" data-hp-scene="planes" data-hp-snap="soft" id="planes" ref={sectionRef}>
      <div className="hp-section-heading hp-section-heading--split" data-hp-reveal>
        <div>
          <span>{t.eyebrow}</span>
          <h2>{t.title}</h2>
        </div>
        <p>{t.lead}</p>
      </div>
      <div className="hp-plan-source" data-live={usesLiveData}>{usesLiveData ? t.liveSource : t.fallbackSource}<i /></div>
      {variant === 'homev01' ? (
        <div className="hp-plans-compact" data-hp-reveal>
          <div className="hp-plan-grid hp-plan-grid--compact">
            {plans.map((plan) => {
              const uniqueFeatures = plan.features.filter((feature) => !sharedFeatures.includes(feature));

              return (
                <article className={plan.highlighted ? 'hp-plan hp-plan--summary is-highlighted' : 'hp-plan hp-plan--summary'} key={plan.id}>
                  <div className="hp-plan-topline"><span>{plan.label}</span>{plan.highlighted ? <b>{t.bestValue}</b> : null}</div>
                  <div className="hp-plan-summary-main">
                    <div><h3>Starter</h3><p>{plan.description}</p></div>
                    <div className="hp-plan-price"><strong>{plan.price}</strong><span>{plan.period}</span></div>
                  </div>
                  <small>{t.trial}</small>
                  {uniqueFeatures.map((feature) => <p className="hp-plan-saving" key={feature}><CheckIcon />{feature}</p>)}
                  <a className="hp-button" href={createSignupUrl(plan.id, plan.cycle, variant, locale)} onClick={() => trackCta(variant, locale, `plan_${plan.cycle}`, plan.id, plan.cycle)}>
                    {t.select} {plan.label.toLocaleLowerCase(locale)} <Arrow />
                  </a>
                </article>
              );
            })}
          </div>
          <div className="hp-shared-features">
            <div><span>{t.allIncluded}</span><h3>{t.allIncludedTitle}</h3></div>
            <ul>{sharedFeatures.map((feature) => <li key={feature}><CheckIcon />{feature}</li>)}</ul>
          </div>
        </div>
      ) : (
        <div className="hp-plan-grid" data-hp-reveal>
          {plans.map((plan) => (
            <article className={plan.highlighted ? 'hp-plan is-highlighted' : 'hp-plan'} key={plan.id}>
              <div className="hp-plan-topline"><span>{plan.label}</span>{plan.highlighted ? <b>{t.bestValue}</b> : null}</div>
              <h3>Starter</h3>
              <p>{plan.description}</p>
              <div className="hp-plan-price"><strong>{plan.price}</strong><span>{plan.period}</span></div>
              <small>{t.trial}</small>
              <ul>
                {plan.features.map((feature) => <li key={feature}><CheckIcon />{feature}</li>)}
              </ul>
              <a className="hp-button" href={createSignupUrl(plan.id, plan.cycle, variant, locale)} onClick={() => trackCta(variant, locale, `plan_${plan.cycle}`, plan.id, plan.cycle)}>
                {t.select} {plan.label.toLocaleLowerCase(locale)} <Arrow />
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PromoVideo({ locale, variant }: { locale: Locale; variant: HomeProposalVariant }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const t = pageCopy[locale].video;

  return (
    <section className="hp-video" data-hp-scene="video" data-hp-snap="strong" data-magnetic="true" id="video">
      <div className="hp-video-card hp-section-shell" data-hp-reveal>
        <div className="hp-video-copy">
          <span>{t.eyebrow}</span>
          <h2>{variant === 'homev01' ? t.title : t.titleAlternative}</h2>
          <p>{t.lead}</p>
          <a
            className="hp-text-link"
            href={VIDEO_URL}
            onClick={() => trackLandingEvent('select_content', variant, locale, {
              content_action: 'open_youtube',
              content_type: 'video',
              item_id: 'bigmelo_overview',
            })}
            rel="noreferrer"
            target="_blank"
          >
            {t.watch} <Arrow />
          </a>
        </div>
        <div className="hp-video-media">
          {isLoaded ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              src={VIDEO_EMBED_URL}
              title={t.iframeTitle}
            />
          ) : (
            <button
              aria-label={t.playAria}
              className="hp-video-placeholder"
              onClick={() => {
                setIsLoaded(true);
                trackLandingEvent('select_content', variant, locale, {
                  content_action: 'play',
                  content_type: 'video',
                  item_id: 'bigmelo_overview',
                });
              }}
              type="button"
            >
              <img alt={t.thumbnailAlt} decoding="async" height="360" loading="lazy" src={VIDEO_THUMBNAIL_URL} width="480" />
              <span aria-hidden="true"><PlayIcon /></span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Contact({ locale, variant }: { locale: Locale; variant: HomeProposalVariant }) {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaError, setCaptchaError] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const isMountedRef = useRef(true);
  const hasTrackedFormStartRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const isCaptchaEnabled = TURNSTILE_SITE_KEY !== '';
  const t = pageCopy[locale].contact;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isCaptchaEnabled || !isNearViewport) return undefined;

    let cancelled = false;
    setCaptchaToken('');
    setCaptchaError(false);
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !turnstileContainerRef.current || !window.turnstile) return;
        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          size: 'flexible',
          theme: variant === 'homev02' ? 'dark' : 'light',
          language: locale,
          callback: (token) => {
            setCaptchaToken(token);
            setCaptchaError(false);
          },
          'expired-callback': () => setCaptchaToken(''),
          'error-callback': () => {
            setCaptchaToken('');
            setCaptchaError(true);
            trackLandingEvent('landing_form_error', variant, locale, { error_type: 'captcha_load' });
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCaptchaError(true);
          trackLandingEvent('landing_form_error', variant, locale, { error_type: 'captcha_load' });
        }
      });

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
      }
      turnstileWidgetIdRef.current = null;
    };
  }, [isCaptchaEnabled, isNearViewport, locale, variant]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const value = (field: string) => String(formData.get(field) ?? '').trim();

    if (isCaptchaEnabled && !captchaToken) {
      setStatus('error');
      setMessage(t.captchaRequired);
      trackLandingEvent('landing_form_error', variant, locale, { error_type: 'captcha_required' });
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      await submitContactSubmission({
        captchaToken: captchaToken || undefined,
        consentAccepted: formData.get('consent_accepted') === 'on',
        email: value('email'),
        locale,
        message: value('message'),
        name: value('name'),
        pageUrl: window.location.href,
        phoneCountryCode: value('phone_country_code'),
        phoneNumber: value('phone_number'),
        referrer: document.referrer || undefined,
        source: `landing_${variant}`,
      });
      if (!isMountedRef.current) return;
      form.reset();
      setStatus('success');
      setMessage(t.success);
      trackLandingEvent('generate_lead', variant, locale, {
        form_name: `landing_${variant}_contact`,
        lead_source: 'contact_form',
      });
    } catch {
      if (!isMountedRef.current) return;
      setStatus('error');
      setMessage(t.error);
      trackLandingEvent('landing_form_error', variant, locale, { error_type: 'network' });
    } finally {
      if (isMountedRef.current) {
        setCaptchaToken('');
        if (turnstileWidgetIdRef.current) window.turnstile?.reset(turnstileWidgetIdRef.current);
      }
    }
  }

  return (
    <section className="hp-contact" data-hp-motion="none" data-hp-scene="contacto" data-hp-snap="soft" id="contacto" ref={sectionRef}>
      <div className="hp-section-shell hp-contact-layout">
        <div className="hp-contact-copy" data-hp-reveal>
          <span>{t.eyebrow}</span>
          <h2>{t.title}</h2>
          <p>{t.lead}</p>
          <ul>
            {t.benefits.map((benefit) => <li key={benefit}><CheckIcon />{benefit}</li>)}
          </ul>
        </div>

        <form
          aria-busy={status === 'submitting'}
          className="hp-contact-form"
          data-hp-reveal
          onFocusCapture={() => {
            setIsNearViewport(true);
            if (!hasTrackedFormStartRef.current) {
              hasTrackedFormStartRef.current = true;
              trackLandingEvent('landing_form_start', variant, locale, { form_name: `landing_${variant}_contact` });
            }
          }}
          onSubmit={handleSubmit}
        >
          <div className="hp-field-row">
            <label>{t.name}<input autoComplete="name" maxLength={120} name="name" placeholder={t.namePlaceholder} required /></label>
            <label>{t.email}<input autoComplete="email" maxLength={255} name="email" placeholder={t.emailPlaceholder} required type="email" /></label>
          </div>
          <Suspense fallback={<PhoneFieldsFallback countryLabel={t.country} phoneLabel={t.phone} />}>
            {isNearViewport ? <ContactPhoneFields countryLabel={t.country} locale={locale} phoneLabel={t.phone} /> : <PhoneFieldsFallback countryLabel={t.country} phoneLabel={t.phone} />}
          </Suspense>
          <label>{t.message}<textarea maxLength={3000} minLength={10} name="message" placeholder={t.messagePlaceholder} required rows={5} /></label>
          <label className="hp-consent"><input name="consent_accepted" required type="checkbox" /><span>{t.consent}</span></label>
          {isCaptchaEnabled ? <div className="hp-captcha"><div ref={turnstileContainerRef} />{captchaError ? <p role="alert">{t.captchaError}</p> : null}</div> : null}
          <button className="hp-button" disabled={status === 'submitting' || (isCaptchaEnabled && !captchaToken)} type="submit">
            {status === 'submitting' ? t.submitting : t.submit} <Arrow />
          </button>
          {message ? <p className={`hp-form-message is-${status}`} role={status === 'error' ? 'alert' : 'status'}>{message}</p> : null}
        </form>
      </div>
    </section>
  );
}

function Footer({ locale, signupUrl, variant }: { locale: Locale; signupUrl: string; variant: HomeProposalVariant }) {
  const t = pageCopy[locale].footer;

  return (
    <footer className="hp-footer" data-hp-scene="final" data-hp-snap="strong">
      <div className="hp-section-shell hp-footer-main" data-hp-reveal>
        <span>{t.eyebrow}</span>
        <h2>{t.title}</h2>
        <a className="hp-button" href={signupUrl} onClick={() => trackCta(variant, locale, 'footer')}>{t.cta} <Arrow /></a>
      </div>
      <div className="hp-section-shell hp-footer-bottom">
        <a aria-label="Bigmelo" className="hp-logo" href="#inicio"><img alt="Bigmelo" height="98" loading="lazy" src={bigmeloLogo} width="382" /></a>
        <p>{t.tagline}</p>
        <nav aria-label={t.legalAria}>
          <a href={locale === 'es' ? '/privacidad' : '/privacy'}>{t.privacy}</a>
          <a href={locale === 'es' ? '/terminos' : '/terms'}>{t.terms}</a>
          <a href={locale === 'es' ? '/eliminacion-datos' : '/data-deletion'}>{t.data}</a>
          <button className="hp-cookie-preferences" onClick={openAnalyticsPreferences} type="button">{t.preferences}</button>
        </nav>
        <small>© 2026 Bigmelo</small>
      </div>
    </footer>
  );
}

function PhoneFieldsFallback({ countryLabel, phoneLabel }: { countryLabel: string; phoneLabel: string }) {
  return (
    <div aria-busy="true" className="contact-phone-row hp-phone-fields-loading">
      <label>{countryLabel}<select aria-label={countryLabel} defaultValue="+57" disabled><option value="+57">Colombia (+57)</option></select></label>
      <label>{phoneLabel}<input aria-label={phoneLabel} disabled placeholder="300 000 0000" type="tel" /></label>
    </div>
  );
}

function applyPublicPlan(plan: DisplayPlan, publicPlans: PublicSubscriptionPlan[], locale: Locale): DisplayPlan {
  const publicPlan = publicPlans.find((candidate) => candidate.id === plan.id);
  if (!publicPlan) return plan;

  const monthlyPlan = publicPlans.find((candidate) => candidate.id === 'starter');
  const savings = plan.cycle === 'year' && monthlyPlan
    ? Math.max(0, monthlyPlan.priceUsd * 12 - publicPlan.priceUsd)
    : 0;

  return {
    ...plan,
    price: formatUsd(publicPlan.priceUsd),
    features: buildPlanFeatures(publicPlan, savings, locale),
  };
}

function buildPlanFeatures(plan: PublicSubscriptionPlan, savings: number, locale: Locale): string[] {
  const format = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-CO' : 'en-US').format(value);
  const integrations = Object.values(plan.capabilities.integrations);
  const incomingAudio = plan.limits.incoming_audio_messages ?? 500;
  const incomingAudioSeconds = plan.limits.incoming_audio_seconds ?? 15000;
  const audioMaxSeconds = incomingAudio > 0 ? Math.floor(incomingAudioSeconds / incomingAudio) : 30;

  if (locale === 'en') {
    return [
      `${format(plan.limits.profiles ?? 1)} published digital presence`,
      'Initial avatar with image and short video',
      '1 clone of your own voice',
      `Up to ${format(plan.limits.chat_messages ?? 1000)} visitor text or audio messages per month`,
      `Up to ${format(incomingAudio)} incoming audios per month, maximum ${format(audioMaxSeconds)} seconds each`,
      `Up to ${format(plan.limits.tts_characters ?? 20000)} characters in audio replies per month`,
      `Up to ${format(plan.capabilities.productsPerProfile ?? 15)} products per profile`,
      `Instagram and TikTok with up to ${format(integrations[0]?.selectedMedia ?? 10)} selected media items per network`,
      'Public social network links',
      'Additional credits available for extendable limits',
      ...(savings > 0 ? [`Save ${formatUsd(savings)} compared with monthly billing`] : []),
    ];
  }

  return [
    `${format(plan.limits.profiles ?? 1)} presencia digital publicada`,
    'Avatar inicial con imagen y video breve',
    '1 clon de tu propia voz',
    `Hasta ${format(plan.limits.chat_messages ?? 1000)} mensajes de visitantes por texto o audio al mes`,
    `Hasta ${format(incomingAudio)} audios entrantes al mes, máximo ${format(audioMaxSeconds)} segundos cada uno`,
    `Hasta ${format(plan.limits.tts_characters ?? 20000)} caracteres en respuestas de audio al mes`,
    `Hasta ${format(plan.capabilities.productsPerProfile ?? 15)} productos por perfil`,
    `Instagram, TikTok con hasta ${format(integrations[0]?.selectedMedia ?? 10)} contenidos seleccionados por red`,
    'Enlaces públicos a redes sociales',
    'Créditos adicionales disponibles para límites ampliables',
    ...(savings > 0 ? [`Ahorro de ${formatUsd(savings)} frente al pago mensual`] : []),
  ];
}

function formatUsd(value: number): string {
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)}`;
}

function createSignupUrl(planId: string, cycle: BillingCycle, variant: HomeProposalVariant, locale: Locale): string {
  const url = new URL('/auth/custom/sign-up', getAdminBaseUrl());
  url.searchParams.set('locale', locale);
  url.searchParams.set('intent', 'trial');
  url.searchParams.set('plan', planId);
  url.searchParams.set('cycle', cycle);

  const incoming = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid']) {
    const value = incoming.get(key)?.trim().slice(0, 255);
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set('landing_variant', variant);

  return url.toString();
}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'es';

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (storedLocale === 'es' || storedLocale === 'en') return storedLocale;
  } catch {
    // Use the Spanish default when storage is unavailable.
  }

  return 'es';
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

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

function useProposalMotion(variant: HomeProposalVariant) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`.home-proposal.${variant}`);
    if (!root) return undefined;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-hp-reveal]'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return undefined;
    }

    targets.forEach((target) => target.classList.add('is-reveal-ready'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px 12% 0px', threshold: 0.06 });
    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, [variant]);

  useEffect(() => {
    if (
      variant !== 'homev01'
      || !window.matchMedia('(min-width: 960px) and (hover: hover) and (pointer: fine)').matches
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }

    const root = document.querySelector<HTMLElement>('.home-proposal.homev01');
    if (!root) return undefined;

    const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-hp-scene]'));
    if (scenes.length === 0) return undefined;

    let activeScene: HTMLElement | null = null;
    let animationFrame = 0;
    let readyFrame = 0;
    let settleTimer = 0;
    let lastScrollY = window.scrollY;

    const updateActiveScene = () => {
      animationFrame = 0;
      const currentScrollY = window.scrollY;
      const direction = currentScrollY + 1 < lastScrollY ? 'up' : 'down';
      lastScrollY = currentScrollY;
      const viewportCenter = window.innerHeight * 0.5;

      const nextScene = scenes.reduce<{ distance: number; scene: HTMLElement } | null>((best, scene) => {
        const rect = scene.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, 78);
        const visibleBottom = Math.min(rect.bottom, window.innerHeight);
        if (visibleBottom <= visibleTop) return best;

        const visibleCenter = visibleTop + ((visibleBottom - visibleTop) / 2);
        const distance = Math.abs(visibleCenter - viewportCenter);
        return !best || distance < best.distance ? { distance, scene } : best;
      }, null)?.scene ?? scenes[0];

      if (nextScene !== activeScene) {
        activeScene?.style.setProperty('--hp-scene-shift', direction === 'up' ? '42px' : '-42px');
        activeScene?.classList.remove('is-scene-active');
        nextScene.dataset.sceneDirection = direction;
        nextScene.style.setProperty('--hp-scene-shift', direction === 'up' ? '-42px' : '42px');
        nextScene.classList.add('is-scene-active');
        activeScene = nextScene;
      }
    };

    const requestUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateActiveScene);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(updateActiveScene, 180);
    };

    updateActiveScene();
    readyFrame = window.requestAnimationFrame(() => root.classList.add('is-hp-scene-motion-ready'));
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (readyFrame) window.cancelAnimationFrame(readyFrame);
      window.clearTimeout(settleTimer);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      root.classList.remove('is-hp-scene-motion-ready');
      scenes.forEach((scene) => {
        scene.classList.remove('is-scene-active');
        scene.removeAttribute('data-scene-direction');
        scene.style.removeProperty('--hp-scene-shift');
      });
    };
  }, [variant]);

  useEffect(() => {
    if (variant === 'homev01' || window.innerWidth < 960 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const root = document.querySelector<HTMLElement>(`.home-proposal.${variant}`);
    if (!root || !('IntersectionObserver' in window)) return undefined;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-magnetic="true"]'));
    let lastIntentAt = 0;
    let lockedUntil = 0;
    const markIntent = () => { lastIntentAt = performance.now(); };
    const markKeyIntent = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(event.key)) markIntent();
    };
    const observer = new IntersectionObserver((entries) => {
      const now = performance.now();
      if (now - lastIntentAt > 700 || now < lockedUntil) return;
      const candidate = entries.find((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.42 && entry.intersectionRatio < 0.82);
      if (!candidate) return;
      const rect = candidate.target.getBoundingClientRect();
      if (Math.abs(rect.top) > window.innerHeight * 0.38) return;
      lockedUntil = now + 1300;
      (candidate.target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, { threshold: [0.42, 0.6, 0.8] });

    window.addEventListener('wheel', markIntent, { passive: true });
    window.addEventListener('touchstart', markIntent, { passive: true });
    window.addEventListener('keydown', markKeyIntent);
    sections.forEach((section) => observer.observe(section));

    return () => {
      window.removeEventListener('wheel', markIntent);
      window.removeEventListener('touchstart', markIntent);
      window.removeEventListener('keydown', markKeyIntent);
      observer.disconnect();
    };
  }, [variant]);
}

function buildHomeStructuredData(locale: Locale): Record<string, unknown> {
  const description = homeSeo[locale].description;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': 'https://bigmelo.com/#website',
        '@type': 'WebSite',
        description,
        inLanguage: locale === 'en' ? 'en-US' : 'es-CO',
        name: 'Bigmelo',
        url: homeSeo.canonical,
      },
      {
        '@id': 'https://bigmelo.com/#organization',
        '@type': 'Organization',
        logo: 'https://bigmelo.com/bigmelo-icon.png',
        name: 'Bigmelo',
        url: homeSeo.canonical,
      },
      {
        '@id': 'https://bigmelo.com/#software',
        '@type': 'SoftwareApplication',
        applicationCategory: 'BusinessApplication',
        description,
        name: 'Bigmelo',
        offers: {
          '@type': 'Offer',
          price: '12.99',
          priceCurrency: 'USD',
          url: 'https://bigmelo.com/#planes',
        },
        operatingSystem: 'Web',
        provider: { '@id': 'https://bigmelo.com/#organization' },
        url: homeSeo.canonical,
      },
    ],
  };
}

function trackLandingEvent(
  eventName: string,
  variant: HomeProposalVariant,
  locale: Locale,
  parameters: Record<string, boolean | number | string> = {},
) {
  trackAnalyticsEvent(eventName, {
    landing_variant: variant,
    page_locale: locale,
    ...parameters,
  });
}

function useLandingSectionTracking(variant: HomeProposalVariant, locale: Locale) {
  const trackedSectionsRef = useRef(new Set<string>());

  useEffect(() => {
    trackedSectionsRef.current.clear();
  }, [variant]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`.home-proposal.${variant}`);
    if (!root || !('IntersectionObserver' in window)) return undefined;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-hp-scene]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const sectionId = (entry.target as HTMLElement).dataset.hpScene;
        if (!sectionId || trackedSectionsRef.current.has(sectionId)) return;

        trackedSectionsRef.current.add(sectionId);
        trackLandingEvent('landing_section_view', variant, locale, { section_id: sectionId });
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '-20% 0px -45% 0px', threshold: 0 });

    sections.forEach((section) => {
      if (!trackedSectionsRef.current.has(section.dataset.hpScene ?? '')) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, [locale, variant]);
}

function trackCta(
  variant: HomeProposalVariant,
  locale: Locale,
  location: string,
  plan = 'starter',
  billingCycle: BillingCycle = 'month',
) {
  trackLandingEvent('landing_cta_click', variant, locale, {
    billing_cycle: billingCycle,
    cta_location: location,
    landing_audience: 'general',
    plan_id: plan,
    trial_days: 7,
  });
}

function Arrow() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 20 20"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 20 20"><path d="m4 10 3.5 3.5L16 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function DesktopIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 20 20"><rect height="11" rx="2" stroke="currentColor" strokeWidth="1.5" width="16" x="2" y="2.5" /><path d="M7 17.5h6M10 13.5v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" /></svg>;
}

function MobileIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 20 20"><rect height="17" rx="2.5" stroke="currentColor" strokeWidth="1.5" width="10" x="5" y="1.5" /><path d="M8.5 15.5h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" /></svg>;
}

function PlayIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="m9 7 8 5-8 5V7Z" fill="currentColor" /></svg>;
}

function InstagramIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><rect height="18" rx="5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="3" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.4" cy="6.7" fill="currentColor" r="1.1" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
