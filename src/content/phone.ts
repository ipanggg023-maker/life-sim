// 📱 มือถือ (โลกยุคปัจจุบัน): IG · YouTube · แอปหาคู่ · หุ้น · แชต
import type { GameEvent, Outcome } from "../engine/events";
import { runEvent, yearHooks } from "../engine/game";
import { chance, pick, randInt } from "../engine/rng";
import type { Life, PhoneState } from "../engine/types";
import { addFame, addMoney, addStat, checkChance, clamp, createPerson, log, money, people, randomName, shortName } from "../engine/util";
import { effSys } from "./gameStats";
import { worldOf } from "./worlds";

export const hasPhone = (l: Life) => worldOf(l.worldId).modern && l.age >= 12 && !(l.flags.doomed && !l.flags.rebuilt);

export function phoneOf(l: Life): PhoneState {
  l.phone ??= { ig: 0, igPosts: 0, yt: 0, ytVideos: 0, ytViews: 0, portfolio: 0 };
  return l.phone;
}

const used = (l: Life, key: string) => l.doneThisYear.filter((x) => x === key).length;
export const IG_PER_YEAR = 3;
export const YT_PER_YEAR = 2;
export const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));

// ───────────────────────── 📸 IG ─────────────────────────

export const IG_POSTS = [
  { id: "selfie", emoji: "🤳", name: "เซลฟี่", stat: "cha" as const, text: "รูปเซลฟี่มุมเดิมที่ถ่ายไปสามสิบช็อต" },
  { id: "food", emoji: "🍜", name: "รูปอาหาร", stat: "luk" as const, text: "รูปอาหารร้านลับที่เพิ่งไปมา" },
  { id: "workout", emoji: "🏋️", name: "รูปออกกำลังกาย", stat: "str" as const, text: "รูปหลังออกกำลังกาย เหงื่อเปียกเสื้อ" },
  { id: "travel", emoji: "🏝️", name: "รูปเที่ยว", stat: "cha" as const, text: "รูปทะเลสีฟ้าที่เพิ่งไปเที่ยวมา", need: (l: Life) => l.doneThisYear.includes("act:trip") || l.doneThisYear.includes("act:hunter_rest"), why: "ต้องไปเที่ยวก่อนในปีนี้" },
  { id: "couple", emoji: "💑", name: "รูปคู่", stat: "cha" as const, text: "รูปคู่กับแฟน", need: (l: Life) => people(l, "partner").length + people(l, "spouse").length > 0, why: "ต้องมีแฟนก่อน" },
];

export function igPost(l: Life, id: string): Outcome | undefined {
  const p = IG_POSTS.find((x) => x.id === id);
  if (!p || !hasPhone(l) || used(l, "ig") >= IG_PER_YEAR || (p.need && !p.need(l))) return;
  l.doneThisYear.push("ig");
  const ph = phoneOf(l);
  ph.igPosts++;
  const base = 8 + effSys(l, p.stat) * 1.2 + Math.max(0, l.fame) * 4 + Math.sqrt(ph.ig) * 2;
  let gain = Math.round(base * (0.5 + randInt(l, 0, 100) / 100));
  const viral = chance(l, 0.04 + l.stats.luck / 2000);
  if (viral) gain *= 12;
  if (p.id === "couple") for (const x of [...people(l, "partner"), ...people(l, "spouse")]) x.bond = clamp(x.bond + 4, 0, 100);
  ph.ig += gain;
  if (viral) addFame(l, 3);
  addStat(l, "happiness", 2);
  const out = { text: `📸 โพสต์${p.text} — ${viral ? "🔥 ไวรัล! " : ""}ผู้ติดตาม +${fmt(gain)} (รวม ${fmt(ph.ig)})`, kind: (viral ? "good" : "normal") as Outcome["kind"] };
  log(l, out.text, out.kind);
  return out;
}

// ───────────────────────── ▶️ YouTube ─────────────────────────

export const YT_GENRES = [
  { id: "vlog", emoji: "🎒", name: "Vlog ชีวิตประจำวัน", stat: "cha" as const },
  { id: "game", emoji: "🎮", name: "เล่นเกม", stat: "agi" as const },
  { id: "cook", emoji: "🍳", name: "ทำอาหาร", stat: "int" as const },
  { id: "dance", emoji: "💃", name: "เต้น/คัฟเวอร์เพลง", stat: "cha" as const },
  { id: "learn", emoji: "📚", name: "ติวหนังสือ/ความรู้", stat: "int" as const },
  { id: "special", emoji: "🌀", name: "คลิปพิเศษของโลกนี้", stat: "luk" as const },
];

/** คลิปพิเศษตามโลก (ต้องมีพลัง/ระบบ) */
export function specialGenre(l: Life): string | undefined {
  if (l.worldId === "hunter" && l.power) return "Vlog บุก Gate แบบ POV";
  if (l.worldId === "tower" && l.power) return "ไฮไลต์การปีนหอคอยของฉัน";
  if (l.worldId === "ordinary" && l.sys) return "ท้าทายร่างกาย 30 วัน (ระบบช่วยแอบๆ)";
  if (l.worldId === "apocalypse" && !l.flags.doomed) return "เตรียมตัวรับวันสิ้นโลก (คนดูหัวเราะ)";
  return;
}

