import { requireSupabase } from "./supabase.js";

export async function listUsers() {
  const { data, error } = await requireSupabase()
    .from("users")
    .select("id,name,email,role,grade,class_number,student_number,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateUser(userId, values) {
  const payload = {
    role: values.role,
    grade: values.grade ? Number(values.grade) : null,
    class_number: values.class_number ? Number(values.class_number) : null,
    student_number: values.student_number ? Number(values.student_number) : null
  };
  const { data, error } = await requireSupabase()
    .from("users")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

