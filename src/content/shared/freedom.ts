// M23 — อิสระในการเล่น: ปุ่ม "ทำ" ที่ผู้เล่นเลือกเองได้ทุกปี และเปิดฉากให้ตัดสินใจจริง
// (พนัน ก่ออาชญากรรม เรียนคอร์ส ทำบุญ ย้ายถิ่น ปลีกวิเวก สร้างผลงาน หาเรื่อง อุปการะ ใช้เงินเปลือง ออกไปเดินเล่น)
import { ACTIVITIES } from "../../engine/activities";
import type { GameEvent, Outcome } from "../../engine/events";
import { kill, runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Country, Life } from "../../engine/types";
import { addFame, addMoney, addStat, checkChance, createPerson, log, money, people, shortName } from "../../engine/util";
import { COUNTRIES, localize } from "../countries";
import { worldOf } from "../worlds";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const big = (text: string): Outcome => ({ text, kind: "milestone" });

/** โทนของโลก: ยุคปัจจุบัน · ซากเมืองหลังวันสิ้นโลก · ยุทธภพ · ราชสำนักแฟนตาซี */
type Tone = "modern" | "ruins" | "murim" | "court";
export function tone(l: Life): Tone {
  if (l.worldId === "murim") return "murim";
  if (l.worldId === "court") return "court";
  if (l.flags.doomed && !l.flags.rebuilt) return "ruins";
  return "modern";
}
const T = <V>(l: Life, m: Record<Tone, V>): V => m[tone(l)];

// ───────────────────────── คุก ─────────────────────────

export const jailed = (l: Life) => Number(l.flags.jailUntil ?? -1) > l.age;

function sendToJail(l: Life, years: number, why: string): string {
  l.flags.jailUntil = l.age + years;
  l.flags.jailCount = Number(l.flags.jailCount ?? 0) + 1;
  if (l.job) l.job = undefined;
  addFame(l, -8);
  addStat(l, "happiness", -15);
  const place = T(l, { modern: "เรือนจำ", ruins: "กรงขังของฐาน", murim: "คุกใต้ดินของทางการ", court: "หอคอยคุมขัง" });
  return `${why} — ศาลตัดสินจำคุก ${years} ปีใน${place} (งานที่ทำอยู่หายไปด้วย)`;
}

yearHooks.push((l) => {
  if (l.flags.jailUntil === undefined || !l.alive) return;
  const until = Number(l.flags.jailUntil);
  if (l.age < until) {
    addStat(l, "health", -randInt(l, 0, 3));
    if (chance(l, 0.25)) addStat(l, "smarts", 1);
    return;
  }
  delete l.flags.jailUntil;
  log(l, T(l, {
    modern: "🔓 คุณพ้นโทษ ประตูเหล็กปิดลงข้างหลัง อากาศข้างนอกมีกลิ่นของเสรีภาพและท่อไอเสีย",
    ruins: "🔓 คุณถูกปล่อยออกจากกรง หัวหน้าฐานบอกว่า \"ครั้งหน้าไม่มีกรงแล้ว มีแต่ประตูหน้าฐาน\"",
    murim: "🔓 คุณพ้นโทษ แสงอาทิตย์แรกแยงตาจนต้องหลับตาครู่หนึ่ง",
    court: "🔓 คุณได้รับการปล่อยตัว ผู้คุมคืนเสื้อคลุมเก่าที่ยับยู่ยี่ให้",
  }), "good");
});

// ───────────────────────── ปุ่มกิจกรรม ─────────────────────────

const once = (l: Life, key: string, years: number) => l.age - Number(l.flags[key] ?? -99) >= years;

ACTIVITIES.push(
  {
    id: "free_gamble",
    emoji: "🎲",
    name: "เล่นการพนัน",
    desc: "รวยหรือหมดตัว",
    minAge: 18,
    world: "all",
    available: (l) => !jailed(l),
    run: (l) => { runEvent(l, "free.gamble"); return meh(""); },
  },
  {
    id: "free_crime",
    emoji: "🦹",
    name: "ทำเรื่องผิดกฎหมาย",
    desc: "เงินง่าย เสี่ยงติดคุก",
    minAge: 14,
    world: "all",
    available: (l) => !jailed(l),
    run: (l) => { runEvent(l, "free.crime"); return meh(""); },
  },
  {
    id: "free_course",
    emoji: "🎓",
    name: "ลงเรียนคอร์สใหม่",
    desc: "ฝึกทักษะที่อยากได้",
    minAge: 10,
    world: "all",
    available: (l) => !jailed(l),
    run: (l) => { runEvent(l, "free.course"); return meh(""); },
  },
  {
    id: "free_charity",
    emoji: "🤲",
    name: "ทำความดี",
    desc: "บริจาค อาสา ช่วยคน",
    minAge: 10,
    world: "all",
    available: (l) => !jailed(l),
    run: (l) => { runEvent(l, "free.charity"); return meh(""); },
  },
  {
    id: "free_move",
    emoji: "🧳",
    name: "ย้ายถิ่นฐาน",
    desc: "เริ่มต้นใหม่ที่อื่น (5 ปีครั้ง)",
    minAge: 18,
    world: "all",
    available: (l) => !jailed(l) && once(l, "movedAt", 5),
    run: (l) => { runEvent(l, "free.move"); return meh(""); },
  },
  {
    id: "free_retreat",
    emoji: "🧘",
    name: "ปลีกวิเวก",
    desc: "หนีโลกไปหาความสงบ",
    minAge: 16,
    world: "all",
    available: (l) => !jailed(l),
    run: (l) => { runEvent(l, "free.retreat"); return meh(""); },
  },
  {
    id: "free_create",
    emoji: "✍️",
    name: "สร้างผลงาน",
    desc: "เขียน แต่ง วาด ประดิษฐ์",
    minAge: 12,
    world: "all",
    run: (l) => { runEvent(l, "free.create"); return meh(""); },
  },
  {
    id: "free_brawl",
    emoji: "👊",
    name: "หาเรื่องคน",
    desc: "ต่อยใครสักคน",
    minAge: 12,
    world: "all",
    run: (l) => { runEvent(l, "free.brawl"); return meh(""); },
  },
  {
    id: "free_adopt",
    emoji: "🧸",
    name: "รับอุปการะเด็ก",
    desc: "สร้างครอบครัวด้วยใจ",
    minAge: 25,
    world: "all",
    available: (l) => !jailed(l) && once(l, "adoptAt", 3),
    run: (l) => { runEvent(l, "free.adopt"); return meh(""); },
  },
  {
    id: "free_splurge",
    emoji: "💎",
    name: "ใช้เงินแบบไม่คิด",
    desc: "ของแพง ความสุขชั่วคราว",
    minAge: 18,
    world: "all",
    available: (l) => !jailed(l) && l.money > 50_000,
    run: (l) => { runEvent(l, "free.splurge"); return meh(""); },
  },
  {
    id: "free_wander",
    emoji: "🗺️",
    name: "ออกไปเดินเล่น",
    desc: "ไม่รู้จะเจออะไร",
    minAge: 8,
    world: "all",
    available: (l) => !jailed(l),
    run: (l) => { runEvent(l, pickEncounter(l)); return meh(""); },
  },
);

// ───────────────────────── ฉากของแต่ละปุ่ม ─────────────────────────

const stake = (l: Life, frac: number, min: number) => Math.max(min, Math.round(Math.max(0, l.money) * frac));

