// Phase 3 — การต่อสู้เป็นฉากสั้น 1–4 ยก (MURIM_PLAN §16)
// ทุกยกเลือก: บุกเต็มแรง · ตั้งรับหาจังหวะ · ท่าไม้ตาย · อาวุธลับ/พิษ · หนี · ยอมแพ้ — แต่ละทางมีโอกาสจริงและผลต่างกัน
// เสียเลือดจริง (สุขภาพ) และมีโอกาสเสียอวัยวะ · คู่ต่อสู้ที่รอดจะจำและเตรียมตัวมาใหม่
import { injure, woundFrom } from "../../../engine/body";
import type { Choice, Ctx, GameEvent, Outcome, Scene } from "../../../engine/events";
import { kill, runEvent } from "../../../engine/game";
import { feel, hasTrait, remember } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addStat, clamp, shortName } from "../../../engine/util";
import { combatPower, gatePower } from "../../hunter/power";

export type DuelResult = "win" | "lose" | "fled" | "draw" | "yield" | "dead";

export interface DuelOpts {
  /** ชื่อคู่ต่อสู้ */
  foe: string;
  /** ระดับฝีมือคู่ต่อสู้ (ขั้นเดียวกับผู้เล่น 0–8) */
  rank: number;
  /** สู้ถึงตาย (แพ้ = อาจตาย) */
  lethal?: boolean;
  /** NPC ที่เกี่ยวข้อง (จำผลการต่อสู้) */
  pid?: string;
  /** เรียกเมื่อจบ — key ใน DUEL_END */
  on?: string;
  /** คู่ต่อสู้โหดเหี้ยม (ยอมแพ้ก็อาจไม่รอด) */
  cruel?: boolean;
  /** ข้อมูลเพิ่มให้ตัวจบเรื่อง */
  extra?: Record<string, string | number | boolean>;
}

/** ตัวจบเรื่องหลังการต่อสู้ — คืนข้อความเพิ่มเติม */
export const DUEL_END: Record<string, (l: Life, r: DuelResult, c: Ctx) => string> = {};

const ROUNDS = 4;

/** พลังต่อสู้ของผู้เล่น — คนที่ยังไม่มีวิชาใช้ร่างกายกับประสบการณ์ข้างถนน */
export function myPower(l: Life): number {
  if (l.power) return combatPower(l);
  return Math.round((l.stats.health * 0.12 + Math.min(10, Number(l.flags.mwBasics ?? 0)) * 0.8 + 2) * (l.body ? 1 : 1));
}

function foePower(c: Ctx): number {
  return gatePower(Number(c.fr)) + Number(c.adapt ?? 0) - (c.foePoison ? 6 : 0);
}

export const duelOdds = (l: Life, c: Ctx, mod = 0) => clamp(0.5 + (myPower(l) - foePower(c)) / 40 + mod, 0.05, 0.95);
/** ศัตรูแข็งกว่า → โดนแรงกว่า */
const hitScale = (l: Life, c: Ctx) => clamp(1 + (foePower(c) - myPower(l)) / 30, 0.5, 2.5);

export function startDuel(l: Life, o: DuelOpts) {
  const p = o.pid ? l.people.find((x) => x.id === o.pid) : undefined;
  // เคยสู้กันแล้ว = รู้ฝีมือกันและกัน
  const known = !!p?.mem?.some((m) => m.k.startsWith("duel_"));
  const ctx: Ctx = { foe: o.foe, fr: o.rank, fhp: 100, round: 1, lethal: !!o.lethal, known, cruel: !!o.cruel, on: o.on ?? "", pid: o.pid ?? "", adapt: p?.tags?.includes("studied") ? 8 : 0 };
  for (const [k, v] of Object.entries(o.extra ?? {})) ctx[`x_${k}`] = v;
  runEvent(l, "duel", ctx);
}

const bar = (n: number) => "▰".repeat(Math.max(0, Math.round(n / 20))) + "▱".repeat(5 - Math.max(0, Math.round(n / 20)));

