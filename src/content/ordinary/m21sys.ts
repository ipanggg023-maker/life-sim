// M21: ระบบชีวิตขั้นสูง — วิวัฒนาการของระบบ (Lv.10/20/30) · ร้านค้าระบบ · ดวงตาประเมินค่า · ภารกิจรายวันที่สอง · ช่องสกิลพิเศษ
import type { GameEvent, Outcome } from "../../engine/events";
import { openHiddenSlot, runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, SysStat } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, log, money, shortName } from "../../engine/util";
import { SYS_INFO, SYS_STATS } from "../gameStats";
import { SYS_CAP, checkSysSkills, gainSysExp } from "./sys";

const sysOut = (text: string): Outcome => ({ text, kind: "system" });

// ───────────────────────── วิวัฒนาการ ─────────────────────────

export const EVOLUTIONS = [
  { lv: 10, emoji: "👁️", name: "ดวงตาประเมินค่า", desc: "ปีละครั้ง: ประเมินคน ของ หรือตัวเอง · ตัวเลือกพิเศษในบางเหตุการณ์" },
  { lv: 20, emoji: "📋", name: "ภารกิจรายวันที่สอง", desc: "ภารกิจรายวันเพิ่มอีกชุด — ได้แต้มสถานะทุกปี" },
  { lv: 30, emoji: "🔮", name: "ช่องสกิลพิเศษ", desc: "เลือกสกิลพิเศษหนึ่งอย่างที่ทำงานทุกปี" },
] as const;

/** ระดับวิวัฒนาการของระบบ 0–3 (นับเฉพาะที่ปลดแล้ว) */
export const evoOf = (l: Life) => Number(l.flags.sysEvo ?? 0);
export const canAppraise = (l: Life) => !!l.sys && evoOf(l) >= 1;

export const SLOT_SKILLS: Record<string, { name: string; emoji: string; desc: string }> = {
  body: { name: "ร่างอมตะ", emoji: "🫀", desc: "สุขภาพ +2 ทุกปี และร่างกายไม่ถดถอยตามอายุ" },
  brain: { name: "สมองควอนตัม", emoji: "🧠", desc: "EXP ระบบ +250 ทุกปี และสติปัญญาค่อยๆ เพิ่ม" },
  midas: { name: "มือมิดาส", emoji: "💰", desc: "รายได้ลึกลับปีละ 3% ของเงินที่มี (สูงสุด 5 ล้าน)" },
  king: { name: "ราชันเสน่ห์", emoji: "👑", desc: "ชื่อเสียงและความสุขเพิ่มทุกปี คนรอบตัวรักคุณมากขึ้น" },
};
export const slotOf = (l: Life) => SLOT_SKILLS[String(l.flags.sysSlot ?? "")];

/** ภารกิจรายวันที่สอง (Lv.20+) */
export function sysDaily2(l: Life): Outcome | undefined {
  if (!l.sys || evoOf(l) < 2 || l.doneThisYear.includes("daily2")) return;
  l.doneThisYear.push("daily2");
  const k = pick(l, SYS_STATS);
  l.sys[k] = Math.min(SYS_CAP, l.sys[k] + 1);
  l.sys.points += 1;
  const quest = pick(l, [
    "อ่านหนังสือนอกสาขาเดือนละเล่ม",
    "โทรหาคนที่ไม่ได้คุยมานานสัปดาห์ละคน",
    "นอนก่อนเที่ยงคืนทุกวัน (ยากที่สุดในชุด)",
    "เดินวันละหนึ่งหมื่นก้าว",
    "ทำอาหารกินเองทุกมื้อเย็น",
  ]);
  const out = sysOut(`[ภารกิจรายวันที่สอง] ${quest} — ทำครบทั้งปี: ${SYS_INFO[k].label} +1 · แต้มสถานะ +1`);
  log(l, out.text, "system");
  gainSysExp(l, 150);
  checkSysSkills(l);
  return out;
}

export const appraiseLeft = (l: Life) => canAppraise(l) && !l.doneThisYear.includes("appraise");
export function startAppraise(l: Life) {
  if (!appraiseLeft(l) || l.queue.length) return;
  l.doneThisYear.push("appraise");
  runEvent(l, "o21.appraise");
}

