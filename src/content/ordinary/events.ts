// โลกธรรมดา: ชีวิตของคนเดียวในโลกที่มีระบบ
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, shortName } from "../../engine/util";
import { fightOdds, markTurn, trackOf } from "../hunter/power";
import { effSys } from "../gameStats";
import { gainSysExp } from "./sys";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const job = (l: Life) => l.job?.careerId ?? "";
const has = (l: Life) => !!l.sys;
const foe = (l: Life, d = 0) => clamp((l.power?.rank ?? 0) + d, 0, 8);

const SYSTEM: GameEvent[] = [
  {
    id: "ord.secret",
    minAge: 8,
    maxAge: 60,
    when: has,
    title: "ความลับที่บอกใครไม่ได้",
    text: () => "คุณเผลอพูดกับหน้าต่างระบบเสียงดังกลางโต๊ะกินข้าว ทุกคนในบ้านหันมามอง",
    choices: [
      {
        label: "เล่าความจริงทั้งหมด",
        run: (l) => {
          const fam = l.people.filter((p) => p.alive && ["father", "mother", "sibling", "spouse", "partner"].includes(p.relation));
          if (fam.length && chance(l, 0.35)) { const p = pick(l, fam); p.bond = clamp(p.bond + 15, 0, 100); return good(`ทุกคนหัวเราะ ยกเว้น${shortName(p)}ที่มองคุณอย่างจริงจัง "ฉันเชื่อ" — ตั้งแต่วันนั้นคุณมีคนรู้ความลับหนึ่งคน`); }
          addStat(l, "happiness", -4);
          return bad("แม่พาคุณไปหาจิตแพทย์ในสัปดาห์ถัดมา");
        },
      },
      { label: "แกล้งทำเป็นซ้อมบทละคร", run: () => meh("ทุกคนพยักหน้าแบบงงๆ แล้วกินข้าวต่อ") },
    ],
  },
  {
    id: "ord.shop",
    minAge: 10,
    maxAge: 80,
    maxTimes: 3,
    when: (l) => has(l) && l.money >= 50_000,
    system: true,
    text: () => "[ร้านค้าระบบเปิดแล้ว] แลกเงินจริงเป็นไอเทมพิเศษได้ — สินค้าวันนี้: ยาเพิ่มค่าสถานะ (50,000 บาท)",
    choices: [
      {
        label: "ซื้อ",
        run: (l) => {
          addMoney(l, -50_000);
          const k = pick(l, ["health", "smarts", "looks", "luck"] as const);
          addStat(l, k, randInt(l, 4, 8));
          return { text: "[ระบบ] ใช้ไอเทมสำเร็จ — ค่าสถานะเพิ่มขึ้นถาวร", kind: "system" };
        },
      },
      { label: "ไม่ซื้อ", run: () => meh("[ร้านค้าจะเปิดอีกครั้งในเวลาที่ไม่แน่นอน]") },
    ],
  },
  {
    id: "ord.glitch",
    minAge: 18,
    maxAge: 80,
    weight: 3,
    when: has,
    title: "ข้อความที่ไม่ควรเห็น",
    system: true,
    text: () => "หน้าต่างระบบกระตุกแล้วแสดงข้อความแปลกๆ ขึ้นมาครู่หนึ่ง\n「บันทึกผู้ใช้คนก่อนหน้า: ล้มเหลว — สาเหตุ: เชื่อใจคนผิด」",
    auto: (l) => { l.flags.systemLore = true; addStat(l, "smarts", 2); return "system"; },
  },
];

