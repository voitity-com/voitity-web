import { FormEvent, useEffect, useState } from 'react';

import bigmeloLogo from '../assets/bigmelo-logo.png';
import valeriaAvatar from '../assets/valeria-rios-avatar.png';

type Locale = 'es' | 'en';

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

const content: Record<
  Locale,
  {
    nav: {
      product: string;
      plans: string;
      contact: string;
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
      online: string;
      userMessage: string;
      avatarMessage: string;
      speaking: string;
      waveform: string;
      memory: string;
    };
    plans: {
      eyebrow: string;
      title: string;
      lead: string;
      items: Plan[];
    };
    contact: {
      eyebrow: string;
      title: string;
      lead: string;
      name: string;
      email: string;
      message: string;
      submit: string;
      success: string;
    };
    footer: {
      tagline: string;
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
    },
    hero: {
      eyebrow: 'Perfiles interactivos con imagen, voz y contexto',
      title: 'Avatares que responden con tu imagen y tu voz.',
      lead:
        'Crea una página pública donde tu avatar conversa, responde con audio y mantiene una experiencia cercana a tu forma real de comunicar.',
      primaryCta: 'Contáctenos',
      secondaryCta: 'Ver planes',
      demoAria:
        'Vista previa de un perfil interactivo con avatar central, mensajes laterales, ondas de audio y campo de conversación.',
      profileName: 'Valeria Rios',
      profileRole: 'Perfil profesional interactivo',
      online: 'Activo ahora',
      userMessage: '¿Puedes contarme sobre tu experiencia?',
      avatarMessage: 'Claro. Puedo responder sobre mi historia, servicios y proyectos usando mi propia voz.',
      speaking: 'Respuesta con audio',
      waveform: 'Voz del perfil',
      memory: 'Información verificada',
    },
    plans: {
      eyebrow: 'Planes',
      title: 'Empieza con créditos simples y predecibles.',
      lead:
        'Cada crédito alimenta conversaciones, respuestas de voz y mejoras del perfil publicado.',
      items: [
        {
          name: 'Mensual',
          price: '$6',
          period: '/mes',
          description: 'Para validar un perfil interactivo con bajo costo inicial.',
          features: [
            '1000 créditos incluidos',
            '1 generación de imagen por mes',
            'Chat de texto y audio para visitantes',
          ],
          cta: 'Elegir mensual',
        },
        {
          name: 'Anual',
          price: '$60',
          period: '/año',
          description: 'Para mantener un perfil activo todo el año con mejor precio.',
          features: [
            '1000 créditos mensuales',
            '12 generaciones de imagen al año',
            'Ahorro equivalente a 2 meses',
          ],
          cta: 'Elegir anual',
          highlighted: true,
        },
      ],
    },
    contact: {
      eyebrow: 'Contáctenos',
      title: 'Cuéntanos qué perfil quieres crear.',
      lead:
        'Personaje público, profesional, educador, creador o marca personal: déjanos tus datos y te contactamos.',
      name: 'Nombre',
      email: 'Correo',
      message: 'Mensaje',
      submit: 'Enviar solicitud',
      success: 'Gracias. Recibimos tu solicitud.',
    },
    footer: {
      tagline: 'Perfiles conversacionales con imagen, voz e información verificada.',
      privacy: 'Privacidad',
      terms: 'Términos',
    },
  },
  en: {
    nav: {
      product: 'Product',
      plans: 'Plans',
      contact: 'Contact',
    },
    hero: {
      eyebrow: 'Interactive profiles with image, voice, and context',
      title: 'Avatars that reply with your image and voice.',
      lead:
        'Create a public page where your avatar chats, replies with audio, and keeps the experience close to your real communication style.',
      primaryCta: 'Contact us',
      secondaryCta: 'See plans',
      demoAria:
        'Preview of an interactive profile with a centered avatar, side messages, audio waves, and conversation input.',
      profileName: 'Valeria Rios',
      profileRole: 'Interactive professional profile',
      online: 'Active now',
      userMessage: 'Can you tell me about your experience?',
      avatarMessage: 'Of course. I can answer about my story, services, and projects using my own voice.',
      speaking: 'Audio response',
      waveform: 'Profile voice',
      memory: 'Verified information',
    },
    plans: {
      eyebrow: 'Plans',
      title: 'Start with simple, predictable credits.',
      lead:
        'Each credit powers conversations, voice replies, and improvements to the published profile.',
      items: [
        {
          name: 'Monthly',
          price: '$6',
          period: '/month',
          description: 'For validating one interactive profile with a low starting cost.',
          features: [
            '1000 credits included',
            '1 image generation per month',
            'Text and audio chat for visitors',
          ],
          cta: 'Choose monthly',
        },
        {
          name: 'Annual',
          price: '$60',
          period: '/year',
          description: 'For keeping a profile active all year at a better price.',
          features: [
            '1000 monthly credits',
            '12 image generations per year',
            'Savings equal to 2 months',
          ],
          cta: 'Choose annual',
          highlighted: true,
        },
      ],
    },
    contact: {
      eyebrow: 'Contact us',
      title: 'Tell us which profile you want to create.',
      lead:
        'Public figure, professional, educator, creator, or personal brand: leave your details and we will contact you.',
      name: 'Name',
      email: 'Email',
      message: 'Message',
      submit: 'Send request',
      success: 'Thanks. We received your request.',
    },
    footer: {
      tagline: 'Conversational profiles with verified image, voice, and information.',
      privacy: 'Privacy',
      terms: 'Terms',
    },
  },
};

function getInitialLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'es';
  }

  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function Home() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const t = content[locale];
  const heroProof =
    locale === 'es'
      ? ['Imagen autorizada', 'Voz clonada', 'Chat público', 'Audio en tiempo real']
      : ['Authorized image', 'Cloned voice', 'Public chat', 'Real-time audio'];
  const contactHighlights =
    locale === 'es'
      ? ['Perfil público listo para compartir', 'Mensajes por texto y audio', 'Información organizada por contexto']
      : ['Public profile ready to share', 'Text and audio messages', 'Context-aware profile information'];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'es' ? 'bigmelo | Avatares interactivos' : 'bigmelo | Interactive avatars';
  }, [locale]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
  }

  return (
    <main className="landing-page">
      <header className="site-header" aria-label="bigmelo">
        <a className="brand" href="#top" aria-label="bigmelo">
          <img className="brand-logo" alt="bigmelo" src={bigmeloLogo} />
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a href="#product">{t.nav.product}</a>
          <a href="#plans">{t.nav.plans}</a>
          <a href="#contact">{t.nav.contact}</a>
        </nav>

        <div className="language-switch" aria-label="Language">
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
              <img alt="" src={valeriaAvatar} />
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

        <div className="hero-product-demo" role="img" aria-label={t.hero.demoAria}>
          <div className="demo-profile-name">{t.hero.profileName}</div>

          <div className="demo-chat-surface">
            <div className="demo-thread demo-thread-left">
              <article className="demo-bubble with-avatar">
                <img alt="" className="demo-mini-avatar" src={valeriaAvatar} />
                <span className="demo-play" />
                <p>{t.hero.avatarMessage}</p>
                <time>10:30 AM</time>
              </article>

              <article className="demo-bubble with-avatar">
                <img alt="" className="demo-mini-avatar" src={valeriaAvatar} />
                <span className="demo-play" />
                <p>{t.hero.memory}</p>
                <time>10:31 AM</time>
              </article>
            </div>

            <div className="demo-avatar-stage">
              <span className="demo-ring demo-ring-one" />
              <span className="demo-ring demo-ring-two" />
              <span className="demo-ring demo-ring-three" />
              <div className="landing-avatar">
                <img alt="" className="landing-avatar-image" src={valeriaAvatar} />
              </div>
            </div>

            <div className="demo-thread demo-thread-right">
              <article className="demo-bubble visitor">
                <p>{t.hero.userMessage}</p>
                <time>10:30 AM</time>
              </article>

              <article className="demo-bubble visitor">
                <p>{locale === 'es' ? '¿También puedes responder con audio?' : 'Can you answer with audio too?'}</p>
                <time>10:31 AM</time>
              </article>
            </div>
          </div>

          <div className="demo-composer">
            <div className="demo-input">{locale === 'es' ? 'Escribe tu mensaje...' : 'Write your message...'}</div>
            <div className="demo-action" aria-hidden="true">
              <MicrophoneIcon />
            </div>
            <div className="demo-action" aria-hidden="true">
              <SendIcon />
            </div>
          </div>
        </div>
      </section>

      <section className="plans-section section-shell" id="plans">
        <div className="section-heading">
          <p className="eyebrow">{t.plans.eyebrow}</p>
          <h2>{t.plans.title}</h2>
          <p>{t.plans.lead}</p>
        </div>

        <div className="plans-grid">
          {t.plans.items.map((plan) => (
            <article className={plan.highlighted ? 'plan-card highlighted' : 'plan-card'} key={plan.name}>
              <div>
                <span className="plan-label">
                  {plan.highlighted
                    ? locale === 'es'
                      ? 'Mejor valor'
                      : 'Best value'
                    : locale === 'es'
                      ? 'Inicio'
                      : 'Start'}
                </span>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>

              <div className="plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
              </div>

              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <a className="button plan-button" href="#contact">
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-section section-shell" id="contact">
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

        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            {t.contact.name}
            <input name="name" autoComplete="name" required />
          </label>

          <label>
            {t.contact.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <label>
            {t.contact.message}
            <textarea name="message" rows={5} required />
          </label>

          <button className="button button-primary" type="submit">
            {t.contact.submit}
          </button>

          {isSubmitted ? <p className="form-success">{t.contact.success}</p> : null}
        </form>
      </section>

      <footer className="site-footer">
        <a className="brand" href="#top" aria-label="bigmelo">
          <img className="brand-logo" alt="bigmelo" src={bigmeloLogo} />
        </a>

        <p>{t.footer.tagline}</p>

        <div>
          <a href="#contact">{t.footer.privacy}</a>
          <a href="#contact">{t.footer.terms}</a>
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