export const shopOpen = (l: Life) => !!l.sys && !l.doneThisYear.includes("sysshop") && !l.queue.length;
export function openShop(l: Life) {
  if (!shopOpen(l)) return;
  l.doneThisYear.push("sysshop");
  runEvent(l, "o21.shop");
}

// ───────────────────────── ร้านค้าระบบ ─────────────────────────

type Item = { label: string; price: number; minLv?: number; buy: (l: Life) => string };
const ITEMS: Item[] = [
  { label: "ยาฟื้นฟูขั้นกลาง", price: 100_000, buy: (l) => { addStat(l, "health", 15); return "ของเหลวสีเขียวรสมิ้นต์ — แผลเก่าที่หัวเข่าหายไปในคืนเดียว (สุขภาพ +15)"; } },
  { label: "คัมภีร์ประสบการณ์", price: 200_000, buy: (l) => { gainSysExp(l, 400); return "หนังสือเปิดเองแล้วหายวับเข้าไปในหัว — คุณรู้สึกเหมือนอ่านมาสามปี (EXP +400)"; } },
  { label: "ตั๋วแต้มสถานะ", price: 500_000, buy: (l) => { l.sys!.points += 2; return "ตั๋วสีทองฉีกเองตามรอยปรุ (แต้มสถานะ +2)"; } },
  { label: "ชาลืมเรื่องเศร้า", price: 80_000, buy: (l) => { addStat(l, "happiness", 15); return "จิบแรกขม จิบที่สองหวาน จิบที่สามคุณจำไม่ได้แล้วว่าเศร้าเรื่องอะไร (ความสุข +15)"; } },
  { label: "เครื่องรางโคลเวอร์สี่แฉก", price: 300_000, buy: (l) => { l.sys!.luk = Math.min(SYS_CAP, l.sys!.luk + 3); return "พอห้อยคอปุ๊บ เหรียญเงินก็ตกลงมาจากฟ้าตรงหน้าคุณ (LUK +3)"; } },
  { label: "น้ำยาคืนวัย", price: 3_000_000, minLv: 20, buy: (l) => { for (const k of ["str", "agi", "sta"] as SysStat[]) l.sys![k] = Math.min(SYS_CAP, l.sys![k] + 3); addStat(l, "health", 10); addStat(l, "looks", 3); return "ริ้วรอยรอบตาจางลงต่อหน้ากระจก (STR/AGI/STA +3)"; } },
  { label: "หนังสือสกิลลับ: สมาธิเหนือมนุษย์", price: 1_500_000, minLv: 15, buy: (l) => { l.sys!.int = Math.min(SYS_CAP, l.sys!.int + 4); gainSysExp(l, 200); return "คุณอ่านมันจบในสามนาที แล้วเข้าใจว่าทำไมมันถึงแพง (INT +4)"; } },
];

const SHOP: GameEvent = {
  id: "o21.shop",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  system: true,
  title: "ร้านค้าระบบ",
  text: (l) => `[ร้านค้าระบบ] ยินดีต้อนรับ ลูกค้าคนเดียวของเรา 🛒\nยอดเงินของคุณ: ${money(l, l.money)}\n「สินค้าเติมใหม่ปีละครั้ง — ซื้อได้ปีละหนึ่งชิ้น」`,
  choices: [
    ...ITEMS.map((it) => ({
      label: `${it.label}`,
      show: (l: Life) => l.money >= it.price && (l.sys?.level ?? 0) >= (it.minLv ?? 0),
      run: (l: Life) => {
        addMoney(l, -it.price);
        return sysOut(`[ซื้อสำเร็จ] ${it.label} — ${it.buy(l)}`);
      },
    })),
    { label: "ขอดูเฉยๆ", run: (l) => (chance(l, 0.15) ? (gainSysExp(l, 30), sysOut("[ระบบ] ลูกค้าที่มาดูทุกปีโดยไม่ซื้อ ได้รับ EXP ปลอบใจ 30")) : sysOut("[ระบบ] ขอบคุณที่แวะมา — ราคาจะไม่ลดลงในปีหน้า")) },
  ],
};

// ───────────────────────── ดวงตาประเมินค่า ─────────────────────────

