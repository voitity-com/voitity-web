import { lazy, Suspense, type ReactNode, useCallback, useEffect, useState } from 'react';

import { AnalyticsConsent } from './components/AnalyticsConsent';
import {
  initializeGoogleAnalytics,
  subscribeToAnalyticsConsent,
  trackPageView,
} from './lib/google-analytics';
import homeSeo from './content/home-seo.json';

const EmbeddedProfile = lazy(async () => {
  const module = await import('./pages/EmbeddedProfile');

  return { default: module.EmbeddedProfile };
});
const DataDeletionInstructions = lazy(async () => {
  const module = await import('./pages/Legal');

  return { default: module.DataDeletionInstructions };
});
const PrivacyPolicy = lazy(async () => {
  const module = await import('./pages/Legal');

  return { default: module.PrivacyPolicy };
});
const TermsAndConditions = lazy(async () => {
  const module = await import('./pages/Legal');

  return { default: module.TermsAndConditions };
});
const NotFound = lazy(async () => {
  const module = await import('./pages/NotFound');

  return { default: module.NotFound };
});
const Profile = lazy(async () => {
  const module = await import('./pages/Profile');

  return { default: module.Profile };
});
const TrainerLanding = lazy(async () => {
  const module = await import('./pages/TrainerLanding');

  return { default: module.TrainerLanding };
});
const HomeProposal = lazy(async () => {
  const module = await import('./pages/HomeProposal');

  return { default: module.HomeProposal };
});

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [missingPathname, setMissingPathname] = useState<string | null>(null);
  const profileAlias = pathname.split('/').filter(Boolean)[0];
  const hostname = window.location.hostname.toLowerCase().replace(/\.$/, '');
  const isCustomDomain = !isBigmeloOrLocalHost(hostname);
  const isTrainerLanding = isTrainerLandingPath(pathname);
  const homeProposalVariant = isCustomDomain ? null : getHomeProposalVariant(pathname);
  const searchParams = new URLSearchParams(window.location.search);
  const widgetKey = searchParams.get('widget')?.trim() ?? '';
  const isWidgetMode = widgetKey !== '';
  const isLandingDemoMode = searchParams.get('landing_demo') === '1';

  useEffect(() => {
    if (isWidgetMode || isLandingDemoMode) {
      return;
    }

    initializeGoogleAnalytics();

    function handlePopState() {
      setPathname(window.location.pathname);
      setMissingPathname(null);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLandingDemoMode, isWidgetMode]);

  useEffect(() => {
    if (isWidgetMode || isLandingDemoMode) {
      return;
    }

    const landingLocale = getInitialLandingLocale();
    const safeTitle = isCustomDomain
      ? 'Public profile | Bigmelo'
      : isTrainerLanding
        ? 'Bigmelo para entrenadores | El link en bio que responde por ti'
        : homeProposalVariant
          ? getHomeProposalTitle(homeProposalVariant, landingLocale)
          : profileAlias
            ? ['privacidad', 'privacy'].includes(profileAlias)
              ? 'Privacy | Bigmelo'
              : ['terminos', 'terms'].includes(profileAlias)
                ? 'Terms | Bigmelo'
                : ['eliminacion-datos', 'eliminacion-de-datos', 'data-deletion', 'user-data-deletion'].includes(profileAlias)
                  ? 'Data deletion | Bigmelo'
                  : 'Public profile | Bigmelo'
            : 'Home | Bigmelo';

    const pageParameters = homeProposalVariant
      ? {
          landing_audience: 'general',
          landing_variant: homeProposalVariant,
          page_locale: landingLocale,
          trial_days: 7,
        }
      : isTrainerLanding
        ? {
          landing_audience: 'fitness_coaches_colombia',
          landing_variant: 'entrenadores',
          page_locale: 'es',
          trial_days: 7,
        }
        : undefined;

    trackPageView(pathname, safeTitle, pageParameters);

    return subscribeToAnalyticsConsent((consent) => {
      if (consent === 'granted') {
        trackPageView(pathname, safeTitle, pageParameters);
      }
    });
  }, [homeProposalVariant, isCustomDomain, isLandingDemoMode, isTrainerLanding, isWidgetMode, pathname, profileAlias]);

  let page: ReactNode;

  const handleProfileNotFound = useCallback(() => {
    setMissingPathname(window.location.pathname);
  }, []);

  if (isWidgetMode) {
    page = <EmbeddedProfile publicKey={widgetKey} />;
  } else if (isCustomDomain && missingPathname === pathname) {
    page = <NotFound />;
  } else if (isCustomDomain) {
    page = <Profile onProfileNotFound={handleProfileNotFound} profileDomain={hostname} suppressViewTracking={isLandingDemoMode} />;
  } else if (isTrainerLanding) {
    page = <TrainerLanding />;
  } else if (homeProposalVariant) {
    page = <HomeProposal variant={homeProposalVariant} />;
  } else if (profileAlias === 'landing') {
    page = <NotFound />;
  } else if (profileAlias === 'privacidad') {
    page = <PrivacyPolicy locale="es" />;
  } else if (profileAlias === 'privacy') {
    page = <PrivacyPolicy locale="en" />;
  } else if (profileAlias === 'terminos') {
    page = <TermsAndConditions locale="es" />;
  } else if (profileAlias === 'terms') {
    page = <TermsAndConditions locale="en" />;
  } else if (profileAlias === 'eliminacion-datos' || profileAlias === 'eliminacion-de-datos') {
    page = <DataDeletionInstructions locale="es" />;
  } else if (profileAlias === 'data-deletion' || profileAlias === 'user-data-deletion') {
    page = <DataDeletionInstructions locale="en" />;
  } else if (profileAlias && missingPathname === pathname) {
    page = <NotFound />;
  } else if (profileAlias) {
    page = <Profile onProfileNotFound={handleProfileNotFound} profileAlias={decodeURIComponent(profileAlias)} suppressViewTracking={isLandingDemoMode} />;
  } else {
    page = <HomeProposal variant="homev01" />;
  }

  return (
    <>
      <Suspense fallback={<RouteSkeleton />}>{page}</Suspense>
      {isWidgetMode || isLandingDemoMode ? null : <AnalyticsConsent />}
    </>
  );
}

