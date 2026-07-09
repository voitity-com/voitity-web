import { useCallback, useEffect, useState } from 'react';

import { Home } from './pages/Home';
import { PrivacyPolicy, TermsAndConditions } from './pages/Legal';
import { Profile } from './pages/Profile';

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const profileAlias = pathname.split('/').filter(Boolean)[0];

  useEffect(() => {
    function handlePopState() {
      setPathname(window.location.pathname);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleProfileNotFound = useCallback(() => {
    window.history.replaceState(null, '', '/');
    setPathname('/');
  }, []);

  if (profileAlias === 'privacidad') {
    return <PrivacyPolicy locale="es" />;
  }

  if (profileAlias === 'privacy') {
    return <PrivacyPolicy locale="en" />;
  }

  if (profileAlias === 'terminos') {
    return <TermsAndConditions locale="es" />;
  }

  if (profileAlias === 'terms') {
    return <TermsAndConditions locale="en" />;
  }

  if (profileAlias) {
    return <Profile onProfileNotFound={handleProfileNotFound} profileAlias={decodeURIComponent(profileAlias)} />;
  }

  return <Home />;
}
