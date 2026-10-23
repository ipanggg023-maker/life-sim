// Phase 4 — วิธีฝึกที่ต่างกันจริง (MURIM_EXPANSION §6 · MURIM_PLAN §18.5)
// ปลอดภัย/ช้า · หนัก/เร็ว/เสี่ยง · กับอาจารย์ (ตรงจุด มีค่าใช้จ่าย) · จากตำรา (ตีความผิดได้) · ฝึกจริง (ประลอง ได้ประสบการณ์ เสี่ยง)
// + เหตุการณ์ที่ทำให้ได้วิชา: เข้าสำนัก ศิษย์สายตรง คัมภีร์ในถ้ำ ถุงผ้าของอาจารย์ขอทาน ตลาดคัมภีร์ (ของปลอมก็มี) และคิดค้นวิชาเอง
import { injure } from "../../../engine/body";
import type { GameEvent, Outcome } from "../../../engine/events";
import { lifespanHooks, yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, log } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import { startDuel } from "../life/duel";
import { ARTS, REALM_LIFE, TYPE_NAME, addQi, artInfo, artsOf, comprehension, knows, learn, masteryWord, practise, tickMartial, type ArtType } from "./arts";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const hasMaster = (l: Life) => !!l.flags.coreDisciple || l.people.some((p) => p.alive && p.tags?.includes("master")) || !!l.power?.guild;
const fromManual = (l: Life, id: string) => artsOf(l).find((a) => a.id === id)?.src === "ตำรา";

export interface TrainMode {
  id: "safe" | "hard" | "master" | "manual" | "spar";
  name: string;
  pros: string;
  cons: string;
  req?: (l: Life, art: string) => string | undefined;
  run: (l: Life, art: string) => Outcome;
}

export const TRAIN_MODES: TrainMode[] = [
  {
    id: "safe", name: "ฝึกอย่างปลอดภัย", pros: "ไม่มีความเสี่ยง", cons: "ก้าวหน้าช้า",
    run: (l, art) => { const d = practise(l, art, randInt(l, 3, 6)); addQi(l, 0.3); if (l.power) gainExp(l, 60); return meh(`คุณฝึก「${artInfo(artsOf(l).find((a) => a.id === art)!).name}」อย่างสม่ำเสมอทุกวัน (ความชำนาญ +${d})`); },
  },
  {
    id: "hard", name: "ฝึกหนักจนสุดแรง", pros: "ก้าวหน้าเร็วเป็นสองเท่า", cons: "เสี่ยงบาดเจ็บ (ราว 1 ใน 5)",
    run: (l, art) => {
      const d = practise(l, art, randInt(l, 7, 13));
      addQi(l, 0.6);
      if (l.power) gainExp(l, 150);
      if (chance(l, 0.2)) { addStat(l, "health", -randInt(l, 6, 14)); return bad(`คุณฝึกจนกล้ามเนื้อฉีกขาด (ความชำนาญ +${d})${injure(l, pick(l, ["armR", "legL", "ribs"] as const), pick(l, ["cut", "broken"] as const), 1, "ฝึกหนักเกินกำลัง")}`); }
      return good(`เหงื่อทุกหยดไม่สูญเปล่า (ความชำนาญ +${d})`);
    },
  },
  {
    id: "master", name: "ขอให้อาจารย์ชี้แนะ", pros: "ตรงจุดที่สุด ไม่มีความเสี่ยง", cons: "ต้องมีอาจารย์/สำนัก และเสียค่าน้ำชา 2 ตำลึง (ศิษย์สายตรงไม่เสีย)",
    req: (l) => (!hasMaster(l) ? "ยังไม่มีอาจารย์หรือสำนัก" : !l.flags.coreDisciple && l.money < 2000 ? "ต้องมีเงิน 2 ตำลึง" : undefined),
    run: (l, art) => { if (!l.flags.coreDisciple) addMoney(l, -2000); const d = practise(l, art, randInt(l, 9, 15)); addQi(l, 0.5); if (l.power) gainExp(l, 120); return good(`อาจารย์แก้ท่าให้เพียงสามจุด แต่ทุกจุดคือสิ่งที่คุณฝึกผิดมาหลายปี (ความชำนาญ +${d})`); },
  },
  {
    id: "manual", name: "ศึกษาจากตำราด้วยตัวเอง", pros: "ก้าวหน้าได้มากถ้าเข้าใจ", cons: "ตีความผิดได้ — อาจธาตุไฟเข้าแทรก",
    req: (l, art) => (!fromManual(l, art) && artInfo(artsOf(l).find((a) => a.id === art)!).grade < 4 ? "วิชานี้ไม่มีตำราให้ศึกษา" : undefined),
    run: (l, art) => {
      if (chance(l, 0.25 - comprehension(l) / 600)) {
        const k = artsOf(l).find((a) => a.id === art)!;
        k.m = Math.max(0, k.m - 4);
        addStat(l, "health", -randInt(l, 8, 16));
        return bad(`คุณตีความตำราผิดไปหนึ่งบรรทัด ลมปราณไหลย้อนทาง${injure(l, "meridians", "internal", 1, "ตีความตำราผิด")}`);
      }
      const d = practise(l, art, randInt(l, 5, 16));
      addQi(l, 0.4);
      if (l.power) gainExp(l, 100);
      return good(`คุณอ่านบรรทัดเดิมเป็นร้อยรอบจนเข้าใจในที่สุด (ความชำนาญ +${d})`);
    },
  },
  {
    id: "spar", name: "ฝึกจริงด้วยการประลอง", pros: "ได้ประสบการณ์จริง และชื่อเสียงถ้าชนะ", cons: "บาดเจ็บได้จริง",
    req: (l) => (!l.power ? "ยังไม่มีวิชาลมปราณ" : undefined),
    run: (l, art) => { practise(l, art, randInt(l, 4, 9)); startDuel(l, { foe: pick(l, ["ศิษย์สำนักข้างเคียง", "จอมยุทธ์พเนจรขี้เมา", "ครูฝึกสำนักคุ้มภัย"]), rank: Math.max(0, (l.power?.rank ?? 0) + randInt(l, -1, 0)) }); return meh("คุณออกไปหาคู่ซ้อมฝีมือในเมือง"); },
  },
];

