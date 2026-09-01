import { useEffect, useMemo, useState } from 'react';

import bigmeloLogo from '../assets/bigmelo-logo.webp';
import { getAdminBaseUrl } from '../lib/admin-url';
import { trackAnalyticsEvent } from '../lib/google-analytics';
import { setPageMetadata } from '../lib/page-metadata';
import '../styles/trainer-landing.css';

type TemplateKey = 'profile01' | 'profile02' | 'profile03' | 'profile04' | 'profile05';

const MOBILE_BASE = '/landing/real-mobile';
const ADMIN_BASE = '/landing/real-product';
const CANONICAL_PATH = '/landing/entrenadores';
const HERO_TEMPLATE_ORDER: TemplateKey[] = ['profile01', 'profile03', 'profile02', 'profile04', 'profile05'];
const LANDING_COPY = {
  lead: 'Responde preguntas, recomienda tus programas y ayuda a tus seguidores a elegir antes de escribirte.',
  title: 'El link en bio que responde por ti.',
  why: 'Tus seguidores necesitan claridad antes de elegir un programa o iniciar una conversación comercial.',
};

const templateData: Record<TemplateKey, { color: string; label: string; src: string }> = {
  profile01: { color: '#ffffff', label: 'Profile 01 · Minimal', src: `${MOBILE_BASE}/profile01-initial.png` },
  profile02: { color: '#050505', label: 'Profile 02 · Social', src: `${MOBILE_BASE}/profile02-initial.png` },
  profile03: { color: '#edfaff', label: 'Profile 03 · Fresh', src: `${MOBILE_BASE}/profile03-initial.png` },
  profile04: { color: '#070917', label: 'Profile 04 · Digital', src: `${MOBILE_BASE}/profile04-initial.png` },
  profile05: { color: '#ffd86e', label: 'Profile 05 · Pop', src: `${MOBILE_BASE}/profile05-initial.png` },
};

export function TrainerLandingPage() {
  const signupUrl = useMemo(createSignupUrl, []);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('profile02');
  const isCanonicalLanding = window.location.pathname.replace(/\/+$/u, '').toLowerCase() === CANONICAL_PATH;

  useEffect(() => {
    setPageMetadata({
      canonicalPath: CANONICAL_PATH,
      description: 'Bigmelo crea perfiles interactivos con plantillas, conversación, contenido y productos para entrenadores y coaches fitness.',
      image: 'https://bigmelo.com/landing/real-mobile/profile02-chat-product.png',
      locale: 'es',
      robots: isCanonicalLanding ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,follow',
      title: `${LANDING_COPY.title} | Bigmelo`,
    });
  }, [isCanonicalLanding]);

  useCleanMotion();
  useHeaderNavigation();

  return (
    <main className="perspective-funnel clean-profile-funnel clean-v51">
      <CleanHeader signupUrl={signupUrl} />
      <section className="pf-hero clean-hero clean-hero--fan" id="inicio">
        <div className="pf-shell pf-hero__copy" data-clean-reveal><h1>{LANDING_COPY.title}</h1><p>{LANDING_COPY.lead}</p><div className="pf-actions"><a className="pf-button" href={signupUrl} onClick={() => trackSignup('hero')}>Crear mi Bigmelo gratis <Arrow /></a><a className="pf-text-link" href="/test-profile" onClick={() => trackLandingEvent('landing_demo_click', { location: 'hero' })} rel="noreferrer" target="_blank">Probar perfil demo <Arrow /></a></div><TrialLine /></div>
        <HeroArtwork selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} />
      </section>
      <ChannelStrip />
      <section className="pf-why pf-shell" id="como-funciona">
        <div className="pf-section-heading" data-clean-reveal><span>CÓMO FUNCIONA</span><h2>Una ruta clara desde el contenido hasta tu oferta.</h2><p>{LANDING_COPY.why}</p></div>
        <div className="pf-flow" data-clean-reveal><article><b>01</b><strong>Llega al perfil</strong><p>Desde Instagram, TikTok, YouTube u otro canal.</p><small>Ejemplo: reel → enlace de Bigmelo.</small></article><article><b>02</b><strong>Hace una pregunta</strong><p>Describe su objetivo con sus propias palabras.</p><small>“¿Qué programa me sirve para entrenar en casa?”</small></article><article><b>03</b><strong>Recibe orientación</strong><p>Bigmelo utiliza la información que aprobaste.</p><small>Respuesta basada en tus fuentes.</small></article><article><b>04</b><strong>Encuentra una opción</strong><p>Puede ver un producto y continuar al destino configurado.</p><small>Fuerza Inicial · COP 180.000.</small></article></div>
      </section>
      <EvidenceStrip />
      <ConversationProof />
      <MidPageCta signupUrl={signupUrl} />
      <BenefitCards />
      <TemplateGallery selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} />
      <AdminConnections />
      <Trial signupUrl={signupUrl} />
      <Faq />
      <Final signupUrl={signupUrl} />
      <Footer />
    </main>
  );
}

