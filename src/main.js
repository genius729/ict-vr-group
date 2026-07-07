import { isConfigured } from "./supabase.js";
import { signInWithGoogle, signOut, getSession, getProfile, onAuthChange } from "./auth.js";
import { listRooms, saveRoom, deleteRoom, subscribeRooms } from "./rooms.js";
import {
  listBookings, createBooking, updateBooking, decideBooking, cancelBooking, deleteBooking,
  listBookingLogs, getRoomDailyBookingUsage, subscribeBookings
} from "./bookings.js";
import {
  listNotifications, markAllNotificationsRead, subscribeNotifications
} from "./notifications.js";
import { listUsers, updateUser } from "./admin.js";
import { getStatistics } from "./statistics.js";
import {
  escapeHtml, formatDateTime, getSeoulParts, humanizeError, monthBounds,
  roleLabel, statusLabel, statusTone, toDateInputValue
} from "./utils.js";
import {
  closeModal, emptyState, errorState, loadingState, pageHead, setButtonBusy,
  setLoading, showConfirm, showModal, toast
} from "./ui.js";

const $ = selector => document.querySelector(selector);
const state = {
  session: null,
  profile: null,
  page: "dashboard",
  adminTab: "rooms",
  rooms: [],
  bookings: [],
  notifications: [],
  calendarDate: new Date(),
  subscriptions: [],
  renderToken: 0
};

const navConfig = {
  student: [
    ["dashboard", "⌂", "대시보드"],
    ["rooms", "▦", "특별실 목록"],
    ["booking", "＋", "예약 신청"],
    ["calendar", "□", "예약 캘린더"],
    ["my", "◎", "나의 예약"]
  ],
  teacher: [
    ["dashboard", "⌂", "대시보드"],
    ["rooms", "▦", "특별실 목록"],
    ["booking", "＋", "예약 신청"],
    ["calendar", "□", "예약 캘린더"],
    ["approvals", "✓", "승인 관리"],
    ["statistics", "▥", "이용 통계"]
  ],
  admin: [
    ["dashboard", "⌂", "대시보드"],
    ["rooms", "▦", "특별실 목록"],
    ["booking", "＋", "예약 신청"],
    ["calendar", "□", "예약 캘린더"],
    ["admin", "⚙", "관리자 페이지"],
    ["statistics", "▥", "전체 통계"]
  ]
};

async function boot() {
  bindShellEvents();
  if (!isConfigured) {
    $("#configWarning").textContent = "config.js에 Supabase URL과 anon key를 입력하면 로그인을 시작할 수 있습니다.";
    $("#configWarning").classList.remove("hidden");
    $("#googleLoginBtn").disabled = true;
    return;
  }

  try {
    const session = await getSession();
    if (session) await enterApp(session);
    onAuthChange(async (event, nextSession) => {
      if (event === "SIGNED_OUT") showLogin();
      if (event === "SIGNED_IN" && nextSession && nextSession.user.id !== state.session?.user?.id) {
        await enterApp(nextSession);
      }
    });
  } catch (error) {
    $("#configWarning").textContent = humanizeError(error);
    $("#configWarning").classList.remove("hidden");
  }
}

function bindShellEvents() {
  $("#googleLoginBtn").addEventListener("click", async event => {
    setButtonBusy(event.currentTarget, true, "Google로 이동 중");
    try {
      await signInWithGoogle();
    } catch (error) {
      toast(humanizeError(error), "error");
      setButtonBusy(event.currentTarget, false);
    }
  });
  $("#logoutBtn").addEventListener("click", async () => {
    try {
      setLoading(true, "로그아웃 중입니다");
      await signOut();
    } catch (error) {
      toast(humanizeError(error), "error");
    } finally {
      setLoading(false);
    }
  });
  $("#menuBtn").addEventListener("click", openMenu);
  $("#mobileShade").addEventListener("click", closeMenu);
  $("#searchBtn").addEventListener("click", () => navigate("rooms"));
  $("#notiBtn").addEventListener("click", () => $("#notificationPanel").classList.add("open"));
  $("#closeNoti").addEventListener("click", () => $("#notificationPanel").classList.remove("open"));
  $("#readAll").addEventListener("click", handleReadAll);
  $("#helpBtn").addEventListener("click", () => showModal(`
    <h3>이용 안내</h3>
    <p>학생 예약은 교사의 승인을 거쳐 확정됩니다. 교사와 관리자의 예약은 즉시 승인됩니다.</p>
    <p>예약 변경이나 취소는 시작 전에 처리해 주세요. 시스템 오류는 학교 관리자에게 문의하세요.</p>
    <div class="modal-actions"><button class="primary" data-action="close-modal">확인</button></div>
  `));
  $("#nav").addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (button) navigate(button.dataset.page);
  });
  $("#content").addEventListener("click", handleContentClick);
  $("#content").addEventListener("submit", handleContentSubmit);
  window.addEventListener("online", () => toast("네트워크가 다시 연결되었습니다."));
  window.addEventListener("offline", () => toast("네트워크 연결이 끊어졌습니다.", "error"));
}