const APPRAISE: GameEvent = {
  id: "o21.appraise",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  system: true,
  title: "ดวงตาประเมินค่า",
  text: () => "[ดวงตาประเมินค่า] ตัวอักษรสีฟ้าลอยขึ้นเหนือทุกสิ่งที่คุณจ้องมอง — คุณจะประเมินอะไรในปีนี้?",
  choices: [
    {
      label: "ประเมินตัวเอง",
      run: (l) => {
        const hidden = l.talents.find((t) => !t.revealed);
        if (hidden) { openHiddenSlot(l, "[ดวงตาประเมินค่า] สแกนผู้ใช้"); return sysOut("ระบบพบสิ่งที่ซ่อนอยู่ในตัวคุณมาตั้งแต่เกิด"); }
        const low = [...SYS_STATS].sort((a, b) => l.sys![a] - l.sys![b])[0];
        l.sys![low] = Math.min(SYS_CAP, l.sys![low] + 2);
        return sysOut(`[ผลประเมิน] จุดอ่อนที่สุด: ${SYS_INFO[low].label} — ระบบจัดโปรแกรมแก้ให้แล้ว (+2)`);
      },
    },
    {
      label: "ประเมินของเก่าที่ตลาดนัด",
      odds: (l) => clamp(0.45 + (l.sys?.luk ?? 0) / 150, 0.3, 0.9),
      run: (l, _c, ok) => {
        if (ok) {
          const v = randInt(l, 3, 30) * 100_000;
          addMoney(l, v);
          return sysOut(`[ผลประเมิน] แจกันลายครามที่แม่ค้าขายแบบเหมาเข่ง — 「ของแท้สมัยราชวงศ์หมิง」 คุณขายต่อได้ ${money(l, v)}`);
        }
        addMoney(l, -2_000);
        return sysOut("[ผลประเมิน] 「ของปลอม ผลิตปีที่แล้ว」 — แต่คุณจ่ายเงินไปก่อนจะอ่านจบ");
      },
    },
    {
      label: "ประเมินคนรอบตัว",
      run: (l) => {
        const ps = l.people.filter((p) => p.alive && !["father", "mother"].includes(p.relation));
        if (!ps.length) { addStat(l, "smarts", 2); return sysOut("[ผลประเมิน] ไม่มีเป้าหมายในระยะ — ระบบเลยประเมินแมวข้างบ้านแทน: 「ความภักดี 2/100」"); }
        const p = pick(l, ps);
        if (p.bond < 40) {
          l.people = l.people.filter((x) => x !== p);
          return sysOut(`[ผลประเมิน] ${shortName(p)} — 「ความจริงใจ: 4/100 · กำลังวางแผนเอาเปรียบผู้ใช้」 คุณตัดขาดก่อนจะสาย`);
        }
        p.bond = clamp(p.bond + 12, 0, 100);
        return sysOut(`[ผลประเมิน] ${shortName(p)} — 「ความจริงใจ: ${clamp(p.bond + 20, 0, 100)}/100」 คุณมองเขาด้วยสายตาใหม่ทั้งหมด`);
      },
    },
    {
      label: "ประเมินหุ้นที่ทุกคนพูดถึง",
      show: (l) => l.age >= 18 && l.money >= 200_000,
      odds: (l) => clamp(0.5 + ((l.sys?.int ?? 0) + (l.sys?.luk ?? 0)) / 300, 0.4, 0.92),
      run: (l, _c, ok) => {
        const bet = Math.min(l.money, 2_000_000);
        if (ok) { addMoney(l, Math.round(bet * 0.8)); return sysOut(`[ผลประเมิน] 「งบการเงินถูกแต่ง — แต่ผู้บริหารเพิ่งซื้อคืน」 คุณเข้าก่อนข่าวออก กำไร ${money(l, Math.round(bet * 0.8))}`); }
        addMoney(l, -Math.round(bet * 0.3));
        return sysOut("[ผลประเมิน] ข้อมูลถูกต้อง — แต่ตลาดไม่สนข้อมูลที่ถูกต้อง ขาดทุนไปเกือบหนึ่งในสาม");
      },
    },
  ],
};

// ───────────────────────── ประกาศวิวัฒนาการ ─────────────────────────