function CleanHeader({ signupUrl }: { signupUrl: string }) {
  return <header className="pf-header"><div className="pf-shell pf-header__inner"><a aria-label="Bigmelo" href="#inicio"><img alt="Bigmelo" src={bigmeloLogo} /></a><nav aria-label="Navegación del landing"><a href="#como-funciona">Cómo funciona</a><a href="#plantillas">Plantillas</a><a href="#producto">Producto</a><a href="#precio">Precio</a></nav><span>Entrenadores</span><a className="pf-button is-small" href={signupUrl} onClick={() => trackSignup('header')}>Probar 7 días <Arrow /></a></div></header>;
}

function HeroArtwork({ selectedTemplate, setSelectedTemplate }: { selectedTemplate: TemplateKey; setSelectedTemplate: (key: TemplateKey) => void }) {
  return <div className="cf-hero-art cf-hero-art--fan" data-clean-reveal>{HERO_TEMPLATE_ORDER.map((key) => <button aria-label={`Mostrar ${templateData[key].label}`} className={selectedTemplate === key ? 'is-active' : ''} key={key} onClick={() => setSelectedTemplate(key)} type="button"><ProfileShot screen={key} /></button>)}</div>;
}

function ChannelStrip() {
  return <section className="pf-channel-strip"><div className="pf-shell"><p>Una experiencia para conectar lo que ya utilizas</p><div><span>Instagram</span><span>TikTok</span><span>YouTube</span><span>Productos</span><span>WhatsApp</span></div></div></section>;
}

function EvidenceStrip() {
  return <section className="pf-facts cf-evidence" aria-label="Evidencia verificable de Bigmelo"><div className="pf-shell" data-clean-reveal><a href="/test-profile" onClick={() => trackLandingEvent('landing_demo_click', { location: 'evidence' })} rel="noreferrer" target="_blank"><strong>Demo real</strong><span>Prueba el perfil de Sofía</span></a><article><strong>Capturas reales</strong><span>Tomadas directamente del producto</span></article><article><strong>5 plantillas</strong><span>Con sus fondos originales</span></article><article><strong>Guía inicial</strong><span>Para los primeros 20 usuarios</span></article></div></section>;
}

function ConversationProof() {
  return <section className="cf-proof" id="producto"><div className="pf-shell cf-proof__inner" data-clean-reveal><div className="pf-feature-copy"><span>PRUEBA REAL DEL PRODUCTO</span><h2>La conversación termina en una opción concreta.</h2><p>Preguntamos por un programa para una persona principiante que quiere ganar fuerza y entrenar en casa tres veces por semana. Bigmelo recomendó “Fuerza Inicial” y presentó su tarjeta.</p><ul><li>Profile 02 con su fondo negro original.</li><li>Pregunta y respuesta generadas en el producto local.</li><li>Producto publicado con precio y destino.</li></ul></div><div className="cf-proof__screens"><ProfileShot screen="conversation" /><ProfileShot screen="product" /></div></div></section>;
}

function MidPageCta({ signupUrl }: { signupUrl: string }) {
  return <section className="cf-mid-cta"><div className="pf-shell" data-clean-reveal><div><span>PRUÉBALO CON TU OFERTA</span><h2>Convierte una pregunta real en el siguiente paso.</h2></div><a className="pf-button" href={signupUrl} onClick={() => trackSignup('middle')}>Crear mi Bigmelo gratis <Arrow /></a></div></section>;
}

