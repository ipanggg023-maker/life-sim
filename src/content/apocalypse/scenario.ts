// วันสิ้นโลก: วันที่ระบบมาถึง · ฉากภารกิจหลัก (บังคับ) · ฉากภารกิจย่อย (ออกเอง)
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, openHiddenSlot, runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { HunterClass, Life } from "../../engine/types";
import { addFame, addMoney, addStat, checkChance, clamp, log, shortName } from "../../engine/util";
import { startArc } from "../manhwa";
import { CLASSES, awaken, classById, fightOdds, gateRewards, luckyRankUp, markTurn, offerClasses, rankName, rollAwakening, survivalOdds } from "../hunter/power";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

export const LAST_SCENARIO = 8;
export const scenarioNo = (l: Life) => Number(l.flags.mainScenario ?? 0);
/** โลกพังแล้วและยังไม่ฟื้น */
export const inRuins = (l: Life) => !!l.flags.doomed && !l.flags.rebuilt;

// ───────────────────────── วันสิ้นโลก ─────────────────────────

const APOC_CLASSES = CLASSES.filter((c) => c.world === "apocalypse");
const offered = (c: Ctx, id: HunterClass) => String(c.offer ?? "").split(",").includes(id);

/** ผลของคืนแรก: ครอบครัวหาย งานหาย เงินในธนาคารไร้ค่า */
function doomfall(l: Life) {
  l.flags.doomed = true;
  l.flags.mainScenario = 1;
  markTurn(l); // วันที่โลกพังคือจุดเปลี่ยนของชีวิตอยู่แล้ว
  l.flags.mainNext = l.age + randInt(l, 2, 3); // ภาคใหม่เปิดเองตอนได้ระบบ (awakenArc)
  const lost: string[] = [];
  for (const p of l.people) {
    if (!p.alive || p.relation === "ally") continue;
    if (chance(l, 0.3)) {
      p.alive = false;
      lost.push(shortName(p));
    }
  }
  if (lost.length) {
    l.flags.lossAge = l.age;
    addStat(l, "happiness", -20);
    log(l, `💔 คืนแรกของวันสิ้นโลก คุณไม่ได้ข่าวจาก${lost.join(", ")}อีกเลย`, "bad");
  }
  const missing = l.people.filter((p) => p.alive && ["father", "mother", "sibling", "spouse", "child", "partner"].includes(p.relation));
  if (missing.length && chance(l, 0.4)) l.flags.missingId = pick(l, missing).id;
  if (l.job && l.job.careerId !== "survivor") {
    log(l, "บริษัท ร้านค้า โรงเรียน — ทุกอย่างที่เคยเป็นงานของคุณหายไปในคืนเดียว", "bad");
    l.job = undefined;
  }
  if (l.education.stage !== "none" && l.education.stage !== "done") l.education.stage = "done";
  if (l.money > 0) l.money = Math.round(l.money * 0.2);
  const stock = Number(l.flags.stockpile ?? 0);
  if (stock) {
    addStat(l, "health", stock * 4);
    log(l, `เสบียงที่ตุนไว้ ${stock} ลังช่วยให้คุณผ่านเดือนแรกได้โดยไม่อดอยาก`, "good");
  }
}

function rollInto(l: Life, c: Ctx, bonus: number) {
  l.flags.forceAwaken = true; // วันสิ้นโลก ทุกคนได้ระบบ
  const extra = (l.flags.knowsDoom ? 1 : 0) + (l.flags.readNovel ? 1 : 0);
  c.rank = Math.max(0, rollAwakening(l, bonus + extra));
  delete l.flags.forceAwaken;
  const offer = offerClasses(l);
  if (l.flags.readNovel && !offer.includes("a_reader")) offer.push("a_reader");
  c.offer = offer.join(",");
}