async function enterApp(session) {
  setLoading(true, "사용자 정보를 확인하는 중입니다");
  try {
    state.session = session;
    state.profile = await getProfile(session.user.id);
    $("#loginScreen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    setUserHeader();
    renderNav();
    startRealtime();
    await Promise.all([refreshNotifications(), navigate("dashboard")]);
  } catch (error) {
    showLogin();
    $("#configWarning").textContent = humanizeError(error);
    $("#configWarning").classList.remove("hidden");
  } finally {
    setLoading(false);
  }
}

function showLogin() {
  stopRealtime();
  state.session = null;
  state.profile = null;
  $("#app").classList.add("hidden");
  $("#loginScreen").classList.remove("hidden");
}

function setUserHeader() {
  const profile = state.profile;
  const detail = profile.role === "student" && profile.grade
    ? `${profile.grade}학년 ${profile.class_number ?? "-"}반 · 학생`
    : roleLabel(profile.role);
  $("#sideName").textContent = $("#topName").textContent = profile.name;
  $("#sideRole").textContent = detail;
  $("#topRole").textContent = roleLabel(profile.role);
  $("#sideAvatar").textContent = $("#topAvatar").textContent = profile.name.slice(0, 1);
}

function renderNav() {
  const items = navConfig[state.profile?.role] ?? navConfig.student;
  $("#nav").innerHTML = `<div class="nav-title">${roleLabel(state.profile?.role)} 메뉴</div>` +
    items.map(([page, icon, label]) => `
      <button class="nav-item ${state.page === page ? "active" : ""}" data-page="${page}" type="button">
        <span class="ico">${icon}</span>${label}
      </button>`).join("");
}

async function navigate(page, options = {}) {
  const allowed = (navConfig[state.profile?.role] ?? []).some(item => item[0] === page);
  state.page = allowed ? page : "dashboard";
  renderNav();
  const label = (navConfig[state.profile.role].find(item => item[0] === state.page) ?? [,, "대시보드"])[2];
  $("#breadcrumbs").innerHTML = `홈 <span>/</span> ${escapeHtml(label)}`;
  closeMenu();
  const token = ++state.renderToken;
  $("#content").innerHTML = loadingState();
  try {
    await renderPage(options);
  } catch (error) {
    if (token !== state.renderToken) return;
    $("#content").innerHTML = pageHead(label, "요청한 정보를 표시할 수 없습니다.") + errorState(humanizeError(error));
  }
  $("#content").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function renderPage(options = {}) {
  const renderers = {
    dashboard: renderDashboard,
    rooms: renderRooms,
    booking: () => renderBooking(options),
    calendar: renderCalendar,
    my: renderMyBookings,
    approvals: renderApprovals,
    statistics: renderStatistics,
    admin: renderAdmin
  };
  await (renderers[state.page] ?? renderDashboard)();
}

async function loadRooms(force = false) {
  if (force || !state.rooms.length) state.rooms = await listRooms();
  return state.rooms;
}

async function renderDashboard() {
  const [rooms, bookings] = await Promise.all([
    loadRooms(true),
    listBookings({
      ownOnly: state.profile.role === "student",
      userId: state.profile.id,
      from: new Date().toISOString()
    })
  ]);
  state.bookings = bookings;
  const pending = bookings.filter(item => item.status === "pending").length;
  const approved = bookings.filter(item => item.status === "approved").length;
  const available = rooms.filter(room => room.status === "available" && !room.maintenance_mode &&
    (!room.closed_until || new Date(room.closed_until) <= new Date())).length;
  const upcoming = bookings.filter(item => ["pending", "approved"].includes(item.status)).slice(0, 5);

  $("#content").innerHTML = pageHead(
    `${state.profile.name}님, 반갑습니다!`,
    "특별실 현황을 확인하고 필요한 공간을 예약하세요.",
    `<div class="date-chip">${new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(new Date())}</div>`
  ) + `
    <section class="metric-grid">
      ${metric("▦", "등록 특별실", rooms.length, "개", "blue-bg")}
      ${metric("✓", "현재 예약 가능", available, "개", "green-bg")}
      ${metric("□", "다가오는 예약", approved, "건", "purple-bg")}
      ${metric("…", "승인 대기", pending, "건", "yellow-bg")}
    </section>
    <section class="dashboard-grid">
      <div class="card">
        <div class="card-head"><h3>특별실 이용 상태</h3><button class="text-button" data-page-target="rooms">전체 보기 →</button></div>
        <div class="schedule-list">
          ${rooms.slice(0, 6).map(room => roomSchedule(room)).join("") || emptyState("등록된 특별실이 없습니다", "관리자가 특별실을 등록하면 여기에 표시됩니다.")}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${state.profile.role === "student" ? "나의" : "전체"} 예정 예약</h3><button class="text-button" data-page-target="calendar">캘린더 →</button></div>
        <div class="schedule-list">
          ${upcoming.map(bookingSchedule).join("") || emptyState("예정된 예약이 없습니다", "새 예약을 신청해 보세요.")}
        </div>
      </div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h3>빠른 메뉴</h3></div>
      <div class="quick-grid">
        ${quick("＋", "새 예약 신청", "특별실을 예약합니다.", "booking")}
        ${quick("▦", "예약 가능 공간", "특별실 상태를 확인합니다.", "rooms")}
        ${quick("□", "월간 일정", "예약을 달력으로 확인합니다.", "calendar")}
        ${quick("◎", state.profile.role === "student" ? "나의 예약" : state.profile.role === "teacher" ? "승인 관리" : "관리자 페이지", "처리할 항목을 확인합니다.", state.profile.role === "student" ? "my" : state.profile.role === "teacher" ? "approvals" : "admin")}
      </div>
    </section>`;
}

function metric(icon, label, value, unit, tone) {
  return `<div class="metric"><span class="metric-icon ${tone}">${icon}</span><small>${label}</small><h2 class="stat-value">${value}<span style="font-size:12px">${unit}</span></h2></div>`;
}

function quick(icon, title, description, page) {
  return `<button class="quick" data-page-target="${page}" type="button"><i>${icon}</i><b>${title}</b><small>${description}</small></button>`;
}

function roomAvailability(room) {
  if (room.maintenance_mode) return ["red", "점검 중"];
  if (room.closed_until && new Date(room.closed_until) > new Date()) return ["yellow", "일시 폐쇄"];
  if (room.status !== "available") return ["gray", "이용 중지"];
  return ["green", "예약 가능"];
}

function roomSchedule(room) {
  const [tone, label] = roomAvailability(room);
  return `<div class="schedule"><time>${escapeHtml(room.available_start.slice(0, 5))}</time><i class="dot" style="background:var(--${tone === "green" ? "green" : tone === "red" ? "red" : "gray"})"></i><div><b>${escapeHtml(room.name)}</b><small>${escapeHtml(room.location)}</small></div><span class="status ${tone}">${label}</span></div>`;
}

function bookingSchedule(booking) {
  const parts = getSeoulParts(booking.start_time);
  return `<div class="schedule"><time>${parts.month}.${parts.day}</time><i class="dot" style="background:var(--blue)"></i><div><b>${escapeHtml(booking.room?.name ?? "특별실")}</b><small>${parts.hour}:${parts.minute} · ${escapeHtml(booking.purpose)}</small></div><span class="status ${statusTone(booking.status)}">${statusLabel(booking.status)}</span></div>`;
}

function hoursBetween(start, end) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60;
}

async function ensureDailyBookingLimit(values, editId = null) {
  const room = state.rooms.find(item => item.id === Number(values.room_id)) ??
    (await loadRooms(true)).find(item => item.id === Number(values.room_id));
  if (!room) throw new Error("선택한 특별실 정보를 찾을 수 없습니다.");

  const usage = await getRoomDailyBookingUsage({
    roomId: values.room_id,
    date: values.date,
    excludeBookingId: editId
  });
  const bookedHours = Number(usage?.booked_hours ?? 0);
  const maxHours = Number(usage?.max_booking_hours ?? room.max_booking_hours);
  const requestedHours = hoursBetween(values.start, values.end);

  if (bookedHours + requestedHours > maxHours) {
    const remainingHours = Math.max(0, maxHours - bookedHours);
    throw new Error(`하루 최대 예약 가능 시간(${maxHours}시간)을 초과했습니다. 남은 예약 가능 시간은 ${remainingHours.toFixed(1)}시간입니다.`);
  }
}

async function renderRooms() {
  const rooms = await loadRooms(true);
  $("#content").innerHTML = pageHead(
    "특별실 목록",
    "특별실의 운영 시간과 현재 상태를 확인하세요.",
    state.profile.role === "admin" ? '<button class="primary" data-action="room-create">＋ 특별실 추가</button>' : ""
  ) + `
    <div class="filter-row">
      <div class="search"><span>⌕</span><input id="roomSearch" placeholder="이름 또는 위치 검색" aria-label="특별실 검색"></div>
      <div class="filter-buttons">
        <button class="active" data-room-filter="all">전체</button>
        <button data-room-filter="available">예약 가능</button>
        <button data-room-filter="unavailable">이용 불가</button>
      </div>
    </div>
    <div id="roomGrid" class="room-grid">${roomCards(rooms)}</div>`;
  $("#roomSearch").addEventListener("input", filterRoomCards);
}

function roomCards(rooms) {
  if (!rooms.length) return emptyState("조건에 맞는 특별실이 없습니다", "검색어나 필터를 변경해 보세요.");
  return rooms.map(room => {
    const [tone, label] = roomAvailability(room);
    const visual = room.image_url
      ? `<img class="room-image" src="${escapeHtml(room.image_url)}" alt="${escapeHtml(room.name)}">`
      : "🏫";
    return `<article class="room-card" data-room-card data-status="${tone === "green" ? "available" : "unavailable"}" data-search="${escapeHtml(`${room.name} ${room.location}`.toLowerCase())}">
      <div class="room-visual">${visual}<span class="status ${tone}">${label}</span></div>
      <div class="room-body">
        <div class="room-title"><h3>${escapeHtml(room.name)}</h3><span>정원 ${room.capacity}명</span></div>
        <div class="room-meta"><span>⌖ ${escapeHtml(room.location)}</span><span>◷ ${room.available_start.slice(0, 5)}~${room.available_end.slice(0, 5)}</span></div>
        <p class="room-description">${escapeHtml(room.description || "등록된 설명이 없습니다.")}</p>
        <div class="next-booking"><span>최대 예약 시간</span><b>${Number(room.max_booking_hours)}시간</b></div>
        <div class="room-actions">
          ${state.profile.role === "admin"
            ? `<button data-action="room-edit" data-id="${room.id}">수정</button><button class="primary" data-action="room-delete" data-id="${room.id}">삭제</button>`
            : `<button class="primary" data-page-target="booking" data-room-id="${room.id}" ${tone !== "green" ? "disabled" : ""}>예약하기</button>`}
        </div>
      </div>
    </article>`;
  }).join("");
}

function filterRoomCards(event) {
  const filter = $("#content [data-room-filter].active")?.dataset.roomFilter ?? "all";
  const query = (event?.target?.value ?? $("#roomSearch")?.value ?? "").trim().toLowerCase();
  $("#content").querySelectorAll("[data-room-card]").forEach(card => {
    card.hidden = !(card.dataset.search.includes(query) && (filter === "all" || card.dataset.status === filter));
  });
}

async function renderBooking({ roomId, editId } = {}) {
  const rooms = await loadRooms(true);
  let booking = null;
  if (editId) {
    booking = (await listBookings({
      ownOnly: state.profile.role !== "admin",
      userId: state.profile.id
    })).find(item => item.id === Number(editId));
    if (!booking) throw new Error("수정할 예약을 찾을 수 없습니다.");
    if (state.profile.role === "student" && booking.status === "approved") {
      throw new Error("승인 완료된 예약은 수정할 수 없습니다. 변경이 필요하면 예약을 취소한 뒤 다시 신청하세요.");
    }
  }
  const parts = booking ? getSeoulParts(booking.start_time) : null;
  const endParts = booking ? getSeoulParts(booking.end_time) : null;
  const selectedId = Number(roomId ?? booking?.room_id ?? rooms[0]?.id);
  const selectedRoom = rooms.find(room => room.id === selectedId);

  $("#content").innerHTML = pageHead(
    booking ? "예약 수정" : "특별실 예약 신청",
    "입력 내용은 서버에서 다시 검증되며, 학생 예약은 교사 승인 후 확정됩니다."
  ) + `
    <div class="form-layout">
      <section class="card form-card">
        <h3>예약 정보</h3>
        <form id="bookingForm" data-edit-id="${booking?.id ?? ""}">
          <div class="form-grid">
            <div class="field"><label>신청자</label><input value="${escapeHtml(booking?.user?.name ?? state.profile.name)}" disabled></div>
            <div class="field"><label>특별실 <span class="required">*</span></label>
              <select name="room_id" required>
                ${rooms.map(room => {
                  const unavailable = roomAvailability(room)[0] !== "green" && room.id !== booking?.room_id;
                  return `<option value="${room.id}" ${room.id === selectedId ? "selected" : ""} ${unavailable ? "disabled" : ""}>${escapeHtml(room.name)} · ${escapeHtml(room.location)}</option>`;
                }).join("")}
              </select>
            </div>
            <div class="field full"><label>사용 목적 <span class="required">*</span></label><textarea name="purpose" minlength="2" maxlength="500" required placeholder="구체적인 사용 목적을 입력하세요.">${escapeHtml(booking?.purpose ?? "")}</textarea></div>
            <div class="field"><label>참가 인원 <span class="required">*</span></label><input name="people" type="number" min="1" value="${booking?.people ?? 1}" required></div>
            <div class="field"><label>사용 날짜 <span class="required">*</span></label><input name="date" type="date" value="${parts ? `${parts.year}-${parts.month}-${parts.day}` : toDateInputValue()}" min="${toDateInputValue()}" required></div>
            <div class="time-fields">
              <div class="field"><label>시작 시간</label><input name="start" type="time" value="${parts ? `${parts.hour}:${parts.minute}` : selectedRoom?.available_start.slice(0, 5) ?? "09:00"}" required></div>
              <span>~</span>
              <div class="field"><label>종료 시간</label><input name="end" type="time" value="${endParts ? `${endParts.hour}:${endParts.minute}` : "10:00"}" required></div>
            </div>
          </div>
          <div class="form-note">동일 시간대 중복, 이용 가능 시간, 최대 예약 시간, 수용 인원, 점검 및 폐쇄 상태는 데이터베이스에서 최종 검사합니다.</div>
          <div class="form-actions"><button class="secondary" type="button" data-page-target="${booking ? "my" : "rooms"}">취소</button><button class="primary" type="submit">${booking ? "변경 저장" : "예약 신청"}</button></div>
        </form>
      </section>
      <aside class="card booking-summary"><h3>예약 안내</h3><div class="summary-room"><span class="emoji">🏫</span><div><b>운영 정책</b><small>특별실별 설정에 따라 자동 검증</small></div></div><ul class="rule-list"><li>학생 예약은 교사 승인 후 확정</li><li>교사 및 관리자는 즉시 승인</li><li>겹치는 예약은 서버에서 차단</li><li>점검 및 일시 폐쇄 시 예약 불가</li></ul></aside>
    </div>`;
}

async function renderCalendar() {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const { start, end } = monthBounds(year, month);
  const bookings = await listBookings({
    ownOnly: state.profile.role === "student",
    userId: state.profile.id,
    from: start,
    to: end
  });
  state.bookings = bookings;
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const previousDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const rawDay = index - firstDay + 1;
    const muted = rawDay < 1 || rawDay > days;
    const displayDay = rawDay < 1 ? previousDays + rawDay : rawDay > days ? rawDay - days : rawDay;
    const events = muted ? [] : bookings.filter(item => Number(getSeoulParts(item.start_time).day) === rawDay);
    const today = !muted && `${year}-${String(month + 1).padStart(2, "0")}-${String(rawDay).padStart(2, "0")}` === toDateInputValue();
    cells.push(`<div class="cal-cell ${muted ? "muted" : ""} ${today ? "today" : ""}"><span class="day-num">${displayDay}</span>
      ${events.slice(0, 3).map(item => {
        const time = getSeoulParts(item.start_time);
        return `<div class="cal-event ${statusTone(item.status)}" title="${escapeHtml(item.room?.name)}">${time.hour}:${time.minute} ${escapeHtml(item.room?.name)}</div>`;
      }).join("")}
    </div>`);
  }
  $("#content").innerHTML = pageHead("예약 캘린더", "월별 특별실 예약 일정을 확인하세요.", '<button class="primary" data-page-target="booking">＋ 새 예약</button>') + `
    <section class="card calendar-card">
      <div class="card-head">
        <div class="calendar-toolbar"><button class="secondary" data-action="calendar-prev">‹</button><h3>${year}년 ${month + 1}월</h3><button class="secondary" data-action="calendar-next">›</button><button class="secondary" data-action="calendar-today">오늘</button></div>
        <div class="legend"><span><i style="background:var(--green)"></i>승인</span><span><i style="background:var(--yellow)"></i>대기</span><span><i style="background:var(--gray)"></i>취소/거절</span></div>
      </div>
      <div class="calendar-grid">${["일","월","화","수","목","금","토"].map(day => `<div class="cal-day-name">${day}</div>`).join("")}${cells.join("")}</div>
    </section>`;
}

