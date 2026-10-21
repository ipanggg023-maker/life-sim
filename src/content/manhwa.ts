// การนำเสนอแบบมังฮวา: ตอน ภาค คอมเมนต์ผู้อ่าน ประโยคค้างคา และชื่อเรื่องตอนจบ
import { chance, pick, randInt } from "../engine/rng";
import type { Life, LogEntry, Series } from "../engine/types";
import { displayName, loc, log, people } from "../engine/util";
import { classById, rankLabel } from "./hunter/power";
import { worldFacts } from "./hunter/worldFacts";
import { isRealistic, worldOf } from "./worlds";
import { birthplaceOf } from "./murim/life/region";

// ───────────────────────── ตอน / ภาค ─────────────────────────

export function chapterNo(life: Life) {
  return Number(life.flags.chapter ?? 0);
}

/** เปิดตอนใหม่: "ตอนที่ N: ชื่อตอน" */
export function startChapter(life: Life, title: string) {
  const n = chapterNo(life) + 1;
  life.flags.chapter = n;
  log(life, `ตอนที่ ${n}: ${title}`, "chapter");
}

const ARC_NAMES = ["ภาคแรก", "ภาคสอง", "ภาคสาม", "ภาคสี่", "ภาคห้า", "ภาคหก", "ภาคเจ็ด", "ภาคแปด", "ภาคเก้า", "ภาคสิบ"];

/** เปิดภาคใหม่ของเรื่อง */
export function startArc(life: Life, title: string) {
  const n = Number(life.flags.arc ?? 0);
  life.flags.arc = n + 1;
  log(life, `${ARC_NAMES[Math.min(n, ARC_NAMES.length - 1)]}: ${title}`, "arc");
}

export function birthArc(life: Life) {
  const w = worldOf(life.worldId);
  const origin = { poor: "เด็กจากครอบครัวธรรมดา", middle: "เด็กชนชั้นกลาง", rich: "ทายาทตระกูลมีฐานะ", elite: "ทายาทตระกูลใหญ่" }[life.wealth];
  startArc(life, life.legacy ? `ทายาทแห่งยุคถัดไป` : `${origin}แห่ง${birthplaceOf(life, w.birthplace)}`);
}

export function awakenArc(life: Life) {
  const p = life.power;
  if (!p) return;
  const r = rankLabel(life, p.rank);
  const cls = classById(p.hunterClass).name;
  const tag = p.rank >= 8 ? "ผู้ถูกเลือกแห่งยุค" : p.rank <= 1 ? "ผู้ที่ทุกคนมองข้าม" : p.rank >= 5 ? "ดาวรุ่งที่ทุกคนจับตา" : "ผู้ตื่นพลังหน้าใหม่";
  startArc(life, `${cls}${worldOf(life.worldId).labels.rank}${r} — ${tag}`);
}

// ───────────────────────── คอมเมนต์ผู้อ่าน ─────────────────────────

const READERS = [
  "กุ้งทอดกรอบ", "ไรท์อย่าดอง", "แฟนคลับตัวร้าย", "อ่านตอนตีสาม", "ติ่งพระเอก", "คนอ่านเงียบ", "ปลาหมึกย่าง",
  "ทีมนางเอก", "หมีพูห์ดุ", "แมวส้มจอมเกเร", "สายเปย์", "นักสะสมมังฮวา", "ป้าข้างบ้าน", "ข้าวมันไก่ประตูน้ำ",
];

type Mood = "awaken" | "sss" | "weak" | "slap" | "sad" | "romance" | "regress" | "money" | "win" | "fail" | "villain" | "wuxia" | "system";

