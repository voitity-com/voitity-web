import { FormEvent, useEffect, useState } from 'react';

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
      eyebrow: 'Avatares conversacionales con voz propia',
      title: 'Convierte un perfil real en una presencia interactiva.',
      lead:
        'Sube una imagen autorizada, clona una voz con textos leídos y publica un perfil capaz de responder por chat o audio.',
      primaryCta: 'Contáctenos',
      secondaryCta: 'Ver planes',
      demoAria:
        'Simulación de un perfil con avatar animado, ondas de audio y respuesta escrita.',
      profileName: 'Valeria Rios',
      profileRole: 'Perfil profesional verificado',
      online: 'En línea',
      userMessage: '¿Qué puedes contarle a un visitante?',
      avatarMessage: 'Respondo con mi voz sobre mi historia y agenda.',
      speaking: 'Respondiendo con voz clonada',
      waveform: 'Audio activo',
      memory: 'Memoria del perfil',
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
      eyebrow: 'Conversational avatars with their own voice',
      title: 'Turn a real profile into an interactive presence.',
      lead:
        'Upload an authorized image, clone a voice from read scripts, and publish a profile that answers by chat or audio.',
      primaryCta: 'Contact us',
      secondaryCta: 'See plans',
      demoAria:
        'Simulation of a profile with an animated avatar, audio waves, and written response.',
      profileName: 'Valeria Rios',
      profileRole: 'Verified professional profile',
      online: 'Online',
      userMessage: 'What can you tell a visitor?',
      avatarMessage: 'I answer in my own voice about my work and schedule.',
      speaking: 'Answering with cloned voice',
      waveform: 'Audio active',
      memory: 'Profile memory',
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

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'es' ? 'Voitity | Avatares interactivos' : 'Voitity | Interactive avatars';
  }, [locale]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
  }

  return (
    <main className="landing-page">
      <header className="site-header" aria-label="Voitity">
        <a className="brand" href="#top" aria-label="Voitity">
          <span className="brand-mark">V</span>
          <span>Voitity</span>
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
          <div className="signal signal-a" />
          <div className="signal signal-b" />
        </div>

        <div className="hero-content" id="product">
          <p className="eyebrow">{t.hero.eyebrow}</p>
          <h1>{t.hero.title}</h1>
          <p className="hero-lead">{t.hero.lead}</p>

          <div className="hero-actions">
            <a className="button button-primary" href="#contact">
              {t.hero.primaryCta}
            </a>
            <a className="button button-secondary" href="#plans">
              {t.hero.secondaryCta}
            </a>
          </div>
        </div>

        <div className="demo-stage" role="img" aria-label={t.hero.demoAria}>
          <div className="demo-toolbar">
            <span />
            <span />
            <span />
          </div>

          <div className="profile-strip">
            <div className="avatar">
              <div className="avatar-hair" />
              <div className="avatar-face">
                <span className="avatar-eye avatar-eye-left" />
                <span className="avatar-eye avatar-eye-right" />
                <span className="avatar-nose" />
                <span className="avatar-mouth" />
              </div>
            </div>

            <div>
              <strong>{t.hero.profileName}</strong>
              <span>{t.hero.profileRole}</span>
            </div>

            <small>{t.hero.online}</small>
          </div>

          <div className="conversation">
            <p className="message message-user">{t.hero.userMessage}</p>
            <div className="message message-avatar">
              <span className="typing-text">{t.hero.avatarMessage}</span>
            </div>
          </div>

          <div className="voice-panel">
            <div>
              <span>{t.hero.speaking}</span>
              <strong>{t.hero.waveform}</strong>
            </div>

            <div className="audio-wave" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="memory-line">
            <span>{t.hero.memory}</span>
            <div>
              <i />
              <i />
              <i />
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
        <div className="section-heading">
          <p className="eyebrow">{t.contact.eyebrow}</p>
          <h2>{t.contact.title}</h2>
          <p>{t.contact.lead}</p>
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
        <a className="brand" href="#top" aria-label="Voitity">
          <span className="brand-mark">V</span>
          <span>Voitity</span>
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
