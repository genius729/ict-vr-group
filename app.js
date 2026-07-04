const rooms = [
  {id:'computer',name:'컴퓨터실',icon:'⌘',location:'본관 3층',capacity:32,status:'using',next:'오늘 15:00',equipment:'PC 32대 · 전자칠판'},
  {id:'science',name:'과학실',icon:'⚗',location:'과학관 2층',capacity:28,status:'available',next:'오늘 16:30',equipment:'실험대 7조 · 싱크대'},
  {id:'music',name:'음악실',icon:'♫',location:'예술관 2층',capacity:35,status:'available',next:'내일 09:00',equipment:'피아노 · 보면대 20개'},
  {id:'art',name:'미술실',icon:'✦',location:'예술관 3층',capacity:30,status:'pending',next:'오늘 14:20',equipment:'이젤 30개 · 세척대'},
  {id:'english',name:'영어전용실',icon:'A',location:'본관 4층',capacity:24,status:'available',next:'오늘 15:40',equipment:'전자칠판 · 태블릿 24대'},
  {id:'maker',name:'메이커실',icon:'⚙',location:'창의관 1층',capacity:20,status:'using',next:'오늘 17:00',equipment:'3D 프린터 · 공구함'},
  {id:'broadcast',name:'방송실',icon:'◉',location:'본관 2층',capacity:8,status:'closed',next:'점검 중',equipment:'방송 장비 · 편집 PC'}
];

const baseBookings = [
  {id:1,roomId:'computer',date:todayISO(),start:'09:00',end:'10:30',purpose:'정보 수업',name:'이수현',className:'1학년 2반',people:28,status:'confirmed'},
  {id:2,roomId:'maker',date:todayISO(),start:'13:00',end:'14:30',purpose:'로봇 동아리 제작',name:'박서준',className:'2학년 5반',people:16,status:'confirmed'},
  {id:3,roomId:'art',date:todayISO(),start:'14:30',end:'15:30',purpose:'미술 수행평가 준비',name:'김민준',className:'2학년 3반',people:12,status:'pending'},
  {id:4,roomId:'science',date:addDaysISO(1),start:'15:00',end:'16:30',purpose:'화학 실험 동아리',name:'김민준',className:'2학년 3반',people:14,status:'confirmed'},
  {id:5,roomId:'music',date:addDaysISO(2),start:'12:30',end:'13:30',purpose:'학교 축제 합주',name:'최유진',className:'1학년 4반',people:21,status:'pending'}
];

let state = {
  page:'dashboard',
  role:localStorage.getItem('schoolspace-role') || 'student',
  bookings:JSON.parse(localStorage.getItem('schoolspace-bookings') || 'null') || baseBookings,
  roomFilter:'all',
  search:''
};

function todayISO(){ return new Date().toLocaleDateString('en-CA'); }
function addDaysISO(days){ const d=new Date();d.setDate(d.getDate()+days);return d.toLocaleDateString('en-CA'); }
function roomFor(id){ return rooms.find(r=>r.id===id); }
function currentUser(){
  return {
    student:{name:'김민준',className:'2학년 3반'},
    teacher:{name:'이지은',className:'과학부 교사'},
    admin:{name:'박정호',className:'시스템 관리자'}
  }[state.role];
}
function statusLabel(status){ return ({available:'예약 가능',using:'사용 중',pending:'승인 대기',confirmed:'예약 확정',closed:'사용 불가',rejected:'거절됨'})[status] || status; }
function formatDate(date){ return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(date+'T00:00:00')); }
function save(){ localStorage.setItem('schoolspace-bookings',JSON.stringify(state.bookings)); }

function pageHeader(eyebrow,title,desc,action=''){
  return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
}

