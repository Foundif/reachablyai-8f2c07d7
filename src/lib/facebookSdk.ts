import { META_APP_ID, META_GRAPH_VERSION } from './metaConfig';

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

let loader: Promise<any> | null = null;

/** Load + init the Facebook JS SDK once. Resolves with window.FB. */
export function loadFacebookSdk(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.FB) return Promise.resolve(window.FB);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Facebook SDK failed to load (blocked by a browser extension or network?)')), 12000);

    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: META_GRAPH_VERSION });
      clearTimeout(timeout);
      resolve(window.FB);
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) return;

    const js = document.createElement('script');
    js.id = 'facebook-jssdk';
    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    js.async = true;
    js.defer = true;
    js.crossOrigin = 'anonymous';
    js.onerror = () => { clearTimeout(timeout); reject(new Error('Failed to load Facebook SDK')); };
    document.body.appendChild(js);
  });

  return loader;
}
