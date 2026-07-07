import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readProjectFile = path => readFile(new URL(path, root), "utf8");

const [html, styles, main, schema, buildScript] = await Promise.all([
  readProjectFile("index.html"),
  readProjectFile("styles.css"),
  readProjectFile("src/main.js"),
  readProjectFile("supabase/schema.sql"),
  readProjectFile("scripts/generate-config.mjs")
]);

function assertIncludes(source, needle, label) {
  assert.ok(source.includes(needle), `${label}: missing ${needle}`);
}

function assertExcludes(source, needle, label) {
  assert.ok(!source.includes(needle), `${label}: unexpected ${needle}`);
}

function assertOrder(source, first, second, label) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.ok(firstIndex >= 0, `${label}: missing ${first}`);
  assert.ok(secondIndex >= 0, `${label}: missing ${second}`);
  assert.ok(firstIndex < secondIndex, `${label}: expected ${first} before ${second}`);
}

assertIncludes(html, 'id="loginScreen"', "login shell");
assertIncludes(html, 'id="googleLoginBtn"', "login shell");
assertIncludes(html, 'id="app"', "app shell");
assertIncludes(html, 'id="content"', "app shell");
assertIncludes(html, '<script src="./config.js"></script>', "script order");
assertIncludes(html, '<script type="module" src="./src/main.js"></script>', "script order");
assertOrder(html, '<script src="./config.js"></script>', '<script type="module" src="./src/main.js"></script>', "script order");

assertExcludes(html, "DEBUG:", "production shell");
assertExcludes(html, "debug-marker", "production shell");
assertExcludes(styles, "debug-marker", "production styles");
assert.ok(html.trimEnd().endsWith("</html>"), "index.html must not have markup after </html>");
assertExcludes(html.slice(html.indexOf("</html>") + "</html>".length), "<script", "document tail");

assertIncludes(main, 'booking.status === "approved"', "approved edit guard");
assertIncludes(main, 'item.status === "pending"', "student edit policy");
assertIncludes(main, '["pending", "approved"].includes(item.status)', "student cancel policy");
assertExcludes(main, '["pending", "approved"].includes(item.status) && new Date(item.start_time)', "student edit policy regression");

assertIncludes(schema, "if actor_role = 'student' and old.status = 'approved' then", "database approved edit guard");
assertIncludes(schema, "승인 완료된 예약은 수정할 수 없습니다", "database approved edit guard");

assertIncludes(buildScript, "process.env.CI || process.env.VERCEL", "deployment config guard");
assertIncludes(buildScript, "process.exit(1)", "deployment config guard");

console.log("E2E smoke passed: shell, production markup, and booking permission flows");
