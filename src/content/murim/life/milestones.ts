// หมุดหมายของเส้นทางยุทธ์ (เขียนใหม่แทนกลไกเก่า): วันตรวจกระดูก · ชีพจรเปิดช้า · ทะลวงขั้น
// ผลตรวจกระดูก = รากฐาน (พรสวรรค์) ไม่ใช่ฝีมือ — ทุกคนเริ่มจากผู้ฝึกหัด ขั้นถัดไปต้องใช้กำลังภายในจริง (MURIM_PLAN §4)
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance } from "../../../engine/rng";
import type { HunterClass, Life } from "../../../engine/types";
import { addFame, addStat, clamp } from "../../../engine/util";
import { CLASSES, awaken, classById, gainExp, guildById, guildsFor, offerClasses, rankLabel, rankUp, rollAwakening, settleNone, trackOf } from "../../hunter/power";
import { QI_NEED, addQi, comprehension, qiYears, rootOf } from "../martial/arts";
import { woundFrom } from "../../../engine/body";

const rank = (l: Life) => l.power?.rank ?? -1;
const STYLES: HunterClass[] = CLASSES.filter((c) => c.world === "murim").map((c) => c.id);

function roll(l: Life, c: Ctx, bonus: number) {
  c.rank = trackOf(l) === "late" ? -1 : rollAwakening(l, bonus);
  c.offer = offerClasses(l).join(",");
}
const after = (_l: Life, c: Ctx, text: string): Outcome => ({ text, next: Number(c.rank) < 0 ? "closed" : "open" });

const styleChoices = STYLES.map((id) => ({
  label: `${classById(id).emoji} ${classById(id).name} — ${classById(id).desc}`,
  tone: id === "m_demon" ? ("danger" as const) : undefined,
  show: (_l: Life, c: Ctx) => String(c.offer ?? "").split(",").includes(id),
  run: (l: Life, c: Ctx): Outcome => {
    const r = Number(c.rank);
    awaken(l, r, id);
    const sect = guildById(String(c.sect || "") || undefined);
    if (sect) {
      l.power!.guild = sect.id;
      l.job = { careerId: "disciple", level: 1, performance: 50, years: 0 };
      if (sect.demonic) addFame(l, -15);
    }
    return { text: `คุณเริ่มเดินทางสาย${classById(id).name} รากฐานขั้น${rankLabel(l, r)}${sect ? ` ในฐานะศิษย์นอกแห่ง${sect.name}` : " โดยไม่มีสำนักคอยหนุนหลัง"} — วันแรกของชีวิตจอมยุทธ์ไม่ได้มีอะไรนอกจากท่าม้าและเหงื่อ`, kind: "milestone" };
  },
}));