const FREE_EVENTS: GameEvent[] = [
  {
    id: "free.gamble",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "วงพนัน",
    text: (l) => T(l, {
      modern: "บ่อนลับใต้ร้านคาราโอเกะ ควันบุหรี่ลอยต่ำ โต๊ะบาคาร่ามีที่ว่างหนึ่งที่ เจ้ามือยิ้มให้คุณเหมือนรู้จักกันมานาน",
      ruins: "ในฐาน คนแลกกระป๋องอาหารกันด้วยการทอยลูกเต๋าบนฝาถังน้ำมัน ใครแพ้หนักสุดต้องเฝ้ายามกะดึกแทน",
      murim: "โรงบ่อนกลางเมืองเสียงเอะอะ ถ้วยลูกเต๋าเขย่าดังกึกกัก นักเลงหน้าโต๊ะหันมามองกระบี่ที่เอวคุณ",
      court: "ห้องไพ่ลับในคฤหาสน์ของไวเคานต์ ขุนนางเดิมพันกันด้วยเหรียญทอง ที่ดิน และบางครั้งก็หัวใจคน",
    }),
    choices: [
      {
        label: (l) => `เล่นเล็กๆ (${money(l, stake(l, 0.02, 2_000))})`,
        odds: () => 0.48,
        run: (l, _c, ok) => {
          const s = stake(l, 0.02, 2_000);
          addMoney(l, ok ? s : -s);
          addStat(l, "happiness", ok ? 3 : -1);
          return ok ? good(`ชนะมา ${money(l, s)} — สนุกดี`) : meh(`เสียไป ${money(l, s)} ถือว่าค่าขนม`);
        },
      },
      {
        label: (l) => `ทุ่มหนัก (${money(l, stake(l, 0.25, 20_000))})`,
        tone: "danger",
        check: { stat: "luck", dc: 60 },
        run: (l, _c, ok) => {
          const s = stake(l, 0.25, 20_000);
          if (ok) { addMoney(l, s * 2); addStat(l, "happiness", 10); return good(`ไพ่ออกตามใจทุกตา! ได้มา ${money(l, s * 2)} คนทั้งโต๊ะเงียบกริบ`); }
          addMoney(l, -s); addStat(l, "happiness", -8);
          return bad(`หมดไป ${money(l, s)} ในชั่วโมงเดียว คุณเดินออกมามือเปล่าตอนตีสาม`);
        },
      },
      {
        label: "หมดหน้าตัก!",
        tone: "danger",
        check: { stat: "luck", dc: 80 },
        show: (l) => l.money > 10_000,
        run: (l, _c, ok) => {
          const s = l.money;
          if (ok) { addMoney(l, s * 3); addStat(l, "happiness", 20); addFame(l, 3); return big(`🎰 แจ็กพอต! เงินทั้งหมดคูณสาม — ${money(l, s * 3)} — ข่าวลือเรื่องคุณกระจายไปทั้งเมือง`); }
          addMoney(l, -s); addStat(l, "happiness", -20);
          l.flags.gambleRuin = Number(l.flags.gambleRuin ?? 0) + 1;
          return bad("คุณหมดตัว เงินทั้งชีวิตหายไปกับไพ่ใบเดียว");
        },
      },
      {
        label: "โกงไพ่",
        check: { stat: "smarts", dc: 70 },
        skill: ["stealth", "study"],
        run: (l, _c, ok) => {
          if (ok) { const s = stake(l, 0.1, 30_000); addMoney(l, s); return good(`ไม่มีใครเห็นไพ่ในแขนเสื้อ คุณได้มา ${money(l, s)}`); }
          addStat(l, "health", -randInt(l, 8, 18));
          if (l.stats.health <= 0) { kill(l, "ถูกจับได้ว่าโกงไพ่แล้วถูกซ้อม"); return bad("พวกเขาไม่ให้โอกาสคุณอธิบาย…"); }
          return bad("ไพ่หล่นจากแขนเสื้อ คุณถูกลากไปหลังร้านและได้ของที่ระลึกเป็นรอยช้ำทั้งตัว");
        },
      },
      { label: "เดินออกมา", run: (l) => { addStat(l, "smarts", 1); return meh("คุณมองโต๊ะพนันอยู่พักหนึ่ง แล้วเดินกลับบ้าน — เจ้ามือดูผิดหวัง"); } },
    ],
  },
  {
    id: "free.crime",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "ด้านมืด",
    text: (l) => T(l, {
      modern: "เพื่อนเก่าส่งข้อความมา \"มีงานง่ายๆ ได้เงินไว ไม่ต้องถามเยอะ\" — แต่คุณก็มีทางเลือกของตัวเอง",
      ruins: "โกดังเสบียงของฐานเฝ้าแค่คนเดียวตอนตีสาม และคนนั้นหลับ",
      murim: "ในเมืองมีคนรวยมากเกินไป และมีคนเฝ้าน้อยเกินไป",
      court: "ห้องเก็บของมีค่าของขุนนางมีกุญแจดอกเดียว และพ่อบ้านขี้เมา",
    }),
    choices: [
      {
        label: (l) => T(l, { modern: "ล้วงกระเป๋าในรถไฟฟ้า", ruins: "ขโมยกระป๋องอาหาร", murim: "ล้วงถุงเงินในตลาด", court: "ฉกเข็มกลัดเพชรในงานเลี้ยง" }),
        check: { stat: "luck", dc: 45 },
        skill: ["stealth"],
        run: (l, _c, ok) => {
          if (ok) { const g = randInt(l, 3, 15) * 1000; addMoney(l, g); l.flags.crimes = Number(l.flags.crimes ?? 0) + 1; return good(`ได้มา ${money(l, g)} ไม่มีใครรู้`); }
          if (chance(l, 0.5)) return bad(sendToJail(l, 1, "คุณถูกจับคาหนังคาเขา"));
          addStat(l, "happiness", -4);
          return bad("เกือบถูกจับ คุณวิ่งหนีจนรองเท้าหลุด");
        },
      },
      {
        label: (l) => T(l, { modern: "ปล้นร้านทอง", ruins: "ปล้นขบวนแลกของ", murim: "ปล้นขบวนสินค้า", court: "ปล้นรถม้าของพ่อค้า" }),
        tone: "danger",
        odds: (l) => Math.min(0.85, checkChance(l, "luck", 70) + (l.power ? 0.25 : 0)),
        skill: ["stealth", "combat"],
        run: (l, _c, ok) => {
          if (ok) { const g = randInt(l, 200, 900) * 1000; addMoney(l, g); addFame(l, -2); l.flags.crimes = Number(l.flags.crimes ?? 0) + 2; return good(`งานใหญ่สำเร็จ ${money(l, g)} อยู่ในกระเป๋า หัวใจยังเต้นแรงไม่หยุด`); }
          if (chance(l, 0.2)) { kill(l, "ถูกยิงระหว่างปล้น"); return bad("เสียงปืนดังขึ้นก่อนที่คุณจะทันได้คิด…"); }
          return bad(sendToJail(l, randInt(l, 3, 7), "ตำรวจล้อมไว้ทุกทาง"));
        },
      },
      {
        label: (l) => T(l, { modern: "ต้มตุ๋นทางออนไลน์", ruins: "ขายยาปลอมให้คนป่วย", murim: "ขายคัมภีร์ปลอม", court: "ปลอมจดหมายขุนนาง" }),
        check: { stat: "smarts", dc: 60 },
        skill: ["study", "social"],
        run: (l, _c, ok) => {
          if (ok) { const g = randInt(l, 50, 300) * 1000; addMoney(l, g); addStat(l, "happiness", -3); l.flags.crimes = Number(l.flags.crimes ?? 0) + 1; return meh(`ได้มา ${money(l, g)} — แต่คืนนั้นคุณนอนไม่ค่อยหลับ`); }
          return bad(sendToJail(l, randInt(l, 2, 4), "เหยื่อรายหนึ่งเป็นญาติของนักสืบ"));
        },
      },
      {
        label: "รับจ้างทวงหนี้",
        check: { stat: "health", dc: 55 },
        skill: ["combat"],
        run: (l, _c, ok) => {
          if (ok) { const g = randInt(l, 20, 80) * 1000; addMoney(l, g); addFame(l, -1); return meh(`ลูกหนี้ยอมจ่าย คุณได้ส่วนแบ่ง ${money(l, g)}`); }
          addStat(l, "health", -10);
          return bad("ลูกหนี้มีพี่ชายตัวใหญ่สองคน");
        },
      },
      { label: "ไม่ทำดีกว่า", run: (l) => { addStat(l, "happiness", 2); return meh("คุณลบข้อความทิ้ง ชีวิตสุจริตอาจจะช้า แต่หลับสบาย"); } },
    ],
  },
  {
    id: "free.course",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "เรียนสิ่งใหม่",
    text: (l) => T(l, {
      modern: "ใบปลิวคอร์สระยะสั้นวางเต็มโต๊ะ คุณอยากเก่งอะไรเพิ่ม?",
      ruins: "ในฐานมีคนเก่งหลายแบบ และทุกคนยอมสอนแลกกับอาหาร",
      murim: "ปรมาจารย์หลายสาขาเปิดสอนอยู่ในเมือง — ค่าเรียนไม่ถูก แต่ความรู้ไม่เคยหายไปไหน",
      court: "สมาคมช่างและหอสมุดหลวงเปิดรับลูกศิษย์ใหม่ปีนี้",
    }),
    choices: [
      { label: (l) => T(l, { modern: "ภาษาต่างประเทศ", ruins: "ภาษามือของหน่วยลาดตระเวน", murim: "อักษรโบราณ", court: "ภาษาของจักรวรรดิเพื่อนบ้าน" }), run: (l) => { addMoney(l, -15_000); addStat(l, "smarts", randInt(l, 3, 6)); l.flags.c_lang = Number(l.flags.c_lang ?? 0) + 1; return good("หลังจากผ่านไปหนึ่งปี คุณเริ่มฝันเป็นภาษาใหม่"); } },
      { label: "ทำอาหาร", run: (l) => { addMoney(l, -10_000); addStat(l, "happiness", 4); addStat(l, "health", 2); l.flags.c_cook = Number(l.flags.c_cook ?? 0) + 1; return good("จานแรกไหม้ จานที่ร้อยทำให้เพื่อนร้องไห้ (ในทางที่ดี)"); } },
      { label: (l) => T(l, { modern: "ดนตรี", ruins: "เล่นกีตาร์รอบกองไฟ", murim: "พิณกู่เจิง", court: "ไวโอลินและเปียโน" }), check: { stat: "smarts", dc: 40 }, run: (l, _c, ok) => { addMoney(l, -20_000); addStat(l, "looks", ok ? 3 : 1); addStat(l, "happiness", 5); l.flags.c_music = Number(l.flags.c_music ?? 0) + 1; return ok ? good("ครูบอกว่าคุณมีหูดี — เพลงแรกที่เล่นจบทำให้ทั้งห้องปรบมือ") : meh("นิ้วคุณช้ากว่าใจ แต่ก็สนุกดี"); } },
      { label: (l) => T(l, { modern: "ป้องกันตัว", ruins: "ยิงปืนและต่อสู้ระยะประชิด", murim: "มวยพื้นฐานของสำนักเล็ก", court: "ดาบสั้นแบบอัศวิน" }), run: (l) => { addMoney(l, -12_000); addStat(l, "health", randInt(l, 3, 6)); l.flags.c_fight = Number(l.flags.c_fight ?? 0) + 1; return good("ร่างกายคุณจำท่าได้ก่อนสมองจะสั่ง"); } },
      { label: (l) => T(l, { modern: "การลงทุนและบัญชี", ruins: "การจัดการเสบียง", murim: "การค้าและบัญชีโรงเตี๊ยม", court: "การบริหารที่ดินและภาษี" }), run: (l) => { addMoney(l, -25_000); addStat(l, "smarts", randInt(l, 2, 4)); l.flags.c_biz = Number(l.flags.c_biz ?? 0) + 1; if (l.job) l.job.performance = Math.min(100, l.job.performance + 8); return good("คุณเริ่มเห็นตัวเลขเป็นเรื่องราว"); } },
      { label: (l) => T(l, { modern: "การแสดง", ruins: "เล่าเรื่องให้เด็กๆ ในฐานฟัง", murim: "งิ้ว", court: "การละครของราชสำนัก" }), run: (l) => { addMoney(l, -15_000); addStat(l, "looks", randInt(l, 2, 5)); addFame(l, 1); l.flags.c_act = Number(l.flags.c_act ?? 0) + 1; return good("คุณพบว่าการเป็นคนอื่นสักพักก็ช่วยให้รู้จักตัวเองมากขึ้น"); } },
      { label: (l) => T(l, { modern: "ปฐมพยาบาล", ruins: "เย็บแผลสนาม", murim: "ฝังเข็มและสมุนไพร", court: "เวทรักษาขั้นต้น" }), run: (l) => { addMoney(l, -10_000); addStat(l, "health", 3); addStat(l, "smarts", 2); l.flags.c_med = Number(l.flags.c_med ?? 0) + 1; return good("ไม่กี่เดือนต่อมา คุณช่วยชีวิตคนแปลกหน้าที่ล้มกลางถนนได้"); } },
    ],
  },
  {
    id: "free.charity",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "ทำความดี",
    text: (l) => T(l, {
      modern: "โลกนี้มีคนที่ต้องการความช่วยเหลือเสมอ — คุณจะช่วยแบบไหน?",
      ruins: "ข้างนอกฐานมีผู้ลี้ภัยเดินมาใหม่ทุกวัน",
      murim: "ปีนี้น้ำท่วมแดนใต้ ผู้อพยพเข้ามาในเมืองไม่หยุด",
      court: "สถานสงเคราะห์ของโบสถ์กำลังจะปิดเพราะขาดเงิน",
    }),
    choices: [
      { label: (l) => `บริจาคเงิน (${money(l, stake(l, 0.1, 5_000))})`, run: (l) => { const s = stake(l, 0.1, 5_000); addMoney(l, -s); addStat(l, "happiness", 8); addFame(l, s >= 1_000_000 ? 5 : 1); l.flags.karma = Number(l.flags.karma ?? 0) + 2; return good(`คุณบริจาค ${money(l, s)} — จดหมายขอบคุณลายมือเด็กๆ มาถึงในเดือนถัดมา`); } },
      { label: "ไปเป็นอาสาสมัคร", run: (l) => { addStat(l, "happiness", 6); addStat(l, "health", -2); l.flags.karma = Number(l.flags.karma ?? 0) + 2; if (chance(l, 0.4)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -8, 8), bond: 60 }); return good(`คุณเหนื่อยทั้งปี แต่ได้เพื่อนแท้มาหนึ่งคน — ${shortName(p)}`); } return good("คุณยกของ ล้างจาน และฟังเรื่องเล่าของคนแปลกหน้าจนจำได้ทุกคน"); } },
      { label: (l) => T(l, { modern: "บริจาคเลือด", ruins: "แบ่งเสบียงของตัวเอง", murim: "ตั้งโรงทาน", court: "เปิดคฤหาสน์ให้ผู้ลี้ภัยพัก" }), run: (l) => { addStat(l, "happiness", 5); addStat(l, "luck", chance(l, 0.3) ? 1 : 0); l.flags.karma = Number(l.flags.karma ?? 0) + 1; return good("ไม่มีใครรู้ว่าเป็นคุณ และนั่นแหละที่ทำให้มันดี"); } },
      { label: "ทำความดีแล้วโพสต์อวด", run: (l) => { addFame(l, 2); addStat(l, "happiness", 2); if (chance(l, 0.3)) { addFame(l, -4); return bad("ชาวเน็ตจับได้ว่าคุณจัดฉาก ดราม่าลุกลามสามวัน"); } return meh("ยอดไลก์ดี แต่ในใจลึกๆ คุณรู้สึกว่างเปล่านิดหน่อย"); } },
    ],
  },
  {
    id: "free.move",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "ย้ายถิ่นฐาน",
    text: (l) => T(l, {
      modern: "คุณเปิดแผนที่โลก แล้วมองมันนานกว่าปกติ",
      ruins: "มีข่าวว่าฐานอื่นปลอดภัยกว่า — หรืออาจแค่เป็นข่าวลือ",
      murim: "ทางออกจากเมืองมีหลายสาย แต่ละสายพาไปสู่ชีวิตคนละแบบ",
      court: "จักรวรรดิกว้างใหญ่ และคุณยังไม่เคยไปเกินเขตแดนบ้านเกิด",
    }),
    choices: [
      ...(["th", "kr", "jp"] as Country[]).map((c) => ({
        label: `${COUNTRIES[c].flag} ย้ายไป${COUNTRIES[c].name}`,
        show: (l: Life) => tone(l) === "modern" && !!worldOf(l.worldId).modern && (l.country ?? "th") !== c,
        run: (l: Life): Outcome => moveCountry(l, c),
      })),
      {
        label: (l) => T(l, { modern: "ย้ายไปอยู่ต่างจังหวัด", ruins: "ย้ายไปฐานบนภูเขา", murim: "ย้ายไปเมืองริมทะเลทางใต้", court: "ย้ายไปแคว้นชายแดน" }),
        run: (l) => {
          l.flags.movedAt = l.age;
          addStat(l, "happiness", randInt(l, 3, 10));
          addStat(l, "health", 2);
          for (const p of people(l, "friend")) p.bond = Math.max(0, p.bond - 15);
          return good(T(l, { modern: "บ้านใหม่มีสวนเล็กๆ เพื่อนบ้านเอาผลไม้มาให้ตั้งแต่วันแรก", ruins: "อากาศบนเขาหนาว แต่ไม่มีเสียงคำรามตอนกลางคืน", murim: "กลิ่นทะเลทำให้คุณนอนหลับสนิทเป็นครั้งแรกในรอบหลายปี", court: "ที่นี่ไม่มีใครรู้จักตระกูลคุณ — ทั้งข้อดีและข้อเสีย" }));
        },
      },
      {
        label: (l) => T(l, { modern: "ย้ายเข้าเมืองหลวง", ruins: "ย้ายเข้าฐานใหญ่ที่สุด", murim: "ย้ายไปเมืองหลวงลั่วหยาง", court: "ย้ายเข้านครหลวง" }),
        run: (l) => {
          l.flags.movedAt = l.age;
          addStat(l, "happiness", -2);
          if (l.job) l.job.performance = Math.min(100, l.job.performance + 5);
          if (chance(l, 0.5)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -5, 5), bond: 45 }); return good(`เมืองใหญ่วุ่นวาย แต่โอกาสก็เยอะ คุณรู้จัก${shortName(p)}ตั้งแต่สัปดาห์แรก`); }
          return meh("ค่าครองชีพสูงกว่าเดิมสองเท่า แต่ทุกอย่างอยู่ใกล้มือ");
        },
      },
      { label: "อยู่ที่เดิมดีกว่า", run: () => meh("คุณพับแผนที่เก็บ — บ้านก็คือบ้าน") },
    ],
  },
  {
    id: "free.retreat",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "ปลีกวิเวก",
    text: (l) => T(l, {
      modern: (l.country ?? "th") === "th" ? "คุณคิดจะไปบวช หรือไปเข้าคอร์สปฏิบัติธรรมสักพัก" : "คุณคิดจะไปพักที่วัดบนภูเขาสักช่วง ปิดมือถือ ไม่ติดต่อใคร",
      ruins: "บนดาดฟ้าตึกร้างมีที่ที่เงียบที่สุดในเมือง — ถ้าไม่นับเสียงลม",
      murim: "อารามบนยอดเขาเปิดรับผู้แสวงหาความสงบ ไม่ถามชื่อ ไม่ถามอดีต",
      court: "อารามแม่ชีริมทะเลสาบรับผู้มาพักเงียบได้ปีละไม่กี่คน",
    }),
    choices: [
      { label: "ไปสักสามเดือน", run: (l) => { addStat(l, "happiness", randInt(l, 6, 12)); addStat(l, "health", 3); if (l.job) l.job.performance = Math.max(0, l.job.performance - 5); return good("คุณกลับมาพร้อมใจที่ช้าลง และฟังคนอื่นพูดจนจบประโยคได้เป็นครั้งแรก"); } },
      { label: "ไปทั้งปี ตัดขาดทุกอย่าง", run: (l) => { addStat(l, "happiness", randInt(l, 12, 20)); addStat(l, "smarts", 2); addStat(l, "luck", chance(l, 0.4) ? 1 : 0); if (l.job) l.job = undefined; for (const p of l.people) p.bond = Math.max(0, p.bond - 8); return good("หนึ่งปีของความเงียบ — คุณลาออกจากงาน แต่ได้อะไรบางอย่างที่เงินซื้อไม่ได้กลับมา"); } },
      { label: "ไปแล้วไม่กลับ", show: (l) => l.age >= 55, tone: "special", run: (l) => { addStat(l, "happiness", 25); l.job = undefined; l.flags.recluse = true; return big("คุณตัดสินใจใช้ชีวิตที่เหลือในความสงบ ข่าวคราวของคุณค่อยๆ เงียบหายไปจากโลก"); } },
    ],
  },
  {
    id: "free.create",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "สร้างผลงาน",
    text: () => "มีบางอย่างในหัวคุณที่อยากออกมาสู่โลก",
    choices: [
      { label: (l) => T(l, { modern: "เขียนนิยาย", ruins: "เขียนบันทึกวันสิ้นโลก", murim: "เขียนตำนานยุทธภพ", court: "เขียนนิยายรักโรแมนติก" }), check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => createWork(l, ok, "หนังสือ") },
      { label: (l) => T(l, { modern: "แต่งเพลง", ruins: "แต่งเพลงรอบกองไฟ", murim: "แต่งบทกวี", court: "ประพันธ์บทเพลงบัลลาด" }), check: { stat: "looks", dc: 60 }, run: (l, _c, ok) => createWork(l, ok, "เพลง") },
      { label: (l) => T(l, { modern: "วาดการ์ตูน", ruins: "วาดแผนที่เมืองที่หายไป", murim: "วาดภาพพู่กันจีน", court: "วาดภาพเหมือนขุนนาง" }), check: { stat: "luck", dc: 55 }, run: (l, _c, ok) => createWork(l, ok, "ภาพ") },
      { label: (l) => T(l, { modern: "ประดิษฐ์ของใหม่", ruins: "ประดิษฐ์เครื่องกรองน้ำ", murim: "ประดิษฐ์อาวุธลับ", court: "ประดิษฐ์เครื่องจักรเวทมนตร์" }), check: { stat: "smarts", dc: 75 }, run: (l, _c, ok) => createWork(l, ok, "สิ่งประดิษฐ์") },
    ],
  },
  {
    id: "free.brawl",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "หาเรื่อง",
    text: (l) => T(l, {
      modern: "มีคนเหยียบเท้าคุณแล้วไม่ขอโทษ — หรือคุณแค่อยากระบายอะไรบางอย่าง",
      ruins: "คนในฐานคนหนึ่งแย่งคิวรับอาหารของเด็ก",
      murim: "นักเลงในโรงเตี๊ยมพูดจาดูถูกสำนักของคุณเสียงดัง",
      court: "บุตรชายบารอนคนหนึ่งเยาะเย้ยคุณกลางงานเลี้ยง",
    }),
    choices: [
      {
        label: "ซัดเลย",
        odds: (l) => Math.min(0.9, checkChance(l, "health", 55) + (l.power ? 0.3 : 0)),
        skill: ["combat"],
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 1); addStat(l, "happiness", 4); if (chance(l, 0.3)) { const p = createPerson(l, "rival", { age: l.age + randInt(l, -3, 3), bond: 10 }); return good(`คุณชนะ แต่${shortName(p)}สาบานว่าจะกลับมาเอาคืน`); } return good("หมัดเดียวจบ คนรอบข้างปรบมือ"); }
          addStat(l, "health", -randInt(l, 5, 15));
          if (l.stats.health <= 0) { kill(l, "ถูกทำร้ายในการทะเลาะวิวาท"); return bad("หมัดสุดท้ายนั้นแรงเกินไป…"); }
          if (tone(l) === "modern" && chance(l, 0.2)) return bad(sendToJail(l, 1, "ตำรวจมาถึงพอดีตอนคุณกำลังแพ้"));
          return bad("คุณแพ้ยับ กลับบ้านด้วยตาเขียว");
        },
      },
      { label: "ท้าแข่งอย่างอื่นแทน", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { addStat(l, "happiness", ok ? 5 : -2); return ok ? good("คุณชนะเขาด้วยการแข่งดื่ม/หมากรุก/ร้องเพลง — แบบที่ไม่มีใครต้องเลือดออก") : meh("คุณแพ้ทั้งการแข่งและศักดิ์ศรี แต่อย่างน้อยฟันครบ"); } },
      { label: "ปล่อยไป", run: (l) => { addStat(l, "smarts", 1); return meh("คุณหายใจลึกๆ แล้วเดินผ่าน — ผู้ใหญ่ขึ้นอีกนิด"); } },
    ],
  },
  {
    id: "free.adopt",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "รับอุปการะ",
    text: (l) => T(l, {
      modern: "มูลนิธิเด็กกำพร้ามีเด็กที่รอบ้านอยู่หลายคน เจ้าหน้าที่ถามว่าคุณพร้อมจริงไหม",
      ruins: "หลังการบุกครั้งล่าสุด ในฐานมีเด็กที่ไม่มีใครเหลืออีกแล้ว",
      murim: "เด็กกำพร้าสงครามนั่งรวมกันอยู่หน้าวัด ไม่มีใครร้องไห้แล้ว",
      court: "สถานสงเคราะห์ของโบสถ์มีเด็กที่ไม่เคยได้ออกไปนอกกำแพงเลย",
    }),
    choices: [
      { label: "รับอุปการะเด็กเล็ก", run: (l) => adopt(l, randInt(l, 0, 4)) },
      { label: "รับเด็กโตที่ไม่มีใครเลือก", run: (l) => { const o = adopt(l, randInt(l, 9, 14)); addStat(l, "happiness", 3); l.flags.karma = Number(l.flags.karma ?? 0) + 2; return o; } },
      { label: "บริจาคแทน ยังไม่พร้อม", run: (l) => { addMoney(l, -20_000); l.flags.adoptAt = l.age; addStat(l, "happiness", 3); return meh("คุณยังไม่พร้อมเป็นพ่อแม่ — การรู้ตัวก็เป็นความรับผิดชอบแบบหนึ่ง"); } },
    ],
  },
  {
    id: "free.splurge",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "ใช้เงินแบบไม่คิด",
    text: () => "บัญชีของคุณมีเงิน และเงินมีไว้ใช้ — ใช่ไหม?",
    choices: [
      { label: (l) => `${T(l, { modern: "ซื้อรถหรู", ruins: "ซื้อรถหุ้มเกราะ", murim: "ซื้อม้าพันลี้", court: "ซื้อรถม้าประดับทอง" })} (${money(l, stake(l, 0.3, 500_000))})`, run: (l) => { const s = stake(l, 0.3, 500_000); addMoney(l, -s); addStat(l, "happiness", 12); addFame(l, 2); l.flags.luxury = Number(l.flags.luxury ?? 0) + 1; return good("ทุกคนหันมามองตอนคุณผ่าน ความรู้สึกนี้อยู่ได้ประมาณสามเดือน"); } },
      { label: (l) => `${T(l, { modern: "ซื้อบ้านหลังใหญ่", ruins: "ซื้อห้องส่วนตัวในฐาน", murim: "ซื้อคฤหาสน์ริมทะเลสาบ", court: "ซื้อปราสาทชนบท" })} (${money(l, stake(l, 0.6, 3_000_000))})`, run: (l) => { const s = stake(l, 0.6, 3_000_000); addMoney(l, -s); addStat(l, "happiness", 15); l.flags.bigHouse = true; return big("บ้านใหม่กว้างจนเสียงสะท้อน — คุณยืนเงียบๆ กลางห้องรับแขกอยู่นานกว่าที่คิด"); } },
      { label: (l) => `จัดปาร์ตี้ใหญ่ให้ทุกคน (${money(l, stake(l, 0.1, 100_000))})`, run: (l) => { const s = stake(l, 0.1, 100_000); addMoney(l, -s); addStat(l, "happiness", 8); for (const p of l.people) p.bond = Math.min(100, p.bond + 6); addFame(l, 1); return good("งานเลี้ยงที่ทุกคนจะพูดถึงไปอีกหลายปี"); } },
      { label: "ซื้อของสะสมหายาก", run: (l) => { const s = stake(l, 0.15, 200_000); addMoney(l, -s); addStat(l, "happiness", 5); l.flags.collectBuy = Number(l.flags.collectBuy ?? 0) + 1; return good(`คุณจ่าย ${money(l, s)} ให้ของชิ้นเล็กๆ ที่ทำให้ใจเต้น`); } },
      { label: "เปลี่ยนใจ เก็บเงินไว้", run: (l) => { addStat(l, "smarts", 1); return meh("คุณปิดหน้าร้านค้าออนไลน์ — ตัวคุณในอนาคตขอบคุณ"); } },
    ],
  },
];