export const DOOM: GameEvent = {
  id: "apoc.doom",
  minAge: 4,
  maxAge: 90,
  forced: true,
  when: (l) => !l.flags.doomed && l.age === Number(l.flags.awakenAge ?? 25),
  title: "วันสิ้นโลก",
  system: true,
  text: (l) =>
    `${l.flags.knowsDoom ? "วันที่คุณรอคอยมาทั้งชีวิตมาถึงแล้ว — " : "วันธรรมดาวันหนึ่ง "}เวลา 19:00 น. ทุกจอในเมืองดับพร้อมกัน แล้วหน้าต่างสีน้ำเงินก็ปรากฏตรงหน้าทุกคน\n` +
    "[ฉากภารกิจหลัก #1 — ราคาของการมีชีวิต]\nเงื่อนไข: ฆ่าสิ่งมีชีวิตอย่างน้อยหนึ่งตัวภายใน 10 นาที\nล้มเหลว: ตาย",
  choices: [
    {
      label: "บี้แมลงที่เกาะกระจกหน้าต่าง",
      check: { stat: "smarts", dc: 45, bonus: (l) => (l.flags.knowsDoom || l.flags.readNovel ? 0.3 : 0) },
      run: (l, c, ok) => {
        doomfall(l);
        rollInto(l, c, ok ? 1 : 0);
        return ok
          ? sys("คุณนึกออกก่อนใคร — แมลงก็เป็นสิ่งมีชีวิต ข้างนอกเสียงกรีดร้องดังขึ้นพร้อมกันทั้งเมือง", "awaken")
          : bad(`คุณหาแมลงไม่เจอจนวินาทีสุดท้าย ต้องแย่งกับคนข้างๆ จนบาดเจ็บ${hurt(l, 8, 15)}`, "awaken");
      },
    },
    {
      label: "สู้กับชายที่คลั่งถือมีดเข้ามา",
      tone: "danger",
      check: { stat: "health", dc: 55 },
      run: (l, c, ok) => {
        doomfall(l);
        if (!ok && chance(l, 0.4)) {
          kill(l, "ถูกฆ่าในฉากภารกิจแรกของวันสิ้นโลก");
          return bad("คมมีดเร็วกว่าที่คิด…");
        }
        rollInto(l, c, ok ? 1 : 0);
        if (ok) addFame(l, 3);
        return ok ? good("คุณล้มเขาได้ และช่วยคนในขบวนรถไฟไว้ได้ทั้งตู้", "awaken") : bad(`คุณรอดมาได้อย่างหวุดหวิด${hurt(l, 12, 25)}`, "awaken");
      },
    },
    {
      label: "ไม่ฆ่าใคร — กอดเด็กที่ร้องไห้อยู่ข้างๆ ไว้",
      tone: "special",
      check: { stat: "luck", dc: 50 },
      survival: (l) => checkChance(l, "luck", 50),
      run: (l, c, ok) => {
        doomfall(l);
        if (!ok) {
          kill(l, "ล้มเหลวในฉากภารกิจแรก — เลือกที่จะไม่ฆ่า");
          return bad("เวลาหมดลง… แต่เด็กคนนั้นรอด");
        }
        rollInto(l, c, 2);
        markTurn(l);
        return { text: "[ดวงดาวดวงหนึ่งประทับใจในความโง่เขลาของคุณ — ยกเว้นเงื่อนไขให้หนึ่งครั้ง]", kind: "system", next: "awaken" };
      },
    },
  ],
  scenes: {
    awaken: {
      title: "ระบบ",
      system: true,
      text: (_l, c) => `[ฉากภารกิจหลัก #1 สำเร็จ] ระบบประเมินผู้รอดชีวิต — ระดับ:【${rankName(Number(c.rank))}】\nกรุณาเลือกเส้นทาง`,
      choices: APOC_CLASSES.map((cls) => ({
        label: `${cls.emoji} ${cls.name} — ${cls.desc}`,
        tone: cls.id === "a_reader" ? ("special" as const) : undefined,
        show: (_l: Life, c: Ctx) => offered(c, cls.id),
        run: (l: Life, c: Ctx): Outcome => {
          const rank = Number(c.rank);
          awaken(l, rank, cls.id);
          openHiddenSlot(l, "ระบบตื่นขึ้น");
          return { text: `☄️ คุณกลายเป็น${classById(cls.id).name} ระดับ ${rankName(rank)} — โลกเก่าจบลงแล้ว`, kind: "milestone" };
        },
      })),
    },
  },
};

function sys(text: string, next?: string): Outcome {
  return { text, kind: "system", next };
}