function dashboard(){
  const confirmedToday=state.bookings.filter(b=>b.date===todayISO()&&b.status==='confirmed').length;
  const pending=state.bookings.filter(b=>b.status==='pending').length;
  return `
    ${pageHeader('DASHBOARD','안녕하세요, 김민준 학생 👋','특별실 현황을 확인하고 필요한 공간을 예약하세요.',`<span class="date-chip">${formatDate(todayISO())}</span>`)}
    <section class="hero"><div><h2>수업과 활동을 위한 공간, 바로 예약하세요.</h2><p>오늘은 7개 특별실 중 3개 특별실을 바로 예약할 수 있어요.</p></div><button data-open-booking>특별실 예약하기 →</button></section>
    <section class="stats-grid">
      ${statCard('▦','blue','전체 특별실','7','개')}
      ${statCard('✓','green','현재 예약 가능','3','개')}
      ${statCard('◷','amber','승인 대기',pending,'건')}
      ${statCard('↗','red','오늘 예약',confirmedToday+2,'건')}
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><h3>실시간 특별실 현황</h3><button class="text-button" data-page="rooms">전체 보기 →</button></div><div class="usage-list">
        ${rooms.slice(0,6).map(room=>`<div class="usage-item"><span class="room-symbol">${room.icon}</span><div><strong>${room.name}</strong><small>${room.location}</small></div><span class="status ${room.status}">${statusLabel(room.status)}</span></div>`).join('')}
      </div></section>
      <section class="panel"><div class="panel-head"><h3>오늘의 예약 일정</h3><button class="text-button" data-page="calendar">캘린더 보기 →</button></div><div class="schedule-list">
        ${state.bookings.filter(b=>b.date===todayISO()).map(b=>`<div class="schedule-item ${b.status}"><time>${b.start}</time><i class="schedule-line"></i><div><strong>${roomFor(b.roomId).name}</strong><small>${b.purpose}</small></div><span class="status ${b.status}">${statusLabel(b.status)}</span></div>`).join('') || '<div class="empty">오늘 예약이 없습니다.</div>'}
      </div></section>
    </div>`;
}

function statCard(icon,color,label,value,unit){ return `<div class="stat-card"><span class="stat-icon ${color}">${icon}</span><div><small>${label}</small><strong>${value}<em>${unit}</em></strong></div></div>`; }

function roomsPage(){
  const filtered=rooms.filter(r=>(state.roomFilter==='all'||r.status===state.roomFilter) && (r.name+r.location+r.equipment).includes(state.search));
  return `
    ${pageHeader('ROOMS','특별실 찾기','위치와 시설 정보를 확인하고 원하는 특별실을 예약하세요.',`<button class="primary" data-open-booking>+ 새 예약</button>`)}
    <div class="toolbar"><label class="search"><input id="roomSearch" placeholder="특별실 이름, 위치, 시설 검색" value="${state.search}"></label><select id="statusFilter"><option value="all">전체 상태</option><option value="available">예약 가능</option><option value="using">사용 중</option><option value="closed">사용 불가</option></select><select id="locationFilter"><option>전체 건물</option><option>본관</option><option>예술관</option><option>과학관</option></select></div>
    <div class="room-grid">${filtered.map(roomCard).join('') || '<div class="empty"><strong>검색 결과가 없습니다.</strong>다른 검색어로 찾아보세요.</div>'}</div>`;
}

function roomCard(r){
  return `<article class="room-card"><div class="room-top"><span class="room-symbol">${r.icon}</span><span class="status ${r.status}">${statusLabel(r.status)}</span></div><h3>${r.name}</h3><p>${r.equipment}</p><div class="room-meta"><span>⌖ ${r.location}</span><span>♙ 최대 ${r.capacity}명</span></div><div class="next-booking">다음 예약 <strong>${r.next}</strong></div><div class="room-actions"><button class="detail" data-toast="${r.name} 상세 정보입니다.">상세 정보</button><button class="book" data-open-booking="${r.id}" ${r.status==='closed'?'disabled':''}>예약하기</button></div></article>`;
}

