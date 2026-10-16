import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill, openHiddenSlot, runEvent } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { HunterClass, Life } from "../../../engine/types";
import { addFame, addStat, checkChance, clamp, hasTalent, log } from "../../../engine/util";
import { startQuest } from "../../murim/quest";
import { startCourtQuest } from "../../court/quest";
import { startClimb } from "../../tower/climb";
import { worldOf } from "../../worlds";
import {
  CLASSES,
  GATE_TYPES,
  awaken,
  classById,
  fightOdds,
  gainExp,
  gateRewards,
  offerClasses,
  rankName,
  luckyRankUp,
  rollAwakening,
  survivalOdds,
} from "../power";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

// ───────────────────────── วันตื่นพลัง ─────────────────────────

function rollInto(l: Life, c: Ctx, bonus: number) {
  c.rank = rollAwakening(l, bonus);
  const offer = offerClasses(l);
  c.offer = offer.join(",");
}

const offered = (c: Ctx, id: HunterClass) => String(c.offer ?? "").split(",").includes(id);

export const AWAKENING: GameEvent = {
  id: "hunter.awakening",
  minAge: 4,
  maxAge: 70,
  forced: true,
  when: (l) => !l.power && !l.flags.awakenDone && l.age === Number(l.flags.awakenAge ?? 19),
  title: "วันตื่นพลัง",
  text: (l) =>
    `คืนก่อนวันเกิดอายุ ${l.age} ปี ไข้ของคุณพุ่งสูงจนตัวสั่น เส้นเลือดใต้ผิวเรืองแสงสีฟ้าจางๆ ` +
    `มีเสียงกระซิบเรียกชื่อ "${l.firstName}" ดังมาจากที่ไหนสักแห่ง…`,
  choices: [
    {
      label: "กัดฟันต่อสู้กับความร้อน",
      check: { stat: "health", dc: 55 },
      run: (l, c, ok) => {
        rollInto(l, c, ok ? 1 : 0);
        return meh(ok ? "คุณกำผ้าปูที่นอนจนขาด ร่างกายต้านทานพลังที่ไหลบ่าเข้ามาได้" : "คุณหมดสติไปกลางดึก…", c.rank === -1 ? "none" : "awakened");
      },
    },
    {
      label: "ปล่อยใจไปตามเสียงกระซิบ",
      check: { stat: "luck", dc: 55 },
      run: (l, c, ok) => {
        rollInto(l, c, ok ? 1 : 0);
        return meh(ok ? "เสียงนั้นอบอุ่นอย่างประหลาด มันพาคุณดำดิ่งลงไปในทะเลแสงสีฟ้า" : "เสียงกระซิบเงียบหายไปกลางทาง…", c.rank === -1 ? "none" : "awakened");
      },
    },
    {
      label: "ตะโกนเรียกแม่!",
      run: (l, c) => {
        rollInto(l, c, 0);
        return meh("แม่วิ่งเข้ามาพร้อมผ้าชุบน้ำ กุมมือคุณไว้ทั้งคืน", c.rank === -1 ? "none" : "awakened");
      },
    },
  ],
  scenes: {
    none: {
      title: "เช้าวันใหม่",
      text: () =>
        "ไข้ลดลงตอนรุ่งเช้า… ไม่มีหน้าต่างสีฟ้า ไม่มีเสียงในหัว ไม่มีอะไรเลย " +
        "ข่าวเช้ารายงานว่าปีนี้มีผู้ตื่นพลังรุ่นเดียวกับคุณหลายพันคน แต่ไม่ใช่คุณ",
      choices: [
        { label: "ยอมรับความจริง ใช้ชีวิตแบบคนธรรมดา", run: (l) => { l.flags.awakenDone = true; addStat(l, "happiness", -8); return meh("คุณปิดทีวี แล้วไปอาบน้ำเตรียมตัวไปเรียน"); } },
        { label: "สาบานว่าสักวันจะหาทางได้พลังมาเอง", run: (l) => { l.flags.awakenDone = true; l.flags.stubborn = true; addStat(l, "happiness", -4); return meh("คุณจ้องมือตัวเองนานมาก… ยังไม่จบหรอก"); } },
      ],
    },
    awakened: {
      title: "การตื่นพลังเสร็จสมบูรณ์",
      system: true,
      text: (_l, c) => `[ระบบ] ยินดีด้วย ผู้ตื่นพลังคนใหม่ — แรงก์ประเมินเบื้องต้น: 【${rankName(Number(c.rank))}】\nกรุณาเลือกสายอาชีพ`,
      choices: CLASSES.map((cls) => ({
        label: `${cls.emoji} ${cls.name} — ${cls.desc}`,
        tone: cls.id === "summoner" ? ("special" as const) : undefined,
        show: (_l: Life, c: Ctx) => offered(c, cls.id),
        run: (l: Life, c: Ctx): Outcome => {
          const rank = Number(c.rank);
          awaken(l, rank, cls.id);
          openHiddenSlot(l, "ตื่นพลัง");
          const hype = rank >= 6 ? " ทั้งประเทศแตกตื่น! สื่อทุกสำนักขอสัมภาษณ์" : rank >= 4 ? " กิลด์ใหญ่หลายแห่งเริ่มส่งคนมาทาบทาม" : rank <= 0 ? " …แรงก์ต่ำสุด ไม่มีใครสนใจคุณเลย" : "";
          return { text: `⚡ คุณตื่นพลังเป็น ${cls.name} แรงก์ ${rankName(rank)}!${hype}`, kind: "milestone" };
        },
      })),
    },
  },
};

