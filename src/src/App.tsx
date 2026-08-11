import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { AnalyticsConsent } from './components/AnalyticsConsent';
import {
  initializeGoogleAnalytics,
  subscribeToAnalyticsConsent,
  trackPageView,
} from './lib/google-analytics';
import { Home } from './pages/Home';
import { EmbeddedProfile } from './pages/EmbeddedProfile';
import { DataDeletionInstructions, PrivacyPolicy, TermsAndConditions } from './pages/Legal';
import { NotFound } from './pages/NotFound';
import { Profile } from './pages/Profile';

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [missingPathname, setMissingPathname] = useState<string | null>(null);
  const profileAlias = pathname.split('/').filter(Boolean)[0];
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

    const safeTitle = profileAlias
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
  }, [isWidgetMode, pathname, profileAlias]);

  let page: ReactNode;

  const handleProfileNotFound = useCallback(() => {
    setMissingPathname(window.location.pathname);
  }, []);

  if (isWidgetMode) {
    page = <EmbeddedProfile publicKey={widgetKey} />;
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
      {page}
      {isWidgetMode ? null : <AnalyticsConsent />}
    </>
  );
}