function calendarPage(){
  const days=[0,1,2,3,4].map(addDaysISO);
  const times=['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
  return `
    ${pageHeader('CALENDAR','예약 캘린더','특별실별 예약 일정을 한눈에 확인하세요.',`<button class="primary" data-open-booking>+ 예약하기</button>`)}
    <section class="calendar-shell"><div class="calendar-toolbar"><div class="week-controls"><button>‹</button><button>›</button></div><h2>${new Date().getFullYear()}년 ${new Date().getMonth()+1}월</h2><span class="status available">● 예약 가능</span></div>
    <div class="calendar-scroll"><div class="week-grid"><div class="week-cell week-head">시간</div>${days.map(d=>`<div class="week-cell week-head">${formatDate(d)}</div>`).join('')}
    ${times.map(time=>`<div class="week-cell time-cell">${time}</div>${days.map(day=>`<div class="week-cell">${state.bookings.filter(b=>b.date===day&&b.start.slice(0,2)===time.slice(0,2)).map(b=>`<div class="calendar-event ${b.status==='pending'?'amber':b.roomId==='computer'?'red':''}"><strong>${roomFor(b.roomId).name}</strong>${b.start}–${b.end}</div>`).join('')}</div>`).join('')}`).join('')}
    </div></div></section>`;
}

function myPage(){
  const mine=state.bookings.filter(b=>b.name===currentUser().name);
  return `${pageHeader('MY RESERVATIONS','내 예약','신청한 예약의 승인 상태와 일정을 관리하세요.',`<button class="primary" data-open-booking>+ 새 예약</button>`)}
  <section class="table-panel"><div class="table-scroll"><table><thead><tr><th>특별실</th><th>사용 일시</th><th>사용 목적</th><th>인원</th><th>상태</th><th>관리</th></tr></thead><tbody>
  ${mine.map(b=>bookingRow(b,true)).join('') || `<tr><td colspan="6"><div class="empty">예약 내역이 없습니다.</div></td></tr>`}</tbody></table></div></section>`;
}

function approvalPage(){
  const pending=state.bookings.filter(b=>b.status==='pending');
  return `${pageHeader('APPROVALS','예약 승인 관리','학생이 신청한 예약을 검토하고 승인 또는 거절하세요.')}
  <section class="table-panel"><div class="table-scroll"><table><thead><tr><th>신청자</th><th>특별실</th><th>사용 일시</th><th>사용 목적</th><th>인원</th><th>처리</th></tr></thead><tbody>
  ${pending.map(b=>`<tr><td><strong>${b.name}</strong><span class="table-sub">${b.className}</span></td><td class="table-room">${roomFor(b.roomId).name}</td><td>${formatDate(b.date)}<span class="table-sub">${b.start} – ${b.end}</span></td><td>${b.purpose}</td><td>${b.people}명</td><td><div class="action-group"><button class="mini-button approve" data-approve="${b.id}">승인</button><button class="mini-button reject" data-reject="${b.id}">거절</button></div></td></tr>`).join('') || `<tr><td colspan="6"><div class="empty"><strong>모두 처리했습니다.</strong>대기 중인 예약이 없습니다.</div></td></tr>`}
  </tbody></table></div></section>`;
}

function bookingRow(b,actions=false){
  return `<tr><td class="table-room">${roomFor(b.roomId).name}<span class="table-sub">${roomFor(b.roomId).location}</span></td><td>${formatDate(b.date)}<span class="table-sub">${b.start} – ${b.end}</span></td><td>${b.purpose}</td><td>${b.people}명</td><td><span class="status ${b.status}">${statusLabel(b.status)}</span></td><td>${actions&&b.status!=='rejected'?`<button class="mini-button reject" data-cancel="${b.id}">예약 취소</button>`:'-'}</td></tr>`;
}

function adminPage(){
  const usage=[['컴퓨터실',86],['과학실',73],['음악실',65],['메이커실',58],['미술실',44]];
  return `${pageHeader('ADMINISTRATION','시설 관리 및 통계','특별실 운영 현황과 사용률을 관리하세요.',`<button class="primary" data-toast="특별실 추가 기능을 준비 중입니다.">+ 특별실 추가</button>`)}
  <section class="stats-grid">${statCard('▦','blue','등록 특별실','7','개')}${statCard('↗','green','이번 달 예약','128','건')}${statCard('◷','amber','평균 사용률','68','%')}${statCard('♙','red','이용 학생','342','명')}</section>
  <div class="admin-grid"><section class="panel"><div class="panel-head"><h3>특별실 사용 순위</h3><span class="status confirmed">7월</span></div>${usage.map((u,i)=>`<div class="rank-row"><b>${i+1}</b><span>${u[0]}</span><span class="bar"><i style="width:${u[1]}%"></i></span><strong>${u[1]}%</strong></div>`).join('')}</section>
  <section class="table-panel"><div class="panel-head" style="padding:20px;margin:0"><h3>특별실 관리</h3></div><div class="table-scroll"><table><thead><tr><th>특별실</th><th>위치</th><th>수용 인원</th><th>상태</th><th>관리</th></tr></thead><tbody>${rooms.map(r=>`<tr><td class="table-room">${r.name}</td><td>${r.location}</td><td>${r.capacity}명</td><td><span class="status ${r.status}">${statusLabel(r.status)}</span></td><td><button class="mini-button" data-toast="${r.name} 수정 화면입니다.">수정</button></td></tr>`).join('')}</tbody></table></div></section></div>`;
}

function render(){
  document.body.dataset.role=state.role;
  document.getElementById('roleSelect').value=state.role;
  const meta={student:['김민준','2학년 3반 · 학생'],teacher:['이지은','과학부 · 교사'],admin:['박정호','시스템 관리자']}[state.role];
  document.getElementById('profileName').textContent=meta[0]; document.getElementById('profileMeta').textContent=meta[1];
  const pages={dashboard,rooms:roomsPage,calendar:calendarPage,my:myPage,approval:approvalPage,admin:adminPage};
  if((state.page==='approval'&&state.role==='student')||(state.page==='admin'&&state.role!=='admin')) state.page='dashboard';
  document.getElementById('mainContent').innerHTML=pages[state.page]();
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===state.page));
  document.getElementById('approvalBadge').textContent=state.bookings.filter(b=>b.status==='pending').length;
  bindDynamic();
}

