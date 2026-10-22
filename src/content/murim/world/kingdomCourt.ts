// ราชสำนักของสามแคว้น — แต่ละแคว้นมีเมืองหลวง เจ้าแคว้นที่แก่ลงทุกปี รัชทายาท เสนาธิการใหญ่ แม่ทัพใหญ่ และข่าวศึกล่าสุด
// เจ้าแคว้นตายได้ (รัชทายาทขึ้นแทน · ท่านอาอาจชิงบัลลังก์) · แคว้นที่อ่อนแอล่มสลายได้ · ความไว้วางใจของนายกำหนดว่าคุณจะได้รางวัลหรือถูกระแวง
// ตัวละครทั้งหมดสมมุติ
import type { GameEvent, Outcome } from "../../../engine/events";
import { kill, yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, displayName, log } from "../../../engine/util";
import { shiftAlign } from "../m17core";
import { MURIM_MALE } from "../names";
import { calYear } from "../life/world";
import { TAEL } from "../story/kit";
import { type Kingdom, addFavor, kingdoms, lordFavor, myLord } from "./war";

interface Seat { capital: string; surname: string; heir: string; uncle: string; strategists: string[]; generals: string[] }
const SEATS: Record<string, Seat> = {
  north: { capital: "เย่เฉิง", surname: "เฉา", heir: "เฉาเหวินลี่", uncle: "เฉาเหรินจือ", strategists: ["ซือหม่าเจิ้งหยวน", "ซุนอวี้หลิง", "กัวเหยียนชิง"], generals: ["เซี่ยหลานเทียน", "จางเหลียวเฟิง", "สวีเฉิงกัง"] },
  west: { capital: "จิ่นกวน", surname: "หลิว", heir: "หลิวซานเป่า", uncle: "หลิวจิ้งหมิง", strategists: ["จูเหลียงเฟย", "ผางเฟิ่งอี๋", "ฝ่าเจิ้งหมิง"], generals: ["กวนเฉิงอวี่", "เว่ยหยางเฟย", "จ้าวเหลียนซาน"] },
  south: { capital: "เจี้ยนหลิง", surname: "ซุน", heir: "ซุนเซ่อหยวน", uncle: "ซุนจิ้งอัน", strategists: ["โจวหลินอวี๋", "หลู่ซูเหวิน", "ลู่ซวิ่นเฉียน"], generals: ["ไท่สือเหยียน", "กานหนิงเฟิง", "หลิงเจิ้นเทา"] },
};
const PLACES = ["ฉางผิง", "ไป่หม่า", "ช่องเขาเหยียนเหมิน", "เซียงหยาง", "ฮั่นจง", "เหอเฟย", "อี๋หลิง", "ด่านหูเหลา", "ทุ่งกวนตู้", "ปากน้ำเซี่ยโข่ว"];
const WIN = ["ยึดเมือง{p}ได้หลังล้อมสามเดือน", "ชนะศึกใหญ่ที่{p} จับเชลยได้หมื่นคน", "ทัพข้าศึกสองหมื่นที่{p}ยอมสวามิภักดิ์", "ตีด่าน{p}แตกในคืนเดียว"];
const LOSE = ["เสียเมือง{p}ให้ข้าศึก", "ทัพแตกที่{p} ทหารตายนับหมื่น", "ยุ้งเสบียงที่{p}ถูกเผา ต้องถอยร้อยลี้", "ขุนนางที่{p}เปิดประตูเมืองรับข้าศึก"];

const seat = (k: Kingdom): Seat => SEATS[k.id] ?? SEATS.north;
const all = (l: Life): Kingdom[] => (l.mw?.kingdoms ?? []) as Kingdom[];
const yr = (l: Life) => calYear(l);
const pow = (l: Life) => l.power?.rank ?? 0;
const ok = (text: string): Outcome => ({ text, kind: "good" });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const big = (text: string): Outcome => ({ text, kind: "milestone" });

