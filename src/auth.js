import { requireSupabase } from "./supabase.js";

export async function signInWithGoogle() {
  const client = requireSupabase();
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId) {
  const client = requireSupabase();
  let { data, error } = await client.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;

  // Auth 트리거 직후 복제 지연에 대비한 짧은 재조회입니다.
  if (!data) {
    await new Promise(resolve => setTimeout(resolve, 350));
    ({ data, error } = await client.from("users").select("*").eq("id", userId).single());
    if (error) throw error;
  }
  return data;
}

export function onAuthChange(callback) {
  const { data } = requireSupabase().auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