/** ปุ่มฝึกในแท็บวิชา (ปีละครั้ง) */
export function trainArt(l: Life, art: string, mode: TrainMode["id"]): Outcome {
  if (l.doneThisYear.includes("mwTrain")) return meh("ปีนี้คุณฝึกเต็มที่ไปแล้ว");
  const m = TRAIN_MODES.find((x) => x.id === mode)!;
  const why = m.req?.(l, art);
  if (why) return meh(why);
  l.doneThisYear.push("mwTrain");
  const out = m.run(l, art);
  if (out.text) log(l, out.text, out.kind ?? "normal");
  return out;
}

// ───────── ได้วิชาจากเรื่องราว ─────────

const BASIC_OF: Record<string, string> = { vajra: "s_vajra_fist", cloud: "s_cloud_sword", alliance: "s_alliance_sword", beggar: "s_beggar_staff", tang: "s_tang_poison", cult: "s_cult_palm", plum: "s_plum_sword", snow: "s_snow_sword", jade: "s_jade_palm", nangong: "s_nangong_sword", peng: "s_peng_saber", zhuge: "s_zhuge_array", blood: "s_blood_claw", shadow: "s_shadow_step", blackway: "s_green_saber" };
const SECRET_OF: Record<string, string> = { vajra: "x_yijin", cloud: "x_taiji", alliance: "x_alliance_seal", beggar: "x_dragon_palm", tang: "x_tang_rain", cult: "x_heavenly_demon", plum: "x_plum_rain", snow: "x_snow_heart", jade: "x_jade_sword", nangong: "x_nangong_thunder", peng: "x_peng_wild", zhuge: "x_zhuge_crossbow", blood: "x_blood_sea", shadow: "x_shadow_kill", blackway: "x_green_chain" };

