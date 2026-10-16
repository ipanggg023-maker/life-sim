import type { GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import { addFame, addMoney, addStat, clamp, createPerson, formatMoney, people, shortName } from "../../../engine/util";
import type { Life } from "../../../engine/types";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const single = (l: Life) => !people(l, "partner").length && !people(l, "spouse").length;
const employed = (l: Life) => !!l.job;

export const ADULT_EVENTS: GameEvent[] = [
  {
    id: "adult.toxic_boss",
    minAge: 18,
    maxAge: 60,
    weight: (l) => (employed(l) ? 10 : 0),
    maxTimes: 2,
    text: () => "หัวหน้าตะคอกใส่คุณกลางห้องประชุมเพราะความผิดที่คุณไม่ได้ทำ",
    choices: [
      {
        label: "เถียงกลับพร้อมหลักฐาน",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { l.job!.performance = clamp(l.job!.performance + 15, 0, 100); return good("ทั้งห้องเงียบ หัวหน้าต้องขอโทษต่อหน้าทุกคน ผู้บริหารเริ่มสังเกตคุณ"); }
          l.job!.performance = clamp(l.job!.performance - 15, 0, 100); return bad("หลักฐานคุณไม่แน่นพอ หัวหน้าจดชื่อคุณไว้ในใจ");
        },
      },
      { label: "ก้มหน้ารับ", run: (l) => { addStat(l, "happiness", -8); return meh("คุณกลับบ้านไปร้องไห้ในห้องน้ำ"); } },
      { label: "ลาออกเดี๋ยวนั้น!", run: (l) => { l.job = undefined; addStat(l, "happiness", 6); return meh("คุณวางบัตรพนักงานบนโต๊ะแล้วเดินออกไปแบบในซีรีส์"); } },
    ],
  },
  {
    id: "adult.scam_call",
    minAge: 18,
    maxAge: 90,
    weight: (l) => (l.age > 55 ? 12 : 6),
    maxTimes: 2,
    text: () => "\"สวัสดีค่ะ ติดต่อจากกรมศุลกากร พัสดุของคุณมียาเสพติด กรุณาโอนเงินเพื่อตรวจสอบ...\"",
    choices: [
      { label: "วางสาย", run: () => good("คุณวางสายแล้วบล็อกเบอร์ทันที") },
      {
        label: "ทำตามที่เขาบอก",
        check: { stat: "smarts", dc: 60 },
        run: (l, _c, ok) => {
          if (ok) return good("กลางสาย คุณรู้ตัวว่าโดนหลอก แล้ววางทันก่อนโอน");
          const lost = Math.max(5000, Math.round(Math.max(0, l.money) * 0.3));
          addMoney(l, -lost); addStat(l, "happiness", -15);
          return bad(`คุณโดนแก๊งคอลเซ็นเตอร์หลอกไป ${formatMoney(lost)}`);
        },
      },
      { label: "แกล้งคุยยาวๆ ให้เสียเวลา", run: (l) => { addStat(l, "happiness", 5); return good("คุณคุยกับมิจฉาชีพ 40 นาทีจนเขาวางสายเอง"); } },
    ],
  },
  {
    id: "adult.lottery_dream",
    minAge: 20,
    maxAge: 90,
    weight: 6,
    maxTimes: 2,
    prepare: (l) => ({ num: String(randInt(l, 0, 999999)).padStart(6, "0") }),
    text: (_l, c) => `คุณฝันเห็นงูใหญ่สีทองกระซิบเลข ${c.num} ตื่นมาเหงื่อแตก`,
    choices: [
      {
        label: "ซื้อลอตเตอรี่เลขนี้ 10 ใบ",
        run: (l) => {
          addMoney(l, -1000);
          // แจ็กพอตต้องหายากกว่าพื้น 5% ของ checkChance — ดวงดีมากก็ได้แค่ ~1%
          if (chance(l, 0.002 + Math.max(0, l.stats.luck - 60) / 4000)) { addMoney(l, 60_000_000); addStat(l, "happiness", 30); addFame(l, 10); return { text: "💰💰💰 ถูกรางวัลที่ 1 สิบใบ! 60 ล้านบาท! ญาติที่ไม่เคยเห็นหน้าโผล่มาเพียบ", kind: "milestone" }; }
          return meh("ไม่ถูกเลยสักตัว งูในฝันคงล้อเล่น");
        },
      },
      { label: "เรื่องงมงาย ไม่ซื้อ", run: () => meh("เย็นนั้นคุณไม่กล้าเปิดดูผลหวย") },
    ],
  },
  {
    id: "adult.relatives_ask",
    minAge: 25,
    maxAge: 45,
    weight: (l) => (single(l) ? 12 : 0),
    maxTimes: 3,
    text: () => "งานรวมญาติช่วงสงกรานต์ ป้าข้างบ้านถามเสียงดังว่า \"เมื่อไหร่จะแต่งงานซักทีล่ะลูก อายุก็ไม่ใช่น้อยแล้วนะ\"",
    choices: [
      { label: "ยิ้มแล้วตอบว่า \"เร็วๆ นี้ค่ะ/ครับ\"", run: (l) => { addStat(l, "happiness", -2); return meh("ป้าพยักหน้าพอใจ ข่าวลือกระจายไปทั้งซอย"); } },
      { label: "\"แล้วเมื่อไหร่ป้าจะใช้หนี้แม่หนูล่ะ\"", run: (l) => { addStat(l, "happiness", 8); for (const p of l.people) if (p.relation === "mother") p.bond = clamp(p.bond - 5, 0, 100); return good("ทั้งวงข้าวเงียบกริบ ป้าไม่ถามอีกเลยตลอดชีวิต"); } },
      { label: "ขอให้ป้าแนะนำคนให้", run: (l) => {
        if (chance(l, 0.5)) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -3, 3), bond: 50 }); return good(`ป้าแนะนำ${shortName(p)}ให้ ไปกินข้าวด้วยกันแล้วคุยถูกคอ!`); }
        return bad("คนที่ป้าแนะนำคุยเรื่องขายตรงทั้งมื้อ");
      } },
    ],
  },
  {
    id: "adult.friend_borrow",
    minAge: 20,
    maxAge: 70,
    weight: (l) => (people(l, "friend").length && l.money > 20000 ? 8 : 0),
    maxTimes: 2,
    prepare: (l) => {
      const f = pick(l, people(l, "friend"));
      return { id: f.id, name: shortName(f), amt: randInt(l, 2, 10) * 10000 };
    },
    text: (_l, c) => `${c.name}ทักมาขอยืมเงิน ${formatMoney(Number(c.amt))} "เดือนหน้าคืนแน่นอน สาบานเลย"`,
    choices: [
      {
        label: "ให้ยืม",
        check: { stat: "luck", dc: 55 },
        run: (l, c, ok) => {
          const f = l.people.find((p) => p.id === c.id);
          if (ok) { if (f) f.bond = clamp(f.bond + 15, 0, 100); return good(`${c.name}คืนเงินครบพร้อมขนมหนึ่งกล่อง`); }
          addMoney(l, -Number(c.amt)); if (f) f.bond = clamp(f.bond - 20, 0, 100);
          return bad(`${c.name}อ่านไลน์แต่ไม่ตอบอีกเลย เงินหายไป ${formatMoney(Number(c.amt))}`);
        },
      },
      { label: "ปฏิเสธ", run: (l, c) => { const f = l.people.find((p) => p.id === c.id); if (f) f.bond = clamp(f.bond - 10, 0, 100); return meh(`${c.name}ส่งสติกเกอร์ยิ้มมาแบบแห้งๆ`); } },
    ],
  },
  {
    id: "adult.stray_cat",
    minAge: 6,
    maxAge: 85,
    weight: (l) => (l.flags.cat ? 0 : 5),
    text: () => "ลูกแมวส้มตัวผอมเดินตามคุณกลับบ้าน ร้องเหมียวๆ ไม่หยุด",
    choices: [
      { label: "รับเลี้ยง", run: (l) => { l.flags.cat = true; addStat(l, "happiness", 12); return good("คุณตั้งชื่อมันว่า \"ส้มตำ\" มันกลายเป็นเจ้านายของบ้านในสัปดาห์เดียว"); } },
      { label: "ให้อาหารแล้วปล่อยไป", run: (l) => { addStat(l, "happiness", 2); return meh("มันกินเสร็จแล้วเดินจากไปโดยไม่หันกลับมามอง"); } },
    ],
  },
  {
    id: "adult.viral",
    minAge: 15,
    maxAge: 60,
    weight: 5,
    maxTimes: 2,
    text: () => "คลิปที่คุณโพสต์เล่นๆ เริ่มมียอดวิวพุ่งขึ้นเรื่อยๆ",
    choices: [
      {
        label: "ทำคลิปต่อทันที",
        check: { stat: "looks", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 12); addStat(l, "happiness", 8); return good("คุณกลายเป็นอินฟลูเอนเซอร์หน้าใหม่ แบรนด์เริ่มทักมา"); }
          addFame(l, -4); return bad("คลิปที่สองโดนทัวร์ลงเพราะพูดผิดคำเดียว");
        },
      },
      { label: "ปล่อยไป ไม่อยากดัง", run: () => meh("ยอดวิวค่อยๆ หยุดนิ่ง ชีวิตกลับมาสงบ") },
    ],
  },
  {
    id: "adult.car_loan",
    minAge: 23,
    maxAge: 50,
    weight: (l) => (employed(l) && !l.flags.car ? 7 : 0),
    text: () => "เซลส์รถยิ้มหวาน \"ดาวน์ศูนย์บาท ผ่อนสบายๆ 84 เดือนครับพี่\"",
    choices: [
      { label: "ออกรถใหม่", run: (l) => { l.flags.car = true; l.debt += 700_000; addStat(l, "happiness", 12); return good("กลิ่นรถใหม่หอมมาก... หนี้ก็หอมเหมือนกัน (+฿700,000)"); } },
      { label: "ซื้อรถมือสองเงินสด", run: (l) => { if (l.money < 200_000) return bad("เงินไม่พอ คุณเดินกลับบ้าน"); l.flags.car = true; addMoney(l, -200_000); addStat(l, "happiness", 6); return meh("รถเก่าหน่อยแต่ไม่มีหนี้"); } },
      { label: "นั่งรถไฟฟ้าต่อไป", run: () => meh("คุณรอดพ้นจากหนี้ไปอีกปี") },
    ],
  },
  {
    id: "adult.condo",
    minAge: 25,
    maxAge: 55,
    weight: (l) => (employed(l) && !l.flags.home ? 6 : 0),
    text: () => "คอนโดใหม่ติดรถไฟฟ้าเปิดจอง \"ราคาพิเศษเฉพาะวันนี้ 3.2 ล้าน\"",
    choices: [
      { label: "กู้ซื้อ", check: { stat: "smarts", dc: 40 }, run: (l, _c, ok) => {
        if (!ok) return bad("ธนาคารไม่อนุมัติสินเชื่อ");
        l.flags.home = true; l.debt += 3_200_000; addStat(l, "happiness", 15);
        return good("🏠 คุณมีบ้านเป็นของตัวเองแล้ว! (หนี้ +฿3,200,000)");
      } },
      { label: "ซื้อเงินสด", show: (l) => l.money >= 3_200_000, run: (l) => { l.flags.home = true; addMoney(l, -3_200_000); addStat(l, "happiness", 18); return good("🏠 คุณจ่ายเงินสดก้อนเดียว เซลส์อ้าปากค้าง"); } },
      { label: "เช่าต่อไป", run: () => meh("คุณปิดโบรชัวร์แล้วกลับห้องเช่า") },
    ],
  },
  {
    id: "adult.food_poison",
    minAge: 8,
    maxAge: 90,
    weight: 5,
    maxTimes: 2,
    text: () => "ส้มตำปูปลาร้าร้านใหม่ปากซอยทำคุณท้องเสียหนักจนต้องให้น้ำเกลือ",
    auto: (l) => { addStat(l, "health", -randInt(l, 4, 9)); return "bad"; },
  },
  {
    id: "adult.temple_fair",
    minAge: 5,
    maxAge: 80,
    weight: 5,
    text: () => "งานวัดประจำปี! มีซุ้มปาเป้าที่รางวัลใหญ่เป็นตุ๊กตาหมีตัวเท่าคน",
    choices: [
      { label: "ปาเป้า", check: { stat: "luck", dc: 60 }, run: (l, _c, ok) => {
        if (ok) { addStat(l, "happiness", 8); return good("ลูกโป่งแตกสามลูกติด! คุณแบกหมียักษ์กลับบ้าน"); }
        addMoney(l, -100); return meh("ปาไปสิบลูก ได้พวงกุญแจมาหนึ่งอัน");
      } },
      { label: "ไปดูลิเก", run: (l) => { addStat(l, "happiness", 5); return meh("พระเอกลิเกส่งยิ้มให้คุณ (หรือให้ป้าข้างหลัง)"); } },
    ],
  },
  {
    id: "adult.partner_cheat",
    minAge: 16,
    maxAge: 70,
    weight: (l) => (people(l, "partner").length || people(l, "spouse").length ? 4 : 0),
    maxTimes: 1,
    prepare: (l) => {
      const p = people(l, "spouse")[0] ?? people(l, "partner")[0];
      return { id: p.id, name: shortName(p) };
    },
    text: (_l, c) => `คุณเห็นแชตหวานๆ ในมือถือของ${c.name}กับคนที่คุณไม่รู้จัก`,
    choices: [
      { label: "เผชิญหน้าทันที", check: { stat: "smarts", dc: 50 }, run: (l, c, ok) => {
        const p = l.people.find((x) => x.id === c.id);
        if (ok) { if (p) p.bond = clamp(p.bond + 10, 0, 100); return good(`ที่แท้เป็นแชตกับพี่สาวที่ช่วยวางแผนเซอร์ไพรส์วันเกิดให้คุณ ${c.name}โกรธที่คุณไม่ไว้ใจ แต่ก็ให้อภัย`); }
        l.people = l.people.filter((x) => x.id !== c.id); addStat(l, "happiness", -20);
        return bad(`${c.name}ยอมรับว่านอกใจ ความสัมพันธ์จบลงตรงนั้น`);
      } },
      { label: "แกล้งทำเป็นไม่เห็น", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond - 15, 0, 100); addStat(l, "happiness", -10); return bad("ความสงสัยกัดกินใจคุณทุกคืน"); } },
    ],
  },
  {
    id: "adult.parent_sick",
    minAge: 22,
    maxAge: 75,
    weight: (l) => (l.people.some((p) => (p.relation === "father" || p.relation === "mother") && p.alive && p.age > 58) ? 7 : 0),
    maxTimes: 2,
    prepare: (l) => {
      const p = pick(l, l.people.filter((x) => (x.relation === "father" || x.relation === "mother") && x.alive && x.age > 58));
      return { id: p.id, name: p.relation === "father" ? "พ่อ" : "แม่", cost: randInt(l, 10, 40) * 10000 };
    },
    text: (_l, c) => `${c.name}ล้มป่วยหนัก หมอบอกว่าต้องผ่าตัด ค่าใช้จ่าย ${formatMoney(Number(c.cost))}`,
    choices: [
      { label: "จ่ายค่ารักษาทั้งหมด", run: (l, c) => { addMoney(l, -Number(c.cost)); const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 20, 0, 100); return good(`การผ่าตัดสำเร็จ ${c.name}กุมมือคุณไว้แน่น`); } },
      { label: "ใช้สิทธิ์บัตรทอง", run: (l, c) => {
        const p = l.people.find((x) => x.id === c.id);
        if (chance(l, 0.6)) return meh(`ต้องรอคิวนานหน่อย แต่${c.name}ก็หายดี`);
        if (p) { p.alive = false; } addStat(l, "happiness", -25);
        return bad(`คิวผ่าตัดยาวเกินไป ${c.name}จากไปก่อนถึงคิว`);
      } },
    ],
  },
  {
    id: "adult.reunion",
    minAge: 30,
    maxAge: 75,
    weight: 5,
    maxTimes: 2,
    text: () => "งานเลี้ยงรุ่น! ทุกคนอวดตำแหน่ง รถ และลูกกันสนั่น",
    choices: [
      { label: "อวดกลับให้หนัก", check: { stat: "looks", dc: 50, bonus: (l) => (l.money > 1_000_000 ? 0.2 : 0) }, run: (l, _c, ok) => ok ? (addStat(l, "happiness", 10), good("คุณคือดาวเด่นของงาน คนที่เคยแกล้งคุณตอนเด็กหน้าซีด")) : (addStat(l, "happiness", -6), bad("คุณโม้ผิดจังหวะ ทุกคนมองหน้ากันเงียบๆ")) },
      { label: "ไปนั่งกินเงียบๆ", run: (l) => { const f = createPerson(l, "friend", { age: l.age, bond: 45 }); return meh(`คุณได้คุยกับ${shortName(f)}ที่ไม่เคยสนิทกัน กลายเป็นคุยถูกคอ`); } },
    ],
  },
  {
    id: "adult.health_scare",
    minAge: 40,
    maxAge: 90,
    weight: (l) => (l.stats.health < 60 ? 10 : 4),
    maxTimes: 2,
    text: () => "หมอตรวจสุขภาพประจำปีแล้วเงยหน้ามองคุณนานผิดปกติ \"ความดันกับไขมันสูงมากนะครับ\"",
    choices: [
      { label: "เปลี่ยนชีวิต ออกกำลังกาย กินคลีน", run: (l) => { addStat(l, "health", randInt(l, 6, 12)); addStat(l, "happiness", -3); return good("สามเดือนผ่านไป ค่าเลือดดีขึ้นจนหมอชม"); } },
      { label: "ชีวิตสั้น กินให้สุด", run: (l) => { addStat(l, "health", -randInt(l, 5, 10)); addStat(l, "happiness", 5); return bad("หมูกระทะยังอร่อยเหมือนเดิม ร่างกายคุณไม่เห็นด้วย"); } },
    ],
  },
  {
    id: "adult.midlife",
    minAge: 40,
    maxAge: 52,
    weight: 6,
    text: () => "คุณตื่นมาตอนตีสามแล้วคิดว่า \"ชีวิตฉันได้ทำอะไรบ้าง?\"",
    choices: [
      { label: "ซื้อบิ๊กไบค์", run: (l) => { addMoney(l, -450_000); addStat(l, "happiness", 12); if (chance(l, 0.1)) { addStat(l, "health", -25); return bad("คุณล้มบนทางด่วนตั้งแต่สัปดาห์แรก รอดมาได้แบบหวุดหวิด"); } return good("ลมตีหน้าบนถนนเลียบทะเล คุณรู้สึกอายุ 20 อีกครั้ง"); } },
      { label: "ลงคอร์สเรียนอะไรใหม่ๆ", run: (l) => { addStat(l, "smarts", 4); addStat(l, "happiness", 6); return good("คุณเริ่มเรียนวาดรูปสีน้ำ และพบว่ามีพรสวรรค์ที่ไม่เคยรู้"); } },
      { label: "นอนต่อ", run: () => meh("ตื่นมาก็ลืมไปแล้วว่าคิดอะไร") },
    ],
  },
  {
    id: "adult.grandkid",
    minAge: 45,
    maxAge: 95,
    weight: (l) => (people(l, "child").some((c) => c.age >= 22) ? 6 : 0),
    maxTimes: 3,
    prepare: (l) => ({ name: shortName(pick(l, people(l, "child").filter((c) => c.age >= 22))) }),
    text: (_l, c) => `${c.name}พาหลานคนใหม่มาให้คุณอุ้ม ตัวเล็กนิดเดียว`,
    auto: (l) => { addStat(l, "happiness", 15); return "good"; },
  },
  {
    id: "adult.retire_trip",
    minAge: 60,
    maxAge: 85,
    weight: (l) => (l.money > 300_000 ? 6 : 0),
    text: () => "เพื่อนวัยเกษียณชวนไปเที่ยวญี่ปุ่นดูใบไม้เปลี่ยนสี",
    choices: [
      { label: "ไปเลย!", run: (l) => { addMoney(l, -80_000); addStat(l, "happiness", 14); return good("คุณถ่ายรูปไปสองพันรูป ส่งเข้ากลุ่มไลน์ครอบครัววันละร้อย"); } },
      { label: "อยู่บ้านเลี้ยงหลาน", run: (l) => { addStat(l, "happiness", 4); return meh("หลานวิ่งรอบบ้านทั้งวัน คุณเหนื่อยแต่มีความสุข"); } },
    ],
  },
  {
    id: "adult.flood",
    minAge: 5,
    maxAge: 90,
    weight: 3,
    text: () => "ฝนตกหนักทั้งคืน กรุงเทพฯ น้ำท่วมถึงเอว น้ำไหลเข้าบ้านคุณ",
    choices: [
      { label: "ขนของขึ้นที่สูง", check: { stat: "health", dc: 45 }, run: (l, _c, ok) => ok ? good("คุณกู้ของมีค่าไว้ได้เกือบหมด") : (addMoney(l, -30_000), bad("ของเสียหายไปเยอะ")) },
      { label: "ช่วยเพื่อนบ้านก่อน", run: (l) => { addMoney(l, -40_000); addFame(l, 3); addStat(l, "happiness", 6); return good("ทั้งซอยรู้จักคุณในฐานะฮีโร่น้ำท่วม"); } },
    ],
  },
  {
    id: "adult.wrong_place",
    minAge: 18,
    maxAge: 70,
    weight: 2,
    text: () => "คุณขับรถกลับบ้านดึก ฝนตกหนัก ถนนมืดสนิท รถพ่วงคันใหญ่ส่ายไปมาอยู่ข้างหน้า",
    choices: [
      {
        label: "เร่งแซง",
        tone: "danger",
        check: { stat: "luck", dc: 45 },
        survival: (l) => Math.min(0.95, 0.55 + (l.stats.luck - 50) / 200),
        run: (l, _c, ok) => {
          if (ok) return good("คุณแซงผ่านไปได้ หัวใจแทบหลุดออกจากอก");
          if (chance(l, 0.5)) { kill(l, "อุบัติเหตุรถชนบนถนนมืด"); return bad("ไฟหน้ารถสาดเข้าตา... ทุกอย่างดับวูบ"); }
          addStat(l, "health", -35); return bad("รถคุณหมุนคว้างตกข้างทาง คุณรอดมาได้แต่ต้องนอนโรงพยาบาลนานหลายเดือน");
        },
      },
      { label: "ชะลอ ขับตามไปเรื่อยๆ", run: () => meh("คุณถึงบ้านช้ากว่าเดิมครึ่งชั่วโมง") },
    ],
  },
];
