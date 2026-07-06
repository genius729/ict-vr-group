# 양청고등학교 특별실 예약 시스템

HTML, CSS, Vanilla JavaScript와 Supabase로 구성된 실제 데이터 기반 특별실 예약 시스템입니다. Google OAuth 로그인, 역할 기반 접근 제어, 서버 측 예약 검증, 실시간 알림, 관리자 기능과 통계를 포함합니다.

## 구조

```text
.
├─ index.html
├─ styles.css
├─ config.js
├─ src/
│  ├─ auth.js
│  ├─ supabase.js
│  ├─ rooms.js
│  ├─ bookings.js
│  ├─ notifications.js
│  ├─ admin.js
│  ├─ statistics.js
│  ├─ ui.js
│  ├─ utils.js
│  └─ main.js
├─ supabase/
│  ├─ schema.sql
│  └─ seed.sql
└─ scripts/
   ├─ generate-config.mjs
   └─ check.mjs
```

## 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 새 프로젝트를 생성합니다.
2. 프로젝트가 준비되면 **SQL Editor → New query**에서 [supabase/schema.sql](./supabase/schema.sql) 전체를 실행합니다.
3. 초기 특별실이 필요하면 [supabase/seed.sql](./supabase/seed.sql)을 실행합니다.
4. **Project Settings → API**에서 Project URL과 publishable key(또는 legacy anon key)를 확인합니다.

`schema.sql`은 다음 항목을 한 번에 구성합니다.

- `users`, `rooms`, `bookings`, `notifications`, `booking_logs`
- Google 최초 로그인 사용자 자동 등록 트리거
- 역할과 예약 변경을 제한하는 RLS 및 DB 트리거
- 예약 시간 겹침 방지 exclusion constraint
- 승인·거절·취소 알림 및 감사 로그
- `room-images` Storage bucket과 관리자 쓰기 정책
- bookings, notifications, rooms의 Realtime publication
- DB 기반 통계 RPC
- 예약 10분 전 알림용 pg_cron 작업

> SQL을 다시 실행할 수 있도록 대부분의 구문은 멱등성 있게 작성했지만, 운영 DB에서는 실행 전 백업을 권장합니다.

## 2. Google OAuth 설정

