export const TRAINER_TIKTOK_PIXEL_ID = "DAQ31ORC77U4UMHB35GG";

const TRAINER_LANDING_PATH = "/landing/entrenadores";

export function shouldEnableTrainerTikTokPixel({
  hostname,
  isProduction,
  pathname,
  search,
}: {
  hostname: string;
  isProduction: boolean;
  pathname: string;
  search: string;
}): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/u, "");
  const normalizedPathname = pathname.replace(/\/+$/u, "").toLowerCase();
  const isLandingDemo = new URLSearchParams(search).get("landing_demo") === "1";

  return (
    isProduction &&
    !isLandingDemo &&
    normalizedHostname === "bigmelo.com" &&
    normalizedPathname === TRAINER_LANDING_PATH
  );
}
