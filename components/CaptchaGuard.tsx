
import React, { useEffect, useRef, useState } from 'react';

export type CaptchaProvider = 'recaptcha' | 'hcaptcha' | 'turnstile';

interface CaptchaGuardProps {
  provider?: CaptchaProvider; // 'recaptcha' | 'hcaptcha' | 'turnstile'
  siteKey?: string;
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark';
}

const SCRIPTS = {
  recaptcha: 'https://www.google.com/recaptcha/api.js?render=explicit',
  hcaptcha: 'https://js.hcaptcha.com/1/api.js?render=explicit',
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
};

const CaptchaGuard: React.FC<CaptchaGuardProps> = ({ 
  provider = import.meta.env?.VITE_CAPTCHA_PROVIDER as CaptchaProvider,
  siteKey = import.meta.env?.VITE_CAPTCHA_SITE_KEY,
  onVerify,
  theme = 'light'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Script Injection Logic
  useEffect(() => {
    if (!provider || !siteKey) return;

    const scriptSrc = SCRIPTS[provider];
    if (!scriptSrc) {
      console.error(`[CaptchaGuard] Unknown provider: ${provider}`);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src^="${scriptSrc.split('?')[0]}"]`);
    
    const onLoadCallback = () => setIsLoaded(true);

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.defer = true;
      script.onload = onLoadCallback;
      document.head.appendChild(script);
    } else {
      // If script is already loaded, check if the global object is ready
      const isReady = 
        (provider === 'recaptcha' && (window as any).grecaptcha?.render) ||
        (provider === 'hcaptcha' && (window as any).hcaptcha?.render) ||
        (provider === 'turnstile' && (window as any).turnstile?.render);
      
      if (isReady) {
        setIsLoaded(true);
      } else {
        existingScript.addEventListener('load', onLoadCallback);
      }
    }

    return () => {
      if (existingScript) existingScript.removeEventListener('load', onLoadCallback);
    };
  }, [provider, siteKey]);

  // 2. Widget Rendering Logic
  useEffect(() => {
    if (!isLoaded || !containerRef.current || !siteKey || !provider) return;

    // Helper to clear previous widget if any
    const cleanup = () => {
      if (widgetId.current !== null) {
        try {
          if (provider === 'turnstile' && (window as any).turnstile) (window as any).turnstile.remove(widgetId.current);
          // reCAPTCHA and hCaptcha don't have a simple 'remove' for V2 checkboxes usually, 
          // we just clear the innerHTML of the container via React re-render.
        } catch (e) { console.warn('Captcha cleanup warning', e); }
        widgetId.current = null;
      }
      if (containerRef.current) containerRef.current.innerHTML = '';
    };

    cleanup();

    try {
      if (provider === 'recaptcha' && (window as any).grecaptcha) {
        widgetId.current = (window as any).grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme,
          callback: onVerify,
        });
      } 
      else if (provider === 'hcaptcha' && (window as any).hcaptcha) {
        widgetId.current = (window as any).hcaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme,
          callback: onVerify,
        });
      } 
      else if (provider === 'turnstile' && (window as any).turnstile) {
        widgetId.current = (window as any).turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme,
          callback: onVerify,
        });
      }
    } catch (e) {
      console.error(`[CaptchaGuard] Failed to render ${provider} widget`, e);
    }

  }, [isLoaded, provider, siteKey, theme, onVerify]);

  if (!provider || !siteKey) return null;

  return (
    <div className="flex justify-center my-4 min-h-[78px]">
      <div ref={containerRef} id={`captcha-container-${provider}`} />
    </div>
  );
};

export default CaptchaGuard;