공식 [Supabase Google 로그인 안내](https://supabase.com/docs/guides/auth/social-login/auth-google)에 따라 설정합니다.

1. [Google Auth Platform](https://console.cloud.google.com/auth/clients)에서 OAuth 동의 화면을 구성합니다.
2. OAuth Client를 만들고 유형을 **Web application**으로 선택합니다.
3. Authorized JavaScript origins에 실제 서비스 origin을 등록합니다.
   - 로컬 예: `http://localhost:3000`
   - 운영 예: `https://reserve.example.school`
4. Authorized redirect URI에는 Supabase Dashboard의 **Authentication → Providers → Google**에 표시되는 callback URL을 등록합니다.
   - 일반 형식: `https://PROJECT_REF.supabase.co/auth/v1/callback`
5. 발급된 Client ID와 Client Secret을 Supabase의 Google Provider에 입력하고 활성화합니다.
6. Supabase **Authentication → URL Configuration**에서:
   - Site URL: 운영 서비스 URL
   - Redirect URLs: 로컬 및 운영 URL

현재 앱은 모든 Google 계정 로그인을 허용합니다. 학교 계정만 허용하려면 운영 전 OAuth hosted domain 제한과 DB 측 이메일 도메인 검사를 함께 추가해야 합니다.

## 3. 최초 관리자 지정

모든 신규 사용자는 안전을 위해 `student`로 생성됩니다. 최초 관리자는 해당 계정으로 한 번 로그인한 후 SQL Editor에서 직접 지정합니다.

```sql
update public.users
set role = 'admin'
where email = '최초관리자@학교도메인';
```

이후에는 관리자 페이지에서 학생, 교사, 관리자 권한을 변경할 수 있습니다. 최소 한 명의 관리자 계정을 항상 유지하세요.

## 4. 환경 설정

로컬에서는 `config.example.js`를 참고하여 `config.js`를 수정합니다.

```js
window.__APP_CONFIG__ = {
  SUPABASE_URL: "https://PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_..."
};
```

publishable/anon key는 브라우저 공개용입니다. 보안 경계는 [PostgreSQL RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)입니다. `service_role` key는 RLS를 우회하므로 브라우저 코드, Git 저장소, Vercel 공개 변수에 절대 넣지 마세요.

Vercel에서는 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 환경 변수를 등록하면 빌드 시 `scripts/generate-config.mjs`가 `config.js`를 생성합니다.

## 5. Storage와 Realtime 확인

`schema.sql`이 `room-images` public bucket과 정책을 만듭니다. 읽기는 공개되며 업로드·수정·삭제는 관리자만 가능합니다. 자세한 원리는 [Storage 접근 제어 문서](https://supabase.com/docs/guides/storage/security/access-control)를 참고하세요.

Realtime이 동작하지 않으면 Supabase Dashboard의 **Database → Publications**에서 `supabase_realtime` publication에 다음 테이블이 포함됐는지 확인합니다.

- `bookings`
- `notifications`
- `rooms`

Postgres Changes 설정은 [Realtime 공식 문서](https://supabase.com/docs/guides/realtime/postgres-changes)와 같습니다.

## 6. 로컬 실행과 검사

ES Module과 OAuth redirect 때문에 `index.html`을 파일로 직접 열지 말고 HTTP 서버를 사용합니다.

```bash
npm run dev
```

기본 `serve` 주소로 접속합니다. JavaScript 문법 및 필수 HTML 참조 검사는 다음과 같습니다.

```bash
npm run check
```

## 7. 배포

### Vercel

1. 저장소를 Vercel에 연결합니다.
2. Framework Preset은 **Other**를 선택합니다.
3. 환경 변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 등록합니다.
4. 포함된 `vercel.json`이 `dist` 정적 산출물을 생성해 배포합니다.
5. 생성된 도메인을 Google OAuth origin과 Supabase Redirect URLs에 추가합니다.

### GitHub Pages

1. `config.js`에 공개 Project URL과 publishable/anon key를 입력합니다.
2. 저장소 **Settings → Pages**에서 브랜치 배포를 선택합니다.
3. Pages URL 전체 경로를 Supabase Redirect URLs에 추가합니다.
4. Google Authorized JavaScript origins에는 origin(`https://USER.github.io`)만 등록합니다.

프로젝트 사이트가 `/REPOSITORY/` 아래에 있어도 현재 상대 경로로 정적 파일을 불러옵니다.

## 8. 서버 측 예약 검증

클라이언트 검증은 사용 편의를 위한 보조 기능일 뿐입니다. 실제 강제 규칙은 `schema.sql`에 있습니다.

- 시작 < 종료, 같은 날짜
- 특별실 이용 가능 시간
- 최대 예약 시간
- 수용 인원
- 점검 모드 및 일시 폐쇄
- `pending` 또는 `approved` 예약의 시간 중복

동시 요청 중복은 `tstzrange`와 GiST exclusion constraint가 원자적으로 차단합니다. 학생의 임의 승인, 다른 사용자 예약 수정, 교사의 승인 외 필드 변경도 DB 트리거가 거부합니다.

## 9. 운영 절차

- 매일: 승인 대기 예약과 일시 폐쇄 상태 확인
- 매주: 관리자 페이지의 강제 취소 및 수정 로그 검토
- 매월: Supabase 사용량, Database/Realtime/Storage quota와 통계 이상치 확인
- 학기 초: 사용자 학년·반·번호 및 교사 권한 정비
- 인사 이동 시: 관리자·교사 권한 즉시 회수
- 장애 시: Supabase 로그와 브라우저 Network 응답의 오류 코드를 함께 확인
- 백업: 유료 플랜의 PITR 또는 정기 `pg_dump` 정책 수립

예약 10분 전 알림은 `pg_cron`이 매분 `create_booking_reminders()`를 실행해 생성합니다. 프로젝트 요금제나 권한 때문에 cron 생성 notice가 출력되면 Supabase의 Cron UI에서 아래 SQL을 매분 실행하도록 등록합니다.

```sql
select public.create_booking_reminders();
```

브라우저가 닫혀 있을 때 외부 푸시나 이메일까지 보내려면 별도의 Edge Function과 메일/푸시 공급자가 필요합니다. 현재 요구 범위의 알림은 앱 내부 Realtime 알림입니다.

## 10. 출시 전 점검표

- 학생 계정으로 다른 학생 예약을 조회·수정할 수 없는지
- 학생이 REST 요청을 조작해 `approved`를 만들 수 없는지
- 교사가 승인 처리와 통계 조회를 할 수 있는지
- 관리자가 특별실/사용자/예약을 관리할 수 있는지
- 같은 특별실·같은 시간 동시 예약 중 하나만 성공하는지
- 점검/폐쇄/정원/운영시간 제한이 서버에서 거부되는지
- 승인·거절·취소·강제취소·10분 전 알림이 생성되는지
- 모바일 메뉴, 빈 상태, 네트워크 오류, 세션 만료 화면이 정상인지
- 실제 운영 도메인 외 OAuth redirect URL이 제거됐는지
