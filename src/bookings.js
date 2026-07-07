import { requireSupabase } from "./supabase.js";
import { toSeoulIso } from "./utils.js";

const BOOKING_SELECT = `
  id,room_id,user_id,approved_by,purpose,people,start_time,end_time,status,
  created_at,approved_at,cancelled_at,
  room:rooms(id,name,location,capacity),
  user:users!bookings_user_id_fkey(id,name,email,grade,class_number,student_number),
  approver:users!bookings_approved_by_fkey(id,name)
`;

export async function listBookings({ ownOnly = false, userId, from, to, status } = {}) {
  let query = requireSupabase()
    .from("bookings")
    .select(BOOKING_SELECT)
    .order("start_time", { ascending: true });
  if (ownOnly && userId) query = query.eq("user_id", userId);
  if (from) query = query.gte("start_time", from);
  if (to) query = query.lt("start_time", to);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createBooking(values, userId) {
  const payload = {
    room_id: Number(values.room_id),
    user_id: userId,
    purpose: values.purpose.trim(),
    people: Number(values.people),
    start_time: toSeoulIso(values.date, values.start),
    end_time: toSeoulIso(values.date, values.end)
  };
  const { data, error } = await requireSupabase()
    .from("bookings")
    .insert(payload)
    .select(BOOKING_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function getRoomDailyBookingUsage({ roomId, date, excludeBookingId = null }) {
  const { data, error } = await requireSupabase().rpc("get_room_daily_booking_usage", {
    target_room_id: Number(roomId),
    target_date: date,
    exclude_booking_id: excludeBookingId ? Number(excludeBookingId) : null
  });
  if (error) throw error;
  return data;
}

export async function updateBooking(bookingId, values) {
  const payload = {
    room_id: Number(values.room_id),
    purpose: values.purpose.trim(),
    people: Number(values.people),
    start_time: toSeoulIso(values.date, values.start),
    end_time: toSeoulIso(values.date, values.end)
  };
  const { data, error } = await requireSupabase()
    .from("bookings")
    .update(payload)
    .eq("id", bookingId)
    .select(BOOKING_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function decideBooking(bookingId, decision) {
  if (!["approved", "rejected"].includes(decision)) throw new Error("올바르지 않은 승인 처리입니다.");
  const { data, error } = await requireSupabase()
    .from("bookings")
    .update({ status: decision })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select(BOOKING_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function cancelBooking(bookingId) {
  const { data, error } = await requireSupabase()
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .select(BOOKING_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function listBookingLogs(bookingId) {
  const { data, error } = await requireSupabase()
    .from("booking_logs")
    .select("id,booking_id,action,actor_id,previous_data,new_data,created_at,actor:users!booking_logs_actor_id_fkey(name,email)")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function subscribeBookings(callback) {
  const client = requireSupabase();
  const channel = client
    .channel("bookings-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, callback)
    .subscribe();
  return () => client.removeChannel(channel);
}
