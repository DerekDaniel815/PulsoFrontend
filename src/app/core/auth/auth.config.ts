const REMOTE_API_URL = 'https://pulso-backend-demo.onrender.com';
const hostname = globalThis.location?.hostname;
const isLocalDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';

export const PULSO_API_URL = isLocalDevelopment ? '/pulso-api' : REMOTE_API_URL;

export function isPulsoApiUrl(url: string): boolean {
  return url === PULSO_API_URL || url.startsWith(`${PULSO_API_URL}/`);
}