function sceneText(l: Life, c: Ctx): string {
  const r = Number(c.round);
  const open = r === 1 ? `${c.foe}${c.lethal ? "ชักอาวุธออกมาเต็มเล่ม แววตาบอกว่าวันนี้ต้องมีคนตาย" : "ตั้งท่ารอ"}` : pick(l, [`${c.foe}ถอยไปสองก้าว หอบหายใจ แล้วพุ่งเข้ามาอีกครั้ง`, `ฝุ่นตลบ ทั้งสองฝ่ายวนรอบกันช้าๆ`, `เลือดหยดลงพื้น ไม่มีใครยอมใคร`]);
  return `ยกที่ ${r}: ${open}\nคุณ ${bar(l.stats.health)} ${l.stats.health} · ${c.foe} ${bar(Number(c.fhp))} ${c.known ? Number(c.fhp) : "?"}`;
}

/** จบการต่อสู้ — บันทึกความทรงจำ ปรับชื่อเสียง แล้วส่งต่อให้ผู้เรียก */
function finish(l: Life, c: Ctx, r: DuelResult, text: string): Outcome {
  const p = c.pid ? l.people.find((x) => x.id === c.pid) : undefined;
  if (p && p.alive) {
    if (r === "win") { remember(l, p, "duel_lost", "แพ้คุณในการประลอง", 2, { respect: 10, grudge: hasTrait(p, "vengeful") || hasTrait(p, "hotheaded") ? 15 : 3, fear: 8 }); (p.tags ??= []).includes("studied") || p.tags.push("studied"); }
    else if (r === "lose" || r === "yield") remember(l, p, "duel_won", "เคยเอาชนะคุณ", 2, { respect: -5, jealousy: -10 });
    else remember(l, p, "duel_draw", "เคยสู้กับคุณสูสี", 1, { respect: 6 });
  }
  if (r === "win") addFame(l, c.lethal ? 3 : 1);
  const extra = c.on && DUEL_END[String(c.on)] ? DUEL_END[String(c.on)](l, r, c) : "";
  return { text: text + (extra ? ` ${extra}` : ""), kind: r === "win" ? "good" : r === "dead" ? "bad" : r === "lose" || r === "yield" ? "bad" : "normal" };
}

/** คุณเสียเลือด — ตายได้ถ้าเป็นการสู้ถึงตาย */
function takeHit(l: Life, c: Ctx, min: number, max: number): { text: string; dead: boolean } {
  const d = Math.round(randInt(l, min, max) * hitScale(l, c));
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    if (c.lethal) { kill(l, `ถูก${c.foe}สังหารในการต่อสู้`); return { text: ` คุณเสียเลือด ${d} — ล้มลงไม่ลุกขึ้นอีก`, dead: true }; }
    l.stats.health = 3;
  }
  return { text: ` (คุณเสียเลือด ${d})${woundFrom(l, d, `จากการต่อสู้กับ${c.foe}`)}`, dead: false };
}

function hitFoe(c: Ctx, d: number) {
  c.fhp = Math.max(0, Number(c.fhp) - d);
}

/** หลังแต่ละยก: ไปยกต่อไป หรือจบ */
function after(l: Life, c: Ctx, text: string): Outcome {
  if (!l.alive) return { text, kind: "bad" };
  if (c.foePoison) hitFoe(c, 8);
  if (Number(c.fhp) <= 0) {
    if (c.lethal) return { text: `${text} ${c.foe}ทรุดลงคุกเข่า ไม่มีแรงจับอาวุธอีกแล้ว`, next: "victory" };
    return finish(l, c, "win", `${text} ${c.foe}ล้มลงยอมรับความพ่ายแพ้`);
  }
  if (Number(c.round) >= ROUNDS) return finish(l, c, "draw", `${text} ฟ้ามืดลง ต่างฝ่ายต่างหมดแรง — จบลงโดยไม่มีใครแพ้ใครชนะ`);
  c.round = Number(c.round) + 1;
  return { text, next: `r${c.round}` };
}

const hasHidden = (l: Life) => !!l.power && ["m_hidden", "m_poison"].includes(l.power.hunterClass) || !!l.flags.hiddenWeapons;