// ───────────────────────── บุก Gate ─────────────────────────

const MIDS = ["trap", "chest", "injured", "trap", "chest", "hidden"] as const;

function hurt(l: Life, gateRank: number, min: number, max: number): string {
  const gap = Math.max(0, gateRank - (l.power?.rank ?? 0));
  const dmg = Math.round(randInt(l, min, max) * (1 + gap * 0.5));
  addStat(l, "health", -dmg);
  if (l.stats.health <= 0) {
    kill(l, `บาดเจ็บสาหัสใน Gate แรงก์ ${rankName(gateRank)}`);
    return " บาดแผลสาหัสเกินกว่าจะรอด…";
  }
  return ` (สุขภาพ -${dmg})`;
}

const R = (c: Ctx) => Number(c.rank);
const monster = (c: Ctx) => String(c.m);

export function startGate(life: Life, gateRank: number) {
  const t = randInt(life, 0, GATE_TYPES.length - 1);
  const ctx: Ctx = {
    rank: gateRank,
    t,
    m: pick(life, GATE_TYPES[t].monsters),
    mid: !life.flags.secretDungeon && chance(life, 0.015) ? "hidden" : pick(life, MIDS.slice(0, 5)),
    score: 0,
    share: 1,
  };
  runEvent(life, "gate.raid", ctx);
}

