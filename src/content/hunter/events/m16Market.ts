// M16 — ตลาดคอร์มอนสเตอร์: ขาย/เก็บ/ตลาดมืด/กลืนคอร์ และคนธรรมดาที่เก็งกำไรคอร์
import type { Ctx, GameEvent } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, money } from "../../../engine/util";
import { CORE_TIERS, addCores, coresOf, corePrice, holdingValue, marketIndex, sellAllCores, sellCores, totalCores } from "../m16";
import { gainExp, luckyRankUp } from "../power";
import { awake, bad, big, good, hurt, isHunter, meh, mundane, w } from "./m16kit";

const T = (c: Ctx) => Number(c.t);
/** ชั้นคอร์สูงสุดที่ถืออยู่ */
const topTier = (l: Life) => [3, 2, 1, 0].find((i) => coresOf(l, i) > 0) ?? -1;
const holding = (l: Life) => totalCores(l) > 0;
const news = (l: Life) => String(l.flags.coreNews ?? "calm");

export const MARKET_EVENTS: GameEvent[] = [
  {
    id: "h16.mkt_boom",
    minAge: 16,
    maxAge: 110,
    maxTimes: 0,
    weight: (l) => w(holding(l) && marketIndex(l) >= 150, 18),
    text: (l) => `📈 ดัชนีราคาคอร์ทะลุ ${marketIndex(l)}! ช่องข่าวเศรษฐกิจขึ้นกราฟสีเขียวยาวเหยียด คอร์ที่คุณเก็บไว้ตอนนี้มีมูลค่ารวม ${money(l, holdingValue(l))}`,
    choices: [
      { label: "เทขายทั้งหมด", run: (l) => sellAllCores(l) },
      { label: "ถือต่อ ยังไม่ถึงจุดสูงสุด", run: (l) => { l.flags.coreGreedy = Number(l.flags.coreGreedy ?? 0) + 1; return meh("คุณปิดแอปตลาดแล้ววางโทรศัพท์คว่ำลง มือยังสั่นนิดหน่อย"); } },
    ],
  },
  {
    id: "h16.mkt_crash",
    minAge: 16,
    maxAge: 110,
    maxTimes: 0,
    weight: (l) => w(holding(l) && marketIndex(l) <= 65, 16),
    text: (l) => `📉 ราคาคอร์ดิ่งเหว ดัชนีเหลือ ${marketIndex(l)} — ${news(l) === "glut" ? "สมาคมเคลียร์ Gate ใหญ่จนคอร์ล้นโกดัง" : "นักลงทุนต่างชาติถอนตัวพร้อมกัน"} ห้องแชตนักล่าคอร์มีแต่สติกเกอร์ร้องไห้`,
    choices: [
      { label: "ตัดขาดทุน ขายทิ้งก่อนจะต่ำกว่านี้", run: (l) => { const o = sellAllCores(l); addStat(l, "happiness", -4); return { ...o, kind: "bad" }; } },
      { label: "ถือต่อ เดี๋ยวก็มี Gate Break", run: (l) => { addStat(l, "happiness", -2); return meh("คุณเปิดข่าวทุกเช้าเพื่อดูว่าวันนี้มีประตูแตกหรือยัง แล้วก็รู้สึกผิดกับตัวเองนิดหน่อย"); } },
      { label: "ช้อนซื้อคอร์ราคาถูกเพิ่ม", check: { stat: "smarts", dc: 55 }, skill: ["business"], run: (l, _c, ok) => {
        const cost = corePrice(l, 1) * 2;
        if (l.money < cost) return meh("คุณเปิดแอปธนาคารดู แล้วก็ปิดไปเงียบๆ");
        addMoney(l, -cost);
        addCores(l, 1, ok ? 3 : 2);
        return ok ? good(`คุณต่อราคากับพ่อค้าที่กำลังร้อนเงินได้คอร์สีคราม 3 ก้อนในราคาสองก้อน`) : meh("คุณได้คอร์สีครามมาสองก้อน… และราคาก็ตกลงอีกในวันรุ่งขึ้น");
      } },
    ],
  },
  {
    id: "h16.mkt_broker",
    minAge: 18,
    maxAge: 100,
    maxTimes: 4,
    weight: (l) => w(holding(l), 7),
    prepare: (l) => ({ t: topTier(l), prem: randInt(l, 10, 30) }),
    text: (_l, c) => `นายหน้าสูทสีครีมนั่งรอคุณที่ล็อบบี้สมาคม "ลูกค้าผมเป็นบริษัทพลังงานครับ ขอซื้อ${CORE_TIERS[T(c)].name}ทั้งหมดของคุณ บวกราคาตลาดให้อีก ${c.prem}%"`,
    choices: [
      {
        label: "ขายให้เขา",
        run: (l, c) => {
          const n = coresOf(l, T(c));
          const got = Math.round(corePrice(l, T(c)) * n * (1 + Number(c.prem) / 100));
          addCores(l, T(c), -n);
          addMoney(l, got);
          l.flags.coreEarned = Number(l.flags.coreEarned ?? 0) + got;
          return good(`เงิน ${money(l, got)} เข้าบัญชีก่อนที่คุณจะเดินถึงลานจอดรถ`);
        },
      },
      { label: "ขอดูหนังสือรับรองบริษัทก่อน", check: { stat: "smarts", dc: 50 }, skill: ["business"], run: (l, c, ok) => {
        if (ok) { addFame(l, 2); return good("ทะเบียนบริษัทเพิ่งตั้งเมื่อวาน — นายหน้าหายตัวไปพร้อมกาแฟที่ยังไม่ได้จ่าย สมาคมขอบคุณที่คุณแจ้งเรื่องมิจฉาชีพรายนี้"); }
        return sellCores(l, T(c), 99);
      } },
      { label: "ไม่ขาย", run: () => meh("\"เปลี่ยนใจเมื่อไหร่โทรหาผมนะครับ\" นามบัตรของเขาหนักกว่ากระดาษทั่วไปอย่างน่าสงสัย") },
    ],
  },
  {
    id: "h16.mkt_black",
    minAge: 18,
    maxAge: 90,
    maxTimes: 3,
    weight: (l) => w(holding(l) && awake(l), 6),
    prepare: (l) => ({ t: topTier(l) }),
    text: (_l, c) => `ข้อความจากเบอร์ไม่รู้จัก: "ได้ยินว่ามี${CORE_TIERS[T(c)].name}ในมือ ตลาดมืดใต้สะพานพระราม 3 จ่ายเงินสด 1.5 เท่า ไม่หักภาษี ไม่ถามที่มา คืนพรุ่งนี้ตีสอง"`,
    choices: [
      { label: "ไปตามนัด", tone: "special", run: (l, c) => sellCores(l, T(c), 99, true) },
      { label: "ส่งข้อความต่อให้หน่วยตรวจสอบของสมาคม", run: (l) => { addFame(l, 3); addMoney(l, 100_000); return good("คืนนั้นหน่วยตรวจสอบบุกจับนายหน้าได้เจ็ดคน คุณได้รางวัลนำจับ และศัตรูที่ไม่รู้ชื่ออีกเจ็ดคน"); } },
      { label: "ลบข้อความทิ้ง", run: () => meh("เบอร์นั้นส่งมาอีกสามครั้ง ครั้งสุดท้ายเป็นแค่อีโมจิรูปตา") },
    ],
  },
  {
    id: "h16.mkt_absorb",
    minAge: 16,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => w(awake(l) && (coresOf(l, 1) + coresOf(l, 2) + coresOf(l, 3) > 0), 6),
    prepare: (l) => ({ t: topTier(l) }),
    title: "กลืนคอร์",
    text: (_l, c) => `กระทู้ลับในเว็บบอร์ด Hunter อ้างว่า "กลืน${CORE_TIERS[T(c)].name}ดิบๆ จะได้พลังของมอนสเตอร์" สมาคมประกาศว่าอันตรายถึงชีวิต แต่คอร์ในมือคุณเต้นเป็นจังหวะเหมือนกำลังเรียก`,
    choices: [
      {
        label: "กลืนมัน",
        tone: "danger",
        odds: (l, c) => 0.55 + l.stats.health / 400 - T(c) * 0.06,
        skill: ["heal"],
        survival: (_l, c) => 0.97 - T(c) * 0.04,
        run: (l, c, ok) => {
          addCores(l, T(c), -1);
          l.flags.coreEaten = Number(l.flags.coreEaten ?? 0) + 1;
          if (ok) {
            gainExp(l, [300, 900, 2500, 6000][T(c)]);
            if (chance(l, [0, 0.12, 0.35, 0.5][T(c)])) luckyRankUp(l, "[ระบบ] ดูดซับแก่นพลังของมอนสเตอร์สำเร็จ");
            return big("ความร้อนแผ่ไปทั่วเส้นเลือด คุณได้ยินเสียงคำรามของมอนสเตอร์ตัวนั้นในหัว… แล้วมันก็กลายเป็นเสียงของคุณเอง");
          }
          if (chance(l, 0.04 + T(c) * 0.04)) { kill(l, "กลืนคอร์มอนสเตอร์แล้วร่างกายรับไม่ไหว"); return bad("มานาของมอนสเตอร์กัดกินคุณจากข้างใน…"); }
          return bad("คุณอาเจียนเป็นสีม่วงทั้งคืน หมอที่สมาคมส่ายหัว \"นึกว่าจะฉลาดกว่านี้\"" + hurt(l, 10, 25, "กลืนคอร์มอนสเตอร์แล้วร่างกายรับไม่ไหว"));
        },
      },
      { label: "เก็บไว้ขาย ฉันยังรักตับ", run: () => meh("คุณวางคอร์กลับลงกล่องตะกั่ว เสียงเต้นค่อยๆ เงียบลง") },
    ],
  },
  {
    id: "h16.mkt_smith",
    minAge: 18,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => w(awake(l) && (coresOf(l, 1) + coresOf(l, 2) > 0), 6),
    prepare: (l) => ({ t: coresOf(l, 2) > 0 ? 2 : 1 }),
    text: (_l, c) => `ช่างตีเหล็กตาบอดข้างหนึ่งในตรอกเยาวราชลูบ${CORE_TIERS[T(c)].name}ของคุณ "ให้ข้าเก็บก้อนนี้ไว้ แล้วข้าจะตีอาวุธที่มีวิญญาณของมันให้ ไม่คิดค่าแรง"`,
    choices: [
      {
        label: "แลก",
        run: (l, c) => {
          addCores(l, T(c), -1);
          const item = T(c) >= 2 ? pick(l, ["ดาบเขี้ยวเลือด", "ถุงมือหัวใจลาวา", "ธนูเงาสีชาด"]) : pick(l, ["มีดสั้นสีคราม", "โล่เกล็ดน้ำแข็ง", "สนับมือฟ้าผ่า"]);
          l.power?.items.push(item);
          return good(`สามวันต่อมา「${item}」วางอยู่บนโต๊ะ มันอุ่นเหมือนมีชีวิต`);
        },
      },
      { label: "ไม่ไว้ใจ", run: () => meh("ช่างแก่หัวเราะ \"ไม่เป็นไร คอร์ก้อนนั้นจะกลับมาหาข้าเอง\" …น่าขนลุกนิดหน่อย") },
    ],
  },
  {
    id: "h16.mkt_lab",
    minAge: 18,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => w(holding(l), 5),
    prepare: (l) => ({ t: topTier(l) }),
    text: (_l, c) => `ศาสตราจารย์จากสถาบันวิจัยมานาแห่งชาติขอยืม${CORE_TIERS[T(c)].name}หนึ่งก้อนไปศึกษา "เราอาจรู้ได้ว่าทำไม Gate ถึงเปิด ถ้ามีตัวอย่างที่ยังสด"`,
    choices: [
      { label: "ให้ฟรีเพื่อวิทยาศาสตร์", run: (l, c) => { addCores(l, T(c), -1); addFame(l, 4); l.flags.labDonor = true; addStat(l, "smarts", 2); return good("งานวิจัยตีพิมพ์ปีถัดมา มีชื่อคุณในกิตติกรรมประกาศ และคำอธิบายว่าคอร์ \"จำ\" โลกที่มันจากมาได้"); } },
      { label: "ขายให้ในราคาตลาด", run: (l, c) => sellCores(l, T(c), 1) },
      { label: "ปฏิเสธ", run: () => meh("ศาสตราจารย์ถอนหายใจแล้วไปเคาะประตู Hunter คนถัดไป") },
    ],
  },
  {
    id: "h16.mkt_theft",
    minAge: 18,
    maxAge: 100,
    maxTimes: 2,
    weight: (l) => w(totalCores(l) >= 3, 6),
    prepare: (l) => ({ t: topTier(l) }),
    text: () => "กลับถึงบ้านตอนตีหนึ่ง ประตูถูกงัด กล่องตะกั่วที่เก็บคอร์ถูกเปิดทิ้งไว้กลางห้อง… ยังได้ยินเสียงฝีเท้าบนหลังคา",
    choices: [
      {
        label: "ไล่ตามขึ้นหลังคา",
        check: { stat: "health", dc: 50, bonus: (l) => (l.power ? 0.2 : 0) },
        skill: ["combat", "escape"],
        run: (l, c, ok) => {
          if (ok) { addStat(l, "happiness", 4); return good("คุณทันมันที่หลังคาตึกที่สาม หัวขโมยเป็นเด็กฝึกงานของบริษัทขนย้ายที่คุณเคยจ้าง คอร์กลับมาครบทุกก้อน"); }
          const lost = Math.ceil(coresOf(l, T(c)) / 2);
          addCores(l, T(c), -lost);
          return bad(`มันกระโดดข้ามตึกที่คุณกระโดดไม่ได้ ${CORE_TIERS[T(c)].name}หายไป ${lost} ก้อน`);
        },
      },
      {
        label: "แจ้งตำรวจ",
        run: (l, c) => {
          const lost = Math.ceil(coresOf(l, T(c)) / 2);
          addCores(l, T(c), -lost);
          if (chance(l, 0.4)) { addCores(l, T(c), 1); return meh(`ตำรวจตามคืนมาได้หนึ่งก้อนจากร้านรับซื้อของเก่า ที่เหลือหายไปกับสายลม`); }
          return bad(`ตำรวจจดบันทึกอย่างตั้งใจ แล้วก็ไม่มีข่าวอีกเลย ${CORE_TIERS[T(c)].name}หายไป ${lost} ก้อน`);
        },
      },
    ],
  },
  {
    id: "h16.mkt_vault",
    minAge: 20,
    maxAge: 100,
    weight: (l) => w(totalCores(l) >= 4 && !l.flags.coreVault, 6),
    text: (l) => `ธนาคารเปิดบริการตู้นิรภัยกันมานาสำหรับเก็บคอร์ ค่าบริการปีละ ${money(l, 120_000)} "กันขโมย กันรังสีมานารั่ว กันแมวคาบไป"`,
    choices: [
      { label: "เช่า", run: (l) => { addMoney(l, -120_000); l.flags.coreVault = true; return good("ตู้นิรภัยหนาสามสิบเซนติเมตร พนักงานยิ้มให้เหมือนคุณเป็นมหาเศรษฐี"); } },
      { label: "เก็บใต้เตียงต่อไป", run: () => meh("กล่องตะกั่วใต้เตียงเรืองแสงจางๆ ตอนกลางคืน เป็นไฟกลางคืนที่แพงที่สุดในโลก") },
    ],
  },
  {
    id: "h16.mkt_startup",
    minAge: 20,
    maxAge: 80,
    weight: (l) => w(coresOf(l, 1) + coresOf(l, 2) >= 2 && !l.flags.coreStartup, 5),
    text: () => "สตาร์ตอัปรถยนต์พลังคอร์ขอแลกคอร์ของคุณกับหุ้นบริษัท \"อีกห้าปี รถทุกคันบนถนนจะวิ่งด้วยคอร์ คุณจะเป็นผู้ถือหุ้นรุ่นแรก!\" ซีอีโออายุ 23 ใส่รองเท้าแตะมาประชุม",
    choices: [
      { label: "แลกคอร์สองก้อนกับหุ้น", run: (l) => { const t = coresOf(l, 2) > 0 ? 2 : 1; addCores(l, t, -Math.min(2, coresOf(l, t))); l.flags.coreStartup = l.age; l.flags.coreStartupTier = t; return meh("คุณได้ใบหุ้นสวยงามหนึ่งแผ่น และคำสัญญาว่าจะได้นั่งรถต้นแบบเป็นคนแรก"); } },
      { label: "ปฏิเสธ", run: () => meh("ซีอีโอยักไหล่ \"เดี๋ยวคุณก็เห็น\"") },
    ],
  },
  {
    id: "h16.mkt_startup_pay",
    minAge: 25,
    maxAge: 100,
    weight: (l) => w(!!l.flags.coreStartup && l.age - Number(l.flags.coreStartup) >= 4, 40),
    text: () => "ข่าวด่วนจากสตาร์ตอัปรถพลังคอร์ที่คุณถือหุ้น…",
    auto: (l) => {
      const t = Number(l.flags.coreStartupTier ?? 1);
      delete l.flags.coreStartup;
      if (chance(l, 0.4)) {
        const got = CORE_TIERS[t].base * randInt(l, 8, 20);
        addMoney(l, got);
        l.flags.startupWin = true;
        l.log.push({ age: l.age, text: `🚗 บริษัทเข้าตลาดหลักทรัพย์! หุ้นของคุณขายได้ ${money(l, got)} ซีอีโอยังใส่รองเท้าแตะเหมือนเดิม`, kind: "good" });
        return "good";
      }
      l.log.push({ age: l.age, text: "🚗 รถต้นแบบระเบิดกลางงานเปิดตัว บริษัทล้มละลายในสองสัปดาห์ ใบหุ้นของคุณกลายเป็นที่รองแก้วกาแฟ", kind: "bad" });
      return "bad";
    },
  },
  {
    id: "h16.mkt_overseas",
    minAge: 20,
    maxAge: 110,
    maxTimes: 2,
    weight: (l) => w(coresOf(l, 3) > 0, 20),
    text: (l) => `เศรษฐีน้ำมันจากตะวันออกกลางส่งเครื่องบินส่วนตัวมารับคุณ "ข้าสะสมคอร์มังกร ขอซื้อก้อนของท่าน ราคา ${money(l, corePrice(l, 3) * 2)}" — สองเท่าของราคาตลาด`,
    choices: [
      { label: "ขาย", run: (l) => { addCores(l, 3, -1); const got = corePrice(l, 3) * 2; addMoney(l, got); l.flags.coreEarned = Number(l.flags.coreEarned ?? 0) + got; return big(`ดีลประวัติศาสตร์! คอร์มังกรของคุณย้ายไปอยู่ในตู้กระจกกันกระสุนกลางทะเลทราย`); } },
      { label: "ขอให้รัฐบาลซื้อไว้เป็นสมบัติชาติแทน", run: (l) => { addCores(l, 3, -1); const got = corePrice(l, 3); addMoney(l, got); addFame(l, 15); return big("คอร์มังกรถูกตั้งแสดงในพิพิธภัณฑ์แห่งชาติ ป้ายใต้ตู้เขียนชื่อคุณตัวใหญ่กว่าชื่อมังกร"); } },
      { label: "ไม่ขาย", run: () => meh("เศรษฐีหัวเราะ \"ข้ารอได้ ข้าอายุยืน\"") },
    ],
  },
  {
    id: "h16.mkt_tax",
    minAge: 22,
    maxAge: 100,
    maxTimes: 2,
    weight: (l) => w(Number(l.flags.coreEarned ?? 0) >= 5_000_000, 5),
    text: () => "กรมสรรพากรส่งจดหมายสีน้ำตาล: \"ขอให้ชี้แจงรายได้จากการขายคอร์มอนสเตอร์ย้อนหลังสามปี\"",
    choices: [
      { label: "จ้างนักบัญชีเก่งๆ", run: (l) => { addMoney(l, -Math.round(Number(l.flags.coreEarned) * 0.03)); return good("นักบัญชีหาค่าลดหย่อนได้ยี่สิบแปดรายการ รวมถึง \"ค่าซักชุดเปื้อนเลือดมอนสเตอร์\""); } },
      { label: "ทำเองตามหลักฐาน", check: { stat: "smarts", dc: 60 }, skill: ["business", "study"], run: (l, _c, ok) => (ok ? good("เอกสารครบทุกใบ เจ้าหน้าที่ประทับตราผ่านแล้วถามว่าคุณรับสอนพิเศษไหม") : (addMoney(l, -Math.round(Number(l.flags.coreEarned) * 0.12)), bad("คุณกรอกช่องผิดสามช่อง เงินเพิ่มและค่าปรับรวมกันเจ็บกว่าโดนมอนสเตอร์กัด"))) },
      { label: "ไม่ตอบ", run: (l) => { addMoney(l, -Math.round(Number(l.flags.coreEarned) * 0.2)); addFame(l, -4); return bad("จดหมายฉบับที่สองเป็นสีแดง ฉบับที่สามมากับเจ้าหน้าที่สองคนและหมายอายัดบัญชี"); } },
    ],
  },
  // ── คนธรรมดากับตลาดคอร์ ──
  {
    id: "h16.mkt_kid_shard",
    minAge: 6,
    maxAge: 14,
    weight: 5,
    text: () => "คุณเจอก้อนหินสีฟ้าเรืองแสงในกองทรายสนามเด็กเล่น หลังมีข่าวเคลียร์ Gate ที่สวนสาธารณะเมื่อเดือนก่อน",
    choices: [
      { label: "เก็บไว้ในกล่องสมบัติ", run: (l) => { addCores(l, 0, 1); addStat(l, "happiness", 6); return good("มันคือเศษคอร์จริงๆ! คุณซ่อนไว้ในกล่องคุกกี้ใต้เตียง เปิดดูทุกคืนก่อนนอน"); } },
      { label: "เอาไปให้ตำรวจ", run: (l) => { addStat(l, "happiness", 3); addFame(l, 1); return good("ตำรวจให้รางวัลเด็กดีเป็นใบประกาศหนึ่งใบกับไอติมหนึ่งแท่ง"); } },
      { label: "เอาไปอวดเพื่อนที่โรงเรียน", run: (l) => { addStat(l, "happiness", 4); if (chance(l, 0.5)) { addCores(l, 0, 1); return meh("ทั้งห้องรุมดู คุณกลายเป็นคนดังประจำชั้นไปหนึ่งสัปดาห์"); } return bad("เพื่อนตัวใหญ่ที่สุดในห้องแย่งไป แล้วบอกว่า \"ใครเจอก่อนไม่สำคัญ ใครถือก่อนสำคัญ\""); } },
    ],
  },
  {
    id: "h16.mkt_sorter",
    minAge: 16,
    maxAge: 25,
    weight: (l) => w(!awake(l), 5),
    text: (l) => `โรงคัดแยกคอร์ของสมาคมรับนักศึกษาทำงานพาร์ทไทม์ ค่าแรงวันละ ${money(l, 800)} ใส่ถุงมือตะกั่วนั่งแยกเศษผลึกตามสีทั้งวัน`,
    choices: [
      { label: "สมัคร", run: (l) => { addMoney(l, 60_000); addStat(l, "health", -2); l.flags.coreEye = true; return good("สามเดือนผ่านไป คุณแยกคอร์ปลอมกับคอร์จริงได้ด้วยการมองแวบเดียว — ทักษะที่ไม่รู้จะใช้ที่ไหน (ยัง)"); } },
      { label: "แอบเก็บเศษผลึกกลับบ้าน", check: { stat: "luck", dc: 55 }, skill: ["stealth"], run: (l, _c, ok) => (ok ? (addCores(l, 0, 2), addMoney(l, 40_000), meh("ไม่มีใครนับเศษเล็กๆ … คุณหวังว่าอย่างนั้น")) : (addFame(l, -2), bad("เครื่องสแกนที่ประตูร้องลั่น คุณโดนไล่ออกตั้งแต่วันที่สาม"))) },
      { label: "ไม่เอา กลัวรังสีมานา", run: () => meh("ป้าที่บ้านบอกว่ารังสีมานาทำให้ผมร่วง คุณเชื่อป้า") },
    ],
  },
  {
    id: "h16.mkt_speculator",
    minAge: 22,
    maxAge: 75,
    maxTimes: 2,
    weight: (l) => w(mundane(l) && l.money >= 200_000, 5),
    text: (l) => `เพื่อนสมัยมหาลัยชวนลงทุนกองทุนคอร์มอนสเตอร์ "ดัชนีตอนนี้ ${marketIndex(l)} เองนะ ปีหน้ามี Gate Break แน่ๆ ข้าได้ข่าววงใน"`,
    choices: [
      {
        label: "ลงสองแสน",
        check: { stat: "luck", dc: 50, bonus: (l) => (marketIndex(l) < 90 ? 0.15 : marketIndex(l) > 140 ? -0.15 : 0) },
        skill: ["business"],
        run: (l, _c, ok) => {
          if (ok) { addMoney(l, 220_000); return good("ปีถัดมาราคาคอร์พุ่งจริง เงินคุณโตเท่าตัว เพื่อนส่งสติกเกอร์ \"บอกแล้ว\" มาสิบสองตัว"); }
          addMoney(l, -150_000);
          return bad("ปีนั้นไม่มี Gate Break สักครั้ง ทั้งประเทศสงบสุข ยกเว้นพอร์ตของคุณ");
        },
      },
      { label: "ไม่เล่น", run: () => meh("\"วงใน\" ของเพื่อนคือลุงที่ขายลอตเตอรี่หน้าสมาคม") },
    ],
  },
  {
    id: "h16.mkt_fake",
    minAge: 18,
    maxAge: 80,
    maxTimes: 2,
    weight: 4,
    text: (l) => `แผงลอยในตลาดนัดขาย "คอร์สีครามแท้ ก้อนละ ${money(l, 15_000)}" — ราคาถูกกว่าตลาดสี่สิบเท่า คนมุงซื้อกันแน่น`,
    choices: [
      {
        label: "ตรวจดูให้ดีก่อนซื้อ",
        check: { stat: "smarts", dc: 50, bonus: (l) => (l.flags.coreEye ? 0.35 : l.power ? 0.15 : 0) },
        skill: ["business", "study"],
        run: (l, _c, ok) => {
          if (ok && chance(l, 0.15)) { addMoney(l, -15_000); addCores(l, 1, 1); return big("ในกองแก้วย้อมสี มีก้อนหนึ่งที่เต้นเป็นจังหวะ คุณจ่ายเงินหนึ่งหมื่นห้าแล้วเดินออกมาเงียบๆ พร้อมคอร์สีครามของจริง"); }
          if (ok) { addFame(l, 1); return good("แก้วย้อมสีทั้งแผง! คุณเตือนคนที่มุงอยู่ พ่อค้าเก็บแผงหนีภายในสามนาที"); }
          addMoney(l, -15_000);
          return bad("ก้อน \"คอร์\" ที่คุณซื้อมาละลายสีติดมือตอนล้าง");
        },
      },
      { label: "เดินผ่าน", run: () => meh("ของถูกและดีไม่มีในโลก โดยเฉพาะในโลกที่มีมอนสเตอร์") },
    ],
  },
  {
    id: "h16.mkt_hoarder",
    minAge: 20,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => w(isHunter(l) && totalCores(l) >= 3, 5),
    text: () => "ข่าวลือหนาหูว่ากิลด์ใหญ่แห่งหนึ่งกักตุนคอร์ไว้เป็นพันก้อน รอปั่นราคาให้พุ่งก่อนเทขายทีเดียว ในห้องแชต Hunter อิสระ มีคนเสนอให้ทุกคน \"เทขายพร้อมกันวันศุกร์ ทุบราคาให้มันเจ็บ\"",
    choices: [
      { label: "เข้าร่วม — เทขายวันศุกร์", run: (l) => { l.flags.coreMkt = Math.max(30, marketIndex(l) - 25); const o = sellAllCores(l); addFame(l, 3); return { ...o, text: `${o.text} — ราคาร่วงจนกิลด์ใหญ่ต้องออกแถลงการณ์ Hunter อิสระทั้งประเทศฉลองกันในห้องแชต` }; } },
      { label: "ขายให้กิลด์นั้นก่อนวันศุกร์ (หักหลังห้องแชต)", run: (l) => { const o = sellAllCores(l); addFame(l, -4); return { ...o, text: `${o.text} — แล้วชื่อคุณก็ถูกเตะออกจากห้องแชตพร้อมแคปหน้าจอ` }; } },
      { label: "ไม่ยุ่ง", run: () => meh("คุณออกจากห้องแชตเงียบๆ ก่อนจะมีใครถามว่าคุณมีคอร์กี่ก้อน") },
    ],
  },
  {
    id: "h16.mkt_heirloom",
    minAge: 55,
    maxAge: 110,
    maxTimes: 1,
    weight: (l) => w(totalCores(l) >= 2, 8),
    text: () => "คุณนั่งนับคอร์ที่สะสมมาทั้งชีวิตในกล่องตะกั่ว แต่ละก้อนมีเรื่องเล่า — Gate ที่เกือบตาย บอสที่ล้มได้ คืนที่ฝนตก",
    choices: [
      { label: "แบ่งให้ลูกหลานเป็นมรดก", run: (l) => { for (let i = 0; i < 4; i++) addCores(l, i, -coresOf(l, i)); l.flags.coreHeirloom = true; addStat(l, "happiness", 10); addFame(l, 1); return good("คุณเขียนชื่อหลานแต่ละคนบนกล่องเล็ก แล้วเล่าเรื่องของคอร์แต่ละก้อนให้ฟังจนดึก"); } },
      { label: "ขายทั้งหมดแล้วเที่ยวรอบโลก", run: (l) => { const o = sellAllCores(l); addStat(l, "happiness", 10); return { ...o, text: `${o.text} — แล้วซื้อตั๋วเครื่องบินชั้นหนึ่งใบแรกในชีวิต` }; } },
      { label: "เก็บไว้ดูเล่น", run: (l) => { addStat(l, "happiness", 3); return meh("แสงจางๆ ของมันทำให้ห้องนอนอุ่นขึ้นเหมือนสมัยยังหนุ่มสาว"); } },
    ],
  },
];