function moveCountry(l: Life, c: Country): Outcome {
  const old = l.country ?? "th";
  // ชื่อเรียงตามธรรมเนียมเดิมของเจ้าตัว: สลับช่องชื่อ/นามสกุลถ้าประเทศใหม่เรียงกลับกัน
  if (COUNTRIES[old].familyFirst !== COUNTRIES[c].familyFirst) [l.firstName, l.lastName] = [l.lastName, l.firstName];
  l.country = c;
  l.flags.movedAt = l.age;
  l.flags.emigrated = Number(l.flags.emigrated ?? 0) + 1;
  if (l.job && chance(l, 0.6)) l.job = undefined;
  for (const p of people(l, "friend")) p.bond = Math.max(0, p.bond - 20);
  addStat(l, "happiness", randInt(l, -4, 10));
  if (chance(l, 0.6)) createPerson(l, "friend", { age: l.age + randInt(l, -6, 6), bond: 40 });
  return big(localize(`✈️ คุณย้ายมาใช้ชีวิตที่${COUNTRIES[c].name} — ภาษาใหม่ อาหารใหม่ เพื่อนบ้านใหม่ ทุกอย่างต้องเริ่มนับหนึ่ง`, c));
}

function createWork(l: Life, ok: boolean, kind: string): Outcome {
  l.flags.works = Number(l.flags.works ?? 0) + 1;
  if (!ok) { addStat(l, "happiness", -2); return meh(`${kind}ของคุณเสร็จแล้ว… มีคนชมว่า "ตั้งใจดีนะ" สามคน`); }
  if (chance(l, 0.12 + l.stats.luck / 1000)) {
    const g = randInt(l, 2, 20) * 1_000_000;
    addMoney(l, g); addFame(l, randInt(l, 8, 15)); addStat(l, "happiness", 15);
    l.flags.masterpiece = Number(l.flags.masterpiece ?? 0) + 1;
    return big(`🌟 ${kind}ของคุณกลายเป็นปรากฏการณ์! คนพูดถึงไปทั่ว ได้ค่าลิขสิทธิ์ ${money(l, g)}`);
  }
  const g = randInt(l, 10, 200) * 1000;
  addMoney(l, g); addFame(l, randInt(l, 1, 3)); addStat(l, "happiness", 6);
  return good(`${kind}ของคุณมีคนชอบพอสมควร ได้มา ${money(l, g)} และแฟนประจำกลุ่มเล็กๆ`);
}