function roundChoices(): Choice[] {
  return [
    {
      label: "บุกเต็มกำลัง",
      tone: "danger",
      pros: "ถ้าเข้าเป้า ศัตรูเจ็บหนัก",
      cons: "พลาดแล้วโดนสวนแรง เสี่ยงเสียอวัยวะ",
      odds: (l, c) => duelOdds(l, c),
      unknown: (_l, c) => !c.known,
      survival: (l, c) => (c.lethal ? clamp(0.55 + duelOdds(l, c) * 0.45, 0.2, 0.99) : 1),
      run: (l, c, ok) => {
        if (ok) { const great = chance(l, 0.3); hitFoe(c, great ? randInt(l, 55, 70) : randInt(l, 30, 45)); return after(l, c, great ? "กระบี่ของคุณเร็วกว่าที่ตาจะตามทัน — เข้าเป้าเต็มๆ!" : "คุณฟันเข้าไหล่ศัตรูเต็มแรง"); }
        const h = takeHit(l, c, 12, 24);
        return h.dead ? { text: `คุณพุ่งเข้าไปผิดจังหวะ${h.text}`, kind: "bad" } : after(l, c, `คุณพุ่งเข้าไปผิดจังหวะ ถูกสวนกลับ${h.text}`);
      },
    },
    {
      label: "ตั้งรับ หาจังหวะสวน",
      pros: "ปลอดภัยกว่า",
      cons: "ทำร้ายศัตรูได้น้อย ยืดเวลา",
      odds: (l, c) => duelOdds(l, c, 0.2),
      unknown: (_l, c) => !c.known,
      run: (l, c, ok) => {
        if (ok) { hitFoe(c, randInt(l, 12, 22)); c.known = true; return after(l, c, "คุณปัดอาวุธศัตรูออกแล้วสวนกลับหนึ่งจังหวะ — และเริ่มอ่านท่าของเขาออก"); }
        const h = takeHit(l, c, 5, 12);
        return h.dead ? { text: `แนวรับของคุณพังลง${h.text}`, kind: "bad" } : after(l, c, `แนวรับของคุณสั่นคลอน${h.text}`);
      },
    },
    {
      label: "ใช้ท่าไม้ตาย",
      tone: "special",
      pros: "รุนแรงที่สุด",
      cons: "ใช้ลมปราณ (สุขภาพ -6) พลาดแล้วเปิดช่องโหว่ใหญ่",
      req: (l) => (!l.power ? "ยังไม่มีวิชาลมปราณ" : l.stats.health < 25 ? "ลมปราณไม่พอ (สุขภาพต่ำเกินไป)" : undefined),
      odds: (l, c) => duelOdds(l, c, -0.05),
      unknown: (_l, c) => !c.known,
      run: (l, c, ok) => {
        addStat(l, "health", -6);
        if (ok) { hitFoe(c, randInt(l, 50, 75)); return after(l, c, "ลมปราณทั้งหมดในตันเถียนพุ่งออกทางปลายกระบี่ — อากาศรอบตัวสั่นสะเทือน!"); }
        const h = takeHit(l, c, 15, 26);
        return h.dead ? { text: `ท่าไม้ตายถูกสลาย${h.text}`, kind: "bad" } : after(l, c, `ศัตรูหลบท่าไม้ตายได้ แล้วซ้ำเข้าช่องโหว่${h.text}`);
      },
    },
    {
      label: "ซัดอาวุธลับ / พิษ",
      pros: "แม่นยำ ศัตรูเสียเลือดต่อเนื่อง",
      cons: "ฝ่ายธรรมะดูถูก (ชื่อเสียง −2)",
      req: (l) => (hasHidden(l) ? undefined : "ไม่มีวิชาอาวุธลับหรือพิษ"),
      odds: (l, c) => duelOdds(l, c, 0.12),
      unknown: (_l, c) => !c.known,
      run: (l, c, ok) => {
        addFame(l, -2);
        if (ok) { hitFoe(c, randInt(l, 20, 32)); c.foePoison = true; return after(l, c, "เข็มพิษสามเล่มปักเข้าคอศัตรู — ใบหน้าเขาเริ่มเขียวคล้ำ"); }
        const h = takeHit(l, c, 8, 16);
        return h.dead ? { text: `ศัตรูปัดอาวุธลับกลับมา${h.text}`, kind: "bad" } : after(l, c, `อาวุธลับพลาดเป้า${h.text}`);
      },
    },
    {
      label: "ถอยหนี",
      pros: "รักษาชีวิตไว้",
      cons: "เสียหน้า (ชื่อเสียง −1)",
      odds: (l, c) => clamp(0.4 + (myPower(l) - foePower(c)) / 80 + (l.power?.hunterClass === "m_light" ? 0.2 : 0) - (l.body?.injuries.some((i) => i.part.startsWith("leg") && i.sev >= 2) ? 0.25 : 0), 0.1, 0.9),
      run: (l, c, ok) => {
        if (ok) { addFame(l, -1); return finish(l, c, "fled", "คุณกระโดดข้ามกำแพงหายไปในความมืด — รอดมาได้ แต่คนพูดถึงเรื่องนี้ไปอีกนาน"); }
        const h = takeHit(l, c, 10, 20);
        return h.dead ? { text: `คุณหนีไม่พ้น${h.text}`, kind: "bad" } : after(l, c, `ศัตรูตามทันแล้วฟันเข้าที่หลัง${h.text}`);
      },
    },
    {
      label: "ยอมแพ้ / ขอชีวิต",
      pros: "จบการต่อสู้ทันที",
      cons: (_l, c) => (c.cruel ? "ศัตรูคนนี้โหดเหี้ยม — อาจไม่ไว้ชีวิต" : "เสียหน้า ชื่อเสียงลด"),
      run: (l, c) => {
        addFame(l, -3);
        if (c.lethal && c.cruel && chance(l, 0.35)) { kill(l, `ถูก${c.foe}ฆ่าทั้งที่คุกเข่าขอชีวิต`); return { text: `${c.foe}หัวเราะเย็นชา แล้วตวัดอาวุธลงมา…`, kind: "bad" }; }
        if (c.lethal && c.cruel && chance(l, 0.4)) {
          const [part, kind] = pick(l, [["handR", "fingers"], ["eyeL", "blind"], ["face", "scar"]] as const);
          const s = injure(l, part, kind, 3, `${c.foe}ทิ้งไว้เป็นเครื่องเตือนใจ`);
          return finish(l, c, "yield", `${c.foe}ไว้ชีวิตคุณ — แต่ทิ้งของที่ระลึกไว้${s}`);
        }
        return finish(l, c, "yield", `${c.foe}เก็บอาวุธ "ไปซะ" — คุณเดินจากมาโดยไม่หันหลังกลับ`);
      },
    },
  ];
}

