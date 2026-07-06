import { requireSupabase } from "./supabase.js";

export async function getStatistics(month) {
  const { data, error } = await requireSupabase().rpc("get_booking_statistics", {
    target_month: `${month}-01`
  });
  if (error) throw error;
  return data;
}

