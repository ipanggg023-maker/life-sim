// Phase 6a — สำนักและฝ่ายต่างๆ เป็น "ผู้เล่น" ของโลก (MURIM_PLAN §8.3 · MURIM_EXPANSION §8.1–8.3)
// แต่ละสำนักมีผู้นำ ผู้สืบทอด กำลัง ความมั่นคง ท่าทีต่อผู้เล่น และปัญหาภายใน — เติบโต เสื่อม ทำสงคราม ถูกล้างสำนักได้เอง
// ฝ่ายธรรมะไม่ได้ดีทั้งหมด ฝ่ายอธรรมไม่ได้เลวทั้งหมด พรรคมารมีอุดมการณ์และการแย่งอำนาจภายใน
import type { GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { clamp, log } from "../../../engine/util";
import { DUEL_END } from "../life/duel";
import { calYear } from "../life/world";
import { B, C, E, FIGHT, G, K, N, near, rnd } from "../story/kit";

export interface Faction {
  id: string;
  name: string;
  side: "orthodox" | "unorthodox" | "demonic";
  /** กำลัง 0–100 */
  power: number;
  /** ความมั่นคงภายใน 0–100 (ต่ำ = แตกแยก แย่งตำแหน่ง) */
  unity: number;
  /** ท่าทีต่อผู้เล่น −100..100 */
  rep: number;
  leader: string;
  leaderAge: number;
  status: "thriving" | "steady" | "declining" | "fallen";
}

const BASE: Omit<Faction, "rep" | "leader" | "leaderAge" | "status">[] = [
  { id: "vajra", name: "วัดวัชระ", side: "orthodox", power: 70, unity: 75 },
  { id: "cloud", name: "สำนักกระบี่เมฆา", side: "orthodox", power: 65, unity: 60 },
  { id: "alliance", name: "พันธมิตรยุทธจักร", side: "orthodox", power: 75, unity: 50 },
  { id: "beggar", name: "พรรคกระยาจก", side: "orthodox", power: 55, unity: 70 },
  { id: "tang", name: "ตระกูลถังเรือนพิษ", side: "unorthodox", power: 60, unity: 65 },
  { id: "cult", name: "ลัทธิมารสวรรค์", side: "demonic", power: 70, unity: 55 },
];

const LEADER_NAMES = ["ฮุ่ยหมิง", "เซียวเทียนหลง", "หลิวเฟิงอวิ๋น", "ฉินเจิ้นหยาง", "ถังอู๋เซิน", "เยี่ยนชิงหาน", "ไป๋เส้าหลง", "จางอู๋จี้", "มู่หรงเฉิน", "หลี่ซิ่วหลาน"];

export function factions(l: Life): Faction[] {
  const w = l.mw;
  if (!w) return [];
  if (!w.fx) {
    w.fx = BASE.map((b) => ({ ...b, power: clamp(b.power + randInt(l, -10, 10), 20, 95), rep: 0, leader: pick(l, LEADER_NAMES), leaderAge: randInt(l, 45, 75), status: "steady" as const }));
  }
  return w.fx;
}
export const factionById = (l: Life, id: string) => factions(l).find((f) => f.id === id);

/** ท่าทีของสำนักต่อผู้เล่น (ใช้ในเหตุการณ์ต่างๆ) */
export function shiftRep(l: Life, id: string, d: number) {
  const f = factionById(l, id);
  if (!f) return;
  const before = f.rep;
  f.rep = clamp(f.rep + d, -100, 100);
  if (before > -50 && f.rep <= -50) log(l, `⚠️ ${f.name}ขึ้นบัญชีดำชื่อคุณแล้ว — ศิษย์ของพวกเขาเห็นหน้าคุณที่ไหนจะไม่ปล่อยไว้`, "bad");
  if (before < 50 && f.rep >= 50) log(l, `🤝 ${f.name}นับคุณเป็นมิตรของสำนัก — ประตูภูเขาเปิดต้อนรับคุณทุกเมื่อ`, "good");
}

const statusOf = (f: Faction): Faction["status"] => (f.power <= 5 ? "fallen" : f.power >= 75 ? "thriving" : f.power <= 30 ? "declining" : "steady");
export const STATUS_NAME: Record<Faction["status"], string> = { thriving: "รุ่งเรือง", steady: "มั่นคง", declining: "เสื่อมถอย", fallen: "ล่มสลาย" };

/** ทุกปี: สำนักเติบโต/เสื่อม · ผู้นำแก่ตาย → แย่งตำแหน่ง · ความขัดแย้งธรรมะ–มารตามแรงกดดันของโลก */
function tickFactions(l: Life) {
  if (l.worldId !== "murim" || !l.alive || !l.mw) return;
  const fs = factions(l);
  const cult = l.mw.cult;
  const yr = calYear(l);
  // ท่าทีของแต่ละฝ่ายค่อยๆ เข้าหาสิ่งที่คุณเป็น: ธรรมะเป็นมิตรฝ่ายธรรมะ มารเป็นมิตรพรรคมาร · สำนักตัวเองเอ็นดูศิษย์
  const al = Number(l.flags.m17Align ?? 0);
  for (const f of fs) {
    const target = (f.side === "orthodox" ? al / 2 : f.side === "demonic" ? -al / 2 : 0) + (l.power?.guild === f.id ? 40 : 0);
    if (Math.abs(f.rep - target) > 3) f.rep = clamp(f.rep + Math.sign(target - f.rep) * 2, -100, 100);
  }
  for (const f of fs) {
    if (f.status === "fallen") { if (chance(l, 0.04)) { f.power = 12; f.status = "declining"; log(l, `📜 ข่าวยุทธภพ: ศิษย์ที่รอดชีวิตของ${f.name}กลับมาตั้งสำนักใหม่บนซากเดิม`); } continue; }
    f.leaderAge++;
    f.power = clamp(f.power + randInt(l, -3, 3) + (f.unity < 30 ? -2 : 0) + (f.side === "demonic" ? (cult - 50) / 25 : 0), 0, 100);
    f.unity = clamp(f.unity + randInt(l, -3, 3), 0, 100);
    // ผู้นำเสียชีวิต — ผู้สืบทอดมั่นคงหรือแย่งชิง
    if (f.leaderAge > 70 && chance(l, (f.leaderAge - 65) / 60)) {
      const old = f.leader;
      f.leader = pick(l, LEADER_NAMES.filter((n) => n !== old));
      f.leaderAge = randInt(l, 38, 58);
      if (f.unity < 45) {
        f.power = clamp(f.power - 12, 0, 100);
        log(l, `📜 ข่าวยุทธภพ: ${old} ประมุข${f.name}สิ้นลม — ศิษย์สองฝ่ายแย่งตำแหน่งจนเลือดตกยางออก ${f.leader} ขึ้นเป็นประมุขคนใหม่บนกองศพ`);
      } else {
        log(l, `📜 ข่าวยุทธภพ: ${old} ประมุข${f.name}สิ้นลมอย่างสงบ ${f.leader} รับตำแหน่งต่ออย่างราบรื่น`);
      }
    }
    const st = statusOf(f);
    if (st !== f.status) {
      if (st === "fallen") log(l, `🔥 ปี ${yr}: ${f.name}ล่มสลาย — สำนักที่ยืนหยัดมาหลายร้อยปีเหลือเพียงซากหิน`, "bad");
      f.status = st;
    }
  }
  // สงครามธรรมะ–มาร เมื่อพรรคมารแข็งแกร่งเกินไป
  const demon = fs.find((f) => f.side === "demonic" && f.status !== "fallen");
  if (demon && demon.power >= 80 && chance(l, 0.15)) {
    const target = pick(l, fs.filter((f) => f.side === "orthodox" && f.status !== "fallen"));
    if (target) {
      const win = chance(l, demon.power / (demon.power + target.power));
      if (win) { target.power = clamp(target.power - randInt(l, 15, 30), 0, 100); demon.power = clamp(demon.power - 5, 0, 100); }
      else { demon.power = clamp(demon.power - randInt(l, 15, 25), 0, 100); target.power = clamp(target.power - 5, 0, 100); }
      log(l, `⚔️ ข่าวยุทธภพ: ${demon.name}บุกภูเขาของ${target.name} — ${win ? `${target.name}เสียหายหนัก ศิษย์ตายนับร้อย` : `${target.name}ต้านไว้ได้ ทัพมารถอยกลับพร้อมความสูญเสีย`}`, win ? "bad" : "normal");
    }
  }
}

/** สำนักที่ผู้เล่นสังกัด */
export const mySectFaction = (l: Life) => (l.power?.guild ? factionById(l, l.power.guild) : undefined);

export const FACTION_EVENTS: GameEvent[] = [
  E("fx.sect_war_call", [16, 75], (l) => { const f = mySectFaction(l)!; return `${f.name}ถูกศัตรูรุกราน ประมุข ${f.leader} เรียกศิษย์ทุกคนกลับภูเขา — คนที่ไม่กลับ จะถูกขีดชื่อออก`; }, [
    FIGHT("กลับไปสู้เคียงข้างสำนัก", "หัวหน้ากองบุก", near(1), { lethal: true, on: "sectDefense", pros: "สำนักจะจำความภักดีนี้ — อาจได้เลื่อนขั้น", cons: "สงครามจริง ตายได้" }),
    C("ส่งเงินช่วยแทน", (l, c) => { const f = mySectFaction(l)!; l.money -= 20_000; shiftRep(l, f.id, 5); return N("ผู้อาวุโสรับเงินไว้โดยไม่พูดอะไร — ศิษย์ที่กลับมาสู้มองคุณแปลกๆ")(l, c); }),
    C("ไม่กลับ", (l, c) => { const f = mySectFaction(l)!; shiftRep(l, f.id, -40); if (l.power) l.power.guild = undefined; return B("ชื่อคุณถูกขีดออกจากทะเบียนศิษย์ — ตั้งแต่วันนี้คุณคือคนนอก", { fame: -4 })(l, c); }),
  ], { when: (l) => { const f = mySectFaction(l); return !!f && f.status !== "fallen" && (f.status === "declining" || (l.mw?.cult ?? 0) >= 70); }, weight: 6, maxTimes: 2, title: "สำนักเรียกตัว" }),
  E("fx.succession_side", [20, 80], (l) => { const f = mySectFaction(l)!; return `ประมุข${f.name}ป่วยหนัก ศิษย์อาวุโสสองคนแย่งตำแหน่ง — ฝ่ายหนึ่งเก่งแต่โหด อีกฝ่ายใจดีแต่อ่อนแอ ทั้งสองมาขอเสียงสนับสนุนจากคุณ`; }, [
    C("หนุนคนเก่ง", (l, c) => { const f = mySectFaction(l)!; f.power = clamp(f.power + 8, 0, 100); f.unity = clamp(f.unity - 10, 0, 100); return N("สำนักแข็งแกร่งขึ้น แต่ศิษย์ฝ่ายแพ้ถูกกวาดล้างเงียบๆ ทีละคน", { align: -2 })(l, c); }),
    C("หนุนคนใจดี", (l, c) => { const f = mySectFaction(l)!; f.unity = clamp(f.unity + 10, 0, 100); f.power = clamp(f.power - 5, 0, 100); return G("สำนักสงบสุข แต่สำนักคู่แข่งเริ่มมองว่าเป็นเหยื่อ", { align: 2 })(l, c); }),
    K("ไกล่เกลี่ยให้ทั้งสองแบ่งอำนาจ", "smarts", 65, G("ทั้งสองยอมจับมือกันต่อหน้าศิษย์ทั้งสำนัก — ชื่อคุณกลายเป็นที่นับถือของทุกฝ่าย", { fame: 5 }), B("ทั้งสองฝ่ายคิดว่าคุณเป็นพวกอีกฝ่าย", { fame: -2 })),
  ], { when: (l) => !!mySectFaction(l) && mySectFaction(l)!.unity < 55 && (l.power?.rank ?? 0) >= 3, weight: 4, title: "แย่งตำแหน่งประมุข" }),
  E("fx.blacklisted", [16, 90], (l) => { const f = factions(l).filter((x) => x.rep <= -50 && x.status !== "fallen").sort((a, b) => a.rep - b.rep)[0]; return `ศิษย์${f?.name ?? "สำนักศัตรู"}สามคนดักรอคุณกลางทาง — ชื่อคุณอยู่ในบัญชีดำของพวกเขา`; }, [
    FIGHT("สู้", "ศิษย์อาวุโสผู้นำกลุ่ม", near(0), { lethal: true, cons: "สำนักจะส่งคนมาอีก" }),
    K("หนี", "luck", 50, N("คุณหนีรอดไปได้อีกครั้ง — แต่รู้ว่าจะมีครั้งต่อไป"), B("หนีไม่พ้น ถูกฟันจนเกือบตาย", { hp: -20, wound: ["armL", "cut", 2] })),
    C("ยอมมอบตัวขอเจรจากับประมุข", (l, c) => (rnd(l, 0, 1) ? G("ประมุขฟังเหตุผล และยอมถอนชื่อคุณออกจากบัญชีดำแลกกับคำสาบาน", { align: 2 }) : B("ประมุขไม่ฟัง — คุณถูกขังในถ้ำหลังเขาหนึ่งปีเต็ม", { hp: -10, joy: -10 }))(l, c)),
  ], { when: (l) => factions(l).some((x) => x.rep <= -50 && x.status !== "fallen"), weight: 6, maxTimes: 0, title: "บัญชีดำ" }),
  E("fx.ally_help", [20, 90], (l) => { const f = factions(l).filter((x) => x.rep >= 50 && x.status !== "fallen")[0]; return `${f?.name ?? "สำนักพันธมิตร"}ส่งคนมาบอกว่าได้ยินว่าคุณลำบาก — "ประมุขฝากบอกว่า บุญคุณที่ท่านเคยทำ สำนักเราไม่เคยลืม"`; }, [
    C("รับความช่วยเหลือ", G("เงิน ยาบำรุง และศิษย์สองคนมาช่วยงานคุณหนึ่งปีเต็ม", { tael: 40, hp: 8 })),
    C("ขอบคุณ แต่ปฏิเสธ", G("ทูตยิ้ม \"ประมุขบอกแล้วว่าท่านจะพูดแบบนี้\"", { fame: 2 })),
  ], { when: (l) => factions(l).some((x) => x.rep >= 50 && x.status !== "fallen") && (l.money < 20_000 || l.stats.health < 40), weight: 6, maxTimes: 3, title: "มิตรไม่ทิ้งกัน" }),
];

// ผลการป้องกันสำนัก
DUEL_END.sectDefense = (l, r) => {
  const f = mySectFaction(l);
  if (!f) return "";
  if (r === "win") { shiftRep(l, f.id, 25); f.power = clamp(f.power + 5, 0, 100); if (l.job?.careerId === "disciple" && l.job.level < 5) l.job.level++; return `${f.name}รอดพ้น — ประมุข${f.leader}เลื่อนขั้นคุณต่อหน้าทั้งสำนัก`; }
  shiftRep(l, f.id, 10);
  return "คุณสู้จนหมดแรง — สำนักไม่ลืมคนที่กลับมา";
};

yearHooks.push(tickFactions);
