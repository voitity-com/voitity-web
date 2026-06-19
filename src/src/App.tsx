import { Home } from './pages/Home';
import { PrivacyPolicy, TermsAndConditions } from './pages/Legal';
import { Profile } from './pages/Profile';

export function App() {
  const profileAlias = window.location.pathname.split('/').filter(Boolean)[0];

  if (profileAlias === 'privacidad' || profileAlias === 'privacy') {
    return <PrivacyPolicy />;
  }

  if (profileAlias === 'terminos' || profileAlias === 'terms') {
    return <TermsAndConditions />;
  }

  if (profileAlias) {
    return <Profile profileAlias={decodeURIComponent(profileAlias)} />;
  }

  return <Home />;
}