const LINES: Record<Mood, string[]> = {
  awaken: ["ในที่สุดก็ตื่นพลัง!!! รอมาตั้งหลายตอน 😭", "หน้าต่างสีฟ้ามาแล้วววว", "ใครอ่านถึงตรงนี้แล้วขนลุกบ้าง ✋", "เริ่มสนุกแล้วโว้ยยย", "ตอนนี้แหละที่รอ!!"],
  sss: ["SSS ตั้งแต่ตื่น??? ไรท์จะเขียนต่อยังไงเนี่ย 555", "เทพตั้งแต่ตอนแรก แบบนี้แหละที่ชอบ", "ประเทศอื่นสั่นแล้วจ้า", "โกงเกินไปแล้ววว (ชอบมาก)"],
  weak: ["แรงก์ต่ำแต่เดี๋ยวก็พลิก สูตรมังฮวา", "ขยะที่กลายเป็นเทพ ภาคสองมาแน่", "ไม่เป็นไรนะ ตัวเอกเรื่องดังก็เริ่มแบบนี้"],
  slap: ["ตบหน้าแรงมากกก 555 สะใจ", "คุกเข่าเลยค่ะ!!!", "บอกแล้วอย่าดูถูกตัวเอก", "ฉากนี้อ่านซ้ำสิบรอบ", "เสียงตบดังมาถึงบ้านฉัน"],
  sad: ["ไรท์ใจร้าย 😭😭", "ขอทิชชู่หนึ่งกล่อง", "ร้องไห้ตอนตีสอง ขอบคุณไรท์มาก", "ไม่ไหวแล้ว พักอ่านก่อน 💔", "ทำไมต้องเป็นแบบนี้"],
  romance: ["เรือลำนี้ล่องแล้วจ้า ⛵", "เขินแทน 🫣", "ขอฉากหวานอีกสักสิบตอน", "ทีมนี้ชนะ!!", "จิ้นจนนอนไม่หลับ"],
  regress: ["ย้อนเวลามาแล้ว รอบนี้ล้างแค้นให้หมด!", "ใครนับได้บ้างตายมากี่รอบแล้ว", "ความรู้อนาคตคือโกงที่สุด", "รอบนี้ห้ามพลาดนะ!!"],
  money: ["รวยแล้วววว ขอยืมบ้าง", "อยากมีความทรงจำเลขหวยบ้าง 😂", "สายเปย์ขอคารวะ"],
  win: ["ฉากต่อสู้มันส์มาก", "นึกว่าจะตายแล้ว ใจหายใจคว่ำ", "พลังทะลุจอ 🔥", "ไรท์วาดฉากนี้สวยมากกก (ในหัว)"],
  fail: ["ไม่นะะะ", "ไรท์ทำอะไรตัวเอกของฉัน", "เดี๋ยวก็กลับมาแก้แค้น ฉันเชื่อ", "พักใจก่อน…"],
  villain: ["ตัวร้ายที่น่ารักที่สุดในจักรวรรดิ", "กิโยตินอยู่ไหน ไม่เห็นแล้ว 555", "ทีมตัวร้ายตลอดไป", "หักบทได้สวยมาก"],
  wuxia: ["ลมปราณพุ่งทะลุจอ", "จอมยุทธ์ตัวจริง", "สามสิบปีฝั่งตะวันออก!!", "ยุทธภพสะเทือน"],
  system: ["[ระบบ] มาแล้ว อ่านแล้วขนลุก", "ใครอยากได้หน้าต่างระบบบ้าง ✋", "ระบบเอ็นดูตัวเอกเกิน 555"],
};

function moodOf(life: Life, text: string, kind: string, awakenedNow: boolean): Mood | undefined {
  if (awakenedNow) return (life.power?.rank ?? 0) >= 8 ? "sss" : (life.power?.rank ?? 0) <= 1 ? "weak" : "awaken";
  if (/ตบ|คุกเข่า|หน้าซีด|เงียบกริบ|ไม่กล้าแม้แต่จะสบตา/.test(text)) return "slap";
  if (/ไม่รอด|เสียชีวิต|จากไป|หลุมศพ/.test(text) && kind === "bad") return "sad";
  if (/💕|💍|แต่งงาน|คบกัน|ยิ้มเป็นครั้งแรก|อภิเษก/.test(text)) return "romance";
  if (/ย้อนเวลา/.test(text)) return "regress";
  if (/ถูกรางวัล|💰|📈/.test(text)) return "money";
  if (/Death Flag|กิโยติน|ตัวร้าย/.test(text)) return "villain";
  if (kind === "system") return "system";
  if (kind === "milestone" || kind === "good") return life.worldId === "murim" && chance(life, 0.4) ? "wuxia" : "win";
  if (kind === "bad") return "fail";
  return;
}

