// Phase 2 — NPC มีความรู้สึกหลายแกน · จำสิ่งที่คุณทำ · มีบุคลิกและเป้าหมายของตัวเอง · ทำอะไรเองทุกปี (MURIM_PLAN §18.3–18.4)
// บุคลิก/เป้าหมายคำนวณจาก id ของคน (ไม่ใช้ RNG ของชีวิต) — เปิดดูหน้าจอกี่ครั้งก็ไม่เปลี่ยนผลการสุ่มของเกม
import { chance, randInt } from "./rng";
import type { Life, Person } from "./types";
import { clamp, log, money, shortName } from "./util";

export type Axis = "love" | "trust" | "respect" | "fear" | "debt" | "grudge" | "jealousy" | "loyalty";
export type RelAxes = Record<Axis, number>;

export const AXIS: Record<Axis, { name: string; emoji: string; good: boolean }> = {
  love: { name: "รัก/ชอบ", emoji: "❤️", good: true },
  trust: { name: "เชื่อใจ", emoji: "🤝", good: true },
  respect: { name: "นับถือ", emoji: "🙇", good: true },
  fear: { name: "เกรงกลัว", emoji: "😨", good: false },
  debt: { name: "ติดหนี้บุญคุณ", emoji: "🎐", good: true },
  grudge: { name: "แค้นเคือง", emoji: "🔥", good: false },
  jealousy: { name: "อิจฉา", emoji: "🐍", good: false },
  loyalty: { name: "ภักดี", emoji: "🛡️", good: true },
};

export interface NpcMemory {
  /** อายุของผู้เล่นตอนเกิดเรื่อง */
  age: number;
  /** ชนิดเรื่อง (ใช้กับเงื่อนไขของ event) */
  k: string;
  text: string;
  /** น้ำหนัก: 3 = เรื่องใหญ่ (ช่วยชีวิต ทรยศ ฆ่าคนรัก) · 2 = กลาง · 1 = เล็ก */
  w: 1 | 2 | 3;
  /** เขารู้ว่าเป็นฝีมือคุณไหม (เรื่องที่ทำลับหลังจะไม่ถูกแก้แค้นจนกว่าจะรู้) */
  known: boolean;
}

export const TRAITS: { id: string; name: string }[] = [
  { id: "filial", name: "กตัญญู" },
  { id: "vengeful", name: "เจ้าคิดเจ้าแค้น" },
  { id: "generous", name: "ใจกว้าง" },
  { id: "envious", name: "ขี้อิจฉา" },
  { id: "ambitious", name: "ทะเยอทะยาน" },
  { id: "honest", name: "ซื่อตรง" },
  { id: "cunning", name: "เจ้าเล่ห์" },
  { id: "timid", name: "ขี้ขลาด" },
  { id: "hotheaded", name: "ใจร้อน" },
  { id: "gentle", name: "อ่อนโยน" },
  { id: "greedy", name: "โลภ" },
  { id: "devoted", name: "รักครอบครัว" },
];

export const NPC_GOALS = [
  "อยากเป็นยอดฝีมือ", "อยากร่ำรวย", "อยากมีครอบครัวที่อบอุ่น", "อยากรับราชการ", "อยากเป็นหมอที่ช่วยคนได้",
  "อยากล้างแค้นให้คนที่รัก", "อยากเห็นโลกกว้าง", "อยากใช้ชีวิตสงบๆ", "อยากให้ตระกูลกลับมารุ่งเรือง", "อยากมีชื่อจารึกในทำเนียบยอดฝีมือ",
];

/** แฮชของสตริง → ตัวเลขคงที่ */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function traitsOf(p: Person): string[] {
  if (!p.traits) {
    const h = hash(p.id + p.name);
    const a = h % TRAITS.length;
    let b = (h >>> 8) % TRAITS.length;
    if (b === a) b = (b + 5) % TRAITS.length;
    p.traits = [TRAITS[a].id, TRAITS[b].id];
    if ((h >>> 16) % 3 === 0) {
      const c = (h >>> 20) % TRAITS.length;
      if (c !== a && c !== b) p.traits.push(TRAITS[c].id);
    }
  }
  return p.traits;
}

export const hasTrait = (p: Person, id: string) => traitsOf(p).includes(id);
export const traitName = (id: string) => TRAITS.find((t) => t.id === id)?.name ?? id;

export function goalOf(p: Person): string {
  p.goal ??= NPC_GOALS[(hash(p.name + p.id) >>> 4) % NPC_GOALS.length];
  return p.goal;
}