async function renderMyBookings() {
  const bookings = await listBookings({ ownOnly: true, userId: state.profile.id });
  state.bookings = bookings;
  $("#content").innerHTML = pageHead("나의 예약", "예약 상태를 확인하고 대기 또는 승인 예약을 변경·취소하세요.", '<button class="primary" data-page-target="booking">＋ 새 예약</button>') +
    bookingTable(bookings, "mine");
}

async function renderApprovals() {
  const bookings = await listBookings({ status: "pending" });
  state.bookings = bookings;
  $("#content").innerHTML = pageHead("예약 승인 관리", `검토가 필요한 학생 예약이 ${bookings.length}건 있습니다.`) +
    bookingTable(bookings, "approval");
}

function bookingTable(bookings, mode = "read") {
  if (!bookings.length) return emptyState("표시할 예약이 없습니다", "새로운 예약이 등록되면 여기에 표시됩니다.");
  return `<div class="card table-card"><table class="data-table"><thead><tr><th>번호</th><th>신청 시간</th><th>특별실</th><th>사용 일시</th><th>신청자 / 목적</th><th>인원</th><th>상태</th><th>관리</th></tr></thead><tbody>
    ${bookings.map(item => {
      const isUpcomingOwnBooking = mode === "mine" && new Date(item.start_time) > new Date();
      const canEdit = isUpcomingOwnBooking && item.status === "pending";
      const canCancel = isUpcomingOwnBooking && ["pending", "approved"].includes(item.status);
      return `<tr><td>#${item.id}</td><td>${formatDateTime(item.created_at, { second: "2-digit" })}</td><td><b>${escapeHtml(item.room?.name ?? "-")}</b><br>${escapeHtml(item.room?.location ?? "")}</td><td>${formatDateTime(item.start_time)}<br>~ ${formatDateTime(item.end_time, { year: undefined, month: undefined, day: undefined })}</td><td><b>${escapeHtml(item.user?.name ?? state.profile.name)}</b><br>${escapeHtml(item.purpose)}</td><td>${item.people}명</td><td><span class="status ${statusTone(item.status)}">${statusLabel(item.status)}</span></td><td>${state.profile.role === "admin" ? `<div class="booking-created-time"><b>신청 시각</b>${formatDateTime(item.created_at, { second: "2-digit" })}</div>` : ""}<div class="action-buttons">
        ${mode === "approval" ? `<button class="approve" data-action="booking-approve" data-id="${item.id}">승인</button><button class="reject" data-action="booking-reject" data-id="${item.id}">거절</button>` : ""}
        ${canEdit ? `<button class="approve" data-action="booking-edit" data-id="${item.id}">수정</button>` : ""}
        ${canCancel ? `<button class="reject" data-action="booking-cancel" data-id="${item.id}">취소</button>` : ""}
        ${state.profile.role === "admin" ? `${item.status === "pending" ? `<button class="approve" data-action="booking-approve" data-id="${item.id}">승인</button><button class="reject" data-action="booking-reject" data-id="${item.id}">거절</button>` : ""}<button class="approve" data-action="booking-edit" data-id="${item.id}">수정</button><button class="approve" data-action="booking-log" data-id="${item.id}">로그</button>${["pending","approved"].includes(item.status) ? `<button class="reject" data-action="booking-force-cancel" data-id="${item.id}">강제 취소</button>` : ""}` : ""}
        ${mode === "admin" ? `<button class="reject" data-action="booking-delete" data-id="${item.id}">삭제</button>` : ""}
      </div></td></tr>`;
    }).join("")}
  </tbody></table></div>`;
}

