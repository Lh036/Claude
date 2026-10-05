// Renders the canvas animation frame-by-frame with headless Chromium and pipes it to ffmpeg.
//   node render.mjs                -> out/analyty-promo.mp4 (with music.wav if present)
//   node render.mjs --stills 2,9   -> out/still-2.png, out/still-9.png
//   add --portrait for the 1080x1920 (9:16) version -> out/analyty-promo-9x16.mp4
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(join(execSync("npm root -g").toString().trim(), "playwright")); }

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const stillsArg = args.includes("--stills") ? args[args.indexOf("--stills") + 1] : null;
const PORTRAIT = args.includes("--portrait");
const FPS = Number(args.includes("--fps") ? args[args.indexOf("--fps") + 1] : 60);

const browser = await playwright.chromium.launch({ args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: PORTRAIT ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(join(here, "index.html")).href + (PORTRAIT ? "?render&portrait" : "?render"));
await page.evaluate(() => window.ready);

const grab = (t) =>
  page.evaluate((t) => {
    window.renderAt(t);
    return document.getElementById("c").toDataURL("image/png").split(",")[1];
  }, t);

if (stillsArg) {
  for (const t of stillsArg.split(",").map(Number)) {
    writeFileSync(join(out, `still-${PORTRAIT ? "v-" : ""}${t}.png`), Buffer.from(await grab(t), "base64"));
  }
  await browser.close();
  process.exit(0);
}

const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * FPS);
const music = join(here, "music.wav");
const ffArgs = ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-"];
if (existsSync(music)) ffArgs.push("-i", music, "-c:a", "aac", "-b:a", "256k", "-shortest");
ffArgs.push("-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, PORTRAIT ? "analyty-promo-9x16.mp4" : "analyty-promo.mp4"));
const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "ignore", "inherit"] });

for (let i = 0; i < frames; i++) {
  const buf = Buffer.from(await grab(i / FPS), "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % FPS === 0) process.stdout.write(`\rframe ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`\nwrote ${ffArgs[ffArgs.length - 1]}`);