function hurt(l: Life, min: number, max: number, cause = "บาดเจ็บสาหัสหลังวันสิ้นโลก"): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

// ───────────────────────── ฉากภารกิจหลัก ─────────────────────────

const MAIN = [
  "",
  "",
  { name: "ราชาแห่งสถานี", desc: "ทุกสถานีรถไฟฟ้าต้องมีผู้ปกครองหนึ่งคน สถานีที่ไม่มีราชาจะถูกปิดตายพร้อมทุกคนข้างใน", foe: "ผู้ท้าชิงบัลลังก์สถานีที่คลั่งอำนาจ" },
  { name: "คลื่นสัตว์อสูรจากทะเล", desc: "ระดับน้ำทะเลสูงขึ้นสิบเมตรในคืนเดียว และมีบางอย่างเดินขึ้นมาจากน้ำ", foe: "ราชินีปลาหมึกยักษ์" },
  { name: "ภัยพิบัติระดับเมือง", desc: "มังกรเพลิงลงจอดกลางเมือง ทุกคนในรัศมีห้ากิโลเมตรต้องเลือก: หนีหรือสู้", foe: "มังกรเพลิงตัวแรกของโลก" },
  { name: "สงครามผู้รอดชีวิต", desc: "ระบบประกาศว่ากลุ่มที่ครอบครองพื้นที่มากที่สุดจะได้รางวัลใหญ่ — และกลุ่มที่แพ้จะถูกลบ", foe: "จอมทัพของกลุ่มคู่แข่ง" },
  { name: "ประตูนรกเปิด", desc: "ท้องฟ้าแตกออกเป็นวง ปีศาจจากโลกอื่นเดินลงมาเป็นแถว", foe: "เจ้านรกชั้นที่หนึ่ง" },
  { name: "ราชาปีศาจทั้งเจ็ด", desc: "เจ็ดราชาปีศาจแบ่งโลกกันคนละส่วน และส่วนของคุณคือเมืองที่คุณเกิด", foe: "ราชาปีศาจแห่งความโลภ" },
  { name: "ฉากสุดท้าย: จุดจบของเรื่องเล่า", desc: "ระบบประกาศว่านี่คือฉากสุดท้าย ผู้ที่ไปถึงยอดจะได้กำหนดตอนจบของโลก", foe: "ผู้ที่สร้างฉากภารกิจทั้งหมด" },
] as const;
/** ระดับความยากของฉากหลัก #n */
const MAIN_RANK = [0, 0, 0, 1, 2, 3, 5, 6, 8];

type MainInfo = { name: string; desc: string; foe: string };
const mainOf = (n: number) => MAIN[clamp(n, 2, LAST_SCENARIO)] as MainInfo;

/** ผ่านฉากหลักไปแล้ว (ไม่ว่าจะเป็นฮีโร่หรือแค่รอด) */
function advanceMain(l: Life, hero: boolean) {
  const n = scenarioNo(l) + 1;
  l.flags.mainScenario = n;
  l.flags.mainNext = l.age + randInt(l, 2, 4);
  if (n >= LAST_SCENARIO) {
    l.flags.rebuilt = true;
    if (hero) {
      l.flags.apocHero = true;
      markTurn(l);
      startArc(l, "หลังจุดจบของเรื่องเล่า");
      log(l, "☀️ คุณจบฉากสุดท้ายด้วยมือตัวเอง — หน้าต่างระบบทั้งโลกดับลงพร้อมกัน แล้วแสงอาทิตย์ธรรมดาก็ส่องลงมาเป็นครั้งแรกในรอบหลายปี", "milestone");
    } else {
      startArc(l, "โลกหลังฉากสุดท้าย");
      log(l, "☀️ ใครบางคนจบฉากสุดท้ายได้ — หน้าต่างระบบดับลงทั้งโลก คุณรอดมาถึงวันที่โลกเริ่มต้นใหม่", "milestone");
    }
  }
}