async function renderStatistics() {
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const month = $("#statisticsMonth")?.value ?? currentMonth;
  const stats = await getStatistics(month);
  const summary = stats.summary ?? {};
  $("#content").innerHTML = pageHead(
    state.profile.role === "admin" ? "전체 이용 통계" : "특별실 이용 통계",
    "실제 예약 데이터를 기준으로 집계합니다.",
    `<input id="statisticsMonth" class="select-compact" type="month" value="${month}">`
  ) + `
    <section class="metric-grid">
      ${metric("□", "월 예약 수", summary.total ?? 0, "건", "blue-bg")}
      ${metric("✓", "승인 수", summary.approved ?? 0, "건", "green-bg")}
      ${metric("%", "승인율", summary.approval_rate ?? 0, "%", "yellow-bg")}
      ${metric("×", "취소율", summary.cancellation_rate ?? 0, "%", "purple-bg")}
    </section>
    <div class="dashboard-grid">
      <section class="card"><div class="card-head"><h3>특별실별 사용률</h3></div>
        <div class="usage-chart">${(stats.rooms ?? []).slice(0, 8).map(item => chartBar(item.name, Number(item.usage_rate), 100, `${item.usage_rate}%`)).join("") || emptyState("데이터가 없습니다", "해당 월의 승인 예약이 없습니다.")}</div>
      </section>
      <section class="card"><div class="card-head"><h3>학년별 이용량</h3></div>
        ${(stats.grades ?? []).map(item => `<div class="schedule"><time>${escapeHtml(item.grade)}학년</time><i class="dot" style="background:var(--blue)"></i><div><b>${item.count}건</b></div></div>`).join("") || emptyState("데이터가 없습니다", "학년 정보가 포함된 예약이 없습니다.")}
      </section>
    </div>
    <div class="dashboard-grid">
      <section class="card"><div class="card-head"><h3>월별 예약 수</h3></div>
        <div class="usage-chart">${(stats.trend ?? []).map(item => chartBar(item.month.slice(5) + "월", Number(item.count), Math.max(1, ...stats.trend.map(x => Number(x.count))), item.count)).join("")}</div>
      </section>
      <section class="card"><div class="card-head"><h3>시간대별 사용량</h3></div>
        ${(stats.hours ?? []).map(item => `<div class="schedule"><time>${item.hour}:00</time><i class="dot" style="background:var(--green)"></i><div><b>${item.count}건</b></div></div>`).join("") || emptyState("데이터가 없습니다", "해당 월의 예약이 없습니다.")}
      </section>
    </div>`;
  $("#statisticsMonth").addEventListener("change", () => renderStatistics().catch(showPageError));
}