export const ASSESS_EVENT: GameEvent = {
  id: "mk.assessment",
  minAge: 10,
  maxAge: 16,
  forced: true,
  when: (l) => !l.power && !l.flags.awakenDone && !l.flags.notYet && l.age === Number(l.flags.ceremonyAge ?? l.flags.awakenAge ?? 12),
  title: "ศิลาวัดกระดูก",
  text: () => "ปีนี้ผู้อาวุโสจากหลายสำนักลงเขามาที่ลานหน้าศาลเจ้าประจำอำเภอ เด็กอายุถึงเกณฑ์ทุกคนเข้าแถวรอวางฝ่ามือบนศิลาสีดำเย็นเฉียบ — พ่อแม่ยืนเบียดกันอยู่นอกเชือกกั้น ไม่มีใครกล้าหายใจแรง",
  choices: [
    { label: "หลับตา หายใจช้าๆ แล้ววางมือ", check: { stat: "smarts", dc: 50 }, run: (l, c, ok) => { roll(l, c, ok ? 1 : 0); return after(l, c, ok ? "ใจคุณนิ่งจนได้ยินเสียงเลือดไหลในหู" : "มือคุณสั่นจนผู้อาวุโสต้องจับให้วางนิ่งๆ"); } },
    { label: "กดฝ่ามือลงสุดแรง", check: { stat: "health", dc: 55 }, run: (l, c, ok) => { roll(l, c, ok ? 1 : 0); return after(l, c, ok ? "ความร้อนบางอย่างวิ่งจากท้องน้อยขึ้นมาตามแขน" : "ศิลาเย็นจนมือชา ไม่มีอะไรตอบสนอง"); } },
    { label: "หายใจแบบที่ขอทานแก่เคยสอน", tone: "special", show: (l) => !!l.flags.beggarMaster || !!l.flags.hiddenMaster, run: (l, c) => { roll(l, c, 2); return after(l, c, "ลมหายใจของคุณไหลเป็นวง ผู้อาวุโสสามคนหันมามองพร้อมกัน"); } },
  ],
  scenes: {
    closed: {
      title: "ศิลาไม่ตอบ",
      text: () => "ศิลาดำสนิทเหมือนเดิม ผู้อาวุโสส่ายหน้า \"ชีพจรอุดตัน\" แล้วเรียกเด็กคนถัดไป — เด็กข้างหลังบางคนหัวเราะ",
      choices: [
        { label: "เดินกลับไปหาพ่อแม่", run: (l) => { settleNone(l); addStat(l, "happiness", -6); return { text: "ท่านแม่จับมือคุณแน่นตลอดทางกลับบ้าน คืนนั้นมีบะหมี่ใส่ไข่สองฟอง ทั้งที่ไม่ใช่วันเกิด" }; } },
        { label: "สาบานว่าจะเปิดชีพจรด้วยตัวเอง", run: (l) => { settleNone(l); l.flags.stubborn = true; return { text: "คุณกำหมัดจนเล็บจิกเนื้อ — ศิลาไม่ใช่คนตัดสินชีวิตคุณ" }; } },
      ],
    },
    open: {
      title: "ศิลาเปล่งแสง",
      text: (l, c) => `ศิลาสว่างวาบขึ้นจากใต้ฝ่ามือ ผู้อาวุโสประกาศเสียงดัง "รากฐานขั้น${rankLabel(l, Number(c.rank))}!" — คนนอกเชือกกั้นฮือ ผู้อาวุโสจากหลายสำนักเดินตรงมาหาคุณ`,
      choices: [
        ...guildsFor({ worldId: "murim" }).filter((g) => g.id !== "alliance").map((g) => ({
          label: `ฝากตัวกับ${g.name} — ${g.desc}`,
          tone: g.demonic ? ("danger" as const) : undefined,
          show: (_l: Life, c: Ctx) => g.minRank <= Number(c.rank),
          run: (_l: Life, c: Ctx): Outcome => {
            c.sect = g.id;
            if (g.demonic && !String(c.offer).includes("m_demon")) c.offer = `${c.offer},m_demon`;
            return { text: `คุณคุกเข่าโขกศีรษะสามครั้งต่อหน้าผู้อาวุโสแห่ง${g.name}`, next: "style" };
          },
        })),
        { label: "ไม่ฝากตัวกับใคร จะฝึกเอง", run: (_l, c) => { c.sect = ""; return { text: "ผู้อาวุโสทุกคนเลิกคิ้ว — บางคนส่ายหน้า บางคนยิ้ม", next: "style" }; } },
      ],
    },
    style: {
      title: "วิชาแรก",
      text: () => "อาจารย์วางคัมภีร์หลายเล่มเรียงบนโต๊ะไม้ \"ชีวิตคนเรามีเวลาพอจะฝึกจนสุดทางได้เพียงสายเดียว เลือกให้ดี\"",
      choices: styleChoices,
    },
  },
};