/** ค่าเริ่มต้นของความรู้สึก — คำนวณจากความสัมพันธ์และความสนิทเดิม (รองรับเซฟเก่า) */
export function relOf(p: Person): RelAxes {
  if (!p.rel) {
    const b = p.bond;
    const fam = ["father", "mother", "sibling", "child", "spouse"].includes(p.relation);
    p.rel = {
      love: clamp(fam ? b : Math.round(b * 0.8), 0, 100),
      trust: clamp(Math.round(b * (fam ? 0.9 : 0.7)), 0, 100),
      respect: p.relation === "child" ? 50 : 35,
      fear: 0,
      debt: 0,
      grudge: p.relation === "rival" ? 20 : 0,
      jealousy: p.relation === "rival" ? 40 : p.relation === "sibling" ? 15 : 0,
      loyalty: fam ? 60 : p.relation === "ally" ? 40 : 20,
    };
  }
  return p.rel;
}

/** น้ำหนักของแต่ละแกนต่อความสนิทรวม (bond เดิม) */
const BOND_W: Record<Axis, number> = { love: 0.45, trust: 0.3, loyalty: 0.15, respect: 0.1, debt: 0.05, fear: -0.05, grudge: -0.4, jealousy: -0.1 };

/** ปรับความรู้สึกโดยตรง (ไม่จดเป็นความทรงจำ) — ความสนิทรวมขยับตามส่วนต่าง */
export function feel(p: Person, d: Partial<RelAxes>) {
  const r = relOf(p);
  let db = 0;
  for (const [k, v] of Object.entries(d) as [Axis, number][]) {
    const nv = clamp(r[k] + v, 0, 100);
    db += (nv - r[k]) * BOND_W[k];
    r[k] = nv;
  }
  p.bond = clamp(Math.round(p.bond + db), 0, 100);
}

/**
 * ให้คนนี้จำสิ่งที่คุณทำ — ปรับความรู้สึกตาม d · known=false = เขายังไม่รู้ว่าเป็นคุณ (ความแค้นจะยังไม่เกิด)
 * คนเจ้าคิดเจ้าแค้นจำความแค้นหนักขึ้น · คนใจกว้างให้อภัยง่ายกว่า
 */
export function remember(l: Life, p: Person, k: string, text: string, w: 1 | 2 | 3, d: Partial<RelAxes>, known = true) {
  const scaled: Partial<RelAxes> = { ...d };
  if (scaled.grudge && scaled.grudge > 0) {
    if (!known) scaled.grudge = 0;
    else if (hasTrait(p, "vengeful")) scaled.grudge = Math.round(scaled.grudge * 1.5);
    else if (hasTrait(p, "generous")) scaled.grudge = Math.round(scaled.grudge * 0.6);
  }
  feel(p, scaled);
  const mem = (p.mem ??= []);
  mem.push({ age: l.age, k, text, w, known });
  // เก็บเรื่องสำคัญที่สุด 10 เรื่อง (น้ำหนักมากก่อน แล้วเรื่องใหม่ก่อน)
  if (mem.length > 10) {
    mem.sort((a, b) => b.w - a.w || b.age - a.age);
    mem.length = 10;
    mem.sort((a, b) => a.age - b.age);
  }
}

/** เขาเพิ่งรู้ความจริงเรื่องที่คุณทำลับหลัง */
export function reveal(p: Person, k: string, grudge: number) {
  const m = p.mem?.find((x) => x.k === k && !x.known);
  if (!m) return false;
  m.known = true;
  feel(p, { grudge: hasTrait(p, "vengeful") ? Math.round(grudge * 1.5) : grudge, trust: -grudge });
  return true;
}

export const remembers = (p: Person, k: string) => !!p.mem?.some((m) => m.k === k && m.known);

