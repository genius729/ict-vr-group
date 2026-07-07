const SEOUL_TIME_ZONE = "Asia/Seoul";

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDateTime(value, options = {}) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...options
  }).format(new Date(value));
}

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function toSeoulIso(date, time) {
  // 브라우저의 로컬 시간대와 관계없이 한국 표준시로 저장합니다.
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

export function toDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getSeoulParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function roleLabel(role) {
  return { student: "학생", teacher: "교사", admin: "관리자" }[role] ?? "학생";
}

export function statusLabel(status) {
  return {
    pending: "승인 대기",
    approved: "승인 완료",
    rejected: "거절",
    cancelled: "취소",
    completed: "이용 완료"
  }[status] ?? status;
}

export function statusTone(status) {
  return {
    pending: "yellow",
    approved: "green",
    rejected: "red",
    cancelled: "gray",
    completed: "blue"
  }[status] ?? "gray";
}

export function humanizeError(error) {
  if (!error) return "알 수 없는 오류가 발생했습니다.";
  if (!navigator.onLine) return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  if (error.code === "23P01") return "선택한 시간대에 이미 다른 예약이 있습니다.";
  if (error.code === "42501") return "이 작업을 수행할 권한이 없습니다.";
  if (error.code === "23505") return "이미 등록된 값입니다.";
  if (error.code === "PGRST202" && /get_room_daily_booking_usage/i.test(error.message ?? "")) {
    return "하루 최대 예약 가능 시간 검증 함수가 아직 Supabase DB에 적용되지 않았습니다. supabase/schema.sql을 다시 실행해 주세요.";
  }
  if (error.code === "PGRST202" && /delete_booking_as_admin/i.test(error.message ?? "")) {
    return "예약 삭제 함수가 아직 Supabase DB에 적용되지 않았습니다. supabase/schema.sql을 다시 실행해 주세요.";
  }
  if (error.code === "PGRST301" || /JWT|session/i.test(error.message ?? "")) {
    return "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.";
  }
  return error.message || "요청을 처리하지 못했습니다.";
}

export function monthBounds(year, monthIndex) {
  const start = new Date(Date.UTC(year, monthIndex, 1) - 9 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, monthIndex + 1, 1) - 9 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