const EVO_EVENTS: GameEvent[] = [
  {
    id: "o21.evo1",
    minAge: 0,
    maxAge: 200,
    forced: true,
    system: true,
    title: "ระบบวิวัฒนาการ I",
    when: (l) => (l.sys?.level ?? 0) >= 10 && evoOf(l) < 1,
    text: () => "[แจ้งเตือน] ผู้ใช้ถึง Lv.10 — ระบบวิวัฒนาการขั้นที่ 1\n「ปลดล็อก: ดวงตาประเมินค่า 👁️」\nตาซ้ายของคุณร้อนวูบ ตัวเลขสีฟ้าเริ่มลอยขึ้นเหนือหัวคนที่เดินผ่าน",
    auto: (l) => { l.flags.sysEvo = 1; l.sys!.points += 3; return "milestone"; },
  },
  {
    id: "o21.evo2",
    minAge: 0,
    maxAge: 200,
    forced: true,
    system: true,
    title: "ระบบวิวัฒนาการ II",
    when: (l) => (l.sys?.level ?? 0) >= 20 && evoOf(l) === 1,
    text: () => "[แจ้งเตือน] ผู้ใช้ถึง Lv.20 — ระบบวิวัฒนาการขั้นที่ 2\n「ปลดล็อก: ภารกิจรายวันที่สอง 📋」\n「ระบบเห็นว่าผู้ใช้ว่างเกินไป」",
    auto: (l) => { l.flags.sysEvo = 2; l.sys!.points += 5; return "milestone"; },
  },
  {
    id: "o21.evo3",
    minAge: 0,
    maxAge: 200,
    forced: true,
    system: true,
    title: "ระบบวิวัฒนาการ III",
    when: (l) => (l.sys?.level ?? 0) >= 30 && evoOf(l) === 2,
    text: () => "[แจ้งเตือน] ผู้ใช้ถึง Lv.30 — ระบบวิวัฒนาการขั้นสุดท้าย\n「ปลดล็อก: ช่องสกิลพิเศษ 🔮 — เลือกได้หนึ่งเดียว เปลี่ยนไม่ได้」",
    choices: Object.entries(SLOT_SKILLS).map(([id, s]) => ({
      label: `${s.emoji} ${s.name} — ${s.desc}`,
      run: (l: Life) => {
        l.flags.sysEvo = 3;
        l.flags.sysSlot = id;
        return { text: `[ระบบ] ติดตั้งสกิลพิเศษ「${s.name}」สำเร็จ — 「ผู้ใช้คนก่อนหน้าไปไม่ถึงตรงนี้」`, kind: "milestone" as const };
      },
    })),
  },
];

// สกิลพิเศษ (ช่อง Lv.30) ทำงานทุกปี — หลังจากร่างกายถดถอยใน sys.ts
yearHooks.push((l) => {
  if (!l.sys || !l.flags.sysSlot) return;
  switch (l.flags.sysSlot) {
    case "body":
      addStat(l, "health", 2);
      for (const k of ["str", "agi", "sta"] as SysStat[]) l.sys[k] = Math.max(l.sys[k], Number(l.flags[`peak_${k}`] ?? 0));
      break;
    case "brain":
      gainSysExp(l, 250);
      if (chance(l, 0.5)) addStat(l, "smarts", 1);
      break;
    case "midas": {
      const v = Math.min(5_000_000, Math.max(20_000, Math.round(l.money * 0.03)));
      addMoney(l, v);
      l.flags.income = Number(l.flags.income ?? 0) + v;
      break;
    }
    case "king":
      addFame(l, 2);
      addStat(l, "happiness", 2);
      for (const p of l.people) if (p.alive) p.bond = clamp(p.bond + 2, 0, 100);
      break;
  }
});
// จำค่าร่างกายสูงสุด (ใช้กับร่างอมตะ)
yearHooks.unshift((l) => {
  if (!l.sys) return;
  for (const k of ["str", "agi", "sta"] as SysStat[]) if (l.sys[k] > Number(l.flags[`peak_${k}`] ?? 0)) l.flags[`peak_${k}`] = l.sys[k];
});

export const M21_SYS_EVENTS: GameEvent[] = [SHOP, APPRAISE, ...EVO_EVENTS];