function adopt(l: Life, age: number): Outcome {
  l.flags.adoptAt = l.age;
  const kid = createPerson(l, "child", { age, bond: age < 5 ? 75 : 45, lastName: l.lastName });
  addMoney(l, -50_000);
  addStat(l, "happiness", 12);
  l.flags.adopted = Number(l.flags.adopted ?? 0) + 1;
  return big(`🧸 ${shortName(kid)} อายุ ${age} ปี กลายเป็นลูกของคุณแล้ว${age >= 9 ? " — เขายังไม่ยอมเรียกคุณว่าพ่อ/แม่ แต่ก็ไม่ปล่อยมือ" : ""}`);
}

// ───────────────────────── "ออกไปเดินเล่น" — เจอเรื่องสั้นที่ยังไม่เคยเจอ ─────────────────────────

const ENCOUNTERS: Record<Tone, Array<{ text: string; a: [string, (l: Life) => Outcome]; b: [string, (l: Life) => Outcome] }>> = {
  modern: [
    { text: "คุณเจอกระเป๋าสตางค์ตกอยู่ข้างทาง ข้างในมีเงินสดและรูปเด็กผู้หญิงยิ้มฟันหลอ", a: ["ตามหาเจ้าของ", (l) => { addStat(l, "happiness", 6); l.flags.karma = Number(l.flags.karma ?? 0) + 1; return good("เจ้าของเป็นคุณตาที่เพิ่งเสียภรรยา รูปนั้นคือหลานคนเดียว เขาจับมือคุณนานมาก"); }], b: ["เก็บเงินไว้", (l) => { addMoney(l, 4_500); addStat(l, "happiness", -2); return meh("4,500 บาท ไม่มากพอให้ลืมรูปเด็กคนนั้น"); }] },
    { text: "นักดนตรีเปิดหมวกริมถนนเล่นเพลงที่แม่คุณเคยร้องกล่อม", a: ["ยืนฟังจนจบแล้วใส่เงิน", (l) => { addStat(l, "happiness", 5); return good("เขาโค้งให้ แล้วเล่นซ้ำให้อีกรอบโดยไม่ต้องขอ"); }], b: ["ขอร้องด้วย", (l) => { addStat(l, "happiness", 7); addFame(l, 1); return good("คนหยุดดูเป็นวง มีคนถ่ายคลิปไปลงเน็ต"); }] },
    { text: "แมวส้มตัวอ้วนเดินตามคุณมาสามซอย แล้วนั่งรอหน้าประตู", a: ["รับเลี้ยง", (l) => { addStat(l, "happiness", 8); l.flags.pet = "แมวส้ม"; return good("มันกลายเป็นเจ้าของบ้านคนใหม่ภายในสามวัน"); }], b: ["ให้อาหารแล้วจากไป", (l) => { addStat(l, "happiness", 3); return meh("พรุ่งนี้มันก็มารออีก"); }] },
    { text: "ร้านหนังสือเก่าในซอยเปลี่ยวมีหนังสือที่ชื่อเหมือนชื่อคุณเป๊ะ", a: ["ซื้อมาอ่าน", (l) => { addStat(l, "smarts", 3); return good("เป็นนิยายเรื่องธรรมดาๆ แต่ตัวเอกตัดสินใจเหมือนคุณทุกครั้ง น่าขนลุกนิดหน่อย"); }], b: ["ถามเจ้าของร้าน", (l) => { addStat(l, "luck", 1); return meh("ชายแก่ยิ้ม \"บางเล่มก็เลือกคนอ่านเอง\" แล้วไม่ยอมพูดอะไรอีก"); }] },
    { text: "คู่รักต่างชาติหลงทาง ถือแผนที่กลับหัว", a: ["พาไปส่ง", (l) => { addStat(l, "happiness", 4); if (chance(l, 0.3)) { createPerson(l, "friend", { age: l.age, bond: 50 }); return good("กลายเป็นเพื่อนทางไกล ส่งโปสการ์ดมาทุกปีใหม่"); } return good("พวกเขาขอถ่ายรูปกับคุณเป็นที่ระลึก"); }], b: ["บอกทางผิดเล่นๆ", (l) => { addStat(l, "happiness", 1); addStat(l, "luck", -1); return meh("ตลกดีสามวินาที แล้วก็รู้สึกผิดทั้งวัน"); }] },
    { text: "ป้าขายลอตเตอรี่ยื่นเลขชุดหนึ่งให้ \"ชุดนี้แหละ ป้าฝันเห็นหน้าหนู\"", a: ["ซื้อ", (l) => { addMoney(l, -160); if (chance(l, 0.04)) { addMoney(l, 400_000); return big("ถูกเลขท้าย! ป้าแกยิ้มเหมือนรู้อยู่แล้ว"); } return meh("กินแห้วเหมือนเดิม ป้าบอกว่า \"งวดหน้าแน่นอน\""); }], b: ["ไม่ซื้อ", () => meh("งวดนั้นเลขออกตรงชุดเป๊ะ — คุณจะไม่มีวันรู้")] },
    { text: "ฝนตกหนัก คุณหลบใต้ชายคาร้านกาแฟเดียวกับคนแปลกหน้าที่ร้องไห้อยู่", a: ["ยื่นผ้าเช็ดหน้าให้", (l) => { addStat(l, "happiness", 4); if (chance(l, 0.35) && !people(l, "partner").length && !people(l, "spouse").length && l.age >= 18) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -4, 4), bond: 55 }); return good(`กาแฟแก้วนั้นยาวไปถึงตอนฝนหยุด — แล้วต่อไปอีกหลายปี คุณได้คบกับ${shortName(p)}`); } return good("เธอ/เขาเล่าเรื่องที่ไม่เคยเล่าให้ใครฟัง แล้วขอบคุณที่ไม่ถามอะไร"); }], b: ["ฟังเพลงในหูฟังต่อ", () => meh("ฝนหยุด ทุกคนแยกย้าย")] },
    { text: "คุณเห็นเด็กนักเรียนโดนรุมแกล้งหลังโรงเรียน", a: ["เข้าไปห้าม", (l) => { addStat(l, "happiness", 4); l.flags.karma = Number(l.flags.karma ?? 0) + 1; return good("พวกเด็กเกเรวิ่งหนี เด็กคนนั้นเงยหน้าขึ้นมองคุณเหมือนเห็นฮีโร่"); }], b: ["ถ่ายคลิปส่งโรงเรียน", (l) => { addFame(l, 1); return meh("คลิปไวรัล ครูถูกเรียกพบ ผู้ปกครองดราม่ากันทั้งอาทิตย์"); }] },
    { text: "ร้านเหล้าเปิดไมค์ให้ใครก็ได้ขึ้นเวที", a: ["ขึ้นไปเล่นมุกตลก", (l) => (chance(l, checkChance(l, "smarts", 55)) ? (addFame(l, 2), addStat(l, "happiness", 6), good("คนหัวเราะจนน้ำตาไหล เจ้าของร้านชวนมาเล่นประจำ")) : (addStat(l, "happiness", -4), bad("เงียบจนได้ยินเสียงน้ำแข็งในแก้ว")))], b: ["นั่งดูคนอื่น", (l) => { addStat(l, "happiness", 3); return meh("คืนวันธรรมดาที่ดีแบบไม่ต้องพยายาม"); }] },
    { text: "ชายแปลกหน้าเสนอขาย \"แผนที่ไปยังสมบัติ\" ราคา 2,000 บาท", a: ["ซื้อแล้วตามไปดู", (l) => { addMoney(l, -2_000); if (chance(l, 0.15)) { addMoney(l, 250_000); return big("ใต้ต้นไม้ใหญ่มีกล่องเหล็กเก่า ข้างในคือเหรียญโบราณที่นักสะสมให้ราคาสูงลิ่ว!"); } return meh("ปลายทางคือร้านก๋วยเตี๋ยวของญาติเขา — อร่อยด้วย"); }], b: ["ปฏิเสธ", () => meh("เขาเดินไปเสนอคนถัดไปด้วยบทพูดเดียวกันเป๊ะ")] },
  ],
  ruins: [
    { text: "ในซากร้านขายของเล่น คุณเจอกล่องดนตรีที่ยังหมุนได้", a: ["เก็บไว้", (l) => { addStat(l, "happiness", 6); return good("เสียงของมันทำให้เด็กในฐานหลับได้เป็นครั้งแรกในรอบสัปดาห์"); }], b: ["แลกเป็นเสบียง", (l) => { addMoney(l, 3_000); return meh("ได้อาหารกระป๋องสองกระป๋อง — ท้องอิ่ม ใจว่าง"); }] },
    { text: "ผู้รอดชีวิตคนเดียวโบกมือจากหลังคาตึกที่ล้อมด้วยสัตว์อสูร", a: ["ไปช่วย", (l) => (chance(l, 0.6) ? (createPerson(l, "friend", { age: l.age + randInt(l, -10, 10), bond: 70 }), good("คุณดึงเธอ/เขาลงมาได้ และได้เพื่อนที่จะไม่มีวันลืมบุญคุณ")) : (addStat(l, "health", -15), bad("สัตว์อสูรหันมาทางคุณ คุณรอดมาได้แบบหวุดหวิด")))], b: ["โยนเสบียงขึ้นไปให้", (l) => { addMoney(l, -2_000); return meh("อย่างน้อยเธอ/เขาก็มีอาหารพอจนกว่าจะมีคนอื่นมา"); }] },
    { text: "วิทยุในรถที่จอดทิ้งไว้ยังรับสัญญาณได้ — มีคนประกาศพิกัดฐานที่มี 'ไฟฟ้าตลอดคืน'", a: ["จดพิกัดไว้", (l) => { addStat(l, "smarts", 2); l.flags.radioBase = true; return meh("ข้อมูลมีค่าเท่าทองในยุคนี้"); }], b: ["ปิดวิทยุ", () => meh("บางครั้งความหวังก็เป็นกับดัก")] },
    { text: "สวนผักบนดาดฟ้าที่ไม่มีใครดูแล ยังมีมะเขือเทศสุกอยู่สามลูก", a: ["กินเลย", (l) => { addStat(l, "health", 4); addStat(l, "happiness", 5); return good("รสชาติของโลกเก่า คุณกินช้าๆ ทีละคำ"); }], b: ["เอาเมล็ดกลับไปปลูกที่ฐาน", (l) => { l.flags.karma = Number(l.flags.karma ?? 0) + 1; addStat(l, "happiness", 4); return good("อีกสามเดือนต่อมา ฐานมีมะเขือเทศกินเป็นครั้งแรก"); }] },
    { text: "สุนัขผอมโซตัวหนึ่งเดินตามคุณออกมาจากซากเมือง", a: ["รับเลี้ยง", (l) => { l.flags.pet = "สุนัขจากซากเมือง"; addStat(l, "happiness", 7); return good("มันเห่าเตือนก่อนสัตว์อสูรจะเข้ามาใกล้ทุกครั้ง"); }], b: ["ไล่ไป", (l) => { addStat(l, "happiness", -3); return meh("มันยืนมองคุณจนลับตา"); }] },
  ],
  murim: [
    { text: "ชายชราตาบอดนั่งเล่นหมากล้อมคนเดียวใต้ต้นสน ยื่นหมากขาวมาให้คุณ", a: ["นั่งลงเล่นด้วย", (l) => { addStat(l, "smarts", 3); if (l.power && chance(l, 0.2)) { l.power.level += 1; return good("ทุกตาที่เขาวางหมากเหมือนสอนเพลงกระบี่ — คุณเข้าใจวิชาตัวเองลึกขึ้นอีกขั้น"); } return good("คุณแพ้ทุกกระดาน แต่สมองเหมือนถูกล้างจนใส"); }], b: ["คารวะแล้วเดินผ่าน", () => meh("เขาพยักหน้าเหมือนรู้อยู่แล้วว่าคุณจะไป")] },
    { text: "พ่อค้าเร่ขายซาลาเปาร้องว่าถูกโจรขโมยเงินทั้งวัน", a: ["ไล่ตามโจร", (l) => (chance(l, checkChance(l, "health", 50) + (l.power ? 0.3 : 0)) ? (addFame(l, 1), good("คุณจับโจรได้ที่ปลายตรอก พ่อค้ายัดซาลาเปาให้เต็มอ้อมแขน")) : (addStat(l, "health", -5), meh("โจรใช้วิชาตัวเบาหายไปบนหลังคา")))], b: ["ซื้อซาลาเปาเหมาหมด", (l) => { addMoney(l, -500); addStat(l, "happiness", 4); return good("เขาร้องไห้ คุณกินซาลาเปาไปทั้งอาทิตย์"); }] },
    { text: "ในถ้ำหลังน้ำตก มีรอยกระบี่สลักไว้บนผนังหิน", a: ["ศึกษารอยกระบี่", (l) => { if (l.power) { l.power.level += chance(l, 0.3) ? 2 : 1; return good("สามวันสามคืน คุณมองจนเห็นเจตนาของคนที่สลักมัน"); } addStat(l, "smarts", 2); return meh("สวยงาม แต่คุณยังไม่เข้าใจ"); }], b: ["ไม่ยุ่ง", () => meh("บางอย่างควรปล่อยให้คนที่ใช่มาเจอ")] },
    { text: "งานแต่งงานของลูกสาวเศรษฐี มีการประลองเลือกคู่หน้าเวที", a: ["ขึ้นประลอง", (l) => (chance(l, l.power ? 0.5 : 0.1) ? (addFame(l, 4), good("คุณชนะ แต่ปฏิเสธการแต่งงานอย่างสุภาพ — เรื่องเล่าลือไปทั้งเมือง")) : (addStat(l, "health", -6), meh("คุณตกเวทีในยกที่สอง คนดูหัวเราะ (ด้วยความเอ็นดู)")))], b: ["นั่งกินโต๊ะจีน", (l) => { addStat(l, "happiness", 5); return good("หูฉลามอร่อยมาก"); }] },
    { text: "ศิษย์สำนักอื่นล้มหมดสติข้างทาง เลือดออกจากปาก — ธาตุไฟเข้าแทรก", a: ["ถ่ายลมปราณช่วย", (l) => { if (l.power && chance(l, 0.7)) { createPerson(l, "ally", { age: l.age + randInt(l, -5, 5), bond: 70 }); return good("เขาฟื้นและสาบานจะตอบแทนบุญคุณ"); } addStat(l, "health", -8); return bad("ลมปราณของเขาย้อนเข้ามาทำร้ายคุณด้วย"); }], b: ["พาไปหาหมอ", (l) => { addMoney(l, -1_000); return meh("หมอบอกว่ามาทันพอดี"); }] },
  ],
  court: [
    { text: "ในสวนกุหลาบหลังพระราชวัง มีจดหมายรักไม่ลงชื่อหล่นอยู่", a: ["ตามหาเจ้าของ", (l) => { addStat(l, "happiness", 4); addFame(l, 1); return good("คุณกลายเป็นแม่สื่อให้คู่รักที่ไม่กล้าพูดกันมาสามปี"); }], b: ["อ่านแล้วเก็บไว้", (l) => { l.flags.loveLetter = true; return meh("ลายมือคุ้นตาอย่างน่าประหลาด — ของใครกันนะ"); }] },
    { text: "นักเล่นแร่แปรธาตุเร่ขายยา \"ดื่มแล้วงามขึ้นสิบปี\"", a: ["ลองดื่ม", (l) => (chance(l, 0.4) ? (addStat(l, "looks", 5), good("ผิวคุณใสขึ้นจริงๆ!")) : (addStat(l, "health", -6), bad("คืนนั้นคุณเห็นภาพหลอนเป็นกระต่ายพูดได้")))], b: ["แจ้งทหารยาม", (l) => { addFame(l, 1); return meh("เขาถูกจับ — แต่ยามแอบเก็บยาไว้ขวดหนึ่ง"); }] },
    { text: "ลูกม้าพลัดหลงจากคอกหลวง วิ่งเข้ามาในตรอก", a: ["พาไปคืน", (l) => { addFame(l, 1); if (chance(l, 0.3)) { addMoney(l, 50_000); return good("มันคือลูกม้าขององค์หญิงน้อย! คุณได้รางวัลและคำขอบคุณเป็นลายพระหัตถ์"); } return good("คนเลี้ยงม้าขอบคุณจนเกือบร้องไห้"); }], b: ["เลี้ยงไว้เอง", (l) => { l.flags.pet = "ม้าขาว"; addStat(l, "happiness", 6); return meh("มันโตเป็นม้าขาวสง่าที่ไม่ยอมให้ใครขี่นอกจากคุณ"); }] },
    { text: "หมอดูยิปซีจับมือคุณแล้วหน้าซีด", a: ["ฟังคำทำนาย", (l) => { addStat(l, "luck", chance(l, 0.5) ? 1 : -1); return meh("\"ชะตาของท่านถูกเขียนไว้แล้ว… แต่หมึกยังไม่แห้ง\""); }], b: ["ดึงมือกลับ", () => meh("เธอตะโกนตามหลังมาเป็นภาษาที่คุณไม่รู้จัก")] },
    { text: "เด็กขายไม้ขีดไฟนั่งตัวสั่นกลางหิมะ", a: ["ซื้อหมดแล้วพาไปกินซุป", (l) => { addMoney(l, -2_000); addStat(l, "happiness", 6); l.flags.karma = Number(l.flags.karma ?? 0) + 1; return good("เธอกินซุปสามชาม แล้วเล่าว่าพ่อเคยเป็นอัศวิน"); }], b: ["ให้เหรียญแล้วรีบไป", (l) => { addMoney(l, -200); return meh("หิมะตกหนักขึ้น คุณไม่หันกลับไปมอง"); }] },
  ],
};

