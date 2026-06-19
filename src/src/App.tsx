import { Home } from './pages/Home';
import { PrivacyPolicy, TermsAndConditions } from './pages/Legal';
import { Profile } from './pages/Profile';

export function App() {
  const profileAlias = window.location.pathname.split('/').filter(Boolean)[0];

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
    return <Profile profileAlias={decodeURIComponent(profileAlias)} />;
  }

  return <Home />;
}
