import React from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { db, app } from '../firebase';
import toast from 'react-hot-toast';

export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('google_access_token');

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
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
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
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

  const customProvider = new GoogleAuthProvider();
  scopes.forEach(scope => customProvider.addScope(scope));

  try {
    const result = await signInWithPopup(auth, customProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      token = credential.accessToken;
      cachedAccessToken = token;
      localStorage.setItem('google_access_token', token);
      return token;
    }
  } catch (error: any) {
    console.error('Google Auth Error:', error);

    const isUnauthorizedDomain =
      error?.code === 'auth/unauthorized-domain' ||
      error?.message?.includes('auth/unauthorized-domain') ||
      error?.message?.includes('unauthorized-domain');

    if (isUnauthorizedDomain) {
      const hostname = window.location.hostname || 'localhost';
      toast.error(
        React.createElement('div', { className: 'space-y-1 text-left' },
          React.createElement('p', { className: 'font-bold text-sm text-red-200' }, '⚠️ Lỗi Firebase (auth/unauthorized-domain)'),
          React.createElement('p', { className: 'text-xs' }, `Tên miền "${hostname}" chưa được cấp phép đăng nhập Google.`),
          React.createElement('div', { className: 'text-[11px] bg-slate-900/90 p-2 rounded border border-slate-700 text-slate-200 mt-1 font-mono whitespace-pre-line' },
            `Hướng dẫn thêm Domain vào Firebase:\n1. Vào console.firebase.google.com\n2. Chọn Dự án -> Authentication -> Settings -> Authorized domains\n3. Nhấn "Add domain" -> Nhập: ${hostname}`
          )
        ),
        { duration: 12000 }
      );
      throw new Error(`Firebase Auth: Tên miền "${hostname}" chưa được thêm vào Authorized Domains trong Firebase Console.`);
    }

    if (error?.code === 'auth/network-request-failed' || error?.message?.includes('network-request-failed')) {
      toast.error('Kết nối Google bị chặn trong iframe. Vui lòng bấm "Mở ứng dụng trong Tab mới" ở góc trên.');
      throw new Error('Kết nối Google bị chặn trong iframe.');
    }

    if (error?.code === 'auth/popup-closed-by-user') {
      toast.error('Cửa sổ xác thực Google đã bị đóng.');
      throw new Error('Cửa sổ xác thực Google đã bị đóng.');
    }

    toast.error('Lỗi xác thực Google: ' + (error?.message || 'Không xác định'));
    throw error;
  }

  if (!token) {
    throw new Error('Không thể lấy Google Access Token.');
  }

  return token;
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const token = await ensureGoogleToken([], true);
    if (auth.currentUser) {
      return { user: auth.currentUser, accessToken: token };
    }
    return null;
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
  await auth.signOut();
  clearStoredGoogleToken();
};