export const GATE_RAID: GameEvent = {
  id: "gate.raid",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "บุก Gate",
  text: (_l, c) => {
    const g = GATE_TYPES[Number(c.t)];
    return `คุณก้าวผ่านวงแหวนแสงของ Gate แรงก์ ${rankName(R(c))} เข้าสู่【${g.name}】— ${g.desc}`;
  },
  choices: [
    {
      label: "บุกตรงไปข้างหน้า",
      odds: (l, c) => fightOdds(l, R(c)),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("คุณกวาดมอนสเตอร์ระดับล่างเป็นทางยาว ทีมเริ่มมองคุณด้วยสายตาใหม่", "mid"); }
        return bad("ฝูงมอนสเตอร์ล้อมคุณไว้ กว่าจะฝ่าออกมาได้ก็เลือดอาบ" + hurt(l, R(c), 6, 14), "mid");
      },
    },
    {
      label: "ลอบเข้าทางเงามืด",
      odds: (l, c) => clamp(checkChance(l, "luck", 45) + (l.power?.hunterClass === "assassin" ? 0.2 : 0) - Math.max(0, R(c) - (l.power?.rank ?? 0)) * 0.1, 0.05, 0.95),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("คุณหลบผ่านรังมอนสเตอร์ได้โดยไม่มีตัวไหนรู้ตัว", "mid"); }
        return bad("กิ่งไม้หักใต้เท้า! ทุกตัวหันมาพร้อมกัน" + hurt(l, R(c), 4, 10), "mid");
      },
    },
    {
      label: "เดินตามหลังทีม (ปลอดภัยแต่ได้ส่วนแบ่งน้อย)",
      run: (_l, c) => { c.share = 0.5; return meh("คุณเก็บคริสตัลมานาตามหลังคนอื่น ไม่มีใครสนใจคุณ", "mid"); },
    },
  ],
  scenes: {
    mid: {
      text: (_l, c) =>
        ({
          trap: "พื้นหินใต้เท้ายุบลง! หนามเหล็กพุ่งขึ้นมาจากรอยแยก",
          chest: "หีบสมบัติเรืองแสงตั้งอยู่กลางห้องโถง… มันอาจเป็นมิมิก",
          injured: "Hunter แรงก์ต่ำคนหนึ่งบาดเจ็บสาหัส นอนร้องขอความช่วยเหลืออยู่ข้างทาง",
          hidden: "ผนังหินตรงหน้ามีอักษรโบราณเรืองแสงเป็นจังหวะ เหมือนหัวใจกำลังเต้น… มีประตูลับซ่อนอยู่",
        })[String(c.mid)] ?? "",
      choices: [
        // กับดัก
        {
          label: "กระโดดหลบ",
          show: (_l, c) => c.mid === "trap",
          odds: (l, c) => fightOdds(l, R(c), 0.15),
          run: (l, c, ok) => (ok ? good("คุณตีลังกาหลบได้อย่างสวยงาม", "boss") : bad("หนามเฉี่ยวขาคุณเป็นแผลยาว" + hurt(l, R(c), 5, 12), "boss")),
        },
        {
          label: "กางสกิลป้องกัน",
          tone: "special",
          show: (l, c) => c.mid === "trap" && ["tank", "healer", "mage"].includes(l.power?.hunterClass ?? ""),
          run: () => good("โล่มานาของคุณรับแรงกระแทกไว้ได้ทั้งหมด", "boss"),
        },
        // หีบ
        {
          label: "เปิดหีบ",
          check: { stat: "luck", dc: 50 },
          show: (_l, c) => c.mid === "chest",
          run: (l, c, ok) => {
            if (ok) {
              const item = pick(l, ["ยาฟื้นพลังระดับสูง", "ม้วนคัมภีร์หลบหนี", "แหวนมานา", "สร้อยคอปีศาจ"]);
              l.power?.items.push(item);
              return good(`ข้างในมี「${item}」! คุณเก็บเข้ากระเป๋า`, "boss");
            }
            return bad("หีบอ้าปากเต็มไปด้วยฟัน! มันคือมิมิก" + hurt(l, R(c), 6, 12), "boss");
          },
        },
        { label: "ไม่แตะ ไปต่อ", show: (_l, c) => c.mid === "chest", run: () => meh("คุณเดินผ่านไป ได้ยินเสียงงับดังกึกตามหลัง", "boss") },
        // คนเจ็บ
        {
          label: "แบกเขาไปด้วย",
          show: (_l, c) => c.mid === "injured",
          run: (l, c) => { addFame(l, 3); addStat(l, "happiness", 4); c.score = Number(c.score) - 1; l.flags.savedHunter = Number(l.flags.savedHunter ?? 0) + 1; return good("คุณแบกเขาไว้บนหลัง ทำให้เคลื่อนที่ช้าลง แต่เขาพึมพำขอบคุณไม่หยุด", "boss"); },
        },
        {
          label: "ใช้สกิลรักษา",
          tone: "special",
          show: (l, c) => c.mid === "injured" && l.power?.hunterClass === "healer",
          run: (l) => { addFame(l, 5); return good("แสงเยียวยาปิดแผลเขาในพริบตา เขาลุกขึ้นมาสู้เคียงข้างคุณ", "boss"); },
        },
        { label: "ทิ้งเขาไว้", show: (_l, c) => c.mid === "injured", run: (l) => { addStat(l, "happiness", -6); return meh("เสียงร้องของเขาค่อยๆ เงียบลงข้างหลัง", "boss"); } },
        // ประตูลับ
        {
          label: "เข้าไปในประตูลับ",
          tone: "danger",
          show: (_l, c) => c.mid === "hidden",
          survival: (l, c) => survivalOdds(l, R(c) + 2),
          odds: (l, c) => survivalOdds(l, R(c) + 2),
          run: (l, _c, ok) => {
            if (!ok) {
              kill(l, "ติดอยู่ในดันเจี้ยนลับใต้ Gate");
              return bad("ประตูปิดลงข้างหลัง รูปปั้นยักษ์นับร้อยลืมตาขึ้นพร้อมกัน…");
            }
            luckyRankUp(l, "[ระบบ] ผ่านการทดสอบของดันเจี้ยนลับ");
            l.flags.secretDungeon = true;
            return { text: "คุณเอาตัวรอดจากบททดสอบของรูปปั้นเทพเจ้ามาได้ และมีบางอย่างในตัวคุณเปลี่ยนไปตลอดกาล", kind: "milestone", next: "boss" };
          },
        },
        { label: "ไม่เสี่ยง กลับทางเดิม", show: (_l, c) => c.mid === "hidden", run: () => meh("คุณหันหลังให้แสงนั้น… มันจะรออยู่ตรงนั้นไหมนะ", "boss") },
      ],
    },
    boss: {
      title: "บอส",
      text: (_l, c) => `ห้องบอสเปิดออก!【${monster(c)}】แรงก์ ${rankName(R(c))} คำรามจนเพดานถ้ำสั่นสะเทือน`,
      choices: [
        {
          label: "สู้เต็มกำลัง",
          tone: "danger",
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06),
          run: (l, c, ok) => {
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share), true);
              addFame(l, R(c) >= 4 ? 4 : 1);
              return { text: `💥 คุณปราบ${monster(c)}ได้! ${r}`, kind: "good" };
            }
            if (!chance(l, survivalOdds(l, R(c), Number(c.score) * 0.06))) {
              kill(l, `ถูก${monster(c)}สังหารใน Gate แรงก์ ${rankName(R(c))}`);
              return bad(`กรงเล็บของ${monster(c)}ฟาดลงมา… ภาพสุดท้ายที่คุณเห็นคือแสงสีฟ้าของ Gate`);
            }
            return bad(`คุณพ่ายแพ้ ทีมลากคุณออกมาได้ทันเวลา` + hurt(l, R(c), 15, 30));
          },
        },
        {
          label: (l) => `ใช้ไอเทม「${l.power?.items[0] ?? ""}」แล้วสู้`,
          tone: "special",
          show: (l) => (l.power?.items.length ?? 0) > 0,
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          run: (l, c, ok) => {
            const item = l.power!.items.shift();
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share), true);
              return { text: `💥 「${item}」พลิกสถานการณ์! คุณปราบ${monster(c)}ได้ ${r}`, kind: "good" };
            }
            return bad(`แม้แต่「${item}」ก็ไม่พอ คุณหนีออกมาได้หวุดหวิด` + hurt(l, R(c), 10, 20));
          },
        },
        {
          label: "ถอยออกจาก Gate",
          run: (l, c) => {
            const r = gateRewards(l, R(c), Number(c.share) * 0.3, false);
            return meh(`คุณถอยออกมาพร้อมคริสตัลที่เก็บได้ระหว่างทาง ${r}`);
          },
        },
      ],
    },
  },
};