export const MAIN_SCENARIO: GameEvent = {
  id: "apoc.main",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => !!l.power && inRuins(l) && scenarioNo(l) < LAST_SCENARIO && l.age >= Number(l.flags.mainNext ?? 999),
  title: "ฉากภารกิจหลัก",
  system: true,
  prepare: (l) => ({ n: scenarioNo(l) + 1 }),
  text: (_l, c) => {
    const m = mainOf(Number(c.n));
    return `[ฉากภารกิจหลัก #${c.n} —【${m.name}】]\n${m.desc}\nระดับอันตราย: ${rankName(MAIN_RANK[Number(c.n)])}`;
  },
  choices: [
    {
      label: "ออกไปแนวหน้า",
      tone: "danger",
      odds: (l, c) => fightOdds(l, MAIN_RANK[Number(c.n)]),
      survival: (l, c) => survivalOdds(l, MAIN_RANK[Number(c.n)]),
      run: (l, c, ok) => {
        const n = Number(c.n);
        const m = mainOf(n);
        if (ok) {
          const r = gateRewards(l, MAIN_RANK[n], 1.5, true);
          addFame(l, 4 + n);
          if (n >= 4 && chance(l, 0.35)) luckyRankUp(l, `[ฉากภารกิจหลัก #${n} สำเร็จ] รางวัลพิเศษ`);
          advanceMain(l, true);
          return { text: `คุณล้ม${m.foe}ได้! ฉากภารกิจหลัก #${n} สำเร็จ ${r}`, kind: n >= LAST_SCENARIO ? "milestone" : "good" };
        }
        if (!chance(l, survivalOdds(l, MAIN_RANK[n]))) {
          kill(l, `สิ้นชีพในฉากภารกิจหลัก #${n}: ${m.name}`);
          return bad(`${m.foe}แข็งแกร่งเกินไป…`);
        }
        advanceMain(l, false);
        return bad(`คุณแพ้ แต่รอดมาได้ — ผู้รอดชีวิตคนอื่นจบฉากนี้แทน${hurt(l, 12, 25)}`);
      },
    },
    {
      label: "อยู่แนวหลัง ปกป้องคนในฐาน",
      odds: (l, c) => survivalOdds(l, Math.max(0, MAIN_RANK[Number(c.n)] - 2)),
      run: (l, c, ok) => {
        const n = Number(c.n);
        if (!ok) {
          addStat(l, "health", -randInt(l, 15, 30));
          if (l.stats.health <= 0) {
            kill(l, `สิ้นชีพขณะปกป้องฐานในฉากภารกิจหลัก #${n}`);
            return bad("แนวหลังก็ไม่ปลอดภัยเสมอไป…");
          }
        }
        addStat(l, "happiness", 2);
        advanceMain(l, false);
        return meh(ok ? "ฐานของคุณรอดทั้งฐาน — ไม่มีใครจำชื่อคุณในฉากนี้ แต่ทุกคนในฐานจำได้" : "ฐานถูกตีแตกไปครึ่งหนึ่ง คุณรอดมาได้พร้อมบาดแผลเต็มตัว");
      },
    },
  ],
};

// ───────────────────────── ฉากภารกิจย่อย ─────────────────────────

const SIDE = [
  { name: "ล่าสัตว์อสูรในห้างร้าง", desc: "ห้างสรรพสินค้าที่เคยไปทุกสุดสัปดาห์ กลายเป็นรังของสัตว์อสูร" },
  { name: "เก็บยาในโรงพยาบาลร้าง", desc: "ฐานต้องการยาปฏิชีวนะ — และโรงพยาบาลไม่เคยว่างจริงๆ" },
  { name: "คุ้มกันรถไฟขบวนสุดท้าย", desc: "รถไฟที่ยังวิ่งได้ขบวนเดียวต้องข้ามสะพานที่สัตว์อสูรยึดไว้" },
  { name: "ไล่ล่าแก๊งปล้น", desc: "แก๊งปล้นผู้รอดชีวิตจับคนในฐานเพื่อนบ้านไปเป็นตัวประกัน" },
  { name: "ฉากพิเศษของดวงดาว", desc: "ดวงดาวดวงหนึ่งเบื่อ จึงเปิดฉากเกมโชว์ — ชนะได้ของ แพ้ได้แผล" },
] as const;
const BOSSES = ["หมาป่าอสูรสามหัว", "หัวหน้าแก๊งปล้นที่ได้สกิลหายาก", "ตั๊กแตนยักษ์ราชินี", "ซากศพเดินได้ระดับผู้นำ", "ไคเมร่าจากห้องแล็บ"];
const MIDS = ["survivors", "cache", "survivors", "cache", "hidden"] as const;
const R = (c: Ctx) => Number(c.rank);
const boss = (c: Ctx) => String(c.b);

