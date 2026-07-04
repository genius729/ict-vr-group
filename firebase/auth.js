// Google OAuth 인증을 담당하며, 임시로 학교 도메인 제약 없이 로그인할 수 있게 합니다.
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { auth } from './firebase-config.js';

export const SCHOOL_EMAIL_DOMAIN = '@yc.hs.kr';
export const SCHOOL_DOMAIN_ERROR = '학교 이메일이 아니어도 로그인할 수 있습니다.';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// 임시로 로그인 가능한 이메일을 제한하지 않도록 처리합니다.
export function isAllowedSchoolEmail(email = '') {
  return Boolean(email);
}

// Google 계정으로 로그인합니다.
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// Firebase 인증 상태 변화를 구독합니다.
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user, null);
  });
}

// Google/Firebase 인증 세션을 종료합니다.
export async function signOutGoogle() {
  await signOut(auth);
}
