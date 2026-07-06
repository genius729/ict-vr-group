import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.__APP_CONFIG__ ?? {};
const configured =
  /^https:\/\/.+\.supabase\.co$/.test(config.SUPABASE_URL ?? "") &&
  config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_ANON_KEY.includes("YOUR_");

export const isConfigured = Boolean(configured);

export const supabase = isConfigured
  ? createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      },
      realtime: { params: { eventsPerSecond: 10 } }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase 연결 정보가 없습니다. config.js를 설정해 주세요.");
  }
  return supabase;
}