export function startScenario(life: Life, r: number) {
  runEvent(life, "apoc.side", {
    rank: r,
    t: randInt(life, 0, SIDE.length - 1),
    b: pick(life, BOSSES),
    mid: !life.flags.hiddenScenario && chance(life, 0.02) ? "hidden" : pick(life, MIDS.slice(0, 4)),
    score: 0,
    share: 1,
  });
}

export const SIDE_SCENARIO: GameEvent = {
  id: "apoc.side",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ฉากภารกิจย่อย",
  text: (_l, c) => {
    const s = SIDE[Number(c.t)];
    return `[ฉากภารกิจย่อย ระดับ ${rankName(R(c))}]【${s.name}】— ${s.desc}`;
  },
  choices: [
    {
      label: "บุกตรงๆ",
      odds: (l, c) => fightOdds(l, R(c)),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("คุณเคลียร์ทางได้อย่างรวดเร็ว", "mid"); }
        return bad("สัตว์อสูรมากกว่าที่คิด" + hurtQ(l, R(c), 6, 14), "mid");
      },
    },
    {
      label: "ซุ่มดูรูปแบบก่อน",
      odds: (l, c) => clamp(checkChance(l, "smarts", 50) + (l.power?.hunterClass === "a_reader" ? 0.2 : 0) - Math.max(0, R(c) - (l.power?.rank ?? 0)) * 0.1, 0.05, 0.95),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("คุณจับจังหวะได้ — พวกมันเปลี่ยนเวรทุกสิบห้านาที", "mid"); }
        return bad("พวกมันได้กลิ่นคุณก่อน!" + hurtQ(l, R(c), 4, 10), "mid");
      },
    },
    {
      label: "ชวนผู้รอดชีวิตคนอื่นไปด้วย (ปลอดภัยแต่ต้องแบ่ง)",
      run: (_l, c) => { c.share = 0.5; return meh("คุณรวมทีมกับผู้รอดชีวิตอีกสามคน", "mid"); },
    },
  ],
  scenes: {
    mid: {
      text: (_l, c) =>
        ({
          survivors: "ระหว่างทาง คุณเจอครอบครัวหนึ่งซ่อนอยู่ในห้องเก็บของ เด็กเล็กสองคนผอมจนเห็นกระดูก",
          cache: "ตู้เซฟของร้านค้ายังปิดอยู่ — อาจมีของมีค่า หรือมีกับดักที่คนอื่นวางไว้",
          hidden: "ผนังตรงหน้ามีรอยแยกเรืองแสง และหน้าต่างระบบเล็กๆ ขึ้นว่า 「ฉากซ่อน — ผู้ค้นพบคนแรก」",
        })[String(c.mid)] ?? "",
      choices: [
        { label: "พาพวกเขากลับฐาน", show: (_l, c) => c.mid === "survivors", run: (l, c) => { addFame(l, 3); addStat(l, "happiness", 5); c.score = Number(c.score) - 1; return good("แม่ของเด็กกอดคุณไม่ยอมปล่อย — เสียงร้องดึงความสนใจของสัตว์อสูร", "boss"); } },
        { label: "ทิ้งเสบียงไว้ให้แล้วไปต่อ", show: (_l, c) => c.mid === "survivors", run: (l) => { addMoney(l, -10_000); return meh("คุณวางอาหารกระป๋องสามกระป๋องไว้ แล้วเดินต่อโดยไม่หันกลับไปมอง", "boss"); } },
        {
          label: "งัดตู้เซฟ",
          show: (_l, c) => c.mid === "cache",
          check: { stat: "luck", dc: 50 },
          run: (l, c, ok) => {
            if (ok) { const item = pick(l, ["ยาฟื้นพลังจากร้านดวงดาว", "ระเบิดมือเคลือบพลัง", "เสื้อเกราะจากฉากก่อน"]); l.power?.items.push(item); return good(`ข้างในมี「${item}」!`, "boss"); }
            return bad("กับดักระเบิด!" + hurtQ(l, R(c), 6, 12), "boss");
          },
        },
        { label: "ไม่แตะ", show: (_l, c) => c.mid === "cache", run: () => meh("ไม่มีของฟรีในวันสิ้นโลก", "boss") },
        {
          label: "เข้าฉากซ่อน",
          tone: "danger",
          show: (_l, c) => c.mid === "hidden",
          odds: (l, c) => survivalOdds(l, R(c) + 2),
          survival: (l, c) => survivalOdds(l, R(c) + 2),
          run: (l, _c, ok) => {
            l.flags.hiddenScenario = true;
            if (!ok) {
              addStat(l, "health", -40);
              if (l.stats.health <= 0) { kill(l, "หายไปในฉากซ่อนของระบบ"); return bad("รอยแยกปิดลงข้างหลังคุณ…"); }
              return bad("ฉากซ่อนปฏิเสธคุณ ร่างคุณถูกดีดกลับมาพร้อมแผลเต็มตัว", "boss");
            }
            luckyRankUp(l, "[ระบบ] ผู้ค้นพบฉากซ่อนคนแรก");
            return { text: "ในฉากซ่อนมีห้องสมุดที่บันทึกทุกฉากของโลกนี้ไว้ — รวมถึงตอนจบ", kind: "milestone", next: "boss" };
          },
        },
        { label: "ไม่เสี่ยง", show: (_l, c) => c.mid === "hidden", run: () => meh("รอยแยกค่อยๆ ปิดลง… บางทีอาจไม่มีโอกาสครั้งที่สอง", "boss") },
      ],
    },
    boss: {
      title: "ตัวคุมฉาก",
      text: (_l, c) => `【${boss(c)}】ขวางทางออก! ระดับ ${rankName(R(c))}`,
      choices: [
        {
          label: "สู้เต็มกำลัง",
          tone: "danger",
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06),
          run: (l, c, ok) => {
            if (ok) { const r = gateRewards(l, R(c), Number(c.share), true); addFame(l, R(c) >= 4 ? 4 : 1); return { text: `☄️ ${boss(c)}ล้มลง! ${r}`, kind: "good" }; }
            if (!chance(l, survivalOdds(l, R(c), Number(c.score) * 0.06))) { kill(l, `ถูก${boss(c)}สังหารในฉากภารกิจย่อย`); return bad(`${boss(c)}ไม่ให้โอกาสครั้งที่สอง…`); }
            return bad("คุณแพ้ แต่หนีกลับฐานได้" + hurtQ(l, R(c), 15, 30));
          },
        },
        {
          label: (l) => `ใช้「${l.power?.items[0] ?? ""}」แล้วสู้`,
          tone: "special",
          show: (l) => (l.power?.items.length ?? 0) > 0,
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          run: (l, c, ok) => {
            const item = l.power!.items.shift();
            if (ok) { const r = gateRewards(l, R(c), Number(c.share), true); return { text: `☄️「${item}」พลิกสถานการณ์! ${r}`, kind: "good" }; }
            return bad(`แม้แต่「${item}」ก็ไม่พอ` + hurtQ(l, R(c), 10, 20));
          },
        },
        { label: "ถอยกลับฐาน", run: (l, c) => meh(`คุณถอยกลับมาพร้อมของที่เก็บได้ — ${gateRewards(l, R(c), Number(c.share) * 0.3, false)}`) },
      ],
    },
  },
};

function hurtQ(l: Life, r: number, min: number, max: number): string {
  const gap = Math.max(0, r - (l.power?.rank ?? 0));
  const dmg = Math.round(randInt(l, min, max) * (1 + gap * 0.5));
  addStat(l, "health", -dmg);
  if (l.stats.health <= 0) {
    kill(l, `บาดเจ็บสาหัสในฉากภารกิจระดับ ${rankName(r)}`);
    return " บาดแผลสาหัสเกินกว่าจะรอด…";
  }
  return ` (สุขภาพ -${dmg})`;
}

/** คนในครอบครัวที่หายไปตั้งแต่คืนแรก (ยังมีชีวิต) */
export const missingPerson = (l: Life) => l.people.find((p) => p.id === l.flags.missingId && p.alive);