function bindDynamic(){
  document.querySelectorAll('[data-page]').forEach(el=>el.onclick=e=>{e.preventDefault();state.page=el.dataset.page;closeMobile();render();window.scrollTo(0,0);});
  document.querySelectorAll('[data-open-booking]').forEach(el=>el.onclick=()=>openBooking(el.dataset.openBooking||''));
  document.querySelectorAll('[data-toast]').forEach(el=>el.onclick=()=>toast(el.dataset.toast));
  document.querySelectorAll('[data-cancel]').forEach(el=>el.onclick=()=>{if(confirm('이 예약을 취소할까요?')){state.bookings=state.bookings.filter(b=>b.id!==Number(el.dataset.cancel));save();toast('예약이 취소되었습니다.');render();}});
  document.querySelectorAll('[data-approve]').forEach(el=>el.onclick=()=>updateBooking(el.dataset.approve,'confirmed','예약을 승인했습니다.'));
  document.querySelectorAll('[data-reject]').forEach(el=>el.onclick=()=>updateBooking(el.dataset.reject,'rejected','예약을 거절했습니다.'));
  const search=document.getElementById('roomSearch'); if(search) search.oninput=e=>{state.search=e.target.value;roomsPageRefresh();};
  const filter=document.getElementById('statusFilter'); if(filter){filter.value=state.roomFilter;filter.onchange=e=>{state.roomFilter=e.target.value;roomsPageRefresh();};}
}
function roomsPageRefresh(){ document.getElementById('mainContent').innerHTML=roomsPage();bindDynamic(); }
function updateBooking(id,status,message){const b=state.bookings.find(x=>x.id===Number(id));if(b)b.status=status;save();toast(message);render();}