/** ความคิดเห็นแบบเว็บตูน — เข้ารหัสเป็นบรรทัด "ชื่อ|ข้อความ|ไลก์" */
function writeComments(life: Life, mood: Mood) {
  const lines: string[] = [];
  const n = randInt(life, 2, 3);
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    let t = pick(life, LINES[mood]);
    for (let k = 0; k < 3 && used.has(t); k++) t = pick(life, LINES[mood]);
    used.add(t);
    lines.push(`${pick(life, READERS)}|${t}|${randInt(life, 3, 99) * (i === 0 ? 100 : 10)}`);
  }
  life.log.push({ age: life.age, text: lines.join("\n"), kind: "comments" });
  life.flags.lastCommentCh = chapterNo(life);
}

/**
 * หลังผลลัพธ์ของฉากเด็ด — คอมเมนต์ออกเฉพาะฉากสำคัญ และเว้นระยะ 2 ตอนขึ้นไป
 * (ฉากที่แรงมาก เช่น ตื่นพลัง ตบหน้า สูญเสีย ออกได้ทันที)
 */
export function maybeComment(life: Life, text: string, kind: string, awakenedNow: boolean) {
  if (!life.alive || isRealistic(life.worldId)) return; // โลกสมจริงอ่านแบบนิยาย ไม่มีคอมเมนต์ผู้อ่าน
  const mood = moodOf(life, text, kind, awakenedNow);
  if (!mood) return;
  const strong = awakenedNow || mood === "slap" || mood === "sad" || mood === "sss" || mood === "regress";
  const gap = chapterNo(life) - Number(life.flags.lastCommentCh ?? -9);
  if (strong ? gap >= 1 : gap >= 2 && (kind === "milestone" || kind === "system") && chance(life, 0.6)) writeComments(life, mood);
}

export function parseComments(e: LogEntry) {
  return e.text.split("\n").map((row) => {
    const [user, text, likes] = row.split("|");
    return { user, text, likes: Number(likes) };
  });
}

export const formatLikes = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// ───────────────────────── ประโยคค้างคาก่อนกด +1 ปี ─────────────────────────

/** hash แบบกำหนดได้ — ห้ามใช้ RNG ของชีวิตตอนวาดหน้าจอ */
function hash(a: number, b: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35);
  h ^= h >>> 13;
  return ((Math.imul(h, 0x27d4eb2f) >>> 0) % 1000) / 1000;
}

const GENERIC_TEASERS = [
  "…แต่ไม่มีใครรู้เลยว่า ปีหน้าจะเปลี่ยนทุกอย่าง",
  "…ลมเริ่มเปลี่ยนทิศ",
  "…และในที่ที่ไกลออกไป มีใครบางคนกำลังพูดถึงชื่อของคุณ",
  "…ชะตาเริ่มขยับเงียบๆ",
];

export function cliffhanger(life: Life): string | undefined {
  if (!life.alive) return;
  const next = life.age + 1;
  const f = life.flags;
  if (life.worldId === "apocalypse" && !f.doomed && Number(f.awakenAge) === next) return "…ไม่มีใครรู้เลยว่า ปีหน้าโลกจะไม่เหมือนเดิมอีกต่อไป";
  if (life.worldId === "ordinary" && !life.power && Number(f.awakenAge) === next && f.awakenTrack !== "never") return "…คืนนั้น คุณได้ยินเสียง \"ติ๊ง\" เบาๆ ในหัวเป็นครั้งแรก";
  if (life.worldId !== "apocalypse" && life.worldId !== "ordinary" && !life.power && Number(f.awakenAge) === next && f.awakenTrack !== "never") return "…คืนนั้น ไข้ของคุณเริ่มขึ้นสูงผิดปกติ";
  if (!life.power && Number(f.ceremonyAge) === next && !["hunter", "tower", "apocalypse", "ordinary"].includes(life.worldId)) return "…วันที่ทุกคนรอคอยกำลังจะมาถึง";
  if (!f.turnDone && Number(f.tpAge) === next) return "…และแล้ว วันที่ชะตาจะเปลี่ยนก็ใกล้เข้ามา";
  if (f.role === "villain" && [12, 16, 18, 20].includes(next) && !f.fateDefied) return next === 20 ? "…ปีหน้า คือวันที่นิยายบอกว่าคุณจะตาย" : "…บทถัดไปของนิยายกำลังจะเริ่มขึ้น";
  const facts = worldFacts(life);
  if (facts.cataclysmAge === next && life.age > 8) return "…ท้องฟ้าเริ่มเปลี่ยนสีในทุกคืน";
  if (life.memories?.some((m) => m.key === "death" && m.age === next)) return "…ปีหน้าคือปีที่คุณเคยตาย";
  if (hash(life.seed, life.age) < 0.07 && life.age > 5) return GENERIC_TEASERS[Math.floor(hash(life.seed + 1, life.age) * GENERIC_TEASERS.length)];
  return;
}