const roundScene = (): Scene => ({ title: "ต่อสู้", text: sceneText, choices: roundChoices() });

export const DUEL_EVENT: GameEvent = {
  id: "duel",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ต่อสู้",
  text: sceneText,
  choices: [
    {
      label: "สังเกตท่าทีก่อนลงมือ",
      pros: "รู้ฝีมือศัตรู — เห็นโอกาสชัดขึ้น",
      cons: "อาจโดนจู่โจมก่อน",
      show: (_l, c) => !c.known,
      run: (l, c) => {
        c.known = true;
        if (chance(l, 0.3)) { const h = takeHit(l, c, 4, 10); if (h.dead) return { text: `คุณมัวแต่สังเกต${h.text}`, kind: "bad" }; return { text: `คุณอ่านท่าของ${c.foe}ออก แต่ระหว่างนั้นก็โดนไปหนึ่งที${h.text}`, next: "r1" }; }
        return { text: `คุณมองการวางเท้าและการหายใจของ${c.foe} — รู้แล้วว่าเขาเก่งแค่ไหน`, next: "r1" };
      },
    },
    ...roundChoices(),
  ],
  scenes: {
    r1: roundScene(),
    r2: roundScene(),
    r3: roundScene(),
    r4: roundScene(),
    victory: {
      title: "ชะตาอยู่ในมือคุณ",
      text: (_l, c) => `${c.foe}คุกเข่าอยู่ตรงหน้า เลือดไหลจากมุมปาก "จะฆ่าก็ฆ่าเลย"`,
      choices: [
        { label: "ปลิดชีพ", tone: "danger", pros: "ตัดปัญหาถาวร", cons: "ครอบครัว/ศิษย์ของเขาอาจตามล้างแค้นในอนาคต", run: (l, c) => { const p = c.pid ? l.people.find((x) => x.id === c.pid) : undefined; if (p) p.alive = false; l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1; l.flags.mwKillAge = l.age; return finish(l, c, "win", `คุณจบชีวิต${c.foe}ด้วยดาบเดียว — ลมหนาวพัดผ่านลานว่างเปล่า`); } },
        { label: "ไว้ชีวิต", pros: "อาจได้บุญคุณหรือความนับถือ", cons: "เขาอาจกลับมาแข็งแกร่งกว่าเดิม", run: (l, c) => { const p = c.pid ? l.people.find((x) => x.id === c.pid) : undefined; if (p) remember(l, p, "spared", "ถูกไว้ชีวิต", 3, hasTrait(p, "vengeful") ? { grudge: 20, fear: 20 } : { debt: 50, respect: 15 }); return finish(l, c, "win", `คุณเก็บกระบี่ "ไปเสีย" — ${c.foe}มองคุณด้วยแววตาที่อ่านไม่ออก`); } },
        { label: "ทำลายวิชา (ทำลายตันเถียน)", tone: "danger", pros: "เขาจะไม่มีวันเป็นภัยอีก", cons: "โหดเหี้ยม — ความแค้นลึกที่สุด ชื่อเสียงฝ่ายธรรมะเสีย", run: (l, c) => { const p = c.pid ? l.people.find((x) => x.id === c.pid) : undefined; if (p) { remember(l, p, "crippled", "ถูกทำลายวิชาจนพิการ", 3, { grudge: 90, fear: 60 }); feel(p, { love: -50 }); p.tags = [...(p.tags ?? []), "crippled"]; } addFame(l, -4); return finish(l, c, "win", `นิ้วของคุณกดลงกลางท้องน้อยของ${c.foe} — เสียงร้องของเขาดังก้องไปทั้งหุบเขา`); } },
      ],
    },
  },
};