/** ชีพจรเปิดช้า: คนที่ศิลาไม่ตอบ แต่ฝึกร่างกายไม่หยุด (ทดแทนเรื่องตื่นช้าแบบเก่า) */
export const LATE_ROOT: GameEvent = {
  id: "mk.late_root",
  minAge: 14,
  maxAge: 40,
  forced: true,
  when: (l) => !l.power && !!l.flags.notYet && Number(l.flags.mwBasics ?? 0) >= 6 && l.age >= Number(l.flags.ceremonyAge ?? 12) + 2,
  title: "ชีพจรที่เปิดช้า",
  text: () => "เช้ามืดวันหนึ่งระหว่างยืนท่าม้า ความร้อนพุ่งขึ้นจากท้องน้อยจนตัวสั่น เส้นที่เคยอุดตันเหมือนมีน้ำไหลผ่านเป็นครั้งแรก",
  choices: [
    { label: "นั่งสมาธิตามกระแสนั้นไป", odds: (l) => clamp(0.45 + (l.stats.smarts - 50) / 150 + Number(l.flags.mwBasics ?? 0) * 0.02, 0.2, 0.9), run: (l, c, ok) => {
      if (!ok) { delete l.flags.notYet; l.flags.awakenDone = true; return { text: "กระแสนั้นดับลงก่อนจะไปถึงไหน — คุณรู้ว่าโอกาสแบบนี้คงไม่มาอีก", kind: "bad" }; }
      const id = offerClasses(l)[0];
      awaken(l, Math.max(0, Math.min(2, Number(l.flags.mwBasics ?? 0) / 6)), id);
      c.done = 1;
      return { text: `ชีพจรเปิด! ช้ากว่าคนอื่นหลายปี แต่ร่างกายที่ฝึกมาไม่หยุดรองรับมันได้ — คุณเริ่มเส้นทางสาย${classById(id).name}`, kind: "milestone" };
    } },
    { label: "กลัว หยุดฝึกทันที", run: (l) => { delete l.flags.notYet; l.flags.awakenDone = true; return { text: "ความร้อนค่อยๆ จางไป ชีวิตธรรมดาก็ไม่ได้แย่อะไร" }; } },
  ],
};

// ───── ทะลวงขั้น ─────
const pills = ["ยาเม็ดทะลวงชีพจร", "ยาเม็ดเก้าหยาง"];
const pillIdx = (l: Life) => l.power?.items.findIndex((i) => pills.includes(i)) ?? -1;
const breakOdds = (l: Life, bonus = 0) =>
  rank(l) === 7
    ? clamp(0.05 + (l.stats.smarts - 50) / 500 + bonus * 0.5, 0.03, 0.4)
    : clamp(0.66 - rank(l) * 0.06 + (l.stats.smarts - 50) / 200 + (qiYears(l) - QI_NEED[rank(l)]) / 200 + bonus, 0.08, 0.95);
const breakSurvival = (l: Life) =>
  rank(l) === 7 ? clamp(0.5 + (l.stats.health - 50) / 300, 0.3, 0.75) : clamp(0.92 - rank(l) * 0.04 + (l.stats.health - 50) / 200, 0.4, 0.99);