export function ytUpload(l: Life, id: string): Outcome | undefined {
  const g = YT_GENRES.find((x) => x.id === id);
  if (!g || !hasPhone(l) || used(l, "yt") >= YT_PER_YEAR) return;
  const special = g.id === "special" ? specialGenre(l) : undefined;
  if (g.id === "special" && !special) return;
  l.doneThisYear.push("yt");
  const ph = phoneOf(l);
  ph.ytVideos++;
  const stat = effSys(l, g.stat) + (special ? 25 : 0);
  let views = Math.round((300 + ph.yt * 1.5 + stat * 40 + Math.max(0, l.fame) * 300) * (0.4 + randInt(l, 0, 120) / 100));
  const viral = chance(l, 0.05 + (special ? 0.05 : 0));
  if (viral) views *= 15;
  const subs = Math.round(views * (0.015 + randInt(l, 0, 15) / 1000));
  ph.yt += subs;
  ph.ytViews += views;
  const pay = ph.yt >= 1000 ? Math.round(views * 0.04) : 0;
  if (pay) addMoney(l, pay);
  if (viral) addFame(l, 4);
  if (g.id === "learn") addStat(l, "smarts", 1);
  const out = {
    text: `▶️ อัปคลิป "${special ?? g.name}" — ${viral ? "🔥 ติดเทรนด์! " : ""}${fmt(views)} วิว · ซับ +${fmt(subs)} (รวม ${fmt(ph.yt)})${pay ? ` · รายได้ ${money(l, pay)}` : ph.yt < 1000 ? " · ยังไม่ถึงเกณฑ์สร้างรายได้ (1K ซับ)" : ""}`,
    kind: (viral ? "good" : "normal") as Outcome["kind"],
  };
  log(l, out.text, out.kind);
  return out;
}

/** ไลฟ์สด — สำหรับสตรีมเมอร์ */
export function ytLive(l: Life): Outcome | undefined {
  if (!hasPhone(l) || l.doneThisYear.includes("live") || phoneOf(l).yt < 100) return;
  l.doneThisYear.push("live");
  const ph = phoneOf(l);
  const donate = Math.round(ph.yt * (0.2 + randInt(l, 0, 60) / 100) * (l.job?.careerId === "streamer" ? 2 : 1));
  addMoney(l, donate);
  ph.yt += Math.round(ph.yt * 0.03);
  addStat(l, "happiness", 3);
  addStat(l, "health", -1);
  const out = { text: `🔴 ไลฟ์สดยาวหกชั่วโมง คนดูส่งโดเนทรวม ${money(l, donate)}`, kind: "good" as const };
  log(l, out.text, out.kind);
  return out;
}

// ───────────────────────── 💘 แอปหาคู่ ─────────────────────────

export const canSwipe = (l: Life) => hasPhone(l) && l.age >= 18 && !l.doneThisYear.includes("swipe") && !people(l, "partner").length && !people(l, "spouse").length;

const JOBS = ["พนักงานออฟฟิศ", "นักศึกษาปริญญาโท", "พยาบาล", "เชฟ", "โปรแกรมเมอร์", "ครู", "นักดนตรี", "เจ้าของคาเฟ่", "ช่างภาพ", "สตรีมเมอร์"];
const BIOS = ["ชอบแมวมากกว่าคน", "หาคนไปกินหมูกระทะด้วย", "ออกกำลังกายทุกเช้า ใครตื่นไม่ไหวปัดซ้าย", "เบื่อแอปนี้แล้ว ขอเจอคนจริงใจสักคน", "ดูซีรีส์เกาหลีจบทุกเรื่อง", "ทำอาหารเก่ง ล้างจานไม่เก่ง"];

export function startSwipe(l: Life) {
  if (!canSwipe(l)) return;
  l.doneThisYear.push("swipe");
  const ctx: Record<string, string | number> = {};
  for (let i = 0; i < 3; i++) {
    const g = l.gender === "m" ? "f" : "m";
    const n = randomName(l, g);
    ctx[`n${i}`] = l.worldId === "hunter" || l.country === "th" || !l.country ? n.nick : n.first;
    ctx[`a${i}`] = clamp(l.age + randInt(l, -5, 6), 18, 80);
    ctx[`j${i}`] = pick(l, JOBS);
    ctx[`b${i}`] = pick(l, BIOS);
    ctx[`d${i}`] = randInt(l, 40, 75);
  }
  runEvent(l, "phone.dating", ctx);
}