export const GATES_PER_YEAR = 3;

export function gatesLeft(life: Life) {
  return GATES_PER_YEAR - life.doneThisYear.filter((x) => x === "gate").length;
}

const QUEST_MSG = {
  hunter: {
    noPower: "ยังไม่ตื่นพลัง",
    noJob: "ต้องลงทะเบียนเป็น Hunter ก่อน (แท็บอาชีพ)",
    full: "ปีนี้บุกครบแล้ว",
    tooHigh: "สมาคมไม่อนุญาต (สูงกว่าแรงก์คุณเกิน 1 ขั้น)",
  },
  murim: {
    noPower: "ยังไม่มีรากฐานยุทธ์",
    noJob: "ต้องเป็นศิษย์สำนัก จอมยุทธ์พเนจร หรือนักฆ่ารับจ้างก่อน (แท็บอาชีพ)",
    full: "ปีนี้ออกภารกิจครบแล้ว",
    tooHigh: "อันตรายเกินฝีมือ (สูงกว่าขั้นคุณเกิน 1 ขั้น)",
  },
  tower: {
    noPower: "ยังไม่ได้รับคำเชิญจากหอคอย",
    noJob: "ต้องลงทะเบียนเป็นผู้ท้าชิงหอคอยก่อน (แท็บอาชีพ)",
    full: "ปีนี้ท้าทายครบแล้ว",
    tooHigh: "หอคอยไม่เปิดบททดสอบที่สูงกว่าระดับคุณเกิน 1 ขั้น",
  },
  court: {
    noPower: "ยังไม่มีพลังเวท",
    noJob: "ต้องเป็นอัศวิน จอมเวทราชสำนัก หรือนักผจญภัยก่อน (แท็บอาชีพ)",
    full: "ปีนี้รับภารกิจครบแล้ว",
    tooHigh: "ราชสำนักไม่มอบภารกิจที่สูงกว่าวงเวทของคุณเกิน 1 ขั้น",
  },
};