const PATH_EVENTS: GameEvent[] = [
  {
    id: "ord.school_gang",
    minAge: 13,
    maxAge: 20,
    when: (l) => has(l) && effSys(l, "str") >= 30,
    title: "หัวหน้าแก๊งโรงเรียน",
    text: () => "หัวหน้าแก๊งที่คุมสามโรงเรียนรอบเมืองส่งคนมาบอกว่า \"หลังเลิกเรียน ดาดฟ้าตึกสาม มาคนเดียว\"",
    choices: [
      {
        label: "ไปตามนัด",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 1)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 6); gainSysExp(l, 300); return good("หัวหน้าแก๊งนอนกองอยู่บนดาดฟ้า วันรุ่งขึ้นทั้งสามโรงเรียนรู้ชื่อคุณ"); }
          addStat(l, "health", -randInt(l, 8, 16));
          return bad("คุณแพ้ยับ — แต่ระบบบันทึกท่าของเขาไว้ทั้งหมดแล้ว");
        },
      },
      { label: "ไม่ไป", run: (l) => { addStat(l, "happiness", -3); return meh("พรุ่งนี้โต๊ะเรียนของคุณถูกเขียนด่าเต็มไปหมด"); } },
    ],
  },
  {
    id: "ord.trainee_sabotage",
    minAge: 13,
    maxAge: 30,
    when: (l) => ["o_trainee", "o_model"].includes(job(l)),
    title: "เด็กฝึกที่ไม่ชอบคุณ",
    text: () => "ก่อนขึ้นประเมินรายเดือน รองเท้าเต้นของคุณถูกกรีดพื้นขาด เด็กฝึกคนหนึ่งยิ้มมุมปากจากอีกฝั่งห้อง",
    choices: [
      { label: "เต้นเท้าเปล่า", skill: ["perform"], check: { stat: "looks", dc: 55 }, run: (l, _c, ok) => { if (ok) { addFame(l, 6); return good("กรรมการลุกขึ้นปรบมือ \"ใครสอนให้เต้นเท้าเปล่าแบบนี้\" — คลิปนั้นหลุดไปถึงโซเชียล"); } addStat(l, "health", -5); return bad("เท้าคุณลื่นตอนหมุนตัว อันดับรายเดือนร่วงลงสิบอันดับ"); } },
      { label: "แฉต่อหน้าทุกคน", check: { stat: "smarts", dc: 50 }, run: (_l, _c, ok) => (ok ? good("กล้องวงจรปิดยืนยัน — เด็กคนนั้นโดนไล่ออกจากค่าย") : bad("ไม่มีหลักฐาน คุณกลายเป็นคนขี้ฟ้องในสายตาทุกคน")) },
    ],
  },
  {
    id: "ord.hospital_politics",
    minAge: 24,
    maxAge: 65,
    when: (l) => job(l) === "doctor",
    title: "การเมืองในโรงพยาบาล",
    text: () => "หัวหน้าแผนกเอาชื่อตัวเองไปใส่ในงานวิจัยที่คุณทำมาสามปี แล้วขึ้นรับรางวัลบนเวทีต่อหน้าคุณ",
    choices: [
      { label: "ยื่นหลักฐานต่อคณะกรรมการ", skill: ["medical", "study"], check: { stat: "smarts", dc: 58 }, run: (l, _c, ok) => { if (ok) { addFame(l, 10); if (l.job) l.job.performance = clamp(l.job.performance + 20, 0, 100); return good("หัวหน้าแผนกถูกสอบสวน ชื่อคุณกลับมาอยู่บนงานวิจัย และคุณได้ตำแหน่งเขา"); } addStat(l, "happiness", -8); return bad("คณะกรรมการเป็นพวกเดียวกัน คุณถูกย้ายไปเวรดึกถาวร"); } },
      { label: "ปล่อยไป แล้วเก็บผลงานถัดไปไว้เอง", run: (l) => { gainSysExp(l, 300); return meh("คุณเงียบ — และเริ่มงานวิจัยชิ้นใหม่ที่ใหญ่กว่าเดิมสิบเท่า"); } },
    ],
  },
  {
    id: "ord.vr_launch",
    minAge: 14,
    maxAge: 50,
    when: (l) => ["o_progamer", "streamer"].includes(job(l)) || (has(l) && effSys(l, "agi") >= 35),
    title: "เกม VR เปิดตัว",
    text: () => "เกม VR ที่ทั้งโลกรอคอยเปิดเซิร์ฟเวอร์วันแรก — ระบบของคุณกะพริบ 「ตรวจพบคลาสลับที่ยังไม่มีใครค้นพบ」",
    choices: [
      {
        label: "ตามหาคลาสลับทั้งคืน",
        skill: ["game"],
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { gainSysExp(l, 400); l.sys && (l.sys.agi += 3); addFame(l, 8); markTurn(l); return { text: "คุณกลายเป็นผู้เล่นคนเดียวในโลกที่มีคลาสนี้ — ทุกกิลด์ส่งข้อความมาเต็มกล่อง", kind: "milestone" }; }
          return meh("คุณวนหาจนเช้า เจอแต่ NPC ขายมันฝรั่ง");
        },
      },
      { label: "เก็บเลเวลตามปกติ", run: (l) => { gainSysExp(l, 250); return meh("คุณติดอันดับร้อยแรกของเซิร์ฟเวอร์ในสัปดาห์แรก"); } },
    ],
  },
  {
    id: "ord.critic",
    minAge: 18,
    maxAge: 70,
    when: (l) => job(l) === "o_chef_job",
    title: "นักวิจารณ์อาหาร",
    text: () => "นักวิจารณ์อาหารที่ปากร้ายที่สุดในประเทศเดินเข้าร้านคุณโดยไม่จอง แล้วสั่ง \"อะไรก็ได้ที่เชฟภูมิใจที่สุด\"",
    choices: [
      { label: "ทำเมนูจากความทรงจำวัยเด็ก", skill: ["cook"], check: { stat: "happiness", dc: 55 }, run: (l, _c, ok) => { if (ok) { addFame(l, 12); addMoney(l, 500_000); return good("นักวิจารณ์ร้องไห้กลางร้าน รีวิวของเขาทำให้คิวจองยาวสามเดือน"); } addFame(l, -4); return bad("\"ซื่อเกินไป\" — คำเดียวที่เขาเขียนในรีวิว"); } },
      { label: "ทำเมนูแฟนซีที่ระบบแนะนำ", run: (l) => { addFame(l, 4); return meh("\"เก่ง แต่ไม่มีหัวใจ\" — รีวิวที่ดีแต่ไม่ดีพอ"); } },
    ],
  },
  {
    id: "ord.chaebol_dinner",
    minAge: 18,
    maxAge: 60,
    when: (l) => (l.regressions ?? 0) > 0 && (l.wealth === "rich" || l.wealth === "elite"),
    title: "มื้อค่ำของตระกูล",
    text: () => "มื้อค่ำประจำเดือนของตระกูล คุณปู่ประธานถามคำถามเดียวกับที่ถามในชาติก่อน \"ถ้าเป็นแก จะทำอะไรกับบริษัทนี้\" — ครั้งก่อนคุณตอบผิด",
    choices: [
      {
        label: "ตอบด้วยสิ่งที่รู้จากอนาคต",
        skill: ["business"],
        check: { stat: "smarts", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { addMoney(l, 20_000_000); addFame(l, 8); markTurn(l); return { text: "คุณปู่วางตะเกียบแล้วมองคุณนาน \"พรุ่งนี้มาที่ห้องทำงานฉัน\" — ญาติทุกคนหน้าซีด", kind: "milestone" }; }
          return bad("คำตอบดีเกินไปจนคุณปู่สงสัย — ญาติทั้งโต๊ะเริ่มจับตาคุณ");
        },
      },
      { label: "แกล้งตอบโง่ๆ เหมือนชาติก่อน", run: (l) => { l.flags.hiddenHeir = true; return meh("ทุกคนหัวเราะเยาะคุณเหมือนเดิม — ดีแล้ว ให้พวกเขาประมาทไปก่อน"); } },
    ],
  },
];