function openBooking(roomId=''){
  const user=currentUser();
  const form=document.getElementById('bookingForm');
  form.elements.name.value=user.name;
  form.elements.className.value=user.className;
  const select=document.getElementById('roomSelect');
  select.innerHTML=rooms.filter(r=>r.status!=='closed').map(r=>`<option value="${r.id}">${r.name} · ${r.location}</option>`).join('');
  if(roomId) select.value=roomId;
  document.getElementById('bookingDate').min=todayISO();document.getElementById('bookingDate').value=todayISO();
  const times=[];for(let h=8;h<=18;h++) for(const m of ['00','30']) times.push(`${String(h).padStart(2,'0')}:${m}`);
  document.getElementById('startTime').innerHTML=times.slice(0,-1).map(t=>`<option>${t}</option>`).join('');
  document.getElementById('endTime').innerHTML=times.slice(1).map(t=>`<option>${t}</option>`).join('');
  document.getElementById('startTime').value='15:00';document.getElementById('endTime').value='16:00';
  document.getElementById('formError').textContent='';
  document.getElementById('bookingModal').classList.add('open');document.getElementById('bookingModal').setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeBooking(){document.getElementById('bookingModal').classList.remove('open');document.getElementById('bookingModal').setAttribute('aria-hidden','true');document.body.style.overflow='';}

document.getElementById('bookingForm').onsubmit=e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const error=document.getElementById('formError');
  if(data.start>=data.end){error.textContent='종료 시간은 시작 시간보다 늦어야 합니다.';return;}
  const conflict=state.bookings.some(b=>b.roomId===data.roomId&&b.date===data.date&&b.status!=='rejected'&&data.start<b.end&&data.end>b.start);
  if(conflict){error.textContent='선택한 시간에 이미 예약이 있습니다. 다른 시간을 선택해 주세요.';return;}
  const roleStatus=state.role==='student'?'pending':'confirmed';
  state.bookings.push({id:Date.now(),...data,people:Number(data.people),status:roleStatus});save();closeBooking();e.target.reset();toast(roleStatus==='pending'?'예약 신청이 완료되었습니다. 교사 승인을 기다려 주세요.':'예약이 확정되었습니다.');state.page='my';render();
};

function toast(message){const el=document.getElementById('toast');el.textContent='✓  '+message;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function closeMobile(){document.getElementById('sidebar').classList.remove('open');document.getElementById('scrim').classList.remove('show');}
function closeDrawer(){document.getElementById('notificationDrawer').classList.remove('open');document.getElementById('scrim').classList.remove('show');}
document.getElementById('menuButton').onclick=()=>{document.getElementById('sidebar').classList.add('open');document.getElementById('scrim').classList.add('show');};
document.getElementById('scrim').onclick=()=>{closeMobile();closeDrawer();};
document.getElementById('roleSelect').onchange=e=>{state.role=e.target.value;localStorage.setItem('schoolspace-role',state.role);state.page='dashboard';toast(`${e.target.options[e.target.selectedIndex].text} 화면으로 전환했습니다.`);render();};
document.querySelectorAll('[data-close-modal]').forEach(el=>el.onclick=closeBooking);
document.getElementById('bookingModal').onclick=e=>{if(e.target.id==='bookingModal')closeBooking();};
document.getElementById('notificationButton').onclick=()=>{
  document.getElementById('notificationList').innerHTML=`
    <div class="notice-item"><span class="notice-mark">✓</span><div><strong>과학실 예약이 승인되었습니다.</strong><p>7월 5일 15:00 예약이 최종 확정되었어요.</p><time>10분 전</time></div></div>
    <div class="notice-item"><span class="notice-mark">◷</span><div><strong>예약 시작 10분 전입니다.</strong><p>컴퓨터실 사용 준비를 확인해 주세요.</p><time>어제</time></div></div>
    <div class="notice-item"><span class="notice-mark">i</span><div><strong>메이커실 정기 점검 안내</strong><p>7월 8일 16시 이후 이용이 제한됩니다.</p><time>2일 전</time></div></div>`;
  document.getElementById('notificationDrawer').classList.add('open');document.getElementById('scrim').classList.add('show');document.getElementById('notificationDot').style.display='none';
};
document.querySelector('[data-close-drawer]').onclick=closeDrawer;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeBooking();closeDrawer();closeMobile();}});
render();
