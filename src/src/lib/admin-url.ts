export function getAdminBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_ADMIN_BASE_URL as string | undefined;

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/u, '');
  }

  if (typeof window === 'undefined') {
    return 'https://admin.bigmelo.com';
  }

  const { hostname, protocol } = window.location;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//localhost:3000`;
  }

  return 'https://admin.bigmelo.com';
}

export function getAdminSignInUrl(locale?: 'en' | 'es'): string {
  const url = new URL('/auth/custom/sign-in', getAdminBaseUrl());

  if (locale) {
    url.searchParams.set('locale', locale);
  }

  return url.toString();
}