function chartBar(label, value, max, displayValue) {
  const height = Math.max(4, Math.round((value / max) * 100));
  return `<div class="bar-wrap"><span class="bar-value">${escapeHtml(displayValue)}</span><div class="bar" style="height:${height}%"></div><span>${escapeHtml(label)}</span></div>`;
}

async function renderAdmin() {
  $("#content").innerHTML = pageHead("관리자 페이지", "특별실, 사용자 권한, 전체 예약과 감사 로그를 관리합니다.", '<button class="primary" data-action="room-create">＋ 특별실 추가</button>') + `
    <div class="manage-tabs">
      <button data-admin-tab="rooms" class="${state.adminTab === "rooms" ? "active" : ""}">특별실 관리</button>
      <button data-admin-tab="bookings" class="${state.adminTab === "bookings" ? "active" : ""}">전체 예약</button>
      <button data-admin-tab="users" class="${state.adminTab === "users" ? "active" : ""}">사용자 관리</button>
    </div><div id="adminContent">${loadingState()}</div>`;
  await renderAdminTab();
}

async function renderAdminTab() {
  const root = $("#adminContent");
  if (!root) return;
  root.innerHTML = loadingState();
  if (state.adminTab === "rooms") {
    const rooms = await loadRooms(true);
    root.innerHTML = rooms.length ? `<div class="card table-card"><table class="data-table"><thead><tr><th>특별실</th><th>위치</th><th>수용 인원</th><th>운영 시간</th><th>상태</th><th>관리</th></tr></thead><tbody>
      ${rooms.map(room => { const [tone, label] = roomAvailability(room); return `<tr><td><b>${escapeHtml(room.name)}</b></td><td>${escapeHtml(room.location)}</td><td>${room.capacity}명</td><td>${room.available_start.slice(0,5)}~${room.available_end.slice(0,5)}</td><td><span class="status ${tone}">${label}</span></td><td><div class="action-buttons"><button class="approve" data-action="room-edit" data-id="${room.id}">수정</button><button class="reject" data-action="room-delete" data-id="${room.id}">삭제</button></div></td></tr>`; }).join("")}
    </tbody></table></div>` : emptyState("등록된 특별실이 없습니다", "특별실을 추가해 주세요.");
  } else if (state.adminTab === "bookings") {
    const bookings = await listBookings();
    state.bookings = bookings;
    root.innerHTML = bookingTable(bookings, "admin");
  } else {
    const users = await listUsers();
    root.innerHTML = users.length ? `<div class="card table-card"><table class="data-table"><thead><tr><th>이름</th><th>이메일</th><th>학적 정보</th><th>권한</th><th>가입일</th><th>관리</th></tr></thead><tbody>
      ${users.map(user => `<tr><td><b>${escapeHtml(user.name)}</b></td><td>${escapeHtml(user.email)}</td><td>${user.grade ? `${user.grade}학년 ${user.class_number ?? "-"}반 ${user.student_number ?? "-"}번` : "-"}</td><td><span class="status ${user.role === "admin" ? "yellow" : user.role === "teacher" ? "green" : "blue"}">${roleLabel(user.role)}</span></td><td>${formatDateTime(user.created_at)}</td><td><button class="approve" data-action="user-edit" data-id="${user.id}">수정</button></td></tr>`).join("")}
    </tbody></table></div>` : emptyState("등록된 사용자가 없습니다", "로그인한 사용자가 여기에 표시됩니다.");
    state.adminUsers = users;
  }
}

