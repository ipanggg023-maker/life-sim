import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { memoryOdds, observe, remembers, useMemory } from "../../../engine/memory";
import { chance, randInt } from "../../../engine/rng";
import type { HunterClass, Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, formatMoney, people, shortName } from "../../../engine/util";
import { awaken, classById, fightOdds, gainExp, luckyRankUp, offerClasses, rankName, rollAwakening, survivalOdds } from "../power";
import { worldFacts } from "../worldFacts";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });
const sys = (text: string, next?: string): Outcome => ({ text, kind: "system", next });

const pct = (l: Life) => `${Math.round(memoryOdds(l) * 100)}%`;
const F = worldFacts;

export const MEMORY_EVENTS: GameEvent[] = [
  // ───────── ลางมรณะ ─────────
  {
    id: "memory.death_warning",
    minAge: 0,
    maxAge: 200,
    forced: true,
    when: (l) => {
      const m = remembers(l, "death");
      return !!m && m.age - 1 === l.age;
    },
    system: true,
    text: (l) => `[ความทรงจำ] ปีหน้าคือปีที่คุณตายในชาติก่อน — "${remembers(l, "death")!.text}" ระวังตัวให้ดี`,
  },

  // ───────── หวย ─────────
  {
    id: "world.lottery_news",
    minAge: 18,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).lotteryAge && !remembers(l, "lottery"),
    text: (l) => `📺 ผลสลากกินแบ่งงวดใหญ่ประจำปี: รางวัลที่ 1 เลข ${F(l).lotteryNumber} — ไม่มีใครถูกเลยสักใบ`,
    auto: (l) => { observe(l, "lottery", `อายุ ${l.age}: รางวัลที่ 1 คือเลข ${F(l).lotteryNumber}`, { num: F(l).lotteryNumber }); },
  },
  {
    id: "memory.lottery",
    minAge: 18,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).lotteryAge && !!remembers(l, "lottery"),
    title: "ความทรงจำ: เลขเด็ด",
    text: (l) => `งวดใหญ่ประจำปีมาถึงแล้ว… คุณจำได้ชัดเจนว่าชาติก่อนรางวัลที่ 1 ออกเลข ${remembers(l, "lottery")!.data?.num}`,
    choices: [
      {
        label: (l) => `ซื้อเลข ${remembers(l, "lottery")!.data?.num} สิบใบ (อนาคตยังตรง ${pct(l)})`,
        tone: "special",
        run: (l) => {
          addMoney(l, -1000);
          if (useMemory(l)) {
            addMoney(l, 60_000_000);
            l.flags.jackpot = true;
            addStat(l, "happiness", 25);
            return { text: "💰 ถูกรางวัลที่ 1 ทั้งสิบใบ! 60 ล้านบาท — ความทรงจำไม่เคยโกหก", kind: "milestone" };
          }
          observe(l, "lottery", `อายุ ${l.age}: รางวัลที่ 1 คือเลข ${F(l).lotteryNumber} (เปลี่ยนไปจากเดิม)`, { num: String(randInt(l, 0, 999_999)).padStart(6, "0") });
          return bad("ผลออกมา… ไม่ใช่เลขที่จำได้! อนาคตเบี่ยงไปแล้ว");
        },
      },
      { label: "ไม่ซื้อ ไม่อยากเปลี่ยนอนาคตมากเกินไป", run: () => meh("คุณดูผลหวยออกตรงตามที่จำได้ แล้วถอนหายใจยาว") },
    ],
  },

  // ───────── หุ้นมานาเทค ─────────
  {
    id: "memory.stock_tip",
    minAge: 18,
    maxAge: 200,
    forced: true,
    when: (l) => !!remembers(l, "stock") && l.age === Math.max(18, F(l).stockAge - 4) && l.money > 0,
    title: "ความทรงจำ: หุ้นมานาเทค",
    text: (l) => `คุณจำได้ว่าอีก ${F(l).stockAge - l.age} ปี บริษัท MANATECH จะค้นพบวิธีแปลงคริสตัลมานาเป็นไฟฟ้า หุ้นพุ่ง 30 เท่าในปีเดียว ตอนนี้ราคายังถูกมาก`,
    choices: [
      { label: (l) => `ลงทุนครึ่งหนึ่ง (${formatMoney(Math.floor(l.money / 2))})`, tone: "special", run: (l) => { const a = Math.floor(l.money / 2); addMoney(l, -a); l.flags.stockInvest = a; return good("คุณซื้อหุ้นแล้วเก็บไว้ไม่แตะเลย"); } },
      { label: (l) => `ทุ่มหมดหน้าตัก (${formatMoney(l.money)})`, tone: "special", run: (l) => { const a = l.money; addMoney(l, -a); l.flags.stockInvest = a; return good("คนรอบตัวคิดว่าคุณบ้า… แต่คุณรู้ดี"); } },
      { label: "ไม่ลงทุน", run: () => meh("เงินฝากออมทรัพย์ก็ปลอดภัยดี") },
    ],
  },
  {
    id: "world.stock_boom",
    minAge: 18,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).stockAge,
    prepare: (l): Ctx => {
      const invest = Number(l.flags.stockInvest ?? 0);
      if (!invest) return { r: "none" };
      if (useMemory(l, 10)) {
        addMoney(l, invest * 30);
        return { r: "win", amt: invest * 30 };
      }
      addMoney(l, Math.round(invest * 0.4));
      return { r: "lose", amt: Math.round(invest * 0.4) };
    },
    text: (_l, c) =>
      c.r === "win"
        ? `📈 MANATECH ประกาศเทคโนโลยีมานาไฟฟ้า หุ้นพุ่ง 30 เท่า! พอร์ตของคุณกลายเป็น ${formatMoney(Number(c.amt))}`
        : c.r === "lose"
          ? `📉 อนาคตเปลี่ยนไป… MANATECH ถูกคู่แข่งชิงประกาศก่อน หุ้นร่วง คุณขายคืนได้แค่ ${formatMoney(Number(c.amt))}`
          : "📈 ข่าว: หุ้น MANATECH พุ่ง 30 เท่าในปีเดียวหลังประกาศเทคโนโลยีมานาไฟฟ้า ใครถือไว้ก่อนรวยกันถ้วนหน้า",
    auto: (l, c) => {
      observe(l, "stock", `อายุ ${l.age}: หุ้น MANATECH พุ่ง 30 เท่า`);
      if (c.r === "win") return "good";
      if (c.r === "lose") return "bad";
    },
  },

  // ───────── มหันตภัยกรุงเทพฯ ─────────
  {
    id: "memory.cataclysm_prep",
    minAge: 1,
    maxAge: 200,
    forced: true,
    when: (l) => !!remembers(l, "cataclysm") && l.age === F(l).cataclysmAge - 1,
    title: "ความทรงจำ: มหันตภัย",
    text: (l) => `ปีหน้า Gate แรงก์ S จะแตกกลางกรุงเทพฯ — ชาติก่อน${remembers(l, "cataclysm")!.text} คุณมีเวลาเตรียมตัวหนึ่งปี`,
    choices: [
      {
        label: (l) => `พาครอบครัวย้ายไปเชียงใหม่ก่อน (อนาคตยังตรง ${pct(l)})`,
        tone: "special",
        run: (l) => {
          addMoney(l, -150_000);
          if (useMemory(l)) { l.flags.evacuated = true; return good("คุณอ้างว่าได้งานใหม่ แล้วพาทุกคนย้ายไปเชียงใหม่ แม่บ่นตลอดทาง"); }
          l.flags.evacuated = false;
          return bad("คุณพาครอบครัวย้ายไปแล้ว… แต่ข่าวลือว่ามหันตภัยจะเกิดที่เชียงใหม่แทนเริ่มดังขึ้น อนาคตเปลี่ยนไปแล้ว");
        },
      },
      {
        label: "เตรียมตัวสู้ (ฝึกหนักทั้งปีแล้วรอที่จุดเกิดเหตุ)",
        tone: "special",
        show: (l) => !!l.power,
        run: (l) => { l.flags.cataclysmReady = true; gainExp(l, 500); return good("คุณศึกษาจุดอ่อนของบอสจากความทรงจำ และฝึกท่าเดียวซ้ำเป็นหมื่นครั้ง"); },
      },
      {
        label: "เตือนสมาคม Hunter",
        check: { stat: "smarts", dc: 70 },
        run: (l, _c, ok) => {
          if (ok) { l.flags.associationWarned = true; addFame(l, 10); return good("สมาคมเชื่อคุณครึ่งหนึ่ง และส่งทีมแรงก์ S ไปเฝ้าจุดนั้นไว้"); }
          addFame(l, -5); return bad("เจ้าหน้าที่หัวเราะใส่ \"ไปดูดวงมาเหรอครับ\"");
        },
      },
    ],
  },
  {
    id: "world.cataclysm",
    minAge: 1,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).cataclysmAge,
    title: "มหันตภัยกรุงเทพฯ",
    text: (l) =>
      l.flags.evacuated
        ? "ข่าวด่วนจากกรุงเทพฯ: Gate แรงก์ S แตกที่สยาม มังกรกระดูกบินออกมาเผาเมืองทั้งคืน… คุณกับครอบครัวดูข่าวอยู่ที่เชียงใหม่อย่างปลอดภัย"
        : "ตีสามสิบห้า ท้องฟ้ากรุงเทพฯ ฉีกออก Gate แรงก์ S แตก! มังกรกระดูกยักษ์บินออกมาพร้อมฝูงมอนสเตอร์นับพัน ไซเรนดังทั่วเมือง",
    choices: [
      {
        label: "ดูข่าวอยู่ที่เชียงใหม่",
        show: (l) => !!l.flags.evacuated,
        run: (l) => {
          observe(l, "cataclysm", "มังกรกระดูกเผากรุงเทพฯ ทั้งคืน");
          if (people(l, "father").length + people(l, "mother").length > 0) l.flags.savedFamily = true;
          addStat(l, "happiness", 5);
          return sys("ครอบครัวของคุณรอดทั้งหมด คุณเปลี่ยนชะตาได้สำเร็จ");
        },
      },
      {
        label: "ฝ่าเข้าไปสู้มังกรกระดูก",
        tone: "danger",
        show: (l) => !l.flags.evacuated && !!l.power,
        odds: (l) => fightOdds(l, 6, l.flags.cataclysmReady ? 0.3 : 0) + (l.flags.associationWarned ? 0.1 : 0),
        survival: (l) => survivalOdds(l, 6, l.flags.cataclysmReady ? 0.3 : 0),
        run: (l, _c, ok) => {
          observe(l, "cataclysm", "มังกรกระดูกเผากรุงเทพฯ และคนในครอบครัวคุณหลายคนไม่รอด");
          if (ok) {
            addFame(l, 50);
            gainExp(l, 3000);
            luckyRankUp(l, "สังหารมังกรกระดูก");
            l.flags.savedFamily = true;
            return { text: "🐉 คุณปักดาบลงกลางกะโหลกมังกร! กรุงเทพฯ รอด และทั้งโลกรู้จักชื่อคุณในคืนเดียว", kind: "milestone" };
          }
          familyLosses(l, 0.2);
          if (!chance(l, survivalOdds(l, 6, l.flags.cataclysmReady ? 0.3 : 0))) { kill(l, "สละชีวิตต้านมังกรกระดูกในมหันตภัยกรุงเทพฯ"); return bad("เปลวไฟสีเขียวกลืนร่างคุณ…"); }
          return bad("คุณพ่ายแพ้ แต่ถ่วงเวลาได้นานพอให้แรงก์ S มาถึง");
        },
      },
      {
        label: "พาครอบครัวหนี",
        show: (l) => !l.flags.evacuated,
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          const lost = familyLosses(l, ok ? 0.1 : 0.35);
          observe(l, "cataclysm", lost ? `มังกรกระดูกเผากรุงเทพฯ และคุณเสีย${lost}ไป` : "มังกรกระดูกเผากรุงเทพฯ ทั้งเมือง");
          if (!ok && chance(l, 0.15)) { kill(l, "ถูกไฟมังกรระหว่างอพยพในมหันตภัยกรุงเทพฯ"); return bad("ถนนถล่มลงตรงหน้า…"); }
          return lost ? bad(`คุณหนีออกมาได้ แต่${lost}ไม่รอด`) : good("ทุกคนในครอบครัวหนีออกมาได้อย่างปาฏิหาริย์");
        },
      },
      {
        label: "ช่วยอพยพคนแปลกหน้า",
        show: (l) => !l.flags.evacuated,
        check: { stat: "health", dc: 55 },
        run: (l, _c, ok) => {
          const lost = familyLosses(l, 0.3);
          observe(l, "cataclysm", lost ? `มังกรกระดูกเผากรุงเทพฯ และคุณเสีย${lost}ไป` : "มังกรกระดูกเผากรุงเทพฯ ทั้งเมือง");
          addFame(l, ok ? 15 : 5);
          if (!ok) addStat(l, "health", -20);
          return ok ? good(`คุณพาคนกว่าห้าร้อยคนลงอุโมงค์รถไฟฟ้าได้ปลอดภัย${lost ? ` …แต่${lost}ไม่รอด` : ""}`) : bad(`คุณช่วยคนได้หลายสิบ แต่บาดเจ็บหนัก${lost ? ` และ${lost}ไม่รอด` : ""}`);
        },
      },
    ],
  },

  // ───────── ดันเจี้ยนลับ (วาสนาที่จำได้) ─────────
  {
    id: "world.secret_gate_news",
    minAge: 18,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).secretGateAge && !remembers(l, "secret_gate"),
    text: () => "📺 ข่าว: Hunter ทีมแรงก์ D หายสาบสูญทั้งทีมใน Gate ที่บางนา มีผู้รอดชีวิตเพียงคนเดียว — และเขาออกมาพร้อมพลังแรงก์ S",
    auto: (l) => { observe(l, "secret_gate", `อายุ ${l.age}: Gate แรงก์ D ที่บางนามีดันเจี้ยนลับที่มอบพลัง`); },
  },
  {
    id: "memory.secret_gate",
    minAge: 18,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).secretGateAge && !!remembers(l, "secret_gate"),
    title: "ความทรงจำ: วาสนาที่บางนา",
    text: () => "คุณจำได้ — Gate แรงก์ D ที่บางนาจะเปิดสัปดาห์นี้ ข้างในมีดันเจี้ยนลับที่มอบพลังให้ผู้รอดเพียงคนเดียว ชาติก่อนคนที่ได้ไปไม่ใช่คุณ",
    choices: [
      {
        label: (l) => `ไปที่นั่นก่อนทุกคน (อนาคตยังตรง ${pct(l)})`,
        tone: "danger",
        survival: (l) => clamp(0.45 + (l.stats.smarts - 50) / 150 + (l.power ? 0.2 : 0), 0.15, 0.95),
        run: (l, c) => {
          if (!useMemory(l)) return bad("Gate ที่บางนา… ไม่ได้เปิดขึ้น อนาคตเปลี่ยนไปแล้ว");
          if (!chance(l, clamp(0.45 + (l.stats.smarts - 50) / 150 + (l.power ? 0.2 : 0), 0.15, 0.95))) {
            kill(l, "ตายในดันเจี้ยนลับที่บางนา");
            return bad("รูปปั้นเทพเจ้าลืมตาขึ้นเร็วกว่าที่จำได้…");
          }
          if (l.power) {
            luckyRankUp(l, "[ระบบ] ผ่านบททดสอบของดันเจี้ยนลับ");
            luckyRankUp(l, "[ระบบ] รางวัลผู้พิชิตคนแรก");
            return { text: "คุณพิชิตดันเจี้ยนลับก่อนใคร และชิงวาสนาของ 'ตัวเอกในชาติก่อน' มาได้", kind: "milestone" };
          }
          c.rank = Math.max(rollAwakening(l, 3), 3);
          c.offer = offerClasses(l).join(",");
          return sys("คุณเป็นผู้รอดชีวิตเพียงคนเดียว… แล้วหน้าต่างสีฟ้าก็เด้งขึ้นมา", "pick");
        },
      },
      { label: "ปล่อยให้เป็นไปตามเดิม", run: () => meh("ข่าวผู้รอดชีวิตแรงก์ S ขึ้นหน้าหนึ่งเหมือนเดิม") },
    ],
    scenes: {
      pick: {
        system: true,
        title: "ผู้พิชิตคนแรก",
        text: (_l, c) => `[ระบบ] ยินดีด้วย ผู้พิชิตดันเจี้ยนลับคนแรก — แรงก์: 【${rankName(Number(c.rank))}】 กรุณาเลือกสายอาชีพ`,
        choices: (["sword", "mage", "healer", "assassin", "tank", "summoner"] as HunterClass[]).map((id) => ({
          label: `${classById(id).emoji} ${classById(id).name}`,
          tone: id === "summoner" ? ("special" as const) : undefined,
          show: (_l: Life, c: Ctx) => String(c.offer).split(",").includes(id),
          run: (l: Life, c: Ctx): Outcome => {
            awaken(l, Number(c.rank), id);
            return { text: `⚡ คุณตื่นพลังเป็น ${classById(id).name} แรงก์ ${rankName(Number(c.rank))} — วาสนาที่ชาติก่อนไม่ใช่ของคุณ ตอนนี้เป็นของคุณแล้ว`, kind: "milestone" };
          },
        })),
      },
    },
  },

  // ───────── ผู้ย้อนเวลาอีกคน (hook สำหรับอนาคต) ─────────
  {
    id: "memory.other_regressor",
    minAge: 16,
    maxAge: 60,
    weight: (l) => ((l.regressions ?? 0) >= 2 ? 6 : 0),
    title: "อีกคนหนึ่ง",
    text: () => "ชายแปลกหน้าในชุดสูทสีดำเดินสวนคุณที่สถานีรถไฟฟ้า แล้วหยุดกระซิบข้างหู \"ครั้งนี้นายมาช้ากว่าเดิมนะ\"",
    choices: [
      { label: "คว้าแขนเขาไว้", check: { stat: "health", dc: 60 }, run: (l, _c, ok) => { l.flags.otherRegressor = true; return ok ? sys("เขายิ้ม \"รอบที่เท่าไหร่แล้วล่ะ? ฉันเลิกนับไปตั้งแต่รอบที่สามสิบ\" แล้วหายไปในฝูงคน") : meh("แขนเสื้อหลุดจากมือคุณ เขาหายไปในฝูงคนราวกับไม่เคยมีตัวตน"); } },
      { label: "แกล้งทำเป็นไม่ได้ยิน", run: (l) => { l.flags.otherRegressor = true; addStat(l, "happiness", -5); return meh("หัวใจคุณเต้นแรงไปทั้งวัน — คุณไม่ใช่คนเดียวที่ย้อนเวลาได้"); } },
    ],
  },

  // ───────── ฝังสมบัติไว้ให้ชาติหน้า ─────────
  {
    id: "soul.time_capsule",
    minAge: 55,
    maxAge: 95,
    weight: (l) => (l.money > 1_000_000 ? 5 : 0),
    text: () => "คืนหนึ่งคุณฝันถึงตัวเองในชาติหน้า… ตื่นมาพร้อมความคิดแปลกๆ ว่าควรฝังอะไรไว้ให้ 'เขา'",
    choices: [
      { label: (l) => `ฝังทองคำมูลค่า ${formatMoney(Math.round(l.money * 0.1))} ไว้ใต้ต้นมะม่วงหลังบ้าน`, tone: "special", run: (l) => { const a = Math.round(l.money * 0.1); addMoney(l, -a); l.flags.stash = a; return sys("คุณจดตำแหน่งไว้ในใจ ไม่บอกใครแม้แต่ลูก"); } },
      { label: "เรื่องเพ้อเจ้อ", run: () => meh("คุณหัวเราะกับตัวเองแล้วนอนต่อ") },
    ],
  },
];

