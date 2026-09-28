/**
 * App config — API base URLs, optional API keys, and environment switchers.
 *
 * Vite env vars (set in `.env` / `.env.production`):
 *   VITE_APP_ENV=development|staging|production
 *   VITE_API_BASE_URL=http://127.0.0.1:8000
 *   VITE_API_KEY=          (optional; leave empty when using JWT only)
 *   VITE_USE_PROXY=true    (empty base URL → same-origin / Vite proxy)
 */

const ENVIRONMENTS = {
  development: {
    apiBaseUrl: 'http://127.0.0.1:8000',
    apiKey: '',
    enableDebug: true,
    enableMockData: false,
  },
  staging: {
    apiBaseUrl: 'https://staging-api.example.com',
    apiKey: '',
    enableDebug: true,
    enableMockData: false,
  },
  production: {
    apiBaseUrl: 'https://api.example.com',
    apiKey: '',
    enableDebug: false,
    enableMockData: false,
  },
}

function resolveAppEnv() {
  const fromEnv = import.meta.env.VITE_APP_ENV
  if (fromEnv && ENVIRONMENTS[fromEnv]) return fromEnv
  if (import.meta.env.PROD) return 'production'
  if (import.meta.env.DEV) return 'development'
  return 'development'
}

const appEnv = resolveAppEnv()
const defaults = ENVIRONMENTS[appEnv]

/** When true (and no VITE_API_BASE_URL), requests use relative URLs via Vite proxy. */
const useProxy =
  String(import.meta.env.VITE_USE_PROXY || '').toLowerCase() === 'true'

const apiBaseUrl = useProxy
  ? ''
  : import.meta.env.VITE_API_BASE_URL || defaults.apiBaseUrl

const apiKey = import.meta.env.VITE_API_KEY || defaults.apiKey || ''

const config = {
  /** Active environment name */
  appEnv,

  /** Gateway origin (no trailing slash). Empty string = same-origin / proxy. */
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),

  /**
   * Optional static API key for gateways that require it.
   * Leave empty for JWT-only auth (LeaveFlow default).
   */
  apiKey,

  /** Feature / behaviour switchers */
  switchers: {
    enableDebug:
      String(import.meta.env.VITE_ENABLE_DEBUG || '').toLowerCase() === 'true' ||
      defaults.enableDebug,
    enableMockData:
      String(import.meta.env.VITE_ENABLE_MOCK || '').toLowerCase() === 'true' ||
      defaults.enableMockData,
    useProxy,
  },

  isDev: appEnv === 'development',
  isStaging: appEnv === 'staging',
  isProd: appEnv === 'production',
}

export default config

export {
  config,
  ENVIRONMENTS,
  apiBaseUrl,
  apiKey,
  appEnv,
}