// ───────────────────────── ฉากต่อสู้ในชีวิตประจำวัน ─────────────────────────

const RANK_NEAR = (l: Life, d: number) => clamp((l.power?.rank ?? 0) + d, 0, 8);

DUEL_END.bandit = (l, r) => {
  if (r === "win") { const loot = randInt(l, 5, 30) * 1000; l.money += loot; return `ค้นตัวโจรได้เงิน ${Math.round(loot / 1000)} ตำลึง`; }
  if (r === "lose" || r === "yield") { const lost = Math.round(Math.max(0, l.money) * 0.25); l.money -= lost; return lost ? `โจรขนเงินคุณไป ${Math.round(lost / 1000)} ตำลึง` : "ในตัวคุณไม่มีอะไรให้ปล้น โจรถ่มน้ำลายใส่แล้วจากไป"; }
  return "";
};
DUEL_END.brawl = (l, r) => (r === "win" ? (addStat(l, "happiness", 4), "ทั้งโรงเตี๊ยมโห่ร้อง เถ้าแก่เลี้ยงเหล้าฟรีหนึ่งไห") : r === "lose" ? "คุณถูกโยนออกนอกโรงเตี๊ยมพร้อมม้านั่ง" : "");
DUEL_END.youngmaster = (l, r) => (r === "win" ? (addFame(l, 4), "ข่าวว่านายน้อยตระกูลใหญ่แพ้คนไร้ชื่อแพร่ไปทั้งเมือง — ตระกูลของเขาจะไม่ลืมเรื่องนี้") : r === "lose" || r === "yield" ? (addStat(l, "happiness", -6), "นายน้อยเหยียบมือคุณกับพื้น 'จำที่ทางของเจ้าไว้'") : "");

