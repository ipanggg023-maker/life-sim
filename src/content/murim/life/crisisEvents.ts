// Phase 1 — ฉากตัดสินใจระหว่างวิกฤต (ระยะเตรียมรับมือ / ระยะวิกฤต) · ทุกตัวเลือกมีข้อแลกเปลี่ยน ไม่มีคำตอบดีที่สุดเสมอ
import type { GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, money } from "../../../engine/util";
import { familyOf, priceIndex, type CrisisId } from "./world";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const stageIs = (l: Life, id: CrisisId, stage: number) => l.mw?.crisis?.id === id && l.mw.crisis.stage === stage;
const once = (id: CrisisId, stage: number) => (l: Life) => stageIs(l, id, stage) && l.flags[`mwDone_${id}_${stage}_${l.mw!.crisis!.since}`] !== true;
const mark = (l: Life, stage: number) => { const c = l.mw!.crisis!; l.flags[`mwDone_${c.id}_${stage}_${c.since}`] = true; };
const grain = (l: Life) => Math.round(30_000 * priceIndex(l) * Math.max(1, familyOf(l).length));

/** รอดจากศึกปราบกบฏ: ฝีมือและร่างกายช่วยได้จริง */
const draftSurvival = (l: Life) => clamp(0.82 + (l.power?.rank ?? 0) * 0.03 + (l.stats.health - 50) / 400, 0.7, 0.97);