/** ทุกปี: วิชาที่ได้จากสถานะ (เข้าสำนัก เป็นศิษย์สายตรง เรื่องในวัยเด็ก) */
function grantFromStatus(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  const g = l.power?.guild;
  if (g && BASIC_OF[g] && !knows(l, BASIC_OF[g])) learn(l, BASIC_OF[g], "สำนัก");
  if (g && l.flags.coreDisciple && SECRET_OF[g] && !knows(l, SECRET_OF[g])) learn(l, SECRET_OF[g], "อาจารย์");
  if (l.power && !artsOf(l).some((a) => artInfo(a).type === "internal") && !knows(l, "a_breathing")) learn(l, "a_breathing", "ครูฝึก", true);
  if ((l.flags.secretBreathing || l.flags.beggarMaster) && !knows(l, "l_beggar_breath")) learn(l, "l_beggar_breath", "อาจารย์");
  if (l.flags.caveManual && !knows(l, "l_cave_scroll")) learn(l, "l_cave_scroll", "ตำรา");
  if (l.flags.caveBreathing && !knows(l, "a_breathing")) learn(l, "a_breathing", "ตำรา");
  if (l.flags.forbiddenArt && !knows(l, "l_forbidden")) learn(l, "l_forbidden", "ตำรา");
  if (l.flags.smithApprentice && !knows(l, "a_long_fist") && l.age >= 12) learn(l, "a_long_fist", "ครูฝึก", true);
}

