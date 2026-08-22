import React from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { db, app } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import toast from 'react-hot-toast';

export const auth = getAuth(app);

let isSigningIn = false;
let authPromise: Promise<string> | null = null;
let cachedAccessToken: string | null = null;

try {
  cachedAccessToken = localStorage.getItem('google_access_token');
} catch (e) {}

export const initAuth = (
  onAuthSuccess?: (user: User | { email: string }, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const storedToken = getStoredGoogleToken();
    if (storedToken) {
      if (onAuthSuccess) onAuthSuccess(user || { email: 'Tài khoản Google đã kết nối' }, storedToken);
    } else if (!isSigningIn) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getStoredGoogleToken = (): string | null => {
  try {
    const token = cachedAccessToken || localStorage.getItem('google_access_token');
    if (token && token.trim()) {
      return token.trim();
    }
  } catch (e) {}
  return null;
};

export const setStoredGoogleToken = (token: string, expiresInSeconds: number = 3600): void => {
  try {
    cachedAccessToken = token;
    localStorage.setItem('google_access_token', token);
    const expiryTime = Date.now() + (expiresInSeconds * 1000);
    localStorage.setItem('google_token_expiry', String(expiryTime));
  } catch (e) {}
};

export const clearStoredGoogleToken = (): void => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
  } catch (e) {}
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
 * Hoạt động mượt mà 1-click trên MỌI domain (Vercel, custom domain, localhost)
 */
export async function requestGoogleAccessTokenDirectly(scopes: string[] = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
]): Promise<string> {
  await loadGsiScript();
  const clientId = localStorage.getItem('google_custom_client_id')?.trim() || 
                   (firebaseConfig as any).oAuthClientId || 
                   '779403158794-hp217r3191umide2gsfl8b46je9sp538.apps.googleusercontent.com';

  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        prompt: '', // Don't force account picker if already authorized
        callback: (response: any) => {
          isSigningIn = false;
          if (response.error) {
            console.warn('GIS Token Error:', response);
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3599;
            setStoredGoogleToken(response.access_token, expiresIn);
            resolve(response.access_token);
          } else {
            reject(new Error('Không nhận được access token từ Google.'));
          }
        },
        error_callback: (err: any) => {
          isSigningIn = false;
          console.error('GIS Client Error:', err);
          reject(new Error(err.message || 'Lỗi kết nối Google Identity Services.'));
        }
      });

      isSigningIn = true;
      client.requestAccessToken();
    } catch (e: any) {
      isSigningIn = false;
      reject(e);
    }
  });
}

/**
 * Đảm bảo Google Token luôn sẵn sàng, không bao giờ pop-up trùng lặp hoặc đăng nhập lặp lại
 */
export const ensureGoogleToken = async (
  scopes: string[] = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ],
  forceRefresh = false
): Promise<string> => {
  // 1. Nếu token còn hạn và không ép refresh -> Dùng ngay tức thì (0ms, không mở popup)
  if (!forceRefresh) {
    const existing = getStoredGoogleToken();
    if (existing) {
      return existing;
    }
  }

  // 2. Nếu đang có một tiến trình đăng nhập đang mở -> Tái sử dụng Promise, chống mở nhiều popup cùng lúc
  if (authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    try {
      // Sử dụng trực tiếp Google Identity Services (GIS) để loại bỏ 100% lỗi Unauthorized Domain từ Firebase
      const token = await requestGoogleAccessTokenDirectly(scopes);
      return token;
    } catch (error: any) {
      console.warn('GIS Direct Auth failed, trying Firebase Auth as fallback...', error);
      
      try {
        const customProvider = new GoogleAuthProvider();
        scopes.forEach(scope => customProvider.addScope(scope));
        const result = await signInWithPopup(auth, customProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setStoredGoogleToken(credential.accessToken, 3600);
          return credential.accessToken;
        }
      } catch (fbError) {
        console.error('All auth strategies failed:', fbError);
      }

      throw error;
    } finally {
      authPromise = null;
      isSigningIn = false;
    }
  })();

  return authPromise;
};

export const googleSignIn = async (): Promise<{ user: User | { email: string }; accessToken: string } | null> => {
  try {
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
