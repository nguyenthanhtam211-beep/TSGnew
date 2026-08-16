import React from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { db, app } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import toast from 'react-hot-toast';

export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('google_access_token');

export const initAuth = (
  onAuthSuccess?: (user: User | { email: string }, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      const storedToken = localStorage.getItem('google_access_token');
      if (storedToken) {
        cachedAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess({ email: 'Tài khoản Google đã kết nối' }, storedToken);
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const getStoredGoogleToken = (): string | null => {
  return cachedAccessToken || localStorage.getItem('google_access_token');
};

export const clearStoredGoogleToken = (): void => {
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
};

/**
 * Tải script Google Identity Services (GIS) để đăng nhập Google trực tiếp không qua Firebase Auth domain check
 */
function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Đăng nhập và lấy Google Access Token trực tiếp qua Google Identity Services (GIS)
 * Hoạt động mượt mà trên MỌI domain (Vercel, custom domain, localhost)
 */
export async function requestGoogleAccessTokenDirectly(scopes: string[] = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
]): Promise<string> {
  await loadGsiScript();
  const clientId = (firebaseConfig as any).oAuthClientId || '779403158794-hp217r3191umide2gsfl8b46je9sp538.apps.googleusercontent.com';

  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: (response: any) => {
          if (response.error) {
            console.warn('GIS Token Error:', response);
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            cachedAccessToken = response.access_token;
            localStorage.setItem('google_access_token', response.access_token);
            resolve(response.access_token);
          } else {
            reject(new Error('Không nhận được access token từ Google.'));
          }
        },
        error_callback: (err: any) => {
          console.error('GIS Client Error:', err);
          reject(new Error(err.message || 'Lỗi kết nối Google Identity Services.'));
        }
      });

      client.requestAccessToken();
    } catch (e: any) {
      reject(e);
    }
  });
}

export const ensureGoogleToken = async (
  scopes: string[] = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ],
  forceRefresh = false
): Promise<string> => {
  let token = getStoredGoogleToken();
  if (token && !forceRefresh) {
    return token;
  }

  // Tầng 1: Thử đăng nhập qua Firebase Auth Popup
  try {
    const customProvider = new GoogleAuthProvider();
    scopes.forEach(scope => customProvider.addScope(scope));

    const result = await signInWithPopup(auth, customProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      token = credential.accessToken;
      cachedAccessToken = token;
      localStorage.setItem('google_access_token', token);
      return token;
    }
  } catch (error: any) {
    console.warn('Firebase Auth popup failed, attempting direct Google GIS fallback...', error);

    const isUnauthorizedDomain =
      error?.code === 'auth/unauthorized-domain' ||
      error?.message?.includes('auth/unauthorized-domain') ||
      error?.message?.includes('unauthorized-domain') ||
      error?.code === 'auth/network-request-failed';

    // Tầng 2: Tự động chuyển tiếp qua Google Identity Services (GIS) nếu gặp lỗi domain hoặc network
    try {
      token = await requestGoogleAccessTokenDirectly(scopes);
      if (token) {
        cachedAccessToken = token;
        localStorage.setItem('google_access_token', token);
        return token;
      }
    } catch (gisError: any) {
      console.error('Direct Google GIS authentication error:', gisError);
      
      if (isUnauthorizedDomain) {
        const hostname = window.location.hostname || 'localhost';
        toast(
          React.createElement('div', { className: 'space-y-1 text-left' },
            React.createElement('p', { className: 'font-bold text-xs text-amber-300' }, '💡 Gợi ý cấu hình domain Firebase:'),
            React.createElement('p', { className: 'text-[11px]' }, `Thêm "${hostname}" vào Authorized Domains trong Firebase Console để hỗ trợ đăng nhập 1-click.`)
          ),
          { duration: 8000 }
        );
      }
      throw gisError;
    }
  }

  if (!token) {
    throw new Error('Không thể lấy Google Access Token.');
  }

  return token;
};

export const googleSignIn = async (): Promise<{ user: User | { email: string }; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const token = await ensureGoogleToken([], true);
    if (auth.currentUser) {
      return { user: auth.currentUser, accessToken: token };
    }
    return { user: { email: 'Tài khoản Google đã kết nối' }, accessToken: token };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getStoredGoogleToken();
};

export const openGoogleAuthTab = (): void => {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('action', 'connect_google');
  window.open(currentUrl.toString(), '_blank');
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (_) {}
  clearStoredGoogleToken();
};
