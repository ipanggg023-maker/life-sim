// M16 — กิลด์ของตัวเอง: ก่อตั้ง รับคน สงครามกิลด์ ควบรวม แปรพักตร์ เรื่องอื้อฉาว
import type { GameEvent } from "../../../engine/events";
import { pick, randInt, chance } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, money, people, shortName } from "../../../engine/util";
import {
  FOUND_COST,
  FOUND_FAME,
  addCores,
  addRep,
  disbandGuild,
  foundGuild,
  guildLv,
  guildRanking,
  guildRep,
  myGuild,
  newMember,
  roster,
  rosterCap,
  setRoster,
  tierOf,
} from "../m16";
import { GATE_PAY, RETAINER, fightOdds, gateRewards, luckyRankUp, rankName, survivalOdds } from "../power";
import { bad, big, good, isHunter, lost, meh, rank, w } from "./m16kit";

const G = (l: Life) => myGuild(l) ?? "กิลด์";
const has = (l: Life) => !!myGuild(l) && !!l.power;
const members = (l: Life) => roster(l).length;
/** สมาชิกที่เก่งที่สุด */
const ace = (l: Life) => [...roster(l)].sort((a, b) => b.r - a.r)[0];
const removeMember = (l: Life, name: string) => setRoster(l, roster(l).filter((m) => m.n !== name));
const vice = (l: Life) => l.people.find((p) => p.id === l.flags.gVice && p.alive);

const NAME_A = ["ดาบ", "เขี้ยว", "ปีก", "เงา", "หัวใจ", "ประตู", "ดวงดาว", "เปลวไฟ"];
const NAME_B = ["ทมิฬ", "รุ่งอรุณ", "สีเงิน", "เหล็กกล้า", "ราตรี", "พายุ", "สีคราม", "ไม่สิ้นสุด"];