const encounterId = (t: Tone, i: number) => `free.x.${t}.${i}`;

for (const t of Object.keys(ENCOUNTERS) as Tone[]) {
  ENCOUNTERS[t].forEach((x, i) =>
    FREE_EVENTS.push({
      id: encounterId(t, i),
      minAge: 0,
      maxAge: 200,
      manual: true,
      maxTimes: 1,
      title: "ระหว่างทาง",
      text: () => x.text,
      choices: [
        { label: x.a[0], run: (l) => x.a[1](l) },
        { label: x.b[0], run: (l) => x.b[1](l) },
      ],
    }),
  );
}

/** เรื่องระหว่างทางที่ยังไม่เคยเจอทั้งชาตินี้และชาติก่อน (หมดแล้วค่อยวนเรื่องที่ไม่ได้เจอในชาตินี้) */
function pickEncounter(l: Life): string {
  const t = tone(l);
  const ids = ENCOUNTERS[t].map((_, i) => encounterId(t, i)).filter((id) => !l.seen[id]);
  const past = new Set(l.pastSeen ?? []);
  const fresh = ids.filter((id) => !past.has(id));
  const pool = fresh.length ? fresh : ids;
  return pool.length ? pick(l, pool) : "free.wander_quiet";
}

FREE_EVENTS.push({
  id: "free.wander_quiet",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  text: () => "คุณเดินไปเรื่อยๆ โดยไม่มีจุดหมาย",
  choices: [
    { label: "นั่งพักริมทาง", run: (l) => { addStat(l, "happiness", 3); return meh("วันธรรมดาที่ไม่มีอะไรเกิดขึ้น — และนั่นก็ดีแล้ว"); } },
    { label: "เดินต่อจนค่ำ", run: (l) => { addStat(l, "health", 2); return meh("ขาคุณเมื่อย แต่หัวโล่ง"); } },
  ],
});

export { FREE_EVENTS };
