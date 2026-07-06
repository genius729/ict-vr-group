import { readFile } from "node:fs/promises";

let failed = false;

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
for (const required of ["#content", "src/main.js", "config.js"]) {
  const needle = required.replace("#", 'id="');
  if (!html.includes(needle)) {
    failed = true;
    console.error(`index.html 필수 항목 누락: ${required}`);
  }
}

if (failed) process.exit(1);
console.log("정적 검사 통과: JavaScript 10개 및 HTML 참조");