function BenefitCards() {
  return <section className="pf-capabilities pf-shell"><div className="pf-section-heading" data-clean-reveal><span>LO QUE REÚNE BIGMELO</span><h2>Tu identidad, tu información y tu oferta.</h2><p>Configura la experiencia sin cambiar la manera en la que ya creas contenido y atiendes prospectos.</p></div><div className="cf-benefits" data-clean-reveal><article><span>Identidad</span><h3>Avatar, nombre, voz y personalidad.</h3><p>El perfil conserva una presencia coherente con tu marca.</p><small>Sofía Mendoza · avatar y presencia propios.</small></article><article><span>Conocimiento</span><h3>Fuentes revisadas y aprobadas por ti.</h3><p>Las respuestas utilizan la información que decides compartir.</p><small>“¿Qué programa me sirve para entrenar en casa?”</small></article><article><span>Oferta</span><h3>Productos dentro de la conversación.</h3><p>Publica descripción, precio y el siguiente destino comercial.</p><small>Fuerza Inicial · COP 180.000.</small></article><article><span>Contenido</span><h3>TikTok y YouTube conectados.</h3><p>Organiza las fuentes que alimentan tu presencia digital.</p><small>TikTok + YouTube como fuentes configurables.</small></article></div></section>;
}

function TemplateGallery({ selectedTemplate, setSelectedTemplate }: { selectedTemplate: TemplateKey; setSelectedTemplate: (key: TemplateKey) => void }) {
  const selected = templateData[selectedTemplate];
  return <section className="pf-templates cf-templates" id="plantillas"><div className="pf-shell pf-template-layout"><div className="pf-template-copy" data-clean-reveal><span>PROFILE 01–05</span><h2>Así vienen realmente las plantillas.</h2><p>Cada captura conserva el fondo CSS original de su template. Solo redondeamos las esquinas exteriores al presentarla dentro del landing.</p><div aria-label="Plantillas originales de Bigmelo" role="tablist">{(Object.keys(templateData) as TemplateKey[]).map((key) => <button aria-selected={selectedTemplate === key} className={selectedTemplate === key ? 'is-active' : ''} key={key} onClick={() => setSelectedTemplate(key)} role="tab" type="button"><i style={{ background: templateData[key].color }} />{templateData[key].label}</button>)}</div><small>Perfil de prueba Sofía Mendoza.</small></div><div className="pf-template-preview" data-clean-reveal role="tabpanel"><img alt={`Captura real de ${selected.label} con su fondo original`} key={selectedTemplate} src={selected.src} /></div></div></section>;
}

function AdminConnections() {
  return <section className="pf-connected pf-shell"><div className="pf-section-heading" data-clean-reveal><span>ADMINISTRADOR REAL</span><h2>Productos y contenido bajo tu control.</h2><p>Gestiona la oferta y conecta las fuentes que ya forman parte de tu estrategia.</p></div><div className="pf-connected-grid" data-clean-reveal><article><div><span>Productos</span><h3>Publica la oferta que el perfil puede recomendar.</h3></div><img alt="Administrador real de productos de Bigmelo" src={`${ADMIN_BASE}/admin-products.png`} /></article><article><div><span>Contenido</span><h3>Conecta TikTok y YouTube desde integraciones.</h3></div><img alt="Integración real de YouTube en Bigmelo" src={`${ADMIN_BASE}/admin-integrations-youtube.png`} /></article></div></section>;
}

function Trial({ signupUrl }: { signupUrl: string }) {
  return <section className="pf-trial pf-shell" id="precio"><div className="pf-section-heading" data-clean-reveal><span>PRUEBA DE SIETE DÍAS</span><h2>Compruébalo con tu propia información.</h2><p>Requiere tarjeta. Puedes cancelar antes del primer cobro.</p></div><div className="pf-timeline" data-clean-reveal><article><b>Hoy</b><span>Creas la cuenta y escoges una de las cinco plantillas.</span></article><article><b>Durante la prueba</b><span>Agregas información, publicas un producto y pruebas preguntas reales.</span></article><article><b>Día 7</b><span>Continúas con Starter por USD 12.99/mes o cancelas antes del cobro.</span></article></div><a className="pf-button" href={signupUrl} onClick={() => trackSignup('trial')}>Activar mis 7 días gratis <Arrow /></a><small>Configuración guiada para los primeros 20 usuarios.</small></section>;
}