async function handleContentClick(event) {
  const targetPage = event.target.closest("[data-page-target]");
  if (targetPage) {
    await navigate(targetPage.dataset.pageTarget, { roomId: targetPage.dataset.roomId });
    return;
  }
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    const filter = event.target.closest("[data-room-filter]");
    const tab = event.target.closest("[data-admin-tab]");
    if (filter) {
      $("#content").querySelectorAll("[data-room-filter]").forEach(button => button.classList.toggle("active", button === filter));
      filterRoomCards();
    }
    if (tab) {
      state.adminTab = tab.dataset.adminTab;
      $("#content").querySelectorAll("[data-admin-tab]").forEach(button => button.classList.toggle("active", button === tab));
      try { await renderAdminTab(); } catch (error) { $("#adminContent").innerHTML = errorState(humanizeError(error)); }
    }
    return;
  }

  const id = actionElement.dataset.id;
  const actions = {
    retry: () => navigate(state.page),
    "room-create": () => openRoomModal(),
    "room-edit": () => openRoomModal(state.rooms.find(room => room.id === Number(id))),
    "room-delete": () => confirmDeleteRoom(Number(id)),
    "booking-edit": () => navigate("booking", { editId: Number(id) }),
    "booking-cancel": () => confirmCancelBooking(Number(id), false),
    "booking-force-cancel": () => confirmCancelBooking(Number(id), true),
    "booking-delete": () => confirmDeleteBooking(Number(id)),
    "booking-approve": () => handleDecision(Number(id), "approved"),
    "booking-reject": () => handleDecision(Number(id), "rejected"),
    "booking-log": () => openBookingLogs(Number(id)),
    "user-edit": () => openUserModal(state.adminUsers?.find(user => user.id === id)),
    "calendar-prev": () => changeCalendarMonth(-1),
    "calendar-next": () => changeCalendarMonth(1),
    "calendar-today": () => { state.calendarDate = new Date(); return renderCalendar(); }
  };
  try { await actions[actionElement.dataset.action]?.(); } catch (error) { toast(humanizeError(error), "error"); }
}