export const BREAK_EVENT: GameEvent = {
  id: "mk.breakthrough",
  minAge: 10,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => !!l.power && rank(l) < 8 && l.age >= Number(l.flags.btNext ?? 0) && qiYears(l) >= QI_NEED[rank(l)],
  title: "คอขวด",
  text: (l) =>
    rank(l) === 7
      ? `เมฆดำหมุนวนเหนือยอดเขาที่คุณนั่งอยู่ สายฟ้าแรกผ่าลงห่างไปไม่ถึงสิบก้าว — ทัณฑ์สวรรค์มาถึงแล้ว ผ่านได้คือขั้น${rankLabel(l, 8)} ผ่านไม่ได้คือเถ้า`
      : `ลมปราณ ${Math.floor(qiYears(l))} ปีในตันเถียนอัดแน่นจนเจ็บ คอขวดของขั้น${rankLabel(l, rank(l))}สั่นอยู่ทุกครั้งที่หายใจ — ข้างหน้าคือขั้น${rankLabel(l, rank(l) + 1)}`,
  choices: [
    {
      label: "ปิดประตูฝืนทะลวง",
      tone: "danger",
      odds: (l) => breakOdds(l),
      survival: (l) => breakSurvival(l),
      run: (l, _c, ok) => {
        if (ok) { rankUp(l, rank(l) === 7 ? "ฝ่าทัณฑ์สวรรค์" : "ทะลวงคอขวด"); return { text: "ลมปราณหมุนครบรอบใหญ่เป็นครั้งแรก เช้านั้นคุณมองเห็นใบไม้ไหวจากระยะร้อยก้าว", kind: "milestone" }; }
        if (!chance(l, breakSurvival(l))) { kill(l, rank(l) === 7 ? "ร่างแหลกในทัณฑ์สวรรค์" : "ธาตุไฟเข้าแทรกขณะทะลวงขั้น"); return { text: "ลมปราณย้อนกลับทะลวงเส้นชีพจรทุกเส้น…", kind: "bad" }; }
        l.flags.btNext = l.age + 3;
        const d = 15 + Math.round((1 - l.stats.health / 100) * 15);
        addStat(l, "health", -d);
        return { text: `ธาตุไฟเข้าแทรก — คุณกระอักเลือดดำ ต้องพักฟื้นอย่างน้อยสามปีก่อนจะลองอีก (สุขภาพ −${d})${woundFrom(l, d, "ธาตุไฟเข้าแทรก")}`, kind: "bad" };
      },
    },
    {
      label: (l) => `กลืน「${l.power?.items[pillIdx(l)] ?? ""}」แล้วทะลวง`,
      tone: "special",
      show: (l) => pillIdx(l) >= 0,
      odds: (l) => breakOdds(l, 0.3),
      run: (l, _c, ok) => {
        const pill = l.power!.items.splice(pillIdx(l), 1)[0];
        if (ok) { rankUp(l, `ฤทธิ์ของ${pill}`); return { text: `${pill}ละลายเป็นสายอุ่นไหลทั่วร่าง คอขวดแตกออกเหมือนน้ำแข็งต้นฤดูใบไม้ผลิ`, kind: "milestone" }; }
        return { text: `แม้มี${pill}ก็ยังไม่พอ — คุณถอนตัวทันก่อนจะสายเกินไป`, kind: "bad" };
      },
    },
    { label: "ยังไม่พร้อม สะสมต่ออีกปี", run: (l) => { gainExp(l, 50); return { text: "คุณข่มลมปราณลงไปอย่างอดทน — คอขวดยังรออยู่ที่เดิม" }; } },
  ],
};

// ───── ปิดด่าน (ปุ่มในแท็บวิชา) ─────
const secluded = (l: Life) => Number(l.flags.secludeUntil ?? 0) > l.age;
export const SECLUDE_EVENTS: GameEvent[] = [
  {
    id: "mk.secluded",
    minAge: 0,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: secluded,
    text: (l) => `⛩️ ปีที่ ${3 - (Number(l.flags.secludeUntil) - l.age)} ในถ้ำปิดด่าน — ข้าวต้มกับน้ำตก ลมหายใจกับความเงียบ`,
    auto: (l) => { addQi(l, 1.5 + rootOf(l) * 0.3); gainExp(l, 300); addStat(l, "happiness", -2); return "normal"; },
  },
  {
    id: "mk.seclude_end",
    minAge: 0,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: (l) => !!l.flags.secludeUntil && Number(l.flags.secludeUntil) === l.age,
    title: "ออกจากด่าน",
    text: () => "หินปิดปากถ้ำถูกผลักออก แสงแดดแรกในรอบสามปีแสบตาจนน้ำตาไหล — ร่างกายเบาแต่หนักแน่นอย่างประหลาด",
    choices: [
      {
        label: "ทดสอบลมปราณที่สะสมมา",
        odds: (l) => clamp(0.3 + comprehension(l) / 200 + (l.stats.smarts - 50) / 250, 0.1, 0.85),
        run: (l, _c, ok) => {
          delete l.flags.secludeUntil;
          if (ok) { addQi(l, 3); return { text: "คุณผลักฝ่ามือเบาๆ ใส่หน้าผา — รอยฝ่ามือลึกครึ่งนิ้วปรากฏบนหิน ลมปราณแน่นขึ้นอีกชั้น", kind: "milestone" }; }
          return { text: "ลมปราณแน่นขึ้น แต่ยังไม่ถึงจุดที่หวัง — สามปีไม่สูญเปล่า แต่ก็ไม่ใช่ปาฏิหาริย์", kind: "good" };
        },
      },
    ],
  },
];

export const MILESTONE_EVENTS: GameEvent[] = [ASSESS_EVENT, LATE_ROOT, BREAK_EVENT, ...SECLUDE_EVENTS];
