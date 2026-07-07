import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const requiresEnvConfig = Boolean(process.env.CI || process.env.VERCEL);

if (!url || !key) {
  if (requiresEnvConfig) {
    console.error("CI/배포 빌드에는 SUPABASE_URL과 SUPABASE_ANON_KEY가 모두 필요합니다.");
    process.exit(1);
  }
  console.log("SUPABASE_URL/SUPABASE_ANON_KEY가 없어 로컬 config.js를 유지합니다.");
} else {
  const source = `window.__APP_CONFIG__ = ${JSON.stringify({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: key
  }, null, 2)};\n`;
  await writeFile(new URL("../config.js", import.meta.url), source, "utf8");
  console.log("config.js를 환경 변수로 생성했습니다.");
}

const root = new URL("../", import.meta.url);
const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of ["index.html", "styles.css", "config.js", "src"]) {
  await cp(new URL(entry, root), new URL(entry, output), { recursive: true });
}
console.log("dist 정적 배포 파일을 생성했습니다.");