async function handleContentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  if (form.id !== "bookingForm") return;
  const values = Object.fromEntries(new FormData(form));
  if (values.start >= values.end) {
    toast("종료 시간은 시작 시간보다 늦어야 합니다.", "error");
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  setButtonBusy(submit, true);
  try {
    const editId = form.dataset.editId ? Number(form.dataset.editId) : null;
    await ensureDailyBookingLimit(values, editId);
    if (editId) {
      await updateBooking(editId, values);
      toast("예약을 수정했습니다.");
    } else {
      const booking = await createBooking(values, state.profile.id);
      toast(booking.status === "approved" ? "예약이 확정되었습니다." : "예약 신청이 완료되었습니다.");
    }
    await navigate(
      state.profile.role === "student" ? "my" :
      state.profile.role === "admin" && form.dataset.editId ? "admin" : "calendar"
    );
  } catch (error) {
    toast(humanizeError(error), "error");
    setButtonBusy(submit, false);
  }
}

function openRoomModal(room = {}) {
  const closed = room.closed_until ? getSeoulParts(room.closed_until) : null;
  const closedValue = closed ? `${closed.year}-${closed.month}-${closed.day}T${closed.hour}:${closed.minute}` : "";
  const modal = showModal(`
    <button class="modal-close" data-action="close-modal" aria-label="닫기">×</button>
    <h3>${room.id ? "특별실 수정" : "특별실 추가"}</h3>
    <form id="roomForm" style="margin-top:16px">
      <div class="form-grid">
        <div class="field"><label>이름</label><input name="name" value="${escapeHtml(room.name ?? "")}" required maxlength="100"></div>
        <div class="field"><label>위치</label><input name="location" value="${escapeHtml(room.location ?? "")}" required maxlength="120"></div>
        <div class="field"><label>수용 인원</label><input name="capacity" type="number" min="1" max="500" value="${room.capacity ?? 20}" required></div>
        <div class="field"><label>상태</label><select name="status"><option value="available" ${room.status !== "unavailable" ? "selected" : ""}>이용 가능</option><option value="unavailable" ${room.status === "unavailable" ? "selected" : ""}>이용 중지</option></select></div>
        <div class="field full"><label>설명</label><textarea name="description" maxlength="500">${escapeHtml(room.description ?? "")}</textarea></div>
        <div class="field"><label>이용 시작</label><input name="available_start" type="time" value="${room.available_start?.slice(0,5) ?? "08:00"}" required></div>
        <div class="field"><label>이용 종료</label><input name="available_end" type="time" value="${room.available_end?.slice(0,5) ?? "18:00"}" required></div>
        <div class="field"><label>최대 예약 시간</label><input name="max_booking_hours" type="number" min="0.5" max="24" step="0.5" value="${room.max_booking_hours ?? 3}" required></div>
        <div class="field"><label>일시 폐쇄 종료</label><input name="closed_until" type="datetime-local" value="${closedValue}"><small class="help">비워 두면 폐쇄하지 않습니다.</small></div>
        <div class="field checkbox"><label><input name="maintenance_mode" type="checkbox" ${room.maintenance_mode ? "checked" : ""}> 점검 모드</label></div>
        <div class="field full"><label>특별실 사진</label><input name="image" type="file" accept="image/jpeg,image/png,image/webp"><small class="help">JPG, PNG, WebP · 최대 5MB</small></div>
      </div>
      <div class="modal-actions"><button type="button" class="secondary" data-action="close-modal">취소</button><button class="primary" type="submit">저장</button></div>
    </form>
  `, true);
  modal.querySelector("#roomForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (values.available_start >= values.available_end) {
      toast("이용 종료 시간은 시작 시간보다 늦어야 합니다.", "error");
      return;
    }
    const button = form.querySelector('[type="submit"]');
    setButtonBusy(button, true);
    try {
      const closedUntil = values.closed_until ? new Date(`${values.closed_until}:00+09:00`).toISOString() : null;
      await saveRoom({
        ...values,
        id: room.id,
        maintenance_mode: form.elements.maintenance_mode.checked,
        closed_until: closedUntil
      }, form.elements.image.files[0]);
      closeModal();
      toast("특별실 정보를 저장했습니다.");
      await navigate(state.page);
    } catch (error) {
      toast(humanizeError(error), "error");
      setButtonBusy(button, false);
    }
  });
}

function confirmDeleteRoom(roomId) {
  showConfirm({
    title: "특별실을 삭제할까요?",
    message: "승인된 예정 또는 진행 예약이 있으면 삭제할 수 없습니다. 대기 신청과 지난 기록은 함께 정리됩니다.",
    confirmText: "삭제",
    danger: true,
    onConfirm: async () => {
      try {
        await deleteRoom(roomId);
        toast("특별실을 삭제했습니다.");
        await navigate(state.page);
      } catch (error) { toast(humanizeError(error), "error"); }
    }
  });
}

function confirmDeleteBooking(bookingId) {
  showConfirm({
    title: "예약을 삭제할까요?",
    message: "삭제한 예약 신청 내역과 관련 감사 로그는 되돌릴 수 없습니다.",
    confirmText: "삭제",
    danger: true,
    onConfirm: async () => {
      try {
        await deleteBooking(bookingId);
        toast("예약 신청 내역을 삭제했습니다.");
        if (state.page === "admin") await renderAdminTab();
        else await navigate(state.page);
      } catch (error) { toast(humanizeError(error), "error"); }
    }
  });
}