export const MARTIAL_EVENTS: GameEvent[] = [
  {
    id: "mw.art.beggar_bag",
    minAge: 20,
    maxAge: 90,
    forced: true,
    when: (l) => !!l.flags.beggarBag && !l.flags.beggarBagOpened,
    title: "ถุงผ้าของอาจารย์",
    text: () => "คุณอายุครบยี่สิบ — ถุงผ้าที่อาจารย์ขอทานฝากไว้เมื่อหลายปีก่อน ยังวางอยู่ใต้หมอนเหมือนเดิม",
    choices: [
      { label: "เปิดถุง", run: (l) => { l.flags.beggarBagOpened = true; const s = learn(l, "l_nine_yang", "ตำรา", true); addQi(l, 5); return { text: `ในถุงมีคัมภีร์ผ้าไหมบางเฉียบ ลายมืออาจารย์เขียนไว้ที่หน้าแรก: "คัมภีร์เก้าสุริยัน — ข้าเฝ้ามันมาครึ่งชีวิตเพื่อรอคนที่ใจดีพอ"${s}`, kind: "milestone" }; } },
      { label: "เผาทิ้ง ไม่อยากพัวพัน", run: (l) => { l.flags.beggarBagOpened = true; return meh("ควันจากถุงผ้าลอยขึ้นฟ้า — บางสิ่งที่ยุทธภพตามหามาร้อยปี หายไปในกองไฟเล็กๆ หลังบ้านคุณ"); } },
    ],
  },
  {
    id: "mw.art.market",
    minAge: 14,
    maxAge: 80,
    weight: 3,
    maxTimes: 2,
    title: "ตลาดคัมภีร์",
    prepare: (l) => ({ id: pick(l, ARTS.filter((a) => a.grade <= 2 && !a.sect && !knows(l, a.id))).id, fake: chance(l, 0.3) ? 1 : 0 }),
    text: (_l, c) => { const a = ARTS.find((x) => x.id === c.id)!; return `พ่อค้าคัมภีร์มือสองในซอกตลาดกระซิบว่ามีตำรา「${a.name}」(${TYPE_NAME[a.type]}) ฉบับสมบูรณ์ ราคาสามสิบตำลึง — กระดาษเก่าดูน่าเชื่อถือ แต่ใครจะรู้`; },
    choices: [
      {
        label: "ซื้อ (30 ตำลึง)",
        pros: "ได้วิชาใหม่",
        cons: "อาจเป็นของปลอม",
        req: (l) => (l.money < 30000 ? "ต้องมีเงิน 30 ตำลึง" : undefined),
        run: (l, c) => { addMoney(l, -30000); if (c.fake) return bad("คุณอ่านไปสามหน้าก็รู้ — มันคือตำราทำอาหารที่ถูกแปะปกใหม่ พ่อค้าหายไปจากตลาดแล้ว"); return { text: `ตำราเป็นของจริง${learn(l, String(c.id), "ตำรา", true)}`, kind: "good" }; },
      },
      { label: "ขอดูก่อนซื้อ", check: { stat: "smarts", dc: 55 }, run: (l, c, ok) => (ok ? (c.fake ? meh("คุณเห็นรอยกาวที่สันปก — ของปลอม คุณเดินจากไปโดยไม่เสียสักอีแปะ") : (addMoney(l, -25000), good(`ของจริง คุณต่อราคาได้ห้าตำลึง${learn(l, String(c.id), "ตำรา", true)}`))) : meh("พ่อค้าไม่ยอมให้ดู \"ซื้อหรือไม่ซื้อ\" — คุณเดินจากไป")) },
      { label: "ไม่สนใจ", run: () => meh("คุณเดินผ่านไป") },
    ],
  },
  {
    id: "mw.art.create",
    minAge: 38,
    maxAge: 95,
    weight: (l) => (artsOf(l).filter((a) => a.m >= 50).length >= 3 && comprehension(l) >= 70 ? 12 : 0),
    maxTimes: 1,
    title: "คิดค้นวิชาของตัวเอง",
    text: () => "ระหว่างนั่งสมาธิใต้น้ำตก ท่าวิชาทั้งหมดที่คุณรู้เริ่มไหลรวมกันในหัว — เหมือนแม่น้ำหลายสายกำลังจะกลายเป็นทะเล",
    choices: (["sword", "palm", "fist", "internal"] as ArtType[]).map((type) => ({
      label: `หลอมรวมเป็นวิชา${TYPE_NAME[type]}ของตัวเอง`,
      pros: "วิชาที่ไม่มีใครเคยเห็น — ไม่มีใครอ่านทางออก",
      cons: "ช่วงแรกยังไม่เสถียร ต้องใช้จริงจึงจะสมบูรณ์",
      run: (l: Life) => {
        const name = `${pick(l, ["เพลง", "กระบวน", "วิถี", "เคล็ด"])}${TYPE_NAME[type]}${pick(l, ["สายลมพลิ้ว", "จันทร์ร้าง", "ใต้หล้าเงียบงัน", "ไร้นาม", "คลื่นพันชั้น", "ดอกท้อร่วง"])}`;
        artsOf(l).push({ id: `own_${l.age}`, m: 10, src: "คิดค้นเอง", since: l.age, own: { name, type, school: Number(l.flags.m17Align ?? 0) <= -40 ? "demonic" : "neutral" } });
        addFame(l, 6);
        l.flags.createdArt = name;
        return { text: `สามวันสามคืนต่อมา คุณลืมตาขึ้น —「${name}」ถือกำเนิดขึ้นในโลก`, kind: "milestone" as const };
      },
    })),
  },
];

/** สร้างตัวเลือกฝึกตามวิชาที่รู้ (วิชาละหนึ่งปุ่มต่อวิธี — แสดงเฉพาะวิชาที่ยังฝึกได้) */
export function trainChoices(l: Life) {
  return artsOf(l).flatMap((k) =>
    TRAIN_MODES.map((m) => ({
      art: k.id,
      mode: m.id,
      label: `${artInfo(k).name} (${masteryWord(k.m)}) — ${m.name}`,
      pros: m.pros,
      cons: m.cons,
      locked: m.req?.(l, k.id),
    })),
  );
}

// ทุกปี: ลมปราณ ความเข้าใจ วิชาขัดกัน · วิชาจากสถานะ
yearHooks.push(tickMartial, grantFromStatus);
// อายุขัยยืดตามขั้นฝีมือ
lifespanHooks.push((l) => (l.worldId === "murim" && l.power ? REALM_LIFE[l.power.rank] ?? 0 : 0));

