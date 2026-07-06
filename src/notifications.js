import { requireSupabase } from "./supabase.js";

export async function listNotifications(limit = 40) {
  const { data, error } = await requireSupabase()
    .from("notifications")
    .select("id,title,content,is_read,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markAllNotificationsRead() {
  const { error } = await requireSupabase()
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) throw error;
}

export function subscribeNotifications(userId, callback) {
  const client = requireSupabase();
  const channel = client
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
  return () => client.removeChannel(channel);
}

