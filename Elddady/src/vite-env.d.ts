
interface ImportMetaEnv {
  readonly VITE_APP_SUPABASE_URL: string
  readonly VITE_APP_ANON_KEY: string
  readonly VITE_API_URL: string
  readonly VITE_CAPTCHA_PROVIDER?: 'recaptcha' | 'hcaptcha' | 'turnstile'
  readonly VITE_CAPTCHA_SITE_KEY?: string
  // Standard Vite Env Variables
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
  readonly BASE_URL: string
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


