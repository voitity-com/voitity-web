import { lazy, Suspense, type ReactNode, useCallback, useEffect, useState } from 'react';

import { AnalyticsConsent } from './components/AnalyticsConsent';
import {
  initializeGoogleAnalytics,
  subscribeToAnalyticsConsent,
  trackPageView,
} from './lib/google-analytics';
import { Home } from './pages/Home';

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

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [missingPathname, setMissingPathname] = useState<string | null>(null);
  const profileAlias = pathname.split('/').filter(Boolean)[0];
  const hostname = window.location.hostname.toLowerCase().replace(/\.$/, '');
  const isCustomDomain = !isBigmeloOrLocalHost(hostname);
  const isTrainerLanding = isTrainerLandingPath(pathname);
  const widgetKey = new URLSearchParams(window.location.search).get('widget')?.trim() ?? '';
  const isWidgetMode = widgetKey !== '';

  useEffect(() => {
    if (isWidgetMode) {
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
  }, [isWidgetMode]);

  useEffect(() => {
    if (isWidgetMode) {
      return;
    }

    const safeTitle = isCustomDomain
      ? 'Public profile | Bigmelo'
      : isTrainerLanding
        ? 'Bigmelo para entrenadores | El link en bio que responde por ti'
      : profileAlias
      ? ['privacidad', 'privacy'].includes(profileAlias)
        ? 'Privacy | Bigmelo'
        : ['terminos', 'terms'].includes(profileAlias)
          ? 'Terms | Bigmelo'
          : ['eliminacion-datos', 'eliminacion-de-datos', 'data-deletion', 'user-data-deletion'].includes(profileAlias)
            ? 'Data deletion | Bigmelo'
            : 'Public profile | Bigmelo'
      : 'Home | Bigmelo';

    trackPageView(pathname, safeTitle);

    return subscribeToAnalyticsConsent((consent) => {
      if (consent === 'granted') {
        trackPageView(pathname, safeTitle);
      }
    });
  }, [isCustomDomain, isTrainerLanding, isWidgetMode, pathname, profileAlias]);

  let page: ReactNode;

  const handleProfileNotFound = useCallback(() => {
    setMissingPathname(window.location.pathname);
  }, []);

  if (isWidgetMode) {
    page = <EmbeddedProfile publicKey={widgetKey} />;
  } else if (isCustomDomain && missingPathname === pathname) {
    page = <NotFound />;
  } else if (isCustomDomain) {
    page = <Profile onProfileNotFound={handleProfileNotFound} profileDomain={hostname} />;
  } else if (isTrainerLanding) {
    page = <TrainerLanding />;
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
    page = <Profile onProfileNotFound={handleProfileNotFound} profileAlias={decodeURIComponent(profileAlias)} />;
  } else {
    page = <Home />;
  }

  return (
    <>
      <Suspense fallback={<RouteSkeleton />}>{page}</Suspense>
      {isWidgetMode ? null : <AnalyticsConsent />}
    </>
  );
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
