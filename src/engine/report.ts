// สรุปผลรายปี: เทียบสถานะก่อน/หลังกด +1 ปี (หรือข้ามหลายปี) แล้วสรุปเป็นบรรทัดสั้นๆ (MURIM_PLAN §18.2 ข้อ 6)
import type { Life, StatKey } from "./types";
import { money, relationLabel, shortName } from "./util";

export interface Snapshot {
  age: number;
  money: number;
  debt: number;
  fame: number;
  stats: Record<StatKey, number>;
  rank?: number;
  level?: number;
  bonds: Record<string, number>;
  alive: string[];
  job?: string;
}

export interface YearReport {
  from: number;
  to: number;
  lines: { text: string; tone: "good" | "bad" | "normal" }[];
}

export function snapshot(l: Life): Snapshot {
  return {
    age: l.age,
    money: l.money,
    debt: l.debt,
    fame: l.fame,
    stats: { ...l.stats },
    rank: l.power?.rank,
    level: l.power?.level,
    bonds: Object.fromEntries(l.people.filter((p) => p.alive).map((p) => [p.id, p.bond])),
    alive: l.people.filter((p) => p.alive).map((p) => p.id),
    job: l.job ? `${l.job.careerId}:${l.job.level}` : undefined,
  };
}

const STAT_NAME: Record<StatKey, string> = { health: "สุขภาพ", happiness: "ความสุข", smarts: "สติปัญญา", looks: "รูปลักษณ์", luck: "โชค" };
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function buildReport(l: Life, before: Snapshot): YearReport {
  const lines: YearReport["lines"] = [];
  const dm = l.money - before.money;
  if (dm !== 0) lines.push({ text: `เงิน ${dm > 0 ? "+" : "−"}${money(l, Math.abs(dm))}`, tone: dm > 0 ? "good" : "bad" });
  if (l.debt !== before.debt) lines.push({ text: `หนี้ ${l.debt > before.debt ? "เพิ่ม" : "ลด"} ${money(l, Math.abs(l.debt - before.debt))}`, tone: l.debt > before.debt ? "bad" : "good" });
  for (const k of ["health", "happiness", "smarts", "looks"] as StatKey[]) {
    const d = l.stats[k] - before.stats[k];
    if (Math.abs(d) >= 2) lines.push({ text: `${STAT_NAME[k]} ${sign(d)}`, tone: d > 0 ? "good" : "bad" });
  }
  if (l.fame !== before.fame && Math.abs(l.fame - before.fame) >= 2) lines.push({ text: `ชื่อเสียง ${sign(l.fame - before.fame)}`, tone: l.fame > before.fame ? "good" : "bad" });
  if (l.power && before.rank !== undefined && l.power.rank > before.rank) lines.push({ text: "ขั้นพลังสูงขึ้น!", tone: "good" });
  else if (l.power && before.level !== undefined && l.power.level > before.level) lines.push({ text: `ฝีมือก้าวหน้า (+${l.power.level - before.level} ระดับ)`, tone: "good" });
  // ความสัมพันธ์ที่เปลี่ยนมาก (เฉพาะคนที่ยังอยู่)
  const moved = l.people
    .filter((p) => p.alive && before.bonds[p.id] !== undefined && Math.abs(p.bond - before.bonds[p.id]) >= 5)
    .sort((a, b) => Math.abs(b.bond - before.bonds[b.id]) - Math.abs(a.bond - before.bonds[a.id]))
    .slice(0, 3);
  for (const p of moved) {
    const d = p.bond - before.bonds[p.id];
    lines.push({ text: `${relationLabel(p, l)} ${shortName(p)} ${d > 0 ? "สนิทขึ้น" : "ห่างเหิน"} (${sign(d)})`, tone: d > 0 ? "good" : "bad" });
  }
  const newcomers = l.people.filter((p) => p.alive && !before.alive.includes(p.id));
  if (newcomers.length) lines.push({ text: `คนใหม่ในชีวิต: ${newcomers.slice(0, 3).map((p) => shortName(p)).join(", ")}${newcomers.length > 3 ? " …" : ""}`, tone: "normal" });
  const lost = l.people.filter((p) => !p.alive && before.alive.includes(p.id));
  if (lost.length) lines.push({ text: `จากไป: ${lost.map((p) => shortName(p)).join(", ")}`, tone: "bad" });
  return { from: before.age, to: l.age, lines };
}