export const DATING_APP: GameEvent = {
  id: "phone.dating",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "💘 แอปหาคู่",
  text: () => "คุณปัดซ้ายไปห้าสิบคน แล้วเหลือสามโปรไฟล์ที่ทำให้หยุดนิ้ว — จะทักใครดี?",
  choices: [
    ...[0, 1, 2].map((i) => ({
      label: (_l: Life, c: Record<string, string | number | boolean>) => `${c[`n${i}`]}, ${c[`a${i}`]} · ${c[`j${i}`]} — "${c[`b${i}`]}"`,
      odds: (l: Life, c: Record<string, string | number | boolean>) => checkChance(l, "looks", Number(c[`d${i}`]), Math.max(0, effSys(l, "cha") - 30) / 150),
      skill: ["social"],
      run: (l: Life, c: Record<string, string | number | boolean>, ok: boolean): Outcome => {
        if (!ok) return { text: `${c[`n${i}`]}อ่านแล้วไม่ตอบ… ปีหน้าค่อยลองใหม่`, kind: "bad" };
        const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: Number(c[`a${i}`]), bond: 55, job: String(c[`j${i}`]) });
        p.name = String(c[`n${i}`]);
        addStat(l, "happiness", 8);
        return { text: `💘 แมตช์! เดตแรงกับ${shortName(p)}ที่คาเฟ่ คุยกันจนร้านปิด — ตอนนี้คุณมีแฟนแล้ว`, kind: "good" };
      },
    })),
    { label: "ลบแอปทิ้ง", run: () => ({ text: "คุณลบแอปแล้วไปนอน ความรักคงไม่ได้มาจากการปัดนิ้ว" }) },
  ],
};

// ───────────────────────── 📈 หุ้น ─────────────────────────

export function invest(l: Life, frac: number): Outcome | undefined {
  if (!hasPhone(l) || l.money <= 0) return;
  const amt = Math.round(l.money * frac);
  if (amt <= 0) return;
  addMoney(l, -amt);
  phoneOf(l).portfolio += amt;
  return { text: `📈 ซื้อหุ้นเพิ่ม ${money(l, amt)} (พอร์ตรวม ${money(l, phoneOf(l).portfolio)})` };
}

export function sellAll(l: Life): Outcome | undefined {
  const ph = phoneOf(l);
  if (ph.portfolio <= 0) return;
  const v = ph.portfolio;
  ph.portfolio = 0;
  addMoney(l, v);
  const out = { text: `📉 ขายหุ้นทั้งหมด ได้เงินคืน ${money(l, v)}` };
  log(l, out.text);
  return out;
}

// ───────────────────────── 💬 แชต ─────────────────────────

export const CHAT_LINES = ["ส่งมีมตลกไปให้", "ทักไปถามว่ากินข้าวยัง", "ส่งสติกเกอร์หมีกอด", "คุยเรื่องเก่าๆ จนดึก", "ส่งรูปแมวที่เจอข้างทางไปให้"];

export function chat(l: Life, personId: string): Outcome | undefined {
  const p = l.people.find((x) => x.id === personId && x.alive);
  if (!p || !hasPhone(l) || l.doneThisYear.includes(`chat:${p.id}`)) return;
  l.doneThisYear.push(`chat:${p.id}`);
  p.bond = clamp(p.bond + randInt(l, 2, 6), 0, 100);
  const line = pick(l, CHAT_LINES);
  return { text: `💬 ${line}ให้${shortName(p)} — ${shortName(p)}ตอบกลับมาเป็นสติกเกอร์หัวเราะ` };
}

// ───────────────────────── ทุกปี ─────────────────────────

yearHooks.push((l) => {
  const ph = l.phone;
  if (!ph) return;
  // หุ้น: ตลาดขึ้นลงทุกปี
  if (ph.portfolio > 0) {
    const r = (randInt(l, -25, 35) + (chance(l, 0.08) ? -30 : 0)) / 100;
    const delta = Math.round(ph.portfolio * r);
    ph.portfolio = Math.max(0, ph.portfolio + delta);
    l.flags.lastReturn = Math.round(r * 100);
    if (Math.abs(r) >= 0.2) log(l, `📈 ตลาดหุ้นปีนี้${r > 0 ? "พุ่ง" : "ร่วง"} ${Math.round(r * 100)}% — พอร์ตคุณ${delta > 0 ? "กำไร" : "ขาดทุน"} ${money(l, Math.abs(delta))}`, r > 0 ? "good" : "bad");
  }
  // ผู้ติดตามที่ไม่โพสต์ก็ค่อยๆ หาย · คนดังได้งานรีวิวสินค้า
  ph.ig = Math.round(ph.ig * 0.95);
  if (ph.ig >= 10_000) addMoney(l, Math.round(ph.ig * 2));
  // คลิปเก่ายังมีคนดู
  if (ph.yt >= 1000 && ph.ytVideos > 0) {
    const back = Math.round(ph.ytViews * 0.05);
    ph.ytViews += back;
    addMoney(l, Math.round(back * 0.04));
  }
});

export const PHONE_EVENTS: GameEvent[] = [DATING_APP];
