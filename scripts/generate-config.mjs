import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("SUPABASE_URL/SUPABASE_ANON_KEY가 없어 기존 config.js를 유지합니다.");
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
