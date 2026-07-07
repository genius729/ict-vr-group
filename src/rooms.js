import { requireSupabase } from "./supabase.js";

const ROOM_FIELDS = "id,name,location,capacity,status,description,image_url,available_start,available_end,max_booking_hours,maintenance_mode,closed_until,created_at";

export async function listRooms() {
  const { data, error } = await requireSupabase()
    .from("rooms")
    .select(ROOM_FIELDS)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function saveRoom(room, imageFile) {
  const client = requireSupabase();
  const payload = {
    name: room.name,
    location: room.location,
    capacity: Number(room.capacity),
    status: room.status,
    description: room.description || "",
    available_start: room.available_start,
    available_end: room.available_end,
    max_booking_hours: Number(room.max_booking_hours),
    maintenance_mode: Boolean(room.maintenance_mode),
    closed_until: room.closed_until || null
  };

  if (imageFile?.size) payload.image_url = await uploadRoomImage(imageFile);

  const query = room.id
    ? client.from("rooms").update(payload).eq("id", room.id)
    : client.from("rooms").insert(payload);
  const { data, error } = await query.select(ROOM_FIELDS).single();
  if (error) throw error;
  return data;
}

async function uploadRoomImage(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("이미지는 5MB 이하만 업로드할 수 있습니다.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, PNG, WebP 형식만 업로드할 수 있습니다.");
  }
  const client = requireSupabase();
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from("room-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });
  if (error) throw error;
  return client.storage.from("room-images").getPublicUrl(path).data.publicUrl;
}

export async function deleteRoom(roomId) {
  const { error } = await requireSupabase().rpc("delete_room_if_no_active_bookings", {
    target_room_id: Number(roomId)
  });
  if (error) {
    if (error.code === "23503") throw new Error("예약 데이터가 연결된 특별실은 직접 삭제할 수 없습니다. schema.sql을 다시 적용해 주세요.");
    throw error;
  }
}

export function subscribeRooms(callback) {
  const client = requireSupabase();
  const channel = client
    .channel("rooms-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, callback)
    .subscribe();
  return () => client.removeChannel(channel);
}