export const GUILD_EVENTS: GameEvent[] = [
  {
    id: "h16.g_found",
    minAge: 20,
    maxAge: 70,
    maxTimes: 3,
    weight: (l) => w(isHunter(l) && !myGuild(l) && rank(l) >= 4 && l.money >= FOUND_COST && l.fame >= FOUND_FAME, 22),
    title: "กิลด์ของฉันเอง",
    prepare: (l) => ({ a: `กิลด์${pick(l, NAME_A)}${pick(l, NAME_B)}`, b: `กิลด์${pick(l, NAME_A)}${pick(l, NAME_B)}` }),
    text: (l) =>
      `ทนายความของสมาคมวางแบบฟอร์มจดทะเบียนกิลด์ลงตรงหน้า "แรงก์ ${rankName(rank(l))} ชื่อเสียงขนาดนี้ จะเป็นลูกน้องคนอื่นไปทำไมครับ" ค่าจดทะเบียน เช่าตึก และเงินทุนตั้งต้นรวม ${money(l, FOUND_COST)}`,
    choices: [
      { label: (_l, c) => `ตั้งชื่อ「${c.a}」`, run: (l, c) => foundGuild(l, String(c.a)) },
      { label: (_l, c) => `ตั้งชื่อ「${c.b}」`, run: (l, c) => foundGuild(l, String(c.b)) },
      { label: (l) => `ใช้นามสกุลตัวเอง「กิลด์${l.lastName}」`, run: (l) => foundGuild(l, `กิลด์${l.lastName}`) },
      { label: "ยังไม่พร้อม", run: () => meh("คุณพับแบบฟอร์มเก็บใส่กระเป๋า… วันหนึ่งอาจจะได้ใช้") },
    ],
  },
  {
    id: "h16.g_rookie",
    minAge: 20,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => w(has(l) && members(l) < rosterCap(l), 9),
    prepare: (l) => ({ r: clamp(rank(l) - randInt(l, 0, 1), 0, 8), ask: Math.round(RETAINER[clamp(rank(l), 0, 8)] * 0.8) }),
    text: (l, c) => `เด็กอายุสิบเก้าเดินเข้ามาในกิลด์พร้อมใบผลตรวจแรงก์ ${rankName(Number(c.r))} "ผมจะเข้ากิลด์นี้ครับ แต่ขอค่าเซ็นสัญญา ${money(l, Number(c.ask))} กับห้องพักที่มีหน้าต่าง"`,
    choices: [
      { label: "จ่าย รับเข้าทันที", run: (l, c) => { addMoney(l, -Number(c.ask)); const m = newMember(l, Number(c.r), "อัจฉริยะหน้าใหม่"); m.y = 55; setRoster(l, [...roster(l), m]); addRep(l, 4); return good(`${m.n} ย้ายเข้าห้องที่มีหน้าต่าง และบ่นเรื่องสัญญาณไวไฟตั้งแต่คืนแรก`); } },
      { label: "ต่อรองให้ทดลองงานก่อน", check: { stat: "looks", dc: 55 }, skill: ["social", "business"], run: (l, c, ok) => {
        if (!ok) return meh("เด็กคนนั้นเดินออกไปเข้ากิลด์คู่แข่งในวันเดียวกัน");
        const m = newMember(l, Number(c.r), "อัจฉริยะหน้าใหม่"); m.y = 70; setRoster(l, [...roster(l), m]);
        return good(`${m.n} ยอมทดลองงานสามเดือน แล้วรักกิลด์มากจนเลิกพูดเรื่องค่าเซ็นสัญญาไปเลย`);
      } },
      { label: "ปฏิเสธ เด็กเกินไป", run: () => meh("สองปีต่อมาเด็กคนนั้นขึ้นปกนิตยสาร Hunter… ในเสื้อของกิลด์อื่น") },
    ],
  },
  {
    id: "h16.g_poach",
    minAge: 20,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => w(has(l) && members(l) >= 2, 8),
    prepare: (l) => ({ n: ace(l)?.n ?? "", big: pick(l, ["กิลด์ราชสีห์ทองคำ", "กิลด์นาคราช", "กิลด์พยัคฆ์ขาว"]) }),
    text: (l, c) => `${c.big}ยื่นข้อเสนอให้ ${c.n} สมาชิกเบอร์หนึ่งของ「${G(l)}」 ค่าตัวมากกว่าที่คุณจ่ายสามเท่า เขาเคาะประตูห้องคุณ "หัวหน้า… ผมควรทำยังไงดี"`,
    choices: [
      { label: "สู้ราคา", run: (l, c) => { const m = roster(l).find((x) => x.n === c.n); const cost = m ? RETAINER[m.r] : 1_000_000; addMoney(l, -cost); setRoster(l, roster(l).map((x) => (x.n === c.n ? { ...x, y: clamp(x.y + 15, 0, 100) } : x))); return meh(`คุณจ่ายเพิ่ม ${money(l, cost)} ${c.n} อยู่ต่อ แต่บัญชีกิลด์เป็นสีแดงไปทั้งไตรมาส`); } },
      { label: "พูดถึงวันแรกที่เราตั้งกิลด์ด้วยกัน", check: { stat: "looks", dc: 55, bonus: (l) => guildRep(l) / 300 }, skill: ["social"], run: (l, c, ok) => {
        if (ok) { setRoster(l, roster(l).map((x) => (x.n === c.n ? { ...x, y: 100 } : x))); addRep(l, 5); return good(`${c.n} ฉีกสัญญาของ${c.big}ทิ้งต่อหน้าสื่อ "ผมไม่ย้ายไปไหนทั้งนั้น" แฟนๆ ของกิลด์ร้องไห้กันทั้งไลฟ์`); }
        removeMember(l, String(c.n)); addRep(l, -6); return bad(`${c.n} ก้มหัวขอโทษ แล้วย้ายไปตอนสิ้นเดือน`);
      } },
      { label: "อวยพรให้ไปได้ดี", run: (l, c) => { removeMember(l, String(c.n)); addStat(l, "happiness", -4); addMoney(l, 2_000_000); return meh(`${c.n} จากไปพร้อมค่าโอนตัวที่${c.big}จ่ายให้กิลด์ "ถ้าวันไหนลำบาก กลับมาบ้านนะ"`); } },
    ],
  },
  {
    id: "h16.g_war",
    minAge: 20,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => w(has(l), 5),
    title: "สงครามกิลด์",
    prepare: (l) => ({ rival: pick(l, ["กิลด์หมาป่าเหล็ก", "กิลด์มังกรดำ", "กิลด์อีกาเพลิง", "กิลด์ฟ้าคำราม"]), gr: clamp(rank(l), 0, 8) }),
    text: (l, c) => `${c.rival}กับ「${G(l)}」มาถึง Gate แรงก์ ${rankName(Number(c.gr))} ที่เปิดใหม่พร้อมกัน สมาคมกฎว่า "ใครเข้าก่อนได้ก่อน" หัวหน้าฝั่งนั้นเดินมาจิ้มอกคุณ "ถอยไป กิลด์กระจอก"`,
    choices: [
      {
        label: "ท้าดวลหัวหน้ากิลด์ต่อหน้าทุกคน",
        tone: "danger",
        odds: (l, c) => fightOdds(l, Number(c.gr), guildLv(l) * 0.02),
        survival: (l, c) => survivalOdds(l, Number(c.gr), 0.15),
        run: (l, c, ok) => {
          if (ok) { addRep(l, 12); addFame(l, 6); const r = gateRewards(l, Number(c.gr), 1, true); addCores(l, tierOf(Number(c.gr)), 1); return big(`หัวหน้า${c.rival}คุกเข่ากลางลานจอดรถ คลิปนี้ทำให้ใบสมัครเข้ากิลด์คุณล้น ${r}`); }
          addRep(l, -8);
          return lost(l, Number(c.gr), `ตายจากการดวลกับหัวหน้า${c.rival}`, `คุณแพ้ต่อหน้าลูกน้องตัวเอง ${c.rival}เดินเข้า Gate ไปพร้อมเสียงหัวเราะ`, 8, 18);
        },
      },
      { label: "เสนอบุกร่วมแล้วแบ่งคอร์ครึ่งๆ", check: { stat: "smarts", dc: 55 }, skill: ["social", "business"], run: (l, c, ok) => {
        if (ok) { gateRewards(l, Number(c.gr), 0.6, true); addCores(l, tierOf(Number(c.gr)), 1); addRep(l, 4); return good(`สองกิลด์บุกร่วมกันสำเร็จ หัวหน้า${c.rival}ยอมรับว่าคุณ "ใช้ได้" แล้วเลี้ยงหมูกระทะทั้งสองกิลด์`); }
        return meh("การเจรจาลากยาวจนกองกำลังของรัฐมาเคลียร์ Gate ไปเอง ทั้งสองฝ่ายไม่ได้อะไร");
      } },
      { label: "ถอย ไม่คุ้มเสี่ยงชีวิตลูกน้อง", run: (l) => { addRep(l, -5); return meh("ลูกน้องบางคนโล่งใจ บางคนก้มหน้าไม่มองคุณ"); } },
    ],
  },
  {
    id: "h16.g_merger",
    minAge: 25,
    maxAge: 85,
    maxTimes: 2,
    weight: (l) => w(has(l) && guildLv(l) >= 2, 5),
    prepare: (l) => ({ big: pick(l, ["กิลด์ราชสีห์ทองคำ", "กิลด์นาคราช"]), price: (guildLv(l) * 15 + members(l) * 4) * 1_000_000 + roster(l).reduce((s, m) => s + GATE_PAY[m.r], 0) }),
    text: (l, c) => `ประธาน${c.big}เชิญคุณไปกินข้าวบนดาดฟ้าโรงแรม "ขาย「${G(l)}」ให้ผม ${money(l, Number(c.price))} ทุกคนได้เงินเดือนเพิ่ม คุณได้ตำแหน่งรองประธาน ไม่ต้องปวดหัวเรื่องบัญชีอีกแล้ว"`,
    choices: [
      { label: "ขาย", run: (l, c) => { addMoney(l, Number(c.price)); const out = disbandGuild(l); l.flags.soldGuild = true; return { text: `🤝 คุณเซ็นสัญญาควบรวม ได้เงิน ${money(l, Number(c.price))} — ${out.text.replace("ด้วยมือตัวเอง ทุกคนแยกย้ายกันไป", "แล้วแขวนป้ายของ" + c.big + "แทน")}`, kind: "milestone" }; } },
      { label: "ปฏิเสธ — กิลด์นี้ไม่ได้มีไว้ขาย", run: (l) => { addRep(l, 6); addStat(l, "happiness", 4); return good("คุณลุกจากโต๊ะก่อนของหวานจะมา ลูกน้องรู้ข่าวแล้วซื้อเค้กมารอที่กิลด์"); } },
    ],
  },
  {
    id: "h16.g_scandal",
    minAge: 22,
    maxAge: 85,
    maxTimes: 2,
    weight: (l) => w(has(l) && members(l) >= 2, 6),
    prepare: (l) => ({ n: pick(l, roster(l)).n }),
    text: (l, c) => `นักข่าวสืบสวนปล่อยคลิป: ${c.n} สมาชิก「${G(l)}」ขนคอร์ของกิลด์ไปขายตลาดมืดตอนตีสาม หน้าคุณอยู่บนปกข่าวในฐานะหัวหน้า`,
    choices: [
      { label: "ไล่ออกและแจ้งความ", run: (l, c) => { removeMember(l, String(c.n)); addRep(l, 3); return meh(`${c.n} โดนยึดใบอนุญาต Hunter สมาชิกที่เหลือเริ่มล็อกตู้เก็บของ`); } },
      { label: "ปกป้องเขา ขอให้ฟังอีกฝั่งก่อน", check: { stat: "smarts", dc: 60 }, skill: ["social", "business"], run: (l, c, ok) => {
        if (ok) { addRep(l, 8); setRoster(l, roster(l).map((x) => (x.n === c.n ? { ...x, y: 100 } : x))); return good(`คุณพิสูจน์ได้ว่า${c.n}ถูกใส่ร้าย — คนในคลิปคือคนที่จ้างมาแสดงโดยกิลด์คู่แข่ง`); }
        addRep(l, -15); addFame(l, -6); return bad(`หลักฐานชุดที่สองออกมา ${c.n}ผิดจริง และคุณก็พลอยดูเหมือนคนร่วมมือ`);
      } },
      { label: "จ่ายเงินปิดข่าว", run: (l) => { addMoney(l, -3_000_000); if (chance(l, 0.5)) return meh("ข่าวเงียบ… ส่วนนักข่าวเปลี่ยนรถใหม่"); addRep(l, -12); return bad("นักข่าวอัดเสียงตอนคุณเสนอเงินไว้ ข่าวที่สองแย่กว่าข่าวแรก"); } },
    ],
  },
  {
    id: "h16.g_hall",
    minAge: 22,
    maxAge: 80,
    weight: (l) => w(has(l) && guildLv(l) >= 2 && !l.flags.gHall, 7),
    text: (l) => `ตึกเก่าห้าชั้นริมแม่น้ำประกาศขาย ${money(l, 25_000_000)} — มีโรงยิมใต้ดิน ห้องประชุม และดาดฟ้าที่เห็นประตู Gate ถาวรของเมือง พอดีกับ「${G(l)}」`,
    choices: [
      { label: "ซื้อเป็นสำนักงานใหญ่", run: (l) => { addMoney(l, -25_000_000); l.flags.gHall = true; addRep(l, 15); return big(`ป้าย「${G(l)}」ขึ้นบนดาดฟ้าตึกริมน้ำ คืนแรกทุกคนนอนกองกันในโรงยิมเพราะยังไม่มีเฟอร์นิเจอร์`); } },
      { label: "เช่าตึกเดิมต่อ", run: () => meh("แอร์ตึกเก่ายังหยดน้ำใส่โต๊ะคุณเหมือนเดิม") },
    ],
  },
  {
    id: "h16.g_member_death",
    minAge: 20,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => w(has(l) && members(l) >= 3, 4),
    prepare: (l) => ({ n: pick(l, roster(l)).n }),
    text: (l, c) => `โทรศัพท์ตอนตีสี่: ${c.n} ไม่ได้ออกมาจาก Gate แรงก์ต่ำที่ไปเคลียร์คนเดียวเพื่อเก็บเงินค่าเทอมให้น้อง สมาชิก「${G(l)}」ทุกคนรออยู่ที่โถงกิลด์`,
    choices: [
      { label: "จ่ายค่าเทอมน้องเขาจนเรียนจบ", run: (l, c) => { removeMember(l, String(c.n)); addMoney(l, -1_500_000); addRep(l, 6); addStat(l, "happiness", -8); setRoster(l, roster(l).map((x) => ({ ...x, y: clamp(x.y + 10, 0, 100) }))); return meh(`คุณไปส่งน้องสาวของ${c.n}ที่มหาวิทยาลัยทุกเปิดเทอม จนวันรับปริญญา เธอใส่ชุดครุยมากอดคุณ`); } },
      { label: "ตั้งกฎใหม่: ห้ามใครเข้า Gate คนเดียว", run: (l, c) => { removeMember(l, String(c.n)); addRep(l, 3); addStat(l, "happiness", -10); return meh(`กฎข้อแรกบนกระดานกิลด์ถูกเขียนด้วยลายมือคุณ ใต้ชื่อของ${c.n}`); } },
    ],
  },
  {
    id: "h16.g_raise",
    minAge: 22,
    maxAge: 85,
    maxTimes: 2,
    weight: (l) => w(has(l) && members(l) >= 4, 6),
    text: (l) => `สมาชิก「${G(l)}」ยื่นจดหมายลงชื่อทุกคน: ขอขึ้นเงินเดือน "ราคาคอร์ขึ้น ค่าครองชีพขึ้น แต่เงินเดือนเราไม่ขึ้นมาสองปีแล้วครับหัวหน้า"`,
    choices: [
      { label: "ขึ้นให้ทุกคน", run: (l) => { addMoney(l, -roster(l).reduce((s, m) => s + RETAINER[m.r] * 0.15, 0)); setRoster(l, roster(l).map((x) => ({ ...x, y: clamp(x.y + 15, 0, 100) }))); return good("เสียงเชียร์ดังลงไปถึงลานจอดรถ เดือนนั้นทุกคนเคลียร์ Gate เกินเป้า"); } },
      { label: "เปิดบัญชีให้ดูว่ากิลด์ไม่มีเงินจริงๆ", check: { stat: "smarts", dc: 50 }, skill: ["business", "social"], run: (l, _c, ok) => (ok ? (setRoster(l, roster(l).map((x) => ({ ...x, y: clamp(x.y + 5, 0, 100) }))), good("ทุกคนเห็นตัวเลข แล้วเงียบ… ก่อนจะมีคนเสนอให้ไปเคลียร์ Gate เพิ่มเอาโบนัสกันเอง")) : (setRoster(l, roster(l).map((x) => ({ ...x, y: clamp(x.y - 15, 0, 100) }))), bad("มีคนชี้ไปที่บรรทัด \"ค่ารถหัวหน้า\" ทั้งห้องเงียบในทางที่แย่"))) },
      { label: "ปฏิเสธ", run: (l) => { setRoster(l, roster(l).map((x) => ({ ...x, y: clamp(x.y - 20, 0, 100) }))); addRep(l, -4); return bad("ไม่มีใครเถียง ไม่มีใครยิ้ม และไม่มีใครอยู่ทำงานเกินเวลาอีกเลย"); } },
    ],
  },
  {
    id: "h16.g_festival",
    minAge: 21,
    maxAge: 90,
    maxTimes: 3,
    weight: (l) => w(has(l) && l.age - Number(l.flags.gFounded ?? l.age) >= 1, 6),
    text: (l) => `ครบรอบ ${l.age - Number(l.flags.gFounded ?? l.age)} ปีของ「${G(l)}」 ลูกน้องอยากจัดงานเลี้ยง แฟนคลับถามในเพจว่าจะมีมีตติ้งไหม`,
    choices: [
      { label: "จัดใหญ่ เปิดให้แฟนๆ เข้า", run: (l) => { addMoney(l, -800_000); addRep(l, 6); addFame(l, 3); return good("แฟนๆ สองพันคนต่อแถวรอบตึก ฮีลเลอร์ของกิลด์ตั้งซุ้มรักษาอาการปวดหลังฟรี คนต่อแถวยาวกว่าซุ้มลายเซ็นคุณ"); } },
      { label: "กินหมูกระทะกันเอง", run: (l) => { addMoney(l, -50_000); setRoster(l, roster(l).map((x) => ({ ...x, y: clamp(x.y + 8, 0, 100) }))); return good("รองหัวหน้าเมาแล้วร้องเพลงลูกทุ่งจนเช้า คลิปนั้นจะถูกใช้แบล็กเมลเขาไปอีกสิบปี"); } },
    ],
  },
  {
    id: "h16.g_audit",
    minAge: 22,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => w(has(l), 4),
    text: (l) => `สมาคม Hunter ส่งทีมตรวจสอบมาที่「${G(l)}」 "ตรวจสต็อกคอร์ บัญชีรายรับ และใบอนุญาตสมาชิกทุกคน — วันนี้เลยครับ"`,
    choices: [
      { label: "เปิดทุกอย่างให้ตรวจ", check: { stat: "smarts", dc: 50, bonus: (l) => (Number(l.flags.blackDeals ?? 0) ? -0.25 : 0.1) }, skill: ["business", "study"], run: (l, _c, ok) => (ok ? (addRep(l, 8), good("ผ่านทุกข้อ หัวหน้าทีมตรวจขอถ่ายรูปกับคุณก่อนกลับ \"ลูกชายผมเป็นแฟนคลับครับ\"")) : (addMoney(l, -2_000_000), addRep(l, -8), bad("เจอคอร์ที่ไม่มีใบรับรองที่มา คุณโดนปรับและถูกตัดสิทธิ์จอง Gate หนึ่งไตรมาส"))) },
      { label: "เลี้ยงข้าวทีมตรวจก่อน", run: (l) => { addMoney(l, -300_000); if (chance(l, 0.6)) return meh("ทีมตรวจกินอิ่มจนตรวจแค่ครึ่งเดียว"); addRep(l, -10); return bad("หัวหน้าทีมตรวจเป็นคนซื่อสัตย์ที่สุดในสมาคม เขาเขียนเรื่องนี้ลงรายงาน"); } },
    ],
  },
  {
    id: "h16.g_vice",
    minAge: 25,
    maxAge: 85,
    weight: (l) => w(has(l) && !!vice(l) && vice(l)!.bond < 55, 8),
    title: "รองหัวหน้า",
    prepare: (l) => ({ n: shortName(vice(l)!) }),
    text: (l, c) => `คุณเจอสัญญาร่างที่${c.n}รองหัวหน้า「${G(l)}」ซ่อนไว้ในลิ้นชัก — ข้อตกลงพาสมาชิกครึ่งกิลด์ย้ายไปตั้งกิลด์ใหม่ โดยมีเงินทุนจากคู่แข่งของคุณ`,
    choices: [
      { label: "เรียกคุยตรงๆ สองต่อสอง", check: { stat: "looks", dc: 55 }, skill: ["social"], run: (l, c, ok) => {
        const v = vice(l)!;
        if (ok) { v.bond = 85; addRep(l, 4); return good(`${c.n}สารภาพว่ารู้สึกไม่มีความหมายในกิลด์ คุณให้เขาคุมทีมใหม่ของตัวเองภายในกิลด์ เขาฉีกสัญญานั้นต่อหน้าคุณ`); }
        v.relation = "rival"; const half = Math.floor(members(l) / 2); setRoster(l, roster(l).slice(half)); addRep(l, -12); delete l.flags.gVice;
        return bad(`${c.n}ลุกขึ้น "ผมนึกว่าคุณจะเข้าใจ" เช้าวันรุ่งขึ้น สมาชิก ${half} คนเก็บของออกไปพร้อมเขา`);
      } },
      { label: "ไล่ออกก่อนเขาจะทันทำ", run: (l, c) => { const v = vice(l)!; v.relation = "rival"; delete l.flags.gVice; addRep(l, -4); return meh(`${c.n}ออกไปคนเดียว ไม่มีใครตามไป แต่เขามองคุณด้วยสายตาที่คุณจะจำไปอีกนาน`); } },
    ],
  },
  {
    id: "h16.g_joint",
    minAge: 20,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => w(has(l) && members(l) >= 3, 6),
    prepare: (l) => ({ gr: clamp(rank(l) + 1, 0, 8) }),
    text: (l, c) => `สมาคมมอบ Gate แรงก์ ${rankName(Number(c.gr))} ให้「${G(l)}」เคลียร์ทั้งกิลด์ เป็นครั้งแรกที่สมาชิกทุกคนจะเข้าไปพร้อมกัน`,
    choices: [
      {
        label: "นำทีมด้วยตัวเอง",
        tone: "danger",
        odds: (l, c) => fightOdds(l, Number(c.gr), 0.05 + guildLv(l) * 0.03 + members(l) * 0.01),
        survival: (l, c) => survivalOdds(l, Number(c.gr), 0.15 + guildLv(l) * 0.03),
        run: (l, c, ok) => {
          if (ok) { const r = gateRewards(l, Number(c.gr), 1.3, true); addCores(l, tierOf(Number(c.gr)), 2); addRep(l, 12); if (chance(l, 0.25)) luckyRankUp(l, "[ระบบ] นำกิลด์ข้ามขีดจำกัด"); return big(`「${G(l)}」เคลียร์ Gate สูงกว่าแรงก์หัวหน้าได้! ${r} · ได้คอร์ 2 ก้อน`); }
          const dead = roster(l)[0];
          if (dead && chance(l, 0.5)) removeMember(l, dead.n);
          addRep(l, -6);
          return lost(l, Number(c.gr), "เสียชีวิตขณะนำกิลด์บุก Gate", `ทีมแตกกลางทาง${dead ? ` ${dead.n} ไม่ได้ออกมา` : ""}`, 10, 20);
        },
      },
      { label: "ให้รองหัวหน้านำ คุณคุมอยู่ด้านหลัง", run: (l, c) => { gateRewards(l, Number(c.gr), 0.6, false); addRep(l, 4); return good("ลูกน้องทำได้ดีกว่าที่คุณคิด คุณแทบไม่ต้องชักอาวุธ — รู้สึกภูมิใจปนแก่ลงนิดหน่อย"); } },
    ],
  },
  {
    id: "h16.g_ranking",
    minAge: 22,
    maxAge: 90,
    maxTimes: 3,
    weight: (l) => w(has(l) && guildLv(l) >= 2, 6),
    text: (l) => `งานประกาศอันดับกิลด์ประจำปี「${G(l)}」ติดอันดับที่ ${guildRanking(l)} ของประเทศ พิธีกรเชิญหัวหน้าขึ้นพูดหนึ่งนาที`,
    choices: [
      { label: "พูดขอบคุณสมาชิกทีละคน", run: (l) => { setRoster(l, roster(l).map((x) => ({ ...x, y: clamp(x.y + 10, 0, 100) }))); return good("หนึ่งนาทีกลายเป็นเจ็ดนาที พิธีกรไม่กล้าตัด ลูกน้องที่นั่งข้างล่างร้องไห้กันครึ่งโต๊ะ"); } },
      { label: "ประกาศว่าปีหน้าจะขึ้นอันดับหนึ่ง", check: { stat: "looks", dc: 55 }, skill: ["perform", "social"], run: (l, _c, ok) => (ok ? (addRep(l, 8), addFame(l, 4), good("ทั้งฮอลล์ปรบมือ หัวหน้ากิลด์อันดับหนึ่งยกแก้วให้คุณจากโต๊ะหน้าสุด")) : (addRep(l, -3), meh("ไมค์หอนพอดีตอนพูดคำว่า \"หนึ่ง\" ทั้งฮอลล์หัวเราะ"))) },
    ],
  },
  {
    id: "h16.g_sponsor",
    minAge: 22,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => w(has(l) && guildRep(l) >= 40, 6),
    prepare: (l) => ({ brand: pick(l, ["ชาเขียวขวดดัง", "ค่ายมือถือ", "ร้านไก่ทอดเจ้าใหญ่", "ประกันชีวิตสำหรับ Hunter"]), amt: guildLv(l) * 3_000_000 }),
    text: (l, c) => `${c.brand}อยากให้「${G(l)}」ใส่โลโก้บนชุดเกราะ ค่าสปอนเซอร์ปีละ ${money(l, Number(c.amt))}`,
    choices: [
      { label: "รับ", run: (l, c) => { addMoney(l, Number(c.amt)); addRep(l, 2); return good("โลโก้ใหญ่กว่าที่ตกลงไว้นิดหน่อย แต่เงินก็ใหญ่กว่าที่ตกลงไว้นิดหน่อยเหมือนกัน"); } },
      { label: "ปฏิเสธ เกราะต้องไม่มีโฆษณา", run: (l) => { addRep(l, 3); return meh("สมาชิกบางคนบ่น บางคนภูมิใจ แฟนคลับชมว่า \"กิลด์ที่ยังมีศักดิ์ศรี\""); } },
    ],
  },
  {
    id: "h16.g_child",
    minAge: 40,
    maxAge: 90,
    weight: (l) => w(has(l) && people(l, "child").some((k) => k.age >= 18 && k.age <= 35), 8),
    prepare: (l) => ({ n: shortName(people(l, "child").find((k) => k.age >= 18 && k.age <= 35)!) }),
    text: (l, c) => `${c.n} ลูกของคุณเพิ่งตื่นพลังแรงก์ D และอยากเข้า「${G(l)}」 "ไม่ต้องให้สิทธิ์พิเศษอะไร แค่อยากทำงานกับพ่อแม่"`,
    choices: [
      { label: "รับเข้า แต่ให้เริ่มจากล่างสุด", run: (l, c) => { const m = newMember(l, 2, "ลูกหัวหน้า (เริ่มจากล้างห้องน้ำ)"); m.n = String(c.n); m.y = 95; setRoster(l, [...roster(l), m]); addStat(l, "happiness", 8); return good(`${c.n}ล้างห้องน้ำกิลด์สามเดือนโดยไม่บ่นสักคำ สมาชิกคนอื่นเริ่มเรียกเขาว่า "รุ่นสอง"`); } },
      { label: "ส่งไปกิลด์อื่นให้เรียนรู้โลกก่อน", run: (l, c) => { addStat(l, "happiness", 2); return meh(`${c.n}เข้ากิลด์พยัคฆ์ขาว และโทรมาเล่าทุกอาทิตย์ว่าที่นั่นห้องน้ำสะอาดกว่า`); } },
    ],
  },
  {
    id: "h16.g_return",
    minAge: 25,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => w(has(l) && members(l) < rosterCap(l) && guildRep(l) >= 45, 4),
    prepare: (l) => ({ r: clamp(rank(l) - 1, 0, 8) }),
    text: (l, c) => `อดีตสมาชิกที่ย้ายไปกิลด์ใหญ่เมื่อหลายปีก่อนยืนเปียกฝนอยู่หน้าประตู「${G(l)}」 ตอนนี้แรงก์ ${rankName(Number(c.r))} แล้ว "ที่โน่นไม่มีใครจำชื่อผมได้ครับ… ขอกลับบ้านได้ไหม"`,
    choices: [
      { label: "เปิดประตูให้", run: (l, c) => { const m = newMember(l, Number(c.r), "ลูกหลงกลับบ้าน"); m.y = 100; setRoster(l, [...roster(l), m]); addRep(l, 4); return good(`${m.n} กลับมานั่งโต๊ะเดิมที่ยังไม่มีใครกล้านั่ง`); } },
      { label: "ปิดประตู คนทรยศครั้งหนึ่งก็ทรยศได้อีก", run: (l) => { addStat(l, "happiness", -3); return meh("เสียงฝนกลบเสียงฝีเท้าที่เดินจากไป"); } },
    ],
  },
  {
    id: "h16.g_reality",
    minAge: 22,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => w(has(l) && l.fame >= 30, 5),
    text: (l) => `ช่องทีวีอยากถ่ายเรียลลิตี้ "24 ชั่วโมงใน「${G(l)}」" ตามติดชีวิตหัวหน้าและลูกน้องหนึ่งฤดูกาลเต็ม`,
    choices: [
      { label: "ตกลง", check: { stat: "looks", dc: 50 }, skill: ["perform", "social"], run: (l, _c, ok) => (ok ? (addFame(l, 10), addRep(l, 10), addMoney(l, 3_000_000), good("เรตติ้งถล่มทลาย ฉากที่ฮีลเลอร์ของกิลด์ทำกับข้าวไหม้ทุกตอนกลายเป็นมีม")) : (addFame(l, -4), addRep(l, -6), bad("ทีมตัดต่อทำให้คุณดูเหมือนหัวหน้าจอมเผด็จการ ทั้งที่คุณแค่ขอให้ล้างจาน"))) },
      { label: "ไม่ — กิลด์ไม่ใช่ละคร", run: () => meh("โปรดิวเซอร์ไปถ่ายกิลด์คู่แข่งแทน และมันก็ดังมาก") },
    ],
  },
  {
    id: "h16.g_rumor",
    minAge: 22,
    maxAge: 85,
    maxTimes: 2,
    weight: (l) => w(has(l), 4),
    text: (l) => `บัญชีอวตารในโซเชียลปล่อยข่าวว่า「${G(l)}」เคลียร์ Gate ได้เพราะซื้อคอร์มาจากตลาดมืดแล้วแจ้งว่าล่าเอง ยอดแชร์แสนครั้งในหนึ่งคืน`,
    choices: [
      { label: "ไลฟ์เปิดคลิปกล้องติดหมวกทุก Gate", run: (l) => { addRep(l, 6); addFame(l, 2); return good("คนดูสามแสนคนนั่งดูคุณฟันก็อบลินสามชั่วโมง คอมเมนต์เปลี่ยนจาก \"โกหก\" เป็น \"ขอโทษครับพี่\""); } },
      { label: "ให้ทีมกฎหมายตามหาต้นตอ", check: { stat: "smarts", dc: 55 }, skill: ["business", "study"], run: (l, _c, ok) => (ok ? (addRep(l, 8), good("ต้นตอคือพนักงานฝ่ายประชาสัมพันธ์ของกิลด์คู่แข่ง คดีจบด้วยการขอโทษหน้าหนึ่งหนังสือพิมพ์")) : (addRep(l, -4), meh("บัญชีอวตารหายไป แต่ข่าวลือยังอยู่"))) },
      { label: "ไม่สนใจ", run: (l) => { addRep(l, -5); return meh("ผู้สมัครเข้ากิลด์ถามเรื่องนี้ในการสัมภาษณ์ทุกคน"); } },
    ],
  },
  {
    id: "h16.g_succession",
    minAge: 58,
    maxAge: 110,
    weight: (l) => w(has(l), 12),
    title: "ส่งต่อกิลด์",
    prepare: (l) => ({ n: (ace(l)?.n ?? (vice(l) ? shortName(vice(l)!) : "รองหัวหน้า")) as string }),
    text: (l, c) => `คุณยืนบนดาดฟ้าของ「${G(l)}」มองลูกน้องซ้อมอยู่ข้างล่าง เข่าเริ่มปวดตอนฝนจะตก ${c.n} ยังรอคำตอบว่าคุณจะเกษียณเมื่อไหร่`,
    choices: [
      { label: (_l, c) => `มอบตำแหน่งหัวหน้าให้ ${c.n}`, run: (l, c) => { const name = G(l); const lv = guildLv(l); addMoney(l, lv * 5_000_000); disbandGuild(l); addStat(l, "happiness", 15); l.flags.guildLegacy = name; return big(`คุณถอดเข็มกลัดหัวหน้า「${name}」กลัดให้ ${c.n} ทั้งกิลด์ยืนเคารพ — คุณได้เงินปันผลก้อนสุดท้ายและตำแหน่ง "หัวหน้ากิลด์กิตติมศักดิ์" ตลอดชีพ`); } },
      { label: "ยังไม่ถึงเวลา", run: (l) => { addStat(l, "health", -2); return meh("คุณลงไปซ้อมกับลูกน้อง แล้วต้องนั่งพักทุกสิบนาที ไม่มีใครกล้าพูดอะไร"); } },
    ],
  },
  {
    id: "h16.g_trainee_day",
    minAge: 22,
    maxAge: 85,
    maxTimes: 2,
    weight: (l) => w(has(l) && members(l) >= 2, 5),
    text: (l) => `「${G(l)}」เปิดวันฝึกฟรีให้เด็กแรงก์ F–E ในชุมชน มีเด็กมาสี่สิบคน หนึ่งในนั้นถือไม้กวาดมาแทนดาบ`,
    choices: [
      { label: "สอนเองทั้งวัน", run: (l) => { addRep(l, 5); addStat(l, "happiness", 8); addStat(l, "health", -2); return good("เด็กถือไม้กวาดเรียนเร็วที่สุด เขาสัญญาว่าโตขึ้นจะมาเข้ากิลด์นี้"); } },
      { label: "ให้ลูกน้องสอน คุณถ่ายรูปลงเพจ", run: (l) => { addRep(l, 3); addFame(l, 1); return meh("ยอดไลก์ดี แต่เด็กๆ ถามหาแต่ \"หัวหน้าตัวจริง\""); } },
    ],
  },
];