/** แกนที่ควรแสดง (ค่าเด่นๆ เท่านั้น) */
export function notableAxes(p: Person): { axis: Axis; value: number }[] {
  const r = relOf(p);
  return (Object.keys(AXIS) as Axis[])
    .filter((a) => (AXIS[a].good ? r[a] >= 55 || (a === "trust" && r[a] <= 25) : r[a] >= 30))
    .map((axis) => ({ axis, value: r[axis] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}

const FAMILY = ["father", "mother", "sibling", "spouse", "child"];

/** ทุกปี: ความรู้สึกเปลี่ยนตามเวลา และ NPC ลงมือทำตามความรู้สึก/บุคลิกของตัวเอง (เฉพาะโลกสมจริง) */
export function tickNpcs(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  const acted = new Set<string>();
  for (const p of l.people) {
    if (!p.alive) continue;
    const r = relOf(p);
    traitsOf(p);
    // ความรู้สึกจางลงตามเวลา (ความแค้นของคนเจ้าคิดเจ้าแค้นแทบไม่จาง · หนี้บุญคุณคงอยู่นาน)
    r.jealousy = clamp(r.jealousy - 2, 0, 100);
    r.fear = clamp(r.fear - 2, 0, 100);
    if (!hasTrait(p, "vengeful")) r.grudge = clamp(r.grudge - (hasTrait(p, "generous") ? 4 : 1), 0, 100);
    r.debt = clamp(r.debt - 1, 0, 100);

    // ปีละไม่เกิน 2 เรื่องที่ NPC ทำเอง — กันบันทึกรก
    if (acted.size >= 2 || p.age < 14) continue;
    const name = shortName(p);
    if (r.grudge >= 60 && chance(l, hasTrait(p, "vengeful") ? 0.18 : 0.08)) {
      acted.add(p.id);
      const loss = Math.round(Math.max(0, l.money) * 0.08);
      if (hasTrait(p, "cunning") || chance(l, 0.5)) {
        l.fame = clamp(l.fame - 3, -100, 100);
        log(l, `🐍 มีข่าวลือเสียๆ หายๆ เรื่องคุณแพร่ไปทั่วตลาด — ว่ากันว่าต้นเรื่องคือ${name}`, "bad");
      } else {
        l.money -= loss;
        log(l, `🔥 ${name}ยังไม่ลืมความแค้น — ร้านค้าที่คุณซื้อขายด้วยถูกยุให้ขึ้นราคา คุณเสียเงินไป ${money(l, loss)}`, "bad");
      }
      feel(p, { grudge: -10 });
      continue;
    }
    if (r.jealousy >= 60 && chance(l, hasTrait(p, "envious") ? 0.15 : 0.06)) {
      acted.add(p.id);
      l.stats.happiness = clamp(l.stats.happiness - 3, 0, 100);
      log(l, `${name}พูดกระทบกระเทียบคุณต่อหน้าคนอื่น — ความอิจฉาเริ่มเห็นชัดขึ้นทุกวัน`, "bad");
      continue;
    }
    if (r.debt >= 50 && r.love >= 35 && chance(l, 0.1)) {
      acted.add(p.id);
      const gift = randInt(l, 5, 30) * 1000;
      l.money += gift;
      feel(p, { debt: -20 });
      log(l, `🎐 ${name}ยังจำบุญคุณที่คุณเคยช่วย — ส่งของกับเงิน ${money(l, gift)} มาให้โดยไม่บอกล่วงหน้า`, "good");
      continue;
    }
    if ((p.relation === "father" || p.relation === "mother") && r.love >= 75 && l.age >= 16 && l.money < 50_000 && chance(l, 0.08)) {
      acted.add(p.id);
      const gift = randInt(l, 10, 40) * 1000;
      l.money += gift;
      log(l, `${name}แอบใส่เงิน ${money(l, gift)} ไว้ในห่อผ้าที่ส่งมาให้ "อย่าบอกใครนะ"`, "good");
      continue;
    }
    if (p.relation === "spouse" && r.trust < 20 && r.love < 35 && chance(l, 0.08)) {
      acted.add(p.id);
      l.people = l.people.filter((x) => x.id !== p.id);
      l.stats.happiness = clamp(l.stats.happiness - 15, 0, 100);
      log(l, `💔 ${name}เก็บข้าวของกลับบ้านเดิมไปเงียบๆ ทิ้งจดหมายไว้ฉบับเดียว: "ข้าทนมามากพอแล้ว"`, "bad");
      break;
    }
    // ชีวิตของ NPC เอง: แต่งงาน มีลูก ทำตามเป้าหมาย
    const tags = (p.tags ??= []);
    if (!FAMILY.includes(p.relation) || p.relation === "sibling") {
      if (p.age >= 18 && !tags.includes("married") && chance(l, 0.07)) {
        tags.push("married");
        if (r.love >= 40) log(l, `ข่าวจากคนรู้จัก: ${name}แต่งงานแล้ว${r.love >= 70 ? " และส่งเทียบเชิญมาให้คุณเป็นแขกคนสำคัญ" : ""}`);
      } else if (tags.includes("married") && !tags.includes("parent") && p.age <= 45 && chance(l, 0.12)) {
        tags.push("parent");
      } else if (p.age >= 25 && !tags.includes("goalDone") && chance(l, hasTrait(p, "ambitious") ? 0.04 : 0.02)) {
        tags.push("goalDone");
        if (r.love >= 40 || r.jealousy >= 40) log(l, `ข่าวจากคนรู้จัก: ${name}${goalOf(p).replace("อยาก", "ได้")}สมใจแล้ว`);
      }
    }
  }
}