export const DUEL_LIFE_EVENTS: GameEvent[] = [
  {
    id: "duel.bandit",
    minAge: 14,
    maxAge: 75,
    weight: (l) => (l.mw?.era === "chaos" ? 10 : l.mw?.era === "decline" ? 6 : 3),
    maxTimes: 0,
    title: "โจรดักปล้น",
    text: (l) => `ระหว่างทางผ่านป่าไผ่ ${pick(l, ["โจรสามคน", "ชายฉกรรจ์สวมผ้าคลุมหน้าห้าคน", "อดีตทหารหนีทัพสองคน"])}กระโดดออกมาขวางทาง "ทิ้งของมีค่าไว้ แล้วไปซะ"`,
    choices: [
      { label: "สู้!", tone: "danger", pros: "ได้ของโจรคืน ชื่อเสียง +", cons: "อาจบาดเจ็บหนักหรือเสียอวัยวะ", run: (l) => { startDuel(l, { foe: "หัวหน้าโจร", rank: RANK_NEAR(l, chance(l, 0.5) ? 0 : -1), lethal: true, cruel: true, on: "bandit" }); return { text: "คุณตั้งท่า หัวหน้าโจรแสยะยิ้มแล้วชักดาบ" }; } },
      { label: "ยอมทิ้งเงิน", pros: "ปลอดภัย", cons: "เสียเงินหนึ่งในสี่", run: (l) => { const lost = Math.round(Math.max(0, l.money) * 0.25); l.money -= lost; return { text: lost ? `คุณโยนถุงเงินให้ (${Math.round(lost / 1000)} ตำลึง) โจรหัวเราะแล้วหายเข้าป่า` : "คุณเปิดถุงให้ดู — ว่างเปล่า โจรถีบคุณล้มแล้วจากไป" }; } },
      { label: "เจรจาด้วยปากคำ", check: { stat: "smarts", dc: 60 }, pros: "ไม่เสียอะไรเลยถ้าสำเร็จ", cons: "ล้มเหลว = โจรโมโห", run: (l, _c, ok) => { if (ok) return { text: "คุณเล่าว่าเป็นญาติของหัวหน้าโจรภูเขาฝั่งเหนือ พวกมันมองหน้ากันแล้วรีบหลีกทาง", kind: "good" }; startDuel(l, { foe: "หัวหน้าโจร", rank: RANK_NEAR(l, 0), lethal: true, cruel: true, on: "bandit" }); return { text: "\"ปากดีนักนะ!\" — มันพุ่งเข้ามา" }; } },
    ],
  },
  {
    id: "duel.brawl",
    minAge: 16,
    maxAge: 60,
    weight: 4,
    maxTimes: 3,
    title: "ตีกันในโรงเตี๊ยม",
    text: (l) => `ชายเมาตัวโตเหยียบเท้าคุณแล้วหาว่าคุณเหยียบเขาก่อน ทั้งโรงเตี๊ยมเงียบ รอดูว่า${l.gender === "m" ? "พ่อหนุ่ม" : "แม่นาง"}จะทำยังไง`,
    choices: [
      { label: "ซัดกันสักยก", pros: "สะใจ ความสุข +", cons: "อาจเจ็บตัว", run: (l) => { startDuel(l, { foe: "ชายเมาตัวโต", rank: RANK_NEAR(l, -1), on: "brawl" }); return { text: "คุณม้วนแขนเสื้อขึ้น" }; } },
      { label: "ขอโทษแล้วเลี้ยงเหล้า", pros: "จบสวย อาจได้เพื่อน", cons: "เสียเงินนิดหน่อย", run: (l) => { l.money -= 1000; return { text: "สามไหต่อมา เขากอดคอคุณร้องเพลงบ้านเกิดเสียงดังลั่น" }; } },
    ],
  },
  {
    id: "duel.youngmaster",
    minAge: 15,
    maxAge: 45,
    weight: (l) => (l.power ? 5 : 2),
    maxTimes: 2,
    title: "นายน้อยผู้ยโส",
    text: (l) => `นายน้อยตระกูล${pick(l, ["เหยียน", "หลู่", "ซือหม่า", "ฮว่างฝู่"])}เตะโต๊ะของคุณล้มกลางร้านน้ำชา "คนชั้นต่ำอย่างเจ้า ไม่ควรนั่งโต๊ะริมหน้าต่าง"`,
    choices: [
      { label: "ท้าประลองต่อหน้าทุกคน", tone: "danger", pros: "ชนะ = ชื่อเสียงพุ่ง", cons: "แพ้ = อับอายทั้งเมือง และตระกูลเขาจะจำหน้าคุณ", run: (l) => { startDuel(l, { foe: "นายน้อยผู้ยโส", rank: RANK_NEAR(l, randInt(l, 0, 1)), on: "youngmaster" }); return { text: "คุณลุกขึ้นช้าๆ \"งั้นข้าขอชี้แนะสักกระบวน\"" }; } },
      { label: "อดทน ลุกไปนั่งที่อื่น", pros: "ไม่มีเรื่อง", cons: "ความสุข −", run: (l) => { addStat(l, "happiness", -5); l.flags.grudge = true; return { text: "คุณกลืนความโกรธลงคอ — สามปีนักปราชญ์แก้แค้นไม่สาย" }; } },
    ],
  },
];

export const DUEL_EVENTS: GameEvent[] = [DUEL_EVENT, ...DUEL_LIFE_EVENTS];

/** ใช้ชื่อ NPC เป็นคู่ต่อสู้ */
export const foeName = (l: Life, pid: string) => { const p = l.people.find((x) => x.id === pid); return p ? shortName(p) : "ศัตรู"; };