function getHomeProposalTitle(variant: 'homev01' | 'homev02' | 'homev03', locale: 'en' | 'es'): string {
  const titles = {
    en: {
      homev01: homeSeo.en.title,
      homev02: 'Do not publish another link. Publish a conversation. | Bigmelo',
      homev03: 'Everything you know can finally answer. | Bigmelo',
    },
    es: {
      homev01: homeSeo.es.title,
      homev02: 'No publiques otro link. Publica una conversación. | Bigmelo',
      homev03: 'Todo lo que sabes. Ahora sí puede responder. | Bigmelo',
    },
  };

  return titles[locale][variant];
}

function getHomeProposalVariant(pathname: string): 'homev01' | 'homev02' | 'homev03' | null {
  const normalizedPath = pathname.replace(/\/+$/u, '').toLowerCase();

  if (normalizedPath === '') return 'homev01';
  if (normalizedPath === '/landing/homev01') return 'homev01';
  if (normalizedPath === '/landing/homev02') return 'homev02';
  if (normalizedPath === '/landing/homev03') return 'homev03';

  return null;
}

function getInitialLandingLocale(): 'en' | 'es' {
  try {
    return window.localStorage.getItem('bigmelo-locale') === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function RouteSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="route-skeleton" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}

function isTrainerLandingPath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/u, '').toLowerCase();

  return normalizedPath === '/landing/entrenadores' || normalizedPath === '/landing/entrenadorv51';
}

function isBigmeloOrLocalHost(hostname: string): boolean {
  return (
    hostname === 'bigmelo.com' ||
    hostname.endsWith('.bigmelo.com') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  );
}