/** เติมราชสำนักให้แคว้น (แคว้นใหม่ หรือเซฟเก่าที่ยังไม่มีข้อมูล) */
export function ensureCourt(l: Life, k: Kingdom): Kingdom {
  const s = seat(k);
  k.capital ??= s.capital;
  k.lordAge ??= randInt(l, 42, 58);
  k.heir ??= s.heir;
  k.heirAge ??= randInt(l, 12, 22);
  k.strategist ??= s.strategists[0];
  k.general ??= s.generals[0];
  k.news ??= [];
  return k;
}
export const courtsOf = (l: Life): Kingdom[] => all(l).map((k) => ensureCourt(l, k));
/** สำหรับหน้าจอ: เติมค่าเริ่มต้นโดยไม่แก้ข้อมูลในเซฟ */
export const viewCourt = (k: Kingdom): Kingdom => { const s = seat(k); return { capital: s.capital, heir: s.heir, strategist: s.strategists[0], general: s.generals[0], news: [], ...k }; };
const news = (k: Kingdom, y: number, t: string) => { k.news = [...(k.news ?? []), { y, t }].slice(-4); };
const newName = (l: Life, k: Kingdom) => `${seat(k).surname}${pick(l, MURIM_MALE)}`;
const fresh = (l: Life, pool: string[], now?: string) => pick(l, pool.filter((x) => x !== now).length ? pool.filter((x) => x !== now) : pool);

export const FAVOR_LABEL = (n: number) => (n >= 75 ? "ไว้วางใจอย่างยิ่ง" : n >= 50 ? "ไว้ใจ" : n >= 25 ? "เฉยๆ" : "ระแวงคุณ");
const isMine = (l: Life, k: Kingdom) => l.flags.lord === k.id;
const iAmLord = (l: Life) => !!l.flags.isLord && l.flags.isLord === l.flags.lord;

// ───────── ทุกปี: เจ้าแคว้นแก่ลง · ตายได้ · ขุนพลตายในศึก · ข่าวศึก · แคว้นล่มสลาย ─────────
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || l.mw?.era !== "war") return;
  const y = yr(l);
  const ks = courtsOf(l);
  for (const k of ks) {
    if (k.fallen) continue;
    k.lordAge = (k.lordAge ?? 50) + 1;
    k.heirAge = (k.heirAge ?? 15) + 1;
    // ข่าวศึกตามแรงที่ขึ้นลง
    const d = k.power - (k.prevPower ?? k.power);
    k.prevPower = k.power;
    if (d >= 5) news(k, y, pick(l, WIN).replace("{p}", pick(l, PLACES)));
    else if (d <= -5) news(k, y, pick(l, LOSE).replace("{p}", pick(l, PLACES)));
    // ขุนพลคนสำคัญตายในศึกหรือถูกปลด
    if (chance(l, 0.07)) {
      const isGen = chance(l, 0.6);
      const mineChief = isMine(l, k) && l.flags.warChief && (isGen ? l.flags.warRole === "general" : l.flags.warRole === "strategist");
      if (!mineChief) {
        const old = isGen ? k.general : k.strategist;
        const nu = fresh(l, isGen ? seat(k).generals : seat(k).strategists, old);
        if (isGen) k.general = nu; else k.strategist = nu;
        news(k, y, isGen ? `แม่ทัพใหญ่${old}ตายในศึก — ${nu}ขึ้นแทน` : `เสนาธิการ${old}ถูกปลดเพราะแผนพลาด — ${nu}ขึ้นแทน`);
        if (isMine(l, k) && !l.flags.warChief && Number(l.flags.warRank ?? 0) >= 5 && lordFavor(l) >= 60) l.flags.chiefOpen = isGen ? "general" : "strategist";
      }
    }
    // เจ้าแคว้นสิ้นใจ (ถ้าคุณเป็นเจ้าแคว้นเอง ชีวิตคุณเป็นตัวกำหนด)
    if (!(iAmLord(l) && isMine(l, k)) && k.lordAge >= 55 && chance(l, (k.lordAge - 50) * 0.012)) {
      const old = k.lord;
      k.lord = k.heir ?? newName(l, k);
      k.lordAge = k.heirAge ?? 20;
      k.heir = newName(l, k);
      k.heirAge = randInt(l, 1, 12);
      news(k, y, `${old}สิ้นใจ — ${k.lord}ขึ้นครองแคว้นตอนอายุ ${k.lordAge}`);
      log(l, `🕯️ ${old}เจ้า${k.name}สิ้นใจ — ${k.lord}ขึ้นครองแคว้นตอนอายุ ${k.lordAge} ปี`, isMine(l, k) ? "bad" : "normal");
      if (isMine(l, k)) l.flags.lordDied = k.id;
    }
  }
  // แคว้นที่อ่อนแอที่สุดล่มสลาย ถูกแคว้นที่แข็งแกร่งที่สุดผนวก
  const alive = ks.filter((k) => !k.fallen);
  if (alive.length >= 2 && y - (l.mw.eraSince ?? y) >= 4) {
    const weak = alive.slice().sort((a, b) => a.power - b.power)[0];
    const strong = alive.slice().sort((a, b) => b.power - a.power)[0];
    if (weak.power <= 8 && strong.power >= 50 && chance(l, 0.35)) {
      weak.fallen = y;
      weak.fellTo = strong.id;
      strong.power = clamp(strong.power + 12, 5, 95);
      news(weak, y, `${weak.capital}แตก — ${strong.name}ผนวกแผ่นดินทั้งหมด`);
      news(strong, y, `ตี${weak.capital}แตก ผนวก${weak.name}`);
      log(l, `🔥 ${weak.capital}เมืองหลวงของ${weak.name}แตก — ${strong.lord}ผนวกแผ่นดินของ${weak.lord}`, "milestone");
      if (isMine(l, weak)) l.flags.lordFell = weak.id;
    }
  }
});