function confirmCancelBooking(bookingId, forced) {
  showConfirm({
    title: forced ? "예약을 강제 취소할까요?" : "예약을 취소할까요?",
    message: forced ? "사용자에게 강제 취소 알림이 전송되고 로그가 기록됩니다." : "취소한 예약은 되돌릴 수 없습니다.",
    confirmText: forced ? "강제 취소" : "예약 취소",
    danger: true,
    onConfirm: async () => {
      try {
        await cancelBooking(bookingId);
        toast("예약을 취소했습니다.");
        await navigate(state.page);
      } catch (error) { toast(humanizeError(error), "error"); }
    }
  });
}

async function handleDecision(bookingId, decision) {
  try {
    await decideBooking(bookingId, decision);
    toast(decision === "approved" ? "예약을 승인했습니다." : "예약을 거절했습니다.");
    if (state.page === "admin") await renderAdminTab();
    else await renderApprovals();
  } catch (error) { toast(humanizeError(error), "error"); }
}

async function openBookingLogs(bookingId) {
  setLoading(true, "예약 로그를 불러오는 중입니다");
  try {
    const logs = await listBookingLogs(bookingId);
    showModal(`<h3>예약 #${bookingId} 변경 로그</h3><div style="margin-top:14px">${logs.map(log => `<div class="log-item"><b>${escapeHtml({
      created: "예약 생성", updated: "예약 수정", approved: "예약 승인", rejected: "예약 거절",
      cancelled: "예약 취소", force_cancelled: "관리자 강제 취소"
    }[log.action] ?? log.action)}</b><small>${formatDateTime(log.created_at)} · 작업자 ${escapeHtml(log.actor?.name ?? log.actor_id ?? "시스템")}</small></div>`).join("") || emptyState("로그가 없습니다", "변경 이력이 아직 없습니다.")}</div><div class="modal-actions"><button class="primary" data-action="close-modal">닫기</button></div>`, true);
  } finally { setLoading(false); }
}

function openUserModal(user) {
  if (!user) return;
  const modal = showModal(`
    <h3>${escapeHtml(user.name)} 사용자 관리</h3><p>${escapeHtml(user.email)}</p>
    <form id="userForm"><div class="form-grid">
      <div class="field"><label>권한</label><select name="role"><option value="student" ${user.role === "student" ? "selected" : ""}>학생</option><option value="teacher" ${user.role === "teacher" ? "selected" : ""}>교사</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>관리자</option></select></div>
      <div class="field"><label>학년</label><input name="grade" type="number" min="1" max="3" value="${user.grade ?? ""}"></div>
      <div class="field"><label>반</label><input name="class_number" type="number" min="1" max="30" value="${user.class_number ?? ""}"></div>
      <div class="field"><label>번호</label><input name="student_number" type="number" min="1" max="50" value="${user.student_number ?? ""}"></div>
    </div><div class="modal-actions"><button type="button" class="secondary" data-action="close-modal">취소</button><button class="primary" type="submit">저장</button></div></form>
  `);
  modal.querySelector("#userForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    setButtonBusy(button, true);
    try {
      await updateUser(user.id, Object.fromEntries(new FormData(event.currentTarget)));
      closeModal();
      toast("사용자 정보를 변경했습니다.");
      await renderAdminTab();
    } catch (error) {
      toast(humanizeError(error), "error");
      setButtonBusy(button, false);
    }
  });
}

async function changeCalendarMonth(offset) {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + offset, 1);
  $("#content").innerHTML = loadingState();
  await renderCalendar();
}

function startRealtime() {
  stopRealtime();
  state.subscriptions.push(
    subscribeNotifications(state.profile.id, async payload => {
      await refreshNotifications();
      toast(payload.new?.title ?? "새 알림이 도착했습니다.");
    }),
    subscribeBookings(() => {
      if (["dashboard", "calendar", "my", "approvals", "admin"].includes(state.page)) {
        navigate(state.page).catch(() => {});
      }
    }),
    subscribeRooms(() => {
      state.rooms = [];
      if (["dashboard", "rooms", "admin"].includes(state.page)) navigate(state.page).catch(() => {});
    })
  );
}

function stopRealtime() {
  state.subscriptions.forEach(unsubscribe => unsubscribe());
  state.subscriptions = [];
}

async function refreshNotifications() {
  try {
    state.notifications = await listNotifications();
    renderNotifications();
  } catch (error) {
    $("#notificationList").innerHTML = `<div class="notification-empty">${escapeHtml(humanizeError(error))}</div>`;
  }
}

function renderNotifications() {
  const unread = state.notifications.filter(item => !item.is_read).length;
  $("#notiDot").classList.toggle("hidden", unread === 0);
  $("#notificationList").innerHTML = state.notifications.length
    ? state.notifications.map(item => `<div class="notification ${item.is_read ? "" : "unread"}"><i class="blue-bg">♢</i><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.content)}</p><time>${formatDateTime(item.created_at)}</time></div></div>`).join("")
    : '<div class="notification-empty">새로운 알림이 없습니다.</div>';
}

async function handleReadAll() {
  try {
    await markAllNotificationsRead();
    state.notifications = state.notifications.map(item => ({ ...item, is_read: true }));
    renderNotifications();
    toast("모든 알림을 읽음 처리했습니다.");
  } catch (error) { toast(humanizeError(error), "error"); }
}

function openMenu() {
  $(".sidebar").classList.add("open");
  $("#mobileShade").classList.add("open");
}

function closeMenu() {
  $(".sidebar").classList.remove("open");
  $("#mobileShade").classList.remove("open");
}

function showPageError(error) {
  $("#content").innerHTML = errorState(humanizeError(error));
}

boot();