/** สุ่มให้คนในครอบครัวเสียชีวิตในมหันตภัย คืนชื่อที่เสียไป */
function familyLosses(l: Life, p: number): string {
  const lost: string[] = [];
  for (const x of l.people) {
    if (!x.alive || !["father", "mother", "sibling", "spouse", "child"].includes(x.relation)) continue;
    if (chance(l, p)) {
      x.alive = false;
      lost.push(shortName(x));
    }
  }
  if (lost.length) addStat(l, "happiness", -15 * lost.length);
  return lost.join(", ");
}

// ───────────────────────── มรดกจากชาติก่อน ─────────────────────────

export const LEGACY_EVENTS: GameEvent[] = [
  {
    id: "legacy.history_class",
    minAge: 10,
    maxAge: 17,
    weight: (l) => (l.legacy && (l.legacy.fame >= 30 || (l.legacy.rank ?? 0) >= 4) ? 20 : 0),
    text: (l) =>
      `คาบประวัติศาสตร์ ครูเปิดสไลด์เรื่อง "${l.legacy!.founderName}" ${l.legacy!.rank !== undefined ? `Hunter แรงก์ ${rankName(l.legacy!.rank)} ` : ""}ผู้มีชื่อเสียงเมื่อหลายสิบปีก่อน…ใบหน้าในรูปคือคุณในชาติก่อน`,
    choices: [
      { label: "ยกมือแก้ข้อมูลที่ผิด", tone: "special", run: (l) => { addFame(l, 2); addStat(l, "smarts", 2); return sys("\"ท่านไม่ได้ชอบกินผักชีครับ/ค่ะ\" ทั้งห้องหันมามองคุณ ครูทำหน้างง"); } },
      { label: "เงียบไว้ แอบยิ้ม", run: (l) => { addStat(l, "happiness", 6); return meh("คุณจดชื่อตัวเองลงสมุดด้วยความรู้สึกแปลกๆ"); } },
    ],
  },
  {
    id: "legacy.descendant",
    minAge: 18,
    maxAge: 70,
    weight: (l) => (l.legacy && !l.flags.descendant ? 15 : 0),
    prepare: (l) => {
      const p = createPerson(l, "friend", { age: l.age + randInt(l, -3, 3), bond: 35, lastName: l.legacy!.lastName });
      return { id: p.id, name: shortName(p), full: p.name };
    },
    text: (l, c) => `คุณเจอ${c.full}กำลังโดนเจ้าหนี้รุมทวงเงินหน้าร้านจำนำ — นามสกุล${l.legacy!.lastName}… เขาคือเหลนของคุณในชาติก่อน`,
    choices: [
      {
        label: "ใช้หนี้ให้เขา",
        tone: "special",
        show: (l) => l.money >= 300_000,
        run: (l, c) => { addMoney(l, -300_000); const p = l.people.find((x) => x.id === c.id); if (p) p.bond = 85; return good(`${c.name}ร้องไห้ขอบคุณ \"ทำไมคุณถึงใจดีกับผมขนาดนี้\" — เพราะเธอคือครอบครัว`); },
      },
      { label: "ขู่เจ้าหนี้ให้ถอยไป", check: { stat: "health", dc: 55 }, run: (l, c, ok) => { const p = l.people.find((x) => x.id === c.id); if (ok) { if (p) p.bond = 70; return good("เจ้าหนี้วิ่งหนีไม่คิดชีวิต"); } return bad("เจ้าหนี้มีกันห้าคน… คุณโดนต่อยหน้าเขียว"); } },
      { label: "เดินผ่านไป", run: (l) => { addStat(l, "happiness", -6); return meh("ตระกูลที่คุณสร้างตกต่ำลงขนาดนี้เลยเหรอ…"); } },
    ],
  },
  {
    id: "legacy.statue",
    minAge: 8,
    maxAge: 80,
    weight: (l) => (l.legacy && l.legacy.fame >= 50 ? 12 : 0),
    text: (l) => `คุณเดินผ่านสวนสาธารณะแล้วเจอรูปปั้นทองแดงของ${l.legacy!.founderName} "วีรบุรุษผู้ปกป้องกรุงเทพฯ" มีนกพิราบเกาะอยู่บนหัว`,
    auto: (l) => { addStat(l, "happiness", 8); return "good"; },
  },
  {
    id: "legacy.grave",
    minAge: 12,
    maxAge: 90,
    weight: (l) => (l.legacy ? 6 : 0),
    text: (l) => `คุณไปไหว้หลุมศพของ${l.legacy!.founderName} (${l.legacy!.founderDeathYear - l.legacy!.founderAge}–${l.legacy!.founderDeathYear}) …ยืนมองชื่อตัวเองบนหินอยู่นาน`,
    choices: [
      { label: "วางดอกไม้ให้ตัวเอง", run: (l) => { addStat(l, "happiness", 5); addStat(l, "luck", 2); return sys("ลมพัดผ่านเบาๆ เหมือนชาติก่อนตอบรับ"); } },
      { label: "บ่นเรื่องคำจารึกที่สะกดผิด", run: (l) => { addStat(l, "happiness", 3); return meh("คุณแจ้งวัดให้แก้ คนเฝ้าสุสานมองคุณแปลกๆ"); } },
    ],
  },
  {
    id: "legacy.stash",
    minAge: 18,
    maxAge: 70,
    weight: (l) => (l.legacy?.stash && !l.flags.stashFound ? 30 : 0),
    title: "สมบัติจากชาติก่อน",
    text: () => "คุณจำได้ว่าชาติก่อนฝังทองคำไว้ใต้ต้นมะม่วงหลังบ้านเก่า… แต่ตอนนี้ตรงนั้นกลายเป็นที่จอดรถคอนโดไปแล้ว",
    choices: [
      {
        label: "แอบขุดตอนกลางคืน",
        tone: "special",
        check: { stat: "luck", dc: 45 },
        run: (l, _c, ok) => {
          l.flags.stashFound = true;
          if (ok) { const v = (l.legacy!.stash ?? 0) * 8; addMoney(l, v); return { text: `⛏️ เจอแล้ว! ทองคำที่ฝังไว้ราคาขึ้นมาหลายสิบปี มูลค่า ${formatMoney(v)}`, kind: "milestone" }; }
          addMoney(l, -20_000); return bad("รปภ. คอนโดจับได้ คุณต้องจ่ายค่าซ่อมพื้นลานจอด");
        },
      },
      { label: "ปล่อยมันไว้", run: () => meh("บางอย่างก็ควรอยู่กับอดีต") },
    ],
  },
];