const LIFE: GameEvent[] = [
  {
    id: "ord.viral",
    minAge: 14,
    maxAge: 70,
    maxTimes: 2,
    when: (l) => has(l) && l.fame >= 10,
    text: (l) => pick(l, [
      "คลิปคุณช่วยคนจากรถไฟฟ้ามียอดดูสิบล้านในคืนเดียว",
      "มีคนตัดคลิปคุณสมัยก่อนดังมาเทียบกับตอนนี้ ทั้งโซเชียลตั้งชื่อเล่นให้คุณว่า 'ตัวเอกการ์ตูน'",
    ]),
    auto: (l) => { addFame(l, randInt(l, 3, 7)); return "good"; },
  },
  {
    id: "ord.scandal",
    minAge: 18,
    maxAge: 70,
    when: (l) => l.fame >= 30,
    title: "ข่าวฉาว",
    text: () => "สำนักข่าวซุบซิบลงรูปคุณกับคนแปลกหน้าในร้านอาหาร พาดหัวว่า 'ความลับที่ซ่อนไว้'",
    choices: [
      { label: "แถลงข่าวตรงๆ", skill: ["social", "perform"], check: { stat: "looks", dc: 55 }, run: (l, _c, ok) => (ok ? (addFame(l, 4), good("คนแปลกหน้าคือแม่บ้านที่เลี้ยงคุณมา — ข่าวกลับกลายเป็นเรื่องซึ้ง")) : (addFame(l, -10), bad("ยิ่งแถลง ยิ่งดูเหมือนแก้ตัว"))) },
      { label: "เงียบ รอข่าวซา", run: (l) => { addFame(l, -4); return meh("สามเดือนผ่านไป ไม่มีใครจำข่าวนี้ได้อีก"); } },
    ],
  },
  {
    id: "ord.fan",
    minAge: 16,
    maxAge: 70,
    when: (l) => l.fame >= 20,
    text: () => "แฟนคลับคนหนึ่งยืนรอหน้าบ้านคุณทุกเช้ามาสามเดือน วันนี้เธอถือจดหมายฉบับหนาไว้ในมือ",
    choices: [
      { label: "รับจดหมาย แล้วขอบคุณ", run: (l) => { addStat(l, "happiness", 5); return good("ในจดหมายเล่าว่าคลิปของคุณทำให้เธอเลิกคิดฆ่าตัวตาย — คุณอ่านซ้ำทั้งคืน"); } },
      { label: "แจ้งตำรวจ", run: (l) => { addFame(l, -2); return meh("เธอไม่มาอีก — คุณไม่รู้เลยว่าในจดหมายเขียนอะไร"); } },
    ],
  },
  {
    id: "ord.mafia_offer",
    minAge: 18,
    maxAge: 60,
    when: (l) => has(l) && l.fame >= 15,
    title: "ข้อเสนอที่ปฏิเสธไม่ได้",
    text: () => "ชายใส่สูทดำวางซองเงินหนาเตอะไว้บนโต๊ะ \"เจ้านายชอบฝีมือคุณ ทำงานให้เราสักงาน แล้วชีวิตคุณจะง่ายขึ้นมาก\"",
    choices: [
      { label: "ปฏิเสธ", odds: (l) => fightOdds(l, foe(l)), run: (l, _c, ok) => { if (ok) { addFame(l, 3); return good("ชายคนนั้นยิ้ม \"น่าเสียดาย\" แล้วเดินออกไป — ไม่มีอะไรเกิดขึ้นตามมา"); } addStat(l, "health", -15); if (l.stats.health <= 0) { kill(l, "ถูกมาเฟียลอบทำร้าย"); return bad("รถคันนั้นไม่ได้เบรก…"); } return bad("สามวันต่อมา คุณถูกรุมทำร้ายในลานจอดรถ"); } },
      { label: "รับงาน", run: (l) => { addMoney(l, 3_000_000); addFame(l, -10); l.flags.mafiaDebt = true; return bad("เงินก้อนนั้นซื้อคอนโดได้ทั้งห้อง — แต่ตั้งแต่วันนั้น โทรศัพท์จากเบอร์แปลกๆ ไม่เคยหยุด"); } },
    ],
  },
  {
    id: "ord.mentor_kid",
    minAge: 28,
    maxAge: 70,
    when: (l) => has(l) && (l.sys?.level ?? 0) >= 8,
    text: () => "เด็กคนหนึ่งเขียนจดหมายมาบอกว่าอยากเป็นเหมือนคุณ แต่ที่บ้านไม่มีเงินส่งเรียน",
    choices: [
      { label: "ออกทุนให้", run: (l) => { addMoney(l, -300_000); createPerson(l, "ally", { age: randInt(l, 12, 15), bond: 70, job: "เด็กที่คุณให้ทุน" }); addStat(l, "happiness", 8); return good("สิบปีต่อมา เด็กคนนั้นขึ้นเวทีรับรางวัล แล้วพูดชื่อคุณเป็นคนแรก"); } },
      { label: "ตอบจดหมายให้กำลังใจ", run: (l) => { addStat(l, "happiness", 2); return meh("คุณเขียนตอบสามหน้า ไม่รู้ว่าจะช่วยได้แค่ไหน"); } },
    ],
  },
  {
    id: "ord.no_system",
    minAge: 30,
    maxAge: 80,
    when: (l) => !has(l) && trackOf(l) === "never" && l.age >= 30,
    text: (l) => pick(l, [
      "คุณดูการ์ตูนเรื่องคนธรรมดาที่วันหนึ่งได้ระบบ แล้วนึกขำ — ชีวิตจริงไม่มีหน้าต่างสีฟ้ามาช่วยใคร",
      "เพื่อนเก่าในงานเลี้ยงรุ่นเล่าว่าชีวิตยากแค่ไหน คุณพบว่าทุกคนต่างก็สู้มาด้วยตัวเองทั้งนั้น",
    ]),
    auto: (l) => { addStat(l, "happiness", 3); return "normal"; },
  },
];

export const ORDINARY_EVENTS: GameEvent[] = [...SYSTEM, ...PATH_EVENTS, ...LIFE];
