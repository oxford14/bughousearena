/** Canonical production origin (Firebase Hosting custom domain). */
export const PRODUCTION_APP_ORIGIN = "https://bughousearena.com";
export const PRODUCTION_APP_HOST = "bughousearena.com";

export function isAllowedAuthHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === PRODUCTION_APP_HOST ||
    hostname === `www.${PRODUCTION_APP_HOST}` ||
    hostname.endsWith(".web.app") ||
    hostname.endsWith(".firebaseapp.com") ||
    hostname.endsWith(".vercel.app")
  );
}