// ───────────────────────── จบชีวิต = จบซีรีส์ ─────────────────────────

function titleOf(life: Life): string {
  const f = life.flags;
  const p = life.power;
  const w = worldOf(life.worldId);
  const r = p ? rankLabel(life, p.rank) : "";
  const reg = life.regressions ?? 0;
  const villainTitle = life.gender === "f" ? "คุณหนูตัวร้าย" : "คุณชายตัวร้าย";
  if (f.crowned) return `จาก${f.role === "villain" ? villainTitle : "คนธรรมดา"}สู่บัลลังก์จักรวรรดิ`;
  if (f.role === "villain" && f.fateDefied) return `${villainTitle}ขอหักบทกิโยติน`;
  if (f.role === "villain" && /กิโยติน|ประหาร/.test(life.causeOfDeath ?? "")) return `บทจบของ${villainTitle}ที่เปลี่ยนไม่ได้`;
  if (f.ascended) return life.wealth === "poor" ? "ลูกชาวนาผู้เหาะขึ้นสวรรค์" : "ผู้บำเพ็ญที่ทะลวงถึงเซียน";
  if (reg >= 1 && (f.revenge || f.arcWon)) return `ผู้ย้อนเวลาครั้งที่ ${reg} กลับมาทวงคืนทุกอย่าง`;
  if (f.arcWon && p) return `${r}ผู้ยืนอยู่เหนือทุกคน`;
  if (f.rankRevealed && p) return `แรงก์ต่ำที่จริงๆ แล้วคือ${r}`;
  if (f.towerTop) return "ผู้ยืนบนยอดหอคอย";
  if (f.apocHero) return "ผู้ปิดฉากสุดท้ายของวันสิ้นโลก";
  if (f.sssAwakened) return life.worldId === "murim" ? "อัจฉริยะเซียนตั้งแต่กำเนิด" : life.worldId === "tower" ? "ผู้ท้าชิงระดับ SSS คนแรกในรอบสิบปี" : life.worldId === "court" ? "ผู้ใช้เวทวงที่ 8 คนแรกในรอบห้าร้อยปี" : "แรงก์ SSS ตั้งแต่วันแรก";
  if (reg >= 1) return `ย้อนเวลามาครั้งที่ ${reg} รอบนี้จะไม่ตายแบบเดิม`;
  if (life.talents.some((t) => t.id === "system_user" && t.revealed)) return "ผู้เล่นคนเดียวที่มีหน้าต่างระบบ";
  if (p && f.lateBloom && p.awakenedAt >= 30) return `ตาลุงวัย ${p.awakenedAt} ที่เพิ่งตื่นพลัง`;
  if (p && f.awakenTrack === "early" && p.awakenedAt <= 10) return `อัจฉริยะวัย ${p.awakenedAt} ขวบผู้ตื่นพลังก่อนใคร`;
  if (f.role === "extra" && f.extraSurvived) return "ตัวประกอบที่ไม่ยอมตายในบทที่ 3";
  if (f.role === "lead" && f.saint) return "นักบุญที่ไม่ได้อยากเป็นตัวเอก";
  if (f.jackpot) return "ถูกรางวัลที่ 1 แล้วชีวิตไม่เหมือนเดิม";
  if (f.revenge) return "การล้างแค้นที่รอมาทั้งชีวิต";
  if (p && p.rank >= 6) return `${r}${/\d$/.test(r) ? " " : ""}ที่แข็งแกร่งที่สุดใน${w.name}`;
  if (p && p.rank <= 1) return `${classById(p.hunterClass).name}${w.labels.rank}${r}ผู้ไม่เคยยอมแพ้`;
  if (life.age < 18) return "ดอกไม้ที่ร่วงก่อนบาน";
  if (!p && life.age >= 80) return "ชีวิตธรรมดาที่ไม่ธรรมดา";
  if (!p && life.age < 30) return "เรื่องราวที่ยังไม่ทันได้เริ่มต้น";
  if (p) return `บันทึกของ${classById(p.hunterClass).name}${w.labels.rank}${r}`;
  return `ชีวิตของ${displayName(life)}`;
}

