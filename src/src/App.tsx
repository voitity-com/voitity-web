import { Home } from './pages/Home';
import { Profile } from './pages/Profile';

export function App() {
  const profileAlias = window.location.pathname.split('/').filter(Boolean)[0];

  if (profileAlias) {
    return <Profile profileAlias={decodeURIComponent(profileAlias)} />;
  }

  return <Home />;
}