export function canEnterGate(life: Life, gateRank: number): string | undefined {
  const msg = QUEST_MSG[life.worldId ?? "hunter"];
  if (!life.power) return msg.noPower;
  if (!worldOf(life.worldId).questJobs.includes(life.job?.careerId ?? "")) return msg.noJob;
  if (life.queue.length) return "กำลังมีเหตุการณ์อยู่";
  if (Number(life.flags.secludeUntil ?? 0) > life.age) return "กำลังปิดด่าน";
  if (gatesLeft(life) <= 0) return msg.full;
  if (gateRank > life.power.rank + 1) return msg.tooHigh;
  if (life.stats.health < 15) return "บาดเจ็บหนักเกินไป";
  return;
}

export function enterGate(life: Life, gateRank: number) {
  if (canEnterGate(life, gateRank)) return;
  life.doneThisYear.push("gate");
  if (life.worldId === "murim") startQuest(life, gateRank);
  else if (life.worldId === "court") startCourtQuest(life, gateRank);
  else if (life.worldId === "tower") startClimb(life, gateRank);
  else startGate(life, gateRank);
}

// ───────────────────────── ฝึกฝน / ภารกิจรายวัน ─────────────────────────

export function train(life: Life): Outcome | undefined {
  if (!life.power || life.doneThisYear.includes("train")) return;
  life.doneThisYear.push("train");
  const cls = classById(life.power.hunterClass);
  addStat(life, cls.key, randInt(life, 1, 3));
  addStat(life, "health", -1);
  const murim = life.worldId === "murim";
  const out = {
    text: murim
      ? `คุณนั่งสมาธิเดินลมปราณและฝึก${cls.name}ทั้งปีที่${worldOf(life.worldId).labels.trainText}`
      : life.worldId === "court"
        ? `คุณฝึก${cls.name}ทุกวันที่${worldOf(life.worldId).labels.trainText}`
        : life.worldId === "tower"
          ? `คุณฝึก${cls.name}ทั้งปีที่${worldOf(life.worldId).labels.trainText}`
          : `คุณฝึกฝน${cls.name}อย่างหนักที่ศูนย์ฝึกของสมาคม`,
    kind: "good" as const,
  };
  log(life, out.text, out.kind);
  // ยุทธภพ: การบำเพ็ญคือทางเติบโตหลัก
  if (murim) gainExp(life, 120 + life.power.level * 15);
  return out;
}

export function dailyQuest(life: Life): Outcome | undefined {
  if (!life.power || !hasTalent(life, "system_user") || life.doneThisYear.includes("daily")) return;
  life.doneThisYear.push("daily");
  addStat(life, "health", randInt(life, 2, 5));
  const out = { text: "[ภารกิจรายวัน] วิดพื้น 100 ครั้ง ซิทอัพ 100 ครั้ง วิ่ง 10 กิโลเมตร — ทำครบทุกวันตลอดปี", kind: "system" as const };
  log(life, out.text, out.kind);
  // EXP คิดหลัง log เพื่อให้ข้อความเลเวลอัปตามมาทีหลัง
  gainExp(life, 150 + life.power.level * 30);
  return out;
}