const faqItems = [
  { answer: 'No. El administrador guía la creación del perfil, la carga de información, la publicación de productos y la selección de la plantilla.', id: 'technical_knowledge', question: '¿Necesito conocimientos técnicos?' },
  { answer: 'Puedes cancelar antes de terminar los siete días para evitar el primer cobro.', id: 'cancel_trial', question: '¿Cómo cancelo la prueba?' },
  { answer: 'Al terminar los siete días de prueba, si no cancelaste. El plan Starter cuesta USD 12.99 al mes.', id: 'first_charge', question: '¿Cuándo se realiza el primer cobro?' },
  { answer: 'Puedes conectar y organizar fuentes de TikTok y YouTube. Instagram puede dirigir seguidores a tu enlace público de Bigmelo.', id: 'social_sources', question: '¿Funciona con Instagram, TikTok y YouTube?' },
  { answer: 'Utiliza las fuentes y la información que tú agregas y apruebas dentro del administrador.', id: 'knowledge_sources', question: '¿Cómo aprende Bigmelo sobre mis programas?' },
  { answer: 'Sí. Puedes configurar WhatsApp como uno de los destinos comerciales para continuar la conversación.', id: 'whatsapp', question: '¿Puedo dirigir prospectos a WhatsApp?' },
  { answer: 'Sí. Puedes cambiar entre las cinco plantillas disponibles y conservar la información de tu perfil.', id: 'templates', question: '¿Puedo cambiar la plantilla después?' },
];

function Faq() {
  return <section className="cf-faq" id="preguntas"><div className="pf-shell"><div className="pf-section-heading" data-clean-reveal><span>PREGUNTAS FRECUENTES</span><h2>Todo claro antes de comenzar.</h2><p>Condiciones y funcionamiento de la prueba Starter.</p></div><div className="cf-faq__list" data-clean-reveal>{faqItems.map((item) => <details key={item.id} onToggle={(event) => { if (event.currentTarget.open) trackLandingEvent('landing_faq_open', { question: item.id }); }}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></div></section>;
}

function Final({ signupUrl }: { signupUrl: string }) {
  return <section className="pf-final cf-final"><div className="pf-shell" data-clean-reveal><span>BIGMELO PARA ENTRENADORES</span><h2>Haz que tu bio ayude a elegir.</h2><p>El link en bio que responde por ti.</p><a className="pf-button" href={signupUrl} onClick={() => trackSignup('final')}>Crear mi Bigmelo gratis <Arrow /></a><TrialLine /><div className="pf-final__screens"><ProfileShot screen="profile01" /><ProfileShot screen="profile03" /><ProfileShot screen="profile05" /></div></div></section>;
}

function Footer() {
  return <footer className="pf-footer"><div className="pf-shell pf-footer__top"><a aria-label="Bigmelo" href="/"><img alt="Bigmelo" src={bigmeloLogo} /></a><p>Perfiles interactivos con conversación, contenido y productos.</p><nav aria-label="Enlaces legales"><a href="/privacidad">Privacidad</a><a href="/terminos">Términos</a><a href="/eliminacion-datos">Eliminación de datos</a></nav></div><div className="pf-shell pf-footer__bottom"><span>© 2026 Bigmelo</span><span>Entrenadores Colombia</span></div></footer>;
}

function ProfileShot({ priority = false, screen }: { priority?: boolean; screen: TemplateKey | 'conversation' | 'product' }) {
  const src = screen === 'conversation' ? `${MOBILE_BASE}/profile02-conversation.png` : screen === 'product' ? `${MOBILE_BASE}/profile02-chat-product.png` : templateData[screen].src;
  const label = screen === 'conversation' ? 'conversación completa en Profile 02' : screen === 'product' ? 'producto recomendado en Profile 02' : `${templateData[screen].label} con su fondo original`;
  return <img alt={`Captura móvil real de ${label}`} className="pf-profile-shot" decoding="async" loading={priority ? 'eager' : 'lazy'} src={src} />;
}

function TrialLine() {
  return <p className="pf-trial-copy">7 días gratis · Requiere tarjeta · Luego USD 12.99/mes · Cancela antes del primer cobro.</p>;
}

function Arrow() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 20 20"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function createSignupUrl(): string {
  const url = new URL('/auth/custom/sign-up', getAdminBaseUrl());
  url.searchParams.set('locale', 'es');
  url.searchParams.set('intent', 'trial');
  url.searchParams.set('plan', 'starter');
  url.searchParams.set('cycle', 'month');
  const incoming = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const value = incoming.get(key)?.trim();
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set('landing_variant', 'entrenadores');
  return url.toString();
}

function useCleanMotion() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-clean-reveal]'));

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    const reveal = (target: HTMLElement) => {
      target.classList.add('is-reveal-ready');
      window.requestAnimationFrame(() => target.classList.add('is-visible'));
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px 16% 0px', threshold: 0.04 });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
}