const lordOf = (l: Life) => myLord(l) ?? all(l).find((k) => k.id === l.flags.lord);
const kc = (l: Life) => { const k = lordOf(l); return k ? ensureCourt(l, k) : undefined; };
const fell = (l: Life) => all(l).find((x) => x.id === l.flags.lordFell);
/** ฉากที่แคว้นหายไปแล้ว (เช่น รวมแผ่นดินก่อนฉากจะเกิด) */
const gone = (l: Life): Outcome => { delete l.flags.lordDied; delete l.flags.lordFell; return meh("เมื่อคุณไปถึง เรื่องทั้งหมดก็จบลงแล้ว — แผ่นดินเปลี่ยนเร็วกว่าฝีเท้าคน"); };
const serving = (l: Life) => l.mw?.era === "war" && !!myLord(l) && !iAmLord(l);

export const KINGDOM_COURT_EVENTS: GameEvent[] = [
  {
    id: "mw.kc.new_lord",
    minAge: 14,
    maxAge: 100,
    maxTimes: 0,
    forced: true,
    weight: (l) => (l.mw?.era === "war" && l.flags.lordDied && l.flags.lordDied === l.flags.lord && myLord(l) ? 50 : 0),
    title: "เจ้าแคว้นองค์ใหม่",
    text: (l) => { const k = kc(l); if (!k) return "ข่าวสับสนจากเมืองหลวงของแคว้น — ไม่มีใครรู้ว่าใครกุมอำนาจ"; return `ธงขาวขึ้นทั่ว${k.capital} — ${k.lord}อายุ ${k.lordAge} ขึ้นครองแคว้นแทนบิดา${l.flags.heirTaught === k.id ? " เด็กที่คุณเคยสอนหนังสือตอนนี้นั่งบนบัลลังก์" : ""} คืนเดียวกันนั้น คนของท่านอา${seat(k).uncle}มาเคาะประตูหลังบ้านคุณ "แผ่นดินกำลังรบ ไม่ใช่เวลาของเด็ก"`; },
    choices: [
      { label: "คุกเข่าถวายสัตย์ต่อเจ้าแคว้นองค์ใหม่", run: (l) => { const k = kc(l); if (!k) return gone(l); delete l.flags.lordDied; const taught = l.flags.heirTaught === k.id; l.flags.lordFavor = taught ? 80 : clamp(lordFavor(l) - 10, 30, 70); return taught ? big(`${k.lord}ลงจากบัลลังก์มาประคองคุณให้ลุกขึ้นเอง "อาจารย์ไม่ต้องคุกเข่าต่อข้า" — ขุนนางทั้งท้องพระโรงเงียบกริบ`) : ok(`คุณเป็นคนแรกที่คุกเข่า — ขุนนางคนอื่นคุกเข่าตาม ${k.lord}จำได้ว่าใครคุกเข่าก่อนใคร`); } },
      {
        label: "หนุนท่านอาชิงบัลลังก์",
        tone: "danger",
        odds: (l) => clamp(0.2 + Number(l.flags.warRank ?? 0) * 0.04 + (l.stats.smarts - 50) / 200 + pow(l) * 0.03 + l.fame / 400, 0.05, 0.75),
        survival: (l) => clamp(0.45 + (l.stats.smarts - 50) / 200 + pow(l) * 0.05, 0.2, 0.92),
        run: (l, _c, s) => {
          const k = kc(l); if (!k) return gone(l);
          delete l.flags.lordDied;
          if (s) {
            const young = k.lord;
            k.lord = seat(k).uncle; k.lordAge = randInt(l, 45, 55); k.heir = newName(l, k); k.heirAge = randInt(l, 15, 25);
            news(k, yr(l), `${k.lord}ยึดบัลลังก์จากหลาน ${young}ถูกส่งไปอยู่วัดบนเขา`);
            l.flags.lordFavor = 85; l.flags.warRank = Number(l.flags.warRank ?? 0) + 2; addFame(l, 4);
            return big(`ประตูวังเปิดก่อนรุ่งสาง — ${k.lord}นั่งบัลลังก์ก่อนตะวันขึ้น ${young}ถูกส่งไปบวชบนเขา คุณได้ตำแหน่งสูงขึ้นสองขั้น${shiftAlign(l, -4)}`);
          }
          if (!chance(l, clamp(0.45 + (l.stats.smarts - 50) / 200 + pow(l) * 0.05, 0.2, 0.92))) { kill(l, `ถูกประหารฐานร่วมกบฏชิงบัลลังก์ของ${k.lord}`); return no("องครักษ์ของเจ้าแคว้นหนุ่มรู้แผนตั้งแต่สามวันก่อน — ศีรษะของท่านอากับของคุณถูกแขวนที่ประตูเมืองคู่กัน"); }
          delete l.flags.lord; delete l.flags.warRole; delete l.flags.warChief; addFame(l, -6);
          return no(`แผนแตก ท่านอาถูกประหาร — คุณปีนกำแพงเมืองหนีออกมาได้ในชุดคนรับใช้ ชื่อคุณอยู่ในประกาศจับของ${k.name}`);
        },
      },
      { label: "ลาออกจากราชการ กลับบ้านเกิด", run: (l) => { const k = kc(l); if (!k) return gone(l); delete l.flags.lordDied; delete l.flags.lord; delete l.flags.warRole; delete l.flags.warChief; return meh(`คุณวางตราประทับไว้หน้าหีบศพของ${seat(k).surname}ผู้ล่วงลับ แล้วเดินออกจาก${k.capital} — ไม่มีใครรั้ง และไม่มีใครลืม`); } },
    ],
  },
  {
    id: "mw.kc.fall",
    minAge: 14,
    maxAge: 100,
    maxTimes: 0,
    forced: true,
    weight: (l) => (l.flags.lordFell && l.flags.lordFell === l.flags.lord && all(l).some((k) => k.id === l.flags.lordFell) ? 50 : 0),
    title: "เมืองหลวงแตก",
    text: (l) => { const k = fell(l); if (!k) return "ข่าวลือว่าเมืองหลวงแตก — แต่ไม่มีใครยืนยันได้"; const by = all(l).find((x) => x.id === k.fellTo); return `${k.capital}ลุกเป็นไฟ — ทัพของ${by?.lord ?? "ข้าศึก"}ทะลักผ่านประตูเมืองชั้นนอก ${k.lord}ถอยมาถึงประตูวังชั้นในพร้อมทหารไม่ถึงสามร้อย`; },
    choices: [
      {
        label: "ยืนรักษาประตูวังให้นายหนี",
        skill: ["combat"],
        tone: "danger",
        odds: (l) => clamp(0.15 + pow(l) * 0.09 + (l.stats.health - 50) / 200, 0.05, 0.85),
        run: (l, _c, s) => {
          const k = fell(l); if (!k) return gone(l);
          delete l.flags.lordFell; delete l.flags.lord; delete l.flags.warRole; delete l.flags.warChief; delete l.flags.isLord;
          addFame(l, 12); l.flags.loyalLegend = true;
          if (s) { addStat(l, "health", -20); return big(`คุณยืนอยู่ที่ประตูวังจนรุ่งเช้า ศพข้าศึกกองสูงถึงเข่า — ${k.lord}หนีรอดลงเรือไปทางใต้ และคุณฝ่าวงล้อมออกมาได้พร้อมแผลสิบเจ็ดแผล สามแคว้นเล่าเรื่องนี้กันอีกร้อยปี`); }
          kill(l, `ยืนรักษาประตูวังของ${k.lord}จนสิ้นใจ ขณะ${k.capital}แตก`);
          return no("หอกเล่มที่สิบเอ็ดแทงทะลุเกราะ — คุณยังยืนพิงประตูอยู่ ข้าศึกไม่กล้าเข้าใกล้จนรุ่งเช้า");
        },
      },
      { label: "ยอมจำนนต่อผู้ชนะ", run: (l) => { const k = fell(l); if (!k) return gone(l); const by = all(l).find((x) => x.id === k.fellTo); delete l.flags.lordFell; delete l.flags.warChief; delete l.flags.isLord; if (by) { l.flags.lord = by.id; l.flags.lordFavor = 25; l.flags.warRank = Math.max(0, Number(l.flags.warRank ?? 0) - 2); } else delete l.flags.lord; addFame(l, -5); return meh(`คุณวางกระบี่ลงหน้าม้าของ${by?.lord ?? "ผู้ชนะ"} — เขารับคุณไว้ใช้งาน แต่ให้คนเฝ้าดูทุกฝีก้าว${shiftAlign(l, -3)}`); } },
      { label: "พาครอบครัวหนีเข้าเขา", skill: ["escape"], odds: (l) => clamp(0.45 + (l.stats.smarts - 50) / 150 + pow(l) * 0.04, 0.15, 0.92), run: (l, _c, s) => { delete l.flags.lordFell; delete l.flags.lord; delete l.flags.warRole; delete l.flags.warChief; delete l.flags.isLord; l.flags.refusedLords = true; if (s) return meh("คุณพาครอบครัวออกทางประตูน้ำกลางควันไฟ — ข้างหลังคือเมืองที่คุณรับใช้มาหลายปี ข้างหน้าคือภูเขาที่ไม่มีใครตามมา"); addMoney(l, -Math.min(l.money, 40 * TAEL)); addStat(l, "health", -10); return no("ทหารข้าศึกปล้นขบวนของคุณกลางทาง — รอดมาได้แค่ตัวกับเสื้อผ้าที่ใส่"); } },
    ],
  },
  {
    id: "mw.kc.slander",
    minAge: 18,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => (serving(l) && Number(l.flags.warRank ?? 0) >= 1 ? 4 : 0),
    prepare: (l) => ({ foe: newName(l, kc(l)!) }),
    title: "ใส่ร้ายในท้องพระโรง",
    text: (l, c) => `นายทหาร${c.foe}คุกเข่ากลางท้องพระโรง กราบทูล${kc(l)!.lord}ว่าคุณส่งจดหมายลับไปหาแคว้นศัตรู — แล้วยื่นจดหมายที่ลายมือเหมือนของคุณทุกตัวอักษร`,
    choices: [
      { label: "ขอตรวจจดหมายต่อหน้าทุกคน", odds: (l) => clamp(0.3 + (l.stats.smarts - 50) / 90, 0.08, 0.92), run: (l, c, s) => { if (s) { addFavor(l, 10); return ok(`คุณชี้ว่าหมึกในจดหมายเป็นหมึกที่ใช้ในค่ายของ${c.foe}เท่านั้น — เขาถูกลากออกไปทั้งที่ยังตะโกนไม่หยุด`); } addFavor(l, -15); return no("ทุกเหตุผลของคุณฟังเหมือนข้อแก้ตัว — เจ้าแคว้นไม่ลงโทษ แต่ไม่มองหน้าคุณตลอดงานเลี้ยง"); } },
      { label: "ท้าดวลเพื่อพิสูจน์ความบริสุทธิ์", skill: ["combat"], odds: (l) => clamp(0.3 + pow(l) * 0.09 + (l.stats.health - 50) / 200, 0.08, 0.92), run: (l, c, s) => { if (s) { addFavor(l, 8); addFame(l, 3); return ok(`สามเพลง — ดาบของ${c.foe}ปลิวไปปักเสาท้องพระโรง เขาสารภาพทั้งน้ำตา`); } addFavor(l, -10); addStat(l, "health", -15); return no("คุณแพ้ต่อหน้าทุกคน — ในยุคนี้ คนแพ้ก็คือคนผิด"); } },
      { label: "ส่งของขวัญให้ขันทีคนสนิทของนาย", odds: (l) => clamp(0.35 + (l.stats.looks - 50) / 150 + Math.min(0.25, l.money / 400_000), 0.1, 0.9), run: (l, _c, s) => { addMoney(l, -Math.min(l.money, 15 * TAEL)); if (s) { addFavor(l, 5); return ok("ขันทีกระซิบข้างหูเจ้าแคว้นสามคืนติด — เรื่องเงียบหายไปเอง"); } return no("ขันทีรับของ แล้วไปรับของจากอีกฝ่ายด้วย"); } },
      { label: "ใส่ร้ายเขากลับให้หนักกว่า", odds: (l) => clamp(0.25 + (l.stats.smarts - 50) / 100, 0.05, 0.85), run: (l, c, s) => { if (s) { addFavor(l, 6); return ok(`อีกเจ็ดวัน "หลักฐาน" ว่า${c.foe}ยักยอกเสบียงโผล่ขึ้นในค่าย — เขาถูกตัดศีรษะหน้ากองทัพ${shiftAlign(l, -6)}`); } addFavor(l, -25); return no(`แผนของคุณรั่ว — ตอนนี้ทั้งราชสำนักเชื่อ${c.foe}${shiftAlign(l, -4)}`); } },
    ],
  },
  {
    id: "mw.kc.suspicion",
    minAge: 18,
    maxAge: 90,
    maxTimes: 0,
    weight: (l) => (serving(l) && lordFavor(l) < 20 && l.age - Number(l.flags.suspectedAt ?? -99) >= 3 ? 30 : 0),
    prepare: (l) => { l.flags.suspectedAt = l.age; return {}; },
    title: "ทหารล้อมบ้าน",
    text: (l) => `รุ่งสาง ทหารองครักษ์ห้าสิบนายล้อมบ้านคุณ — ${kc(l)!.lord}สงสัยว่าคุณคิดคด ในมือหัวหน้าองครักษ์มีราชโองการที่ยังไม่ได้เขียนโทษ`,
    choices: [
      { label: "ถอดเกราะ เปิดประตูให้ค้นบ้าน", odds: (l) => clamp(0.3 + (l.stats.smarts - 50) / 150 + lordFavor(l) / 100 + (l.stats.looks - 50) / 300, 0.1, 0.85), run: (l, _c, s) => { if (s) { l.flags.lordFavor = 40; return ok("ค้นทั้งวันไม่เจออะไร — เจ้าแคว้นส่งสุราไหหนึ่งมาขอโทษ ไหสุรานั้นคือคำเตือนครั้งสุดท้าย"); } l.flags.warRank = 0; l.flags.warRole = "soldier"; delete l.flags.warChief; l.flags.lordFavor = 30; return no("ไม่เจออะไร แต่ก็ไม่มีใครเชื่อ — คุณถูกลดยศเป็นพลทหาร ไปเฝ้าด่านชายแดน"); } },
      { label: "หนีข้ามแดนไปหาแคว้นอื่น", skill: ["escape"], tone: "danger", odds: (l) => clamp(0.35 + (l.stats.smarts - 50) / 150 + pow(l) * 0.06, 0.1, 0.92), run: (l, _c, s) => { const me = l.flags.lord; const other = kingdoms(l).filter((k) => k.id !== me).sort((a, b) => b.power - a.power)[0]; if (s && other) { l.flags.lord = other.id; l.flags.lordFavor = 35; delete l.flags.warChief; return meh(`คุณข้ามแม่น้ำตอนเที่ยงคืน — ${other.lord}รับคุณไว้ เพราะคนที่นายเก่าอยากฆ่าย่อมรู้ความลับของนายเก่า`); } kill(l, "ถูกจับได้ขณะหนีข้ามแดน และถูกประหารฐานกบฏ"); return no("ด่านริมน้ำปิดก่อนคุณไปถึงครึ่งชั่วยาม…"); } },
      {
        label: "ชิงลงมือก่อน — ยกทัพยึดเมืองหลวง",
        show: (l) => l.flags.warRole === "general",
        tone: "danger",
        odds: (l) => clamp(0.08 + Number(l.flags.warRank ?? 0) * 0.04 + pow(l) * 0.04 + l.fame / 500, 0.03, 0.6),
        run: (l, _c, s) => {
          const k = kc(l); if (!k) return gone(l);
          if (s) {
            const old = k.lord;
            k.lord = displayName(l); k.lordAge = l.age; k.heir = undefined; k.heirAge = undefined;
            l.flags.isLord = k.id; l.flags.lordFavor = 100; addFame(l, 10);
            news(k, yr(l), `แม่ทัพ${displayName(l)}ยกทัพยึด${k.capital} ${old}หนีไปตาย`);
            return big(`ทัพของคุณเข้า${k.capital}ก่อนฟ้าสาง — ${old}หนีออกทางประตูหลังแล้วไม่มีใครเห็นอีก คุณนั่งบัลลังก์ของ${k.name}ด้วยเกราะที่ยังเปื้อนเลือด${shiftAlign(l, -10)}`);
          }
          kill(l, `ก่อกบฏต่อ${k.lord}ไม่สำเร็จ ถูกประหารกลางตลาด${k.capital}`);
          return no("ครึ่งหนึ่งของทัพคุณกลับใจกลางทาง…");
        },
      },
    ],
  },
  {
    id: "mw.kc.reward",
    minAge: 18,
    maxAge: 85,
    maxTimes: 2,
    weight: (l) => (serving(l) && lordFavor(l) >= 75 ? 6 : 0),
    title: "งานเลี้ยงฉลองชัย",
    text: (l) => `${kc(l)!.lord}จัดงานเลี้ยงฉลองชัยกลาง${kc(l)!.capital} แล้วเรียกคุณขึ้นไปนั่งข้างกาย ต่อหน้าขุนนางทั้งแคว้น "ข้าจะให้รางวัลอะไรเจ้าดี"`,
    choices: [
      { label: "ขอที่ดินศักดินาริมแม่น้ำ", run: (l) => { addMoney(l, 150 * TAEL); addFame(l, 3); return ok("ที่นาสามร้อยหมู่กับหมู่บ้านสองแห่ง — ชาวบ้านเรียกคุณว่าท่านเจ้าที่ตั้งแต่วันแรก"); } },
      { label: "ขอแต่งงานกับลูกของเจ้าแคว้น", show: (l) => !l.people.some((p) => p.alive && p.relation === "spouse"), odds: (l) => clamp(0.35 + (l.stats.looks - 50) / 120 + lordFavor(l) / 300, 0.1, 0.9), run: (l, _c, s) => { const k = kc(l); if (!k) return gone(l); if (s) { const sp = createPerson(l, "spouse", { gender: l.gender === "m" ? "f" : "m", age: clamp(l.age + randInt(l, -8, 0), 16, 90), bond: 55, lastName: seat(k).surname }); l.flags.lordInLaw = k.id; addFavor(l, 10); addFame(l, 5); return big(`${k.lord}หัวเราะลั่นแล้วยกจอกให้ — ${sp.name}กลายเป็นคู่ชีวิตของคุณ ตอนนี้คุณเป็นคนในตระกูล${seat(k).surname}แล้ว`); } addFavor(l, -5); return no("ท้องพระโรงเงียบไปครู่หนึ่ง — เจ้าแคว้นยิ้มแต่ไม่ตอบ คุณขอเกินตัว"); } },
      { label: "ขอให้ปล่อยเชลยศึกกลับบ้าน", run: (l) => { addFavor(l, -4); addFame(l, 6); return ok(`เชลยสามพันคนได้กลับบ้าน — บางคนกราบคุณกลางถนน ขุนนางบางคนมองคุณแปลกๆ${shiftAlign(l, 6)}`); } },
      { label: "ไม่ขออะไร ขอแค่รับใช้ต่อ", run: (l) => { addFavor(l, 8); return ok(`${kc(l)!.lord}มองคุณนาน แล้วถอดหยกที่เอวมาให้ — หยกชิ้นนั้นมีค่ากว่าที่ดินทั้งตำบล`); } },
    ],
  },
  {
    id: "mw.kc.chief",
    minAge: 20,
    maxAge: 85,
    maxTimes: 0,
    weight: (l) => (serving(l) && l.flags.chiefOpen && !l.flags.warChief ? 20 : 0),
    title: "ตราประทับแม่ทัพใหญ่",
    text: (l) => `ตำแหน่ง${l.flags.chiefOpen === "general" ? "แม่ทัพใหญ่" : "เสนาธิการใหญ่"}ของ${kc(l)!.name}ว่างลง — ${kc(l)!.lord}ส่งตราประทับมาวางบนโต๊ะของคุณ ไม่มีจดหมาย ไม่มีคำอธิบาย`,
    choices: [
      { label: "รับตราประทับ", run: (l) => { const k = kc(l); if (!k) return gone(l); const gen = l.flags.chiefOpen === "general"; delete l.flags.chiefOpen; l.flags.warChief = true; if (gen) { l.flags.warRole = "general"; k.general = displayName(l); } else { l.flags.warRole = "strategist"; k.strategist = displayName(l); } addFame(l, 8); news(k, yr(l), `${displayName(l)}ขึ้นเป็น${gen ? "แม่ทัพใหญ่" : "เสนาธิการใหญ่"}`); return big(`วันรุ่งขึ้นทั้ง${k.capital}รู้ — คุณคือ${gen ? "แม่ทัพใหญ่" : "เสนาธิการใหญ่"}แห่ง${k.name} ทุกชัยชนะต่อจากนี้เป็นของคุณ ทุกความพ่ายแพ้ก็เช่นกัน`); } },
      { label: "ส่งคืน เสนอคนที่อาวุโสกว่า", run: (l) => { delete l.flags.chiefOpen; addFavor(l, 4); addFame(l, 2); return meh("ผู้อาวุโสที่คุณเสนอชื่อได้ตำแหน่ง — และเป็นหนี้คุณไปตลอดชีวิต"); } },
    ],
  },
  {
    id: "mw.kc.tutor",
    minAge: 25,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (serving(l) && l.stats.smarts >= 55 && lordFavor(l) >= 50 && (kc(l)?.heirAge ?? 99) <= 16 ? 4 : 0),
    title: "อาจารย์ของรัชทายาท",
    text: (l) => `${kc(l)!.lord}ขอให้คุณสอนหนังสือ${kc(l)!.heir}รัชทายาทวัย ${kc(l)!.heirAge} ปี "สอนให้มันรู้จักแผ่นดิน ไม่ใช่แค่ตำรา"`,
    choices: [
      { label: "สอนเมตตาธรรมและการเลี้ยงราษฎร", run: (l) => { l.flags.heirTaught = kc(l)!.id; addFavor(l, 5); return ok(`ทุกเช้าคุณพา${kc(l)!.heir}ไปดูชาวนาไถนา — เด็กชายถามว่าทำไมคนที่ปลูกข้าวถึงหิวที่สุด${shiftAlign(l, 3)}`); } },
      { label: "สอนพิชัยสงครามและความเด็ดขาด", run: (l) => { l.flags.heirTaught = kc(l)!.id; addFavor(l, 5); return ok(`${kc(l)!.heir}เรียนรู้ไว — วันหนึ่งเขาสั่งเฆี่ยนคนรับใช้ที่ทำถ้วยแตกโดยไม่กะพริบตา คุณไม่แน่ใจว่าสอนถูกหรือเปล่า`); } },
      { label: "ปฏิเสธ — ข้าไม่ใช่ครู", run: (l) => { addFavor(l, -3); return meh("เจ้าแคว้นพยักหน้าแล้วไปหาคนอื่น — แต่จำไว้"); } },
    ],
  },
  {
    id: "mw.kc.envoy_in",
    minAge: 20,
    maxAge: 85,
    maxTimes: 2,
    weight: (l) => (serving(l) && l.fame >= 30 && kingdoms(l).length >= 2 ? 3 : 0),
    prepare: (l) => ({ k: pick(l, kingdoms(l).filter((k) => k.id !== l.flags.lord)).id }),
    title: "ของขวัญจากแคว้นศัตรู",
    text: (l, c) => { const k = kingdoms(l).find((x) => x.id === c.k)!; return `คนของ${k.lord}เจ้า${k.name}มาส่งกล่องไม้จันทน์ถึงบ้าน — ข้างในเป็นทองคำห้าสิบตำลึงกับจดหมายสั้นๆ "คนเก่งควรอยู่กับนายที่เห็นค่า"`; },
    choices: [
      { label: "ส่งกล่องทั้งกล่องให้นายของคุณดู", run: (l) => { addFavor(l, 10); return ok("เจ้าแคว้นอ่านจดหมายแล้วหัวเราะ เอาทองคืนให้คุณครึ่งหนึ่ง \"ข้าก็เห็นค่าเจ้า\""); } },
      { label: "เก็บทองไว้เงียบๆ", odds: (l) => clamp(0.5 + (l.stats.smarts - 50) / 150, 0.15, 0.9), run: (l, _c, s) => { addMoney(l, 50 * TAEL); if (s) return meh("ไม่มีใครรู้ — ทองห้าสิบตำลึงกับความรู้สึกแปลกๆ ทุกครั้งที่เข้าเฝ้า"); addFavor(l, -30); return no("สายลับของนายคุณเห็นคนส่งกล่อง — ทองยังอยู่ แต่ความไว้ใจหายไป"); } },
      { label: "เผาจดหมายต่อหน้าทูต ส่งทองคืน", run: (l) => { addFavor(l, 4); addFame(l, 3); return ok(`ทูตกลับไปเล่าให้นายฟัง — ทั้งสามแคว้นรู้ว่าคุณซื้อไม่ได้${shiftAlign(l, 2)}`); } },
    ],
  },
];