export const CRISIS_EVENTS: GameEvent[] = [
  // ───── ทุพภิกขภัย ─────
  {
    id: "mw.famine.prep",
    minAge: 12,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: once("famine", 1),
    title: "ข้าวเริ่มแพง",
    text: (l) => `ราคาข้าวขึ้นทุกสัปดาห์ ข้าวพอกินทั้งปีสำหรับครอบครัวคุณตอนนี้ราคา ${money(l, grain(l))} — และจะแพงกว่านี้อีก`,
    choices: [
      { label: (l) => `ซื้อข้าวกักตุนไว้ (${money(l, grain(l))})`, show: (l) => l.money >= grain(l), run: (l) => { mark(l, 1); addMoney(l, -grain(l)); l.flags.mwPrepared = true; return good("ยุ้งข้าวหลังบ้านเต็ม คืนนี้คุณนอนหลับสนิทกว่าคนทั้งหมู่บ้าน — ถ้าไม่มีใครรู้"); } },
      { label: "ปลูกมันกับผักป่าเตรียมไว้", run: (l) => { mark(l, 1); addStat(l, "health", -2); if (chance(l, 0.6)) { l.flags.mwPrepared = true; return good("มันเทศหัวเล็กๆ ไม่อร่อย แต่จะช่วยชีวิตได้"); } return meh("ดินแห้งเกินไป หัวมันฝ่อหมด"); } },
      { label: "เชื่อทางการว่าจะเปิดยุ้งหลวงแจก", run: (l) => { mark(l, 1); return meh("ประกาศจากที่ว่าการบอกว่า 'ไม่ต้องตื่นตระหนก' — คุณเลือกเชื่อ"); } },
    ],
  },
  {
    id: "mw.famine.hit",
    minAge: 10,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: once("famine", 2),
    title: "ข้าวยากหมากแพง",
    text: () => "เพื่อนบ้านที่ลูกยังเล็กมาเคาะประตูกลางดึก มือถือชามเปล่า \"ขอข้าวสักกำมือ… ลูกข้าไม่ได้กินมาสามวันแล้ว\"",
    choices: [
      { label: "แบ่งข้าวให้", run: (l) => { mark(l, 2); addFame(l, 3); l.flags.mwSharedFood = Number(l.flags.mwSharedFood ?? 0) + 1; if (l.flags.mwPrepared && chance(l, 0.5)) l.flags.mwPrepared = false; addStat(l, "happiness", 4); return good("ลูกของเขารอด — หลายสิบปีต่อมา เด็กคนนั้นยังจำหน้าคุณได้ (ข้าวในบ้านเหลือน้อยลง)"); } },
      { label: "ปิดประตูเงียบๆ", run: (l) => { mark(l, 2); addStat(l, "happiness", -6); l.flags.mwRefusedFood = true; return meh("เสียงเด็กร้องไห้ค่อยๆ ไกลออกไป ครอบครัวคุณยังมีข้าวกิน"); } },
      { label: "ขายข้าวให้ในราคาตลาด", show: (l) => !!l.flags.mwPrepared, run: (l) => { mark(l, 2); addMoney(l, Math.round(grain(l) * 0.4)); addFame(l, -2); return meh("เขาเอาปิ่นปักผมของภรรยามาแลก คุณได้กำไร แต่เพื่อนบ้านทั้งซอยรู้เรื่องนี้ในวันรุ่งขึ้น"); } },
      {
        label: "ปล้นยุ้งข้าวของเศรษฐีกับชาวบ้าน",
        tone: "danger",
        check: { stat: "luck", dc: 55 },
        run: (l, _c, ok) => {
          mark(l, 2);
          if (ok) { l.flags.mwPrepared = true; addFame(l, 2); return good("ข้าวหลายร้อยกระสอบถูกแบ่งให้ทั้งหมู่บ้าน คนเรียกคุณว่าผู้กล้า — แต่ทางการเรียกว่าโจร"); }
          if (chance(l, 0.25)) { kill(l, "ถูกทหารรักษายุ้งข้าวฆ่าตายระหว่างปล้นข้าวช่วงทุพภิกขภัย"); return bad("ลูกธนูดอกแรกปักกลางอก…"); }
          addStat(l, "health", -randInt(l, 10, 20)); l.flags.mwWanted = true;
          return bad("ทหารยามไล่ฟันจนคุณต้องหนีเข้าป่า ชื่อคุณถูกติดประกาศจับ");
        },
      },
    ],
  },
  // ───── กบฏชาวนา ─────
  {
    id: "mw.rebellion.prep",
    minAge: 15,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: once("rebellion", 1),
    title: "ประกาศเกณฑ์ไพร่พล",
    text: (l) => `ทหารหลวงมาที่หมู่บ้านพร้อมบัญชีรายชื่อ ทุกบ้านต้องส่งชายฉกรรจ์หนึ่งคนไปรบกับกบฏ — ${l.gender === "m" ? "ชื่อคุณอยู่ในบัญชี" : "พี่น้องผู้ชายในบ้านคุณอยู่ในบัญชี"}`,
    choices: [
      { label: "ไปเป็นทหารตามคำสั่ง", survival: (l) => draftSurvival(l), run: (l) => { mark(l, 1); l.flags.mwSoldier = true; addFame(l, 2); if (!chance(l, draftSurvival(l))) { kill(l, "ตายในสนามรบระหว่างปราบกบฏชาวนา"); return bad("ศึกแรกก็เป็นศึกสุดท้าย"); } addStat(l, "health", -randInt(l, 3, 12)); addMoney(l, 20_000); return meh("คุณกลับมาพร้อมแผลเป็นและเบี้ยเลี้ยงก้อนเล็กๆ — และภาพที่ลืมไม่ลง"); } },
      { label: (l) => `จ่ายเงินให้คนอื่นไปแทน (${money(l, 60_000)})`, show: (l) => l.money >= 60_000, run: (l) => { mark(l, 1); addMoney(l, -60_000); return meh("ลูกชายคนเลี้ยงหมูข้างบ้านไปแทน แม่ของเขามองคุณทุกครั้งที่เดินผ่าน"); } },
      { label: "หนีเข้าป่ากับครอบครัว", check: { stat: "luck", dc: 45 }, run: (l, _c, ok) => { mark(l, 1); if (ok) { l.flags.mwPrepared = true; return good("ถ้ำในหุบเขาลึกพอให้ทั้งครอบครัวซ่อนจนกว่าศึกจะสงบ"); } l.flags.mwWanted = true; addStat(l, "happiness", -8); return bad("ทหารตามรอยมาถึง คุณหนีรอดแต่ถูกประกาศเป็นผู้หนีราชการ"); } },
      { label: "แอบไปเข้ากับฝ่ายกบฏ", tone: "danger", run: (l) => { mark(l, 1); l.flags.mwRebel = true; addFame(l, -3); return meh("คืนนั้นคุณโพกผ้าที่หน้าผาก — ถ้ากบฏชนะ คุณคือผู้ก่อตั้งราชวงศ์ ถ้าแพ้… อย่าคิดถึงมัน"); } },
    ],
  },
  {
    id: "mw.rebellion.hit",
    minAge: 10,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: once("rebellion", 2),
    title: "เมืองแตก",
    text: (l) => l.flags.mwRebel ? "กองกบฏที่คุณร่วมด้วยบุกเข้าเมือง พวกเขาเริ่มปล้นบ้านชาวบ้านธรรมดา — รวมถึงถนนที่คุณเคยอยู่" : "เสียงกลองศึกดังทั้งคืน ประตูเมืองแตก ทหารกบฏกรูเข้ามาตามตรอก บ้านถัดไปถูกจุดไฟแล้ว",
    choices: [
      { label: "ยืนขวางประตูบ้าน ปกป้องครอบครัว", tone: "danger", check: { stat: "health", dc: 55 }, survival: (l) => l.power ? 0.9 : 0.8, run: (l, _c, ok) => { mark(l, 2); if (ok) { addFame(l, 4); return good("ทหารกบฏสามคนถอยไปหาบ้านหลังอื่นที่ง่ายกว่า ครอบครัวคุณรอดทั้งหมด"); } if (chance(l, l.power ? 0.1 : 0.2)) { kill(l, "ถูกทหารกบฏฟันตายหน้าประตูบ้านขณะปกป้องครอบครัว"); return bad("คุณล้มลงหน้าประตู — แต่ประตูยังไม่เปิด"); } addStat(l, "health", -randInt(l, 15, 30)); return bad("ดาบฟันเฉียดกระดูก คุณรอด และพวกมันก็ไปแล้ว"); } },
      { label: "พาครอบครัวหนีทางท่อระบายน้ำ", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { mark(l, 2); if (ok) { l.flags.mwPrepared = true; return good("ท่อระบายน้ำเหม็นแทบสำลัก แต่พาทุกคนออกนอกเมืองได้"); } addStat(l, "happiness", -10); addMoney(l, -Math.round(Math.max(0, l.money) * 0.3)); return bad("ทางตันจนต้องย้อนกลับ ทรัพย์สินที่ขนมาหายไปครึ่งหนึ่งระหว่างหนี"); } },
      { label: "ซ่อนตัวในห้องเก็บของ รอให้ผ่านไป", run: (l) => { mark(l, 2); addMoney(l, -Math.round(Math.max(0, l.money) * 0.5)); addStat(l, "happiness", -8); return meh("พวกมันขนของมีค่าไปครึ่งบ้าน แต่ไม่มีใครเปิดประตูห้องเก็บของ"); } },
      { label: "ห้ามพวกกบฏปล้นชาวบ้าน", show: (l) => !!l.flags.mwRebel, check: { stat: "looks", dc: 55 }, run: (l, _c, ok) => { mark(l, 2); if (ok) { addFame(l, 6); return good("หัวหน้ากองฟังคุณ ถนนสายนั้นรอด ชาวบ้านไม่รู้เลยว่ากบฏคนนั้นเคยเป็นเพื่อนบ้านของพวกเขา"); } addStat(l, "health", -10); return bad("พวกเดียวกันหันมาชกคุณ 'อย่ามาทำเป็นคนดีตอนนี้'"); } },
    ],
  },
  // ───── โรคระบาด ─────
  {
    id: "mw.plague.hit",
    minAge: 12,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: once("plague", 2),
    title: "ห่าลงเมือง",
    text: (l) => { const f = familyOf(l)[0]; return f ? `${f.name}เริ่มตัวร้อนและไอไม่หยุด หมอในเมืองเหลือไม่กี่คน ค่ารักษาแพงกว่าเดิมสามเท่า` : "คนในเรือนแถวเดียวกับคุณป่วยไปครึ่งหนึ่งแล้ว ทางการเริ่มปิดถนนและเผาบ้านที่มีคนตาย"; },
    choices: [
      { label: (l) => `จ้างหมอดีที่สุดที่หาได้ (${money(l, 80_000)})`, show: (l) => l.money >= 80_000, run: (l) => { mark(l, 2); addMoney(l, -80_000); l.flags.mwPrepared = true; return good("หมอชราเปิดกล่องเข็มทองกับยาที่ไม่มีใครมี — คนในบ้านอาการดีขึ้น"); } },
      { label: "ดูแลคนป่วยเอง ไม่ทิ้งใคร", check: { stat: "health", dc: 50 }, run: (l, _c, ok) => { mark(l, 2); addStat(l, "happiness", 3); if (ok) { addFame(l, 2); return good("คุณป้อนยาต้มทุกสองชั่วยาม ไม่หลับมาเจ็ดวัน — และไม่ติดโรค"); } addStat(l, "health", -randInt(l, 15, 25)); if (chance(l, 0.15)) { kill(l, "ติดโรคระบาดขณะดูแลคนป่วยในบ้าน"); return bad("ไข้ขึ้นสูงในคืนที่สิบ…"); } return bad("คุณติดโรคเสียเอง นอนซมอยู่เดือนหนึ่งเต็ม"); } },
      { label: "ปิดบ้าน ไม่ให้ใครเข้าออก", run: (l) => { mark(l, 2); l.flags.mwPrepared = true; addStat(l, "happiness", -5); return meh("คุณตอกไม้ปิดประตู ส่งอาหารผ่านช่องหน้าต่าง — ปลอดภัยกว่า แต่เหงาจนแทบบ้า"); } },
      { label: "หนีไปบ้านญาติต่างเมือง", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => { mark(l, 2); if (ok) { l.flags.mwPrepared = true; return good("ญาติที่ชนบทรับคุณไว้ อากาศบนเขาบริสุทธิ์กว่าในเมืองมาก"); } addFame(l, -2); return bad("ด่านปิดทุกทาง ทหารไล่คุณกลับเมือง และจดชื่อไว้ว่าพยายามหนี"); } },
    ],
  },
  // ───── พรรคมารผงาด ─────
  {
    id: "mw.cult.prep",
    minAge: 16,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: (l) => once("cult", 1)(l) && !!l.power,
    title: "พันธมิตรยุทธภพเรียกคน",
    text: () => "ทูตจากพันธมิตรยุทธภพมาพร้อมป้ายเชิญ \"ทุกคนที่ถือกระบี่ได้ ต้องช่วยกันหยุดพรรคมาร — หรือรอให้พวกมันมาถึงบ้าน\"",
    choices: [
      { label: "รับป้ายเชิญ เข้าร่วมทัพ", run: (l) => { mark(l, 1); l.flags.mwAlliance = true; addFame(l, 4); return good("ชื่อคุณถูกจารึกในบัญชีผู้กล้า — และในบัญชีของพรรคมารด้วย"); } },
      { label: "ปฏิเสธ ปกป้องแค่ครอบครัวตัวเอง", run: (l) => { mark(l, 1); l.flags.mwPrepared = true; addFame(l, -2); return meh("ทูตมองคุณนิ่งๆ แล้วเดินจากไป คุณย้ายครอบครัวไปอยู่หมู่บ้านลึกในหุบเขา"); } },
      { label: "แอบส่งข่าวให้พรรคมาร", tone: "danger", run: (l) => { mark(l, 1); l.flags.mwCultSpy = true; addMoney(l, 200_000); return meh("ทองคำหนักมือ ธงดำจะผ่านหมู่บ้านคุณไปโดยไม่แตะต้อง — ถ้าไม่มีใครรู้ว่าใครเป็นคนบอก"); } },
    ],
  },
];