function useHeaderNavigation() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.clean-v51');
    if (!root) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameRequested = false;
    let assistLockedUntil = window.location.hash ? window.performance.now() + 2200 : 0;
    let manualScrollIntentUntil = 0;
    const menuFocus: Record<string, string> = {
      '#inicio': '#inicio .pf-hero__copy',
      '#como-funciona': '#como-funciona .pf-section-heading',
      '#plantillas': '#plantillas .pf-template-copy',
      '#producto': '#producto .pf-feature-copy',
      '#precio': '#precio .pf-section-heading',
    };
    const headerLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('.pf-header a[href^="#"]'));
    const menuLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('.pf-header nav a[href^="#"]'));
    let navigationSettleTimer: number | undefined;
    const suppressScrollAssistForNavigation = () => {
      assistLockedUntil = window.performance.now() + 2200;
      manualScrollIntentUntil = 0;
    };
    const markManualScrollIntent = () => {
      manualScrollIntentUntil = window.performance.now() + 1000;
    };
    const markKeyboardScrollIntent = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '].includes(event.key)) {
        markManualScrollIntent();
      }
    };
    const linkHandlers = headerLinks.map((link) => {
      const handler = (event: MouseEvent) => {
        const hash = link.getAttribute('href');
        if (!hash) return;
        const target = root.querySelector<HTMLElement>(menuFocus[hash] ?? hash);
        if (!target) return;
        event.preventDefault();
        suppressScrollAssistForNavigation();
        trackLandingEvent('landing_nav_click', { section: hash.slice(1).replaceAll('-', '_') });
        window.history.pushState(null, '', hash);
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        window.clearTimeout(navigationSettleTimer);
        navigationSettleTimer = window.setTimeout(() => {
          suppressScrollAssistForNavigation();
          target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }, 1000);
      };
      link.addEventListener('click', handler);
      return { handler, link };
    });

    if (window.location.hash) {
      const initialTarget = root.querySelector<HTMLElement>(menuFocus[window.location.hash] ?? window.location.hash);
      if (initialTarget) {
        window.requestAnimationFrame(() => initialTarget.scrollIntoView({ behavior: 'auto', block: 'center' }));
        navigationSettleTimer = window.setTimeout(() => {
          suppressScrollAssistForNavigation();
          initialTarget.scrollIntoView({ behavior: 'auto', block: 'center' });
        }, 1200);
      }
    }

    const updateActiveMenuItem = () => {
      frameRequested = false;
      if (window.scrollY < window.innerHeight * 0.55) {
        menuLinks.forEach((link) => {
          link.classList.remove('is-active');
          link.removeAttribute('aria-current');
        });
        return;
      }

      const closest = menuLinks
        .map((link) => {
          const hash = link.getAttribute('href') ?? '';
          const section = hash ? root.querySelector<HTMLElement>(hash) : null;
          return { distance: section ? Math.abs(section.getBoundingClientRect().top - window.innerHeight * 0.34) : Number.POSITIVE_INFINITY, link };
        })
        .sort((a, b) => a.distance - b.distance)[0]?.link;
      menuLinks.forEach((link) => {
        const active = link === closest;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };

    const handleScroll = () => {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(updateActiveMenuItem);
    };

    const trackedSections = [
      ['hero', '.clean-hero'],
      ['how_it_works', '#como-funciona'],
      ['product_proof', '#producto'],
      ['benefits', '.pf-capabilities'],
      ['templates', '#plantillas'],
      ['admin_control', '.pf-connected'],
      ['trial', '#precio'],
      ['faq', '#preguntas'],
      ['final', '.cf-final'],
    ] as const;
    const seenSections = new Set<string>();
    const sectionObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const section = (entry.target as HTMLElement).dataset.v51Section;
        if (!section || seenSections.has(section)) return;
        seenSections.add(section);
        trackLandingEvent('landing_section_view', { section });
      });
    }, { threshold: 0.22 }) : null;
    trackedSections.forEach(([section, selector]) => {
      const target = root.querySelector<HTMLElement>(selector);
      if (!target) return;
      target.dataset.v51Section = section;
      sectionObserver?.observe(target);
    });

    const assistedTargets = [
      ['hero', '#inicio', '#inicio .pf-hero__copy'],
      ['product_proof', '#producto', '#producto .pf-feature-copy'],
      ['templates', '#plantillas', '#plantillas .pf-template-copy'],
    ] as const;
    const armedAssists = new Set<Element>();
    const scrollAssistObserver = !reduceMotion && 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
        const now = window.performance.now();
        const eligible = entries
          .filter((entry) => {
            if (entry.intersectionRatio < 0.04) {
              armedAssists.add(entry.target);
              return false;
            }

            return entry.isIntersecting
              && entry.intersectionRatio >= 0.1
              && armedAssists.has(entry.target)
              && now >= assistLockedUntil
              && now <= manualScrollIntentUntil;
          })
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!eligible) return;

        armedAssists.delete(eligible.target);
        assistLockedUntil = now + 1200;
        const observedSection = eligible.target as HTMLElement;
        const focusTarget = root.querySelector<HTMLElement>(observedSection.dataset.v51ScrollFocus ?? '');
        (focusTarget ?? observedSection).scrollIntoView({ behavior: 'smooth', block: 'center' });
        trackLandingEvent('landing_scroll_assist', {
          section: observedSection.dataset.v51ScrollAssist ?? 'unknown',
          threshold: '10_percent',
        });
      }, { threshold: [0, 0.04, 0.1] })
      : null;
    assistedTargets.forEach(([section, sectionSelector, focusSelector]) => {
      const target = root.querySelector<HTMLElement>(sectionSelector);
      if (!target) return;
      target.dataset.v51ScrollAssist = section;
      target.dataset.v51ScrollFocus = focusSelector;
      armedAssists.add(target);
      scrollAssistObserver?.observe(target);
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', markManualScrollIntent, { passive: true });
    window.addEventListener('touchstart', markManualScrollIntent, { passive: true });
    window.addEventListener('touchmove', markManualScrollIntent, { passive: true });
    window.addEventListener('keydown', markKeyboardScrollIntent);
    window.addEventListener('hashchange', suppressScrollAssistForNavigation);
    window.addEventListener('popstate', suppressScrollAssistForNavigation);
    updateActiveMenuItem();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', markManualScrollIntent);
      window.removeEventListener('touchstart', markManualScrollIntent);
      window.removeEventListener('touchmove', markManualScrollIntent);
      window.removeEventListener('keydown', markKeyboardScrollIntent);
      window.removeEventListener('hashchange', suppressScrollAssistForNavigation);
      window.removeEventListener('popstate', suppressScrollAssistForNavigation);
      window.clearTimeout(navigationSettleTimer);
      linkHandlers.forEach(({ handler, link }) => link.removeEventListener('click', handler));
      sectionObserver?.disconnect();
      scrollAssistObserver?.disconnect();
    };
  }, []);
}

function trackSignup(location: 'final' | 'header' | 'hero' | 'middle' | 'trial') {
  trackLandingEvent('landing_cta_click', { location });
  trackLandingEvent('signup_started', { location, plan: 'starter_monthly' });
}

function trackLandingEvent(eventName: string, parameters: Record<string, string>) {
  trackAnalyticsEvent(eventName, { landing_variant: 'entrenadores', ...parameters });
}