function tagsOf(life: Life): string[] {
  const f = life.flags;
  const tags = [`#${worldOf(life.worldId).name.replace(/^โลก /, "")}`];
  if (life.power) tags.push(life.worldId === "murim" ? "#ฝึกยุทธ์" : life.worldId === "court" ? "#เวทมนตร์" : life.worldId === "tower" ? "#ปีนหอคอย" : life.worldId === "apocalypse" ? "#วันสิ้นโลก" : life.worldId === "ordinary" ? "#ระบบชีวิต" : "#ตื่นพลัง");
  else tags.push("#ไร้พลัง");
  if ((life.regressions ?? 0) > 0) tags.push("#ย้อนเวลา");
  if (f.revenge || f.vendetta) tags.push("#ล้างแค้น");
  if (f.role === "villain") tags.push("#ตัวร้าย");
  if (people(life, "spouse", false).length) tags.push("#โรแมนซ์");
  if (f.sssAwakened || life.talents.some((t) => t.id === "system_user" && t.revealed)) tags.push("#โกง");
  if (f.lateBloom) tags.push("#ตื่นช้า");
  if (life.legacy) tags.push("#เกิดใหม่");
  return tags.slice(0, 5);
}

export function seriesOf(life: Life): Series {
  const chapters = chapterNo(life);
  const p = life.power;
  let rating = 2.4 + Math.min(1.4, chapters / 14) + (p && p.rank >= 6 ? 0.4 : 0) + ((life.regressions ?? 0) > 0 ? 0.3 : 0) + Math.max(0, life.fame) / 200;
  if (life.age < 12) rating -= 0.6;
  rating = Math.round(Math.max(1, Math.min(5, rating)) * 10) / 10;
  const views = Math.round((chapters * 8000 + Math.max(0, life.fame) * 30_000 + life.age * 500) * (0.7 + rating / 5));
  const gen = Number(life.flags.generation ?? 1);
  const title = life.flags.seriesTitle ? `${life.flags.seriesTitle} ภาค ${gen}` : loc(life, titleOf(life));
  return { title, rating, views, chapters, tags: tagsOf(life) };
}

export const formatViews = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

/** คอมเมนต์ตอนจบซีรีส์ (กำหนดได้จาก seed — ไม่แตะ RNG ของชีวิต) */
export function finaleComments(life: Life) {
  const pool = life.age < 18
    ? ["จบแบบนี้เลยเหรอ… 😭", "ไรท์คะ ตัวเอกยังเด็กอยู่เลย", "ขอภาคต่อแบบย้อนเวลา!!"]
    : seriesOf(life).rating >= 4
      ? ["ตอนจบที่ดีที่สุดในปีนี้ ⭐⭐⭐⭐⭐", "ร้องไห้หนักมาก ขอบคุณไรท์", "ไรท์คะ ภาคสองมาเมื่อไหร่", "อ่านจบแล้วใจหาย"]
      : ["จบแล้วเหรอ… ขอภาคต่อ", "ตอนจบรีบไปนิด แต่โดยรวมชอบนะ", "รอเรื่องใหม่ของไรท์ค่ะ", "ชีวิตธรรมดาแต่อบอุ่นดี"];
  return [0, 1, 2].map((i) => ({
    user: READERS[Math.floor(hash(life.seed + i * 7, life.age) * READERS.length)],
    text: pool[(Math.floor(hash(life.seed, life.age) * pool.length) + i) % pool.length], // ไม่ซ้ำกัน
    likes: 100 + Math.floor(hash(life.seed + i, 3) * 9900),
  }));
}
