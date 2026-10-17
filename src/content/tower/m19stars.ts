// M19 — ดวงดาวและโต๊ะพนัน: เดิมพันระยะยาว · แทงสวนตัวเอง · ล้มโต๊ะ · สงครามระหว่างดวงดาว
import type { GameEvent } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, money } from "../../engine/util";
import { fightOdds, gainExp, luckyRankUp, survivalOdds } from "../hunter/power";
import { SPONSORS, sponsorOf } from "../sponsors";
import { floorCap } from "./climb";
import { longBets, rivalGrudge, rivalStar, saveBets, stakeOf, team, updateMate, wagerStats } from "./m19sys";
import { bad, big, climbing, flagN, floor, foe, good, hurt, meh } from "./m19util";

const starry = (l: Life) => climbing(l) && floor(l) >= 5;
const sp = (l: Life) => sponsorOf(l);

function offerLongBet(l: Life, star: string, plus: number, years: number, pay: number) {
  const stake = Math.min(stakeOf(l), Math.max(0, l.money));
  addMoney(l, -stake);
  const target = Math.min(100, floor(l) + plus);
  saveBets(l, [...longBets(l), { star, floor: target, by: l.age + years, stake, pay }]);
  return { target, stake };
}

export const M19_STARS: GameEvent[] = [
  {
    id: "t19.s.long_bet",
    minAge: 12,
    maxAge: 80,
    maxTimes: 4,
    weight: (l) => (starry(l) && longBets(l).length < 2 && floor(l) < floorCap(l.power!.rank) && l.money >= 10_000 ? 12 : 0),
    title: "เดิมพันระยะยาว",
    system: true,
    prepare: (l) => ({ star: pick(l, SPONSORS).name, plus: randInt(l, 6, 14), years: randInt(l, 2, 4) }),
    text: (l, c) => `[ดวงดาว '${c.star}' เปิดเดิมพันพิเศษ] "ข้าพนันว่าเจ้าจะถึงชั้น ${Math.min(100, floor(l) + Number(c.plus))} ภายใน ${c.years} ปี — เจ้ากล้าวางเงินข้างเดียวกับข้าไหม?" (ลง ${money(l, stakeOf(l))} · ถ้าทำได้ รับ ×3)`,
    choices: [
      { label: "รับเดิมพัน", run: (l, c) => { const { target } = offerLongBet(l, String(c.star), Number(c.plus), Number(c.years), 3); return meh(`[เดิมพันถูกบันทึก] ถึงชั้น ${target} ก่อนอายุ ${l.age + Number(c.years)} — ดวงดาวทั้งหลายเริ่มนับถอยหลัง`); } },
      { label: "ต่อรองให้จ่าย ×5 แต่เวลาครึ่งเดียว", tone: "danger", check: { stat: "smarts", dc: 55 }, run: (l, c, ok) => { if (!ok) return meh(`[ดวงดาว '${c.star}' หัวเราะ] "โลภนัก" — ข้อเสนอถูกถอนไป`); const { target } = offerLongBet(l, String(c.star), Number(c.plus), Math.max(1, Math.floor(Number(c.years) / 2)), 5); return good(`[ดวงดาว '${c.star}' ชอบความบ้าบิ่น] ชั้น ${target} ภายใน ${Math.max(1, Math.floor(Number(c.years) / 2))} ปี จ่ายห้าเท่า!`); } },
      { label: "ไม่เล่น", run: () => meh("[ดวงดาว เบื่อหน่าย] ...ไปหาคนอื่นก็ได้") },
    ],
  },
  {
    id: "t19.s.bet_against_scandal",
    minAge: 12,
    maxAge: 80,
    weight: (l) => (starry(l) && wagerStats(l).thrown >= 1 ? 20 : 0),
    title: "ข่าวฉาวแกล้งแพ้",
    text: () => "สถานีถ่ายทอดสดบนโลกเปิดคลิปช้าห้าเท่า — จังหวะที่คุณ 'ล้ม' ต่อหน้าผู้คุมชั้น คุณหลบได้สบายๆ คอมเมนต์ทั่วโลกขึ้นแฮชแท็ก #ผู้ท้าชิงล้มมวย",
    choices: [
      { label: "ออกมาขอโทษทั้งน้ำตา", check: { stat: "looks", dc: 55 }, skill: ["perform", "social"], run: (l, _c, ok) => { if (ok) { addFame(l, 4); return good("คลิปขอโทษของคุณยอดวิวมากกว่าคลิปฉาวสองเท่า คนครึ่งโลกให้อภัย อีกครึ่งเปิดเดิมพันว่าคุณจะทำอีกไหม"); } addFame(l, -3); return bad("น้ำตาไม่ไหลสักหยด ทุกคนเห็นว่าคุณพยายามบีบ"); } },
      { label: "ยอมรับตรงๆ ว่าทำเพื่อเงิน", run: (l) => { addFame(l, -4); addMoney(l, 200_000); return meh("ความตรงไปตรงมาของคุณทำให้แบรนด์เครื่องดื่มชูกำลังติดต่อมาเป็นพรีเซนเตอร์ 'ล้มได้ ลุกไว'"); } },
      { label: "ปฏิเสธ — บอกว่าเป็นกลยุทธ์", check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => { if (ok) { addFame(l, 1); return good("คุณอธิบายเรื่อง 'การอ่านจังหวะของผู้คุมชั้น' ได้น่าเชื่อจนนักวิเคราะห์ทีวีทั้งช่องพยักหน้าตาม"); } addFame(l, -6); return bad("ผู้ดูแลชั้นออกแถลงการณ์ว่า 'ผู้คุมชั้นไม่ได้ทำอะไรเลย'"); } },
    ],
  },
  {
    id: "t19.s.rival_trap",
    minAge: 12,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => (starry(l) && rivalGrudge(l) >= 2 ? 10 : 0),
    title: "ของขวัญจากดาวคู่แข่ง",
    system: true,
    text: (l) => `[ดวงดาว '${rivalStar(l).name}' ส่งของขวัญมาให้คุณ] กล่องสีดำผูกโบสีแดง มีการ์ดเขียนว่า 'ขอโทษเรื่องที่ผ่านมา ♡'`,
    choices: [
      { label: "เปิด", tone: "danger", check: { stat: "luck", dc: 55 }, run: (l, _c, ok) => { if (ok) { l.power!.items.push("ดาบที่ดาวคู่แข่งส่งมาผิดกล่อง"); return good("ข้างในเป็นอาวุธชั้นดี — ดูเหมือนดวงดาวส่งของผิดกล่อง กล่องที่ตั้งใจส่งไปอยู่กับใครสักคนที่โชคร้าย"); } return bad("กล่องระเบิดเป็นหมอกพิษ" + hurt(l, 8, 18, "พิษจากของขวัญของดวงดาว")); } },
      { label: "ส่งคืนพร้อมการ์ดของคุณเอง", run: (l) => { l.flags.t19grudge = rivalGrudge(l) + 1; addFame(l, 2); return meh(`การ์ดของคุณเขียนว่า 'ไม่เป็นไร เดี๋ยวชนะให้ดูอีก' — [ดวงดาว '${rivalStar(l).name}' โกรธจนหน้าจอแชทของจักรวาลกระตุก]`); } },
      { label: "ให้หน่วยสอดแนมของทีมตรวจก่อน", show: (l) => team(l).some((x) => x.m.role === "scout"), run: (l) => { addMoney(l, 300_000); return good("ทีมคุณถอดกับดักออก แล้วขายกล่องเปล่าต่อให้นักสะสมของดวงดาว"); } },
    ],
  },
  {
    id: "t19.s.star_war",
    minAge: 14,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (starry(l) && !!sp(l) && rivalGrudge(l) >= 3 ? 10 : 0),
    title: "สงครามระหว่างดวงดาว",
    system: true,
    text: (l) => `[ประกาศทั่วจักรวาล] ดวงดาว '${sp(l)!.name}' และ '${rivalStar(l).name}' ทะเลาะกันกลางโต๊ะพนัน — ท้องฟ้าของหอคอยแตกเป็นสองสี ทั้งสองฝ่ายต้องการให้คุณเป็น 'ตัวแทน' ดวลกับผู้ท้าชิงที่อีกดาวหนุน`,
    choices: [
      {
        label: "รับดวลในนามผู้สนับสนุน",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 1)),
        survival: (l) => survivalOdds(l, foe(l, 1)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 8); luckyRankUp(l, `[ดวงดาว '${sp(l)!.name}'] ตัวแทนของข้าชนะ!`); l.flags.t19grudge = 0; return big(`คุณชนะ! '${rivalStar(l).name}' ต้องถอนตัวจากโต๊ะพนันของคุณไปสิบปี ท้องฟ้ากลับเป็นสีเดียว`); }
          if (!chance(l, survivalOdds(l, foe(l, 1)))) { kill(l, "ตายในการดวลตัวแทนของดวงดาว"); return bad("ดวงดาวทั้งสองเงียบไปพร้อมกัน… สงครามจบลงด้วยร่างของคุณ"); }
          l.flags.sponsor = "none";
          return bad(`คุณแพ้ — '${sp(l)?.name ?? "ผู้สนับสนุน"}' เสียหน้าจนทิ้งคุณไปโดยไม่ลา${hurt(l, 15, 25, "บาดแผลจากการดวลตัวแทนของดวงดาว")}`);
        },
      },
      { label: "เสนอให้ทั้งสองดาวคืนดีกัน", check: { stat: "looks", dc: 60 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { l.flags.t19grudge = 0; addFame(l, 5); return good("[ดวงดาวทั้งสองเงียบ] …แล้วก็ส่งอีโมจิจับมือพร้อมกัน ผู้ท้าชิงทั้งหอคอยปรบมือให้คนกลางที่บ้าที่สุดในประวัติศาสตร์"); } return bad("ทั้งสองดาวหันมาโกรธคุณพร้อมกัน — อย่างน้อยก็คืนดีกันแล้ว"); } },
      { label: "ปฏิเสธทั้งคู่", run: (l) => { addStat(l, "happiness", -3); if (chance(l, 0.5)) l.flags.sponsor = "none"; return meh("คุณปิดหน้าต่างระบบ — ท้องฟ้าครางกึกก้องไปอีกสามวัน"); } },
    ],
  },
  {
    id: "t19.s.debt_collect",
    minAge: 12,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => (flagN(l, "t19sponsorDebt") > 0 && !!sp(l) ? 14 : 0),
    title: "ทวงหนี้ของดวงดาว",
    system: true,
    text: (l) => `[ดวงดาว '${sp(l)!.name}' มาทวงหนี้] "เจ้าขอให้ข้าช่วยในชั้นดวงดาวเลือกผู้รอด — ถึงเวลาจ่ายคืนแล้ว ข้าต้องการ${sp(l)!.likes}"`,
    choices: [
      { label: "ทำตามที่ดวงดาวต้องการ", run: (l) => { l.flags.t19sponsorDebt = 0; addStat(l, "happiness", -6); gainExp(l, 300); return meh(`คุณแสดง'${sp(l)!.likes}'ต่อหน้าผู้ชมทั้งจักรวาล ดวงดาวพอใจ — แต่คุณรู้สึกเหมือนเป็นนักแสดงในละครของคนอื่น`); } },
      { label: "จ่ายเป็นเงินแทน", show: (l) => l.money >= 500_000, run: (l) => { addMoney(l, -500_000); l.flags.t19sponsorDebt = 0; return meh("[ดวงดาว] \"เงิน… น่าเบื่อ แต่รับไว้ก็ได้\""); } },
      { label: "เบี้ยวหนี้", tone: "danger", run: (l) => { l.flags.t19sponsorDebt = 0; l.flags.sponsor = "none"; addFame(l, -3); return bad("[ดวงดาวตัดการสนับสนุน] และประกาศชื่อคุณในบัญชีดำของโต๊ะพนันทุกโต๊ะ"); } },
    ],
  },
  {
    id: "t19.s.chat_flood",
    minAge: 12,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => (starry(l) ? 6 : 0),
    system: true,
    text: (l) => pick(l, [
      "[แชทของจักรวาล] ดวงดาว 'นักสะสมโศกนาฏกรรม': ชั้นหน้าขอดราม่าหน่อย · ดวงดาว 'ยายดาวตก': หนูกินข้าวหรือยัง · ดวงดาว 'นิรนาม#4471': ผมแทงข้างคุณหมดตัว",
      "[แชทของจักรวาล] ดวงดาวสามดวงทะเลาะกันว่าคุณควรตัดผมหรือไม่ — โหวตออกมา 51 ต่อ 49",
      "[แชทของจักรวาล] ดวงดาว 'เทพผู้เบื่อหน่าย' ส่งข้อความว่า 'ใครชนะผู้คุมชั้นหน้าได้ ข้าจะบริจาคดาวเคราะห์ให้หนึ่งดวง' — ไม่มีใครรู้ว่าล้อเล่นหรือเปล่า",
    ]),
    choices: [
      { label: "ตอบแชทดวงดาว", check: { stat: "looks", dc: 50 }, skill: ["social", "perform"], run: (l, _c, ok) => { if (ok) { addMoney(l, randInt(l, 1, 4) * 100_000); return good("ดวงดาวชอบคำตอบของคุณ — เหรียญตกลงมาเป็นฝน"); } return meh("ดวงดาวส่งอีโมจิหาวกลับมาพร้อมกันสามสิบดวง"); } },
      { label: "ปิดหน้าต่างแชท", run: (l) => { addStat(l, "happiness", 2); return meh("เงียบดี"); } },
    ],
  },
  {
    id: "t19.s.rig_offer",
    minAge: 14,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (starry(l) && l.money >= 100_000 ? 6 : 0),
    title: "ข้อเสนอล้มโต๊ะ",
    text: (l) => `โบรกเกอร์ของโต๊ะพนันดวงดาวนัดคุณที่บาร์ชั้นปลอดภัย "ชั้นหน้า ถ้าคุณแพ้ผู้คุมชั้นในนาทีที่สาม ดวงดาวกลุ่มหนึ่งจะจ่าย ${money(l, 5_000_000)} — ไม่มีใครเจ็บ ปีหน้าค่อยมาใหม่"`,
    choices: [
      { label: "รับเงิน", tone: "danger", run: (l) => { addMoney(l, 5_000_000); const s = wagerStats(l); s.thrown++; s.rigged++; l.flags.t19wager = JSON.stringify(s); addFame(l, -4); addStat(l, "happiness", -5); return bad("คุณล้มในนาทีที่สามพอดี เงินเข้าบัญชีก่อนคุณลุกขึ้น — ผู้คุมชั้นมองคุณด้วยสายตาที่คุณไม่อยากจำ"); } },
      { label: "แจ้งผู้ดูแลชั้น", run: (l) => { addFame(l, 4); l.flags.t19grudge = rivalGrudge(l) + 1; return good("โบรกเกอร์ถูกโยนออกจากหอคอย — ดวงดาวกลุ่มนั้นจำชื่อคุณไว้แล้ว"); } },
      { label: "แกล้งรับ แล้วชนะเสียเลย", check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => { if (ok) { addMoney(l, 1_000_000); l.flags.t19grudge = rivalGrudge(l) + 2; return good("คุณรับมัดจำแล้วล้มผู้คุมชั้นในนาทีที่สอง ดวงดาวกลุ่มนั้นขาดทุนย่อยยับ — และตอนนี้อยากให้คุณตายมาก"); } l.flags.t19grudge = rivalGrudge(l) + 2; return bad("โบรกเกอร์อ่านแผนคุณออก และขายข้อมูลให้ดาวคู่แข่งทันที"); } },
    ],
  },
  {
    id: "t19.s.new_sponsor_bid",
    minAge: 14,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (starry(l) && l.flags.sponsor === "none" && floor(l) >= 15 ? 10 : 0),
    title: "ประมูลสิทธิ์สนับสนุน",
    system: true,
    prepare: (l) => {
      const pool = SPONSORS.filter((s) => s.id !== l.flags.t19rival);
      const a = pick(l, pool);
      const b = pick(l, pool.filter((x) => x.id !== a.id));
      return { a: a.id, b: b.id };
    },
    text: (_l, c) => `[ดวงดาวสองดวงประมูลสิทธิ์สนับสนุนคุณ] '${SPONSORS.find((s) => s.id === c.a)!.name}' vs '${SPONSORS.find((s) => s.id === c.b)!.name}' — ราคาขึ้นทุกวินาที`,
    choices: [
      { label: (_l, c) => `เลือก '${SPONSORS.find((s) => s.id === c.a)!.name}' (${SPONSORS.find((s) => s.id === c.a)!.desc})`, run: (l, c) => { l.flags.sponsor = String(c.a); l.flags.t19rival = String(c.b); addMoney(l, 1_000_000); return { text: `[ดวงดาว '${SPONSORS.find((s) => s.id === c.a)!.name}' เป็นผู้สนับสนุนคุณ] ส่วนดาวที่แพ้ประมูล… กลายเป็นดาวคู่แข่งของคุณ`, kind: "system" }; } },
      { label: (_l, c) => `เลือก '${SPONSORS.find((s) => s.id === c.b)!.name}' (${SPONSORS.find((s) => s.id === c.b)!.desc})`, run: (l, c) => { l.flags.sponsor = String(c.b); l.flags.t19rival = String(c.a); addMoney(l, 1_000_000); return { text: `[ดวงดาว '${SPONSORS.find((s) => s.id === c.b)!.name}' เป็นผู้สนับสนุนคุณ] ดาวที่แพ้ส่งข้อความสั้นๆ ว่า 'จำไว้'`, kind: "system" }; } },
      { label: "ลากราคาต่อจนทั้งคู่ถอย", check: { stat: "smarts", dc: 60 }, skill: ["business"], run: (l, _c, ok) => { if (ok) { addMoney(l, 8_000_000); return good("ทั้งสองดาวเลิกประมูลพร้อมกัน แต่ค่ามัดจำที่จ่ายไปแล้วไม่คืน — คุณรวยขึ้นโดยไม่ต้องมีเจ้านาย"); } return meh("ทั้งสองดาวเบื่อและหายไป ไม่มีใครได้อะไร"); } },
    ],
  },
  {
    id: "t19.s.gambler_mate",
    minAge: 14,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (starry(l) && team(l).length >= 1 ? 5 : 0),
    title: "เพื่อนร่วมทีมติดพนัน",
    prepare: (l) => { const x = pick(l, team(l)); return { name: x.p.short ?? x.p.name, id: x.p.id }; },
    text: (_l, c) => `${c.name}เอาเงินรางวัลของทีมทั้งหมดไปแทงข้าง 'แพ้' ของทีมคุณเอง "ก็แค่ประกันความเสี่ยง! ถ้าเราแพ้ อย่างน้อยก็มีเงิน!"`,
    choices: [
      { label: "ด่าแล้วยึดบัญชีคืน", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond - 10, 0, 100); return meh(`${c.name}งอนไปหนึ่งอาทิตย์ แต่บัญชีทีมปลอดภัย`); } },
      { label: "ปล่อย แล้วตั้งใจชนะให้ดู", run: (l, c) => { addMoney(l, -100_000); const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 6, 0, 100); return meh(`ทีมคุณชนะ ${c.name}เสียเงินหมดแต่ดีใจที่สุดในทีม "แพ้พนันครั้งนี้คุ้มที่สุดในชีวิต"`); } },
    ],
  },
  {
    id: "t19.s.star_reveal",
    minAge: 18,
    maxAge: 90,
    weight: (l) => (starry(l) && !!sp(l) && floor(l) >= 50 ? 4 : 0),
    title: "ตัวตนของดวงดาว",
    text: (l) => `ในชั้นที่ไม่มีใครอยู่ ดวงดาว '${sp(l)!.name}' ปรากฏตัวต่อหน้าคุณเป็นครั้งแรก — มันคือผู้ท้าชิงที่ถึงยอดหอคอยเมื่อพันปีก่อน "สิ่งที่รออยู่บนยอดคือที่นั่งบนท้องฟ้า เจ้าจะได้นั่งดูคนอื่นปีนไปตลอดกาล"`,
    choices: [
      { label: "ถามว่ามีความสุขไหม", run: (l) => { l.flags.t19truth = true; addStat(l, "smarts", 3); return meh(`[ดวงดาว '${sp(l)!.name}'] "…นั่นเป็นเหตุผลที่ข้าชอบพนัน" — ดวงดาวหายไป ทิ้งคำถามไว้ในใจคุณ`); } },
      { label: "บอกว่าจะเปลี่ยนสิ่งที่รออยู่บนยอด", run: (l) => { l.flags.t19truth = true; l.flags.t19changeTop = true; addFame(l, 3); return big(`[ดวงดาว '${sp(l)!.name}' หัวเราะจนท้องฟ้าสั่น] "ทุกคนพูดแบบนี้… แต่เจ้าอาจเป็นคนแรกที่ข้าอยากเดิมพันด้วยทั้งหมดที่มี"`); } },
    ],
  },
  {
    id: "t19.s.audience_vote",
    minAge: 12,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (starry(l) ? 5 : 0),
    title: "ดวงดาวโหวตบทลงโทษ",
    system: true,
    text: () => "[กิจกรรมพิเศษ] ดวงดาวทั้งหลายโหวตเลือก 'บทลงโทษสนุกๆ' ให้ผู้ท้าชิงยอดนิยมหนึ่งคน — ชื่อคุณขึ้นอันดับหนึ่ง ตัวเลือก: ร้องเพลงกลางชั้น / ใส่ชุดไก่หนึ่งเดือน / สู้กับห่านของหอคอย",
    choices: [
      { label: "ร้องเพลงกลางชั้น", check: { stat: "looks", dc: 50 }, skill: ["perform"], run: (l, _c, ok) => { if (ok) { addFame(l, 4); addMoney(l, 500_000); return good("เสียงคุณดีเกินคาด ดวงดาวส่งเหรียญมาจนผู้ดูแลชั้นต้องเอาไม้กวาดมากวาด"); } addFame(l, 1); return meh("เพี้ยนทุกโน้ต แต่ดวงดาวชอบมากกว่าร้องเพราะ"); } },
      { label: "ใส่ชุดไก่หนึ่งเดือน", run: (l) => { addFame(l, 3); addStat(l, "happiness", -2); return meh("ผู้คุมชั้นที่คุณเจอในเดือนนั้นหัวเราะจนเสียจังหวะไปสองครั้ง — นับว่าได้เปรียบ"); } },
      { label: "สู้กับห่านของหอคอย", tone: "danger", check: { stat: "health", dc: 55 }, run: (l, _c, ok) => { if (ok) { addFame(l, 5); gainExp(l, 300); return good("ห่านยอมแพ้หลังสิบห้านาที ทั้งจักรวาลยืนปรบมือ"); } return bad("ห่านชนะ ไม่มีอะไรน่าอายกว่านี้อีกแล้ว" + hurt(l, 3, 8, "ห่านของหอคอย")); } },
    ],
  },
  {
    id: "t19.s.lucky_streak",
    minAge: 12,
    maxAge: 80,
    weight: (l) => (starry(l) && wagerStats(l).won >= 3 && !l.flags.t19luckyTitle ? 12 : 0),
    title: "เซียนพนันของดวงดาว",
    text: () => "สถิติเดิมพันของคุณดีจนดวงดาวกลุ่มหนึ่งตั้งฉายาให้ว่า 'ผู้ท้าชิงที่แทงชีวิตตัวเองไม่เคยพลาด' โต๊ะพนันบางโต๊ะเริ่มไม่รับเดิมพันจากคุณ",
    auto: (l) => { l.flags.t19luckyTitle = true; addFame(l, 4); addStat(l, "luck", 2); return "milestone"; },
  },
  {
    id: "t19.s.broke_gambler",
    minAge: 12,
    maxAge: 80,
    weight: (l) => (starry(l) && wagerStats(l).net < -1_000_000 ? 10 : 0),
    title: "หมดตัวที่โต๊ะพนัน",
    text: () => "บัญชีเดิมพันของคุณติดลบหนักจนแม่ส่งข้อความมาจากโลก 'ลูก… ที่ข่าวบอกว่าเสียพนันดวงดาวนี่เรื่องจริงไหม'",
    choices: [
      { label: "สาบานว่าจะเลิกพนัน", run: (l) => { l.flags.t19quitBet = true; addStat(l, "happiness", 3); return good("คุณลบแอปโต๊ะพนันออกจากหน้าต่างระบบ (ซึ่งลบไม่ได้ แต่คุณซ่อนไว้ในโฟลเดอร์ลึกที่สุด)"); } },
      { label: "ทุ่มครั้งสุดท้ายเพื่อถอนทุน", tone: "danger", check: { stat: "luck", dc: 60 }, run: (l, _c, ok) => { if (ok) { addMoney(l, 2_000_000); return good("ถอนทุนได้หมดในครั้งเดียว — ดวงดาวทั้งโต๊ะบอกว่านี่คือเหตุผลที่ไม่ควรเลิก"); } addMoney(l, -Math.round(Math.max(0, l.money) * 0.5)); return bad("ครั้งสุดท้ายจริงๆ — เพราะไม่มีอะไรเหลือให้เล่นแล้ว"); } },
    ],
  },
  {
    id: "t19.s.star_gift_team",
    minAge: 12,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (starry(l) && !!sp(l) && team(l).length >= 2 ? 6 : 0),
    system: true,
    text: (l) => `[ดวงดาว '${sp(l)!.name}' ชอบทีมของคุณ] "ข้าจะให้พรหนึ่งข้อ — แก่เจ้า หรือแก่สมาชิกที่อ่อนแอที่สุดในทีม"`,
    choices: [
      { label: "ให้ตัวเอง", run: (l) => { gainExp(l, 500); return meh("พลังไหลเข้าร่าง — แต่สมาชิกที่อ่อนที่สุดก้มหน้า"); } },
      { label: "ให้สมาชิกที่อ่อนที่สุด", run: (l) => { const x = team(l).sort((a, b) => a.m.lv - b.m.lv)[0]; updateMate(l, x.p.id, (m) => { m.lv += 5; }); x.p.bond = clamp(x.p.bond + 15, 0, 100); return good(`${x.p.short ?? x.p.name}ขึ้นห้าเลเวลในคืนเดียว และมองคุณเหมือนคุณเป็นดวงดาวอีกดวง`); } },
    ],
  },
  {
    id: "t19.s.grudge_assassin",
    minAge: 14,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (starry(l) && rivalGrudge(l) >= 4 ? 8 : 0),
    title: "นักฆ่าที่ดวงดาวจ้าง",
    text: (l) => `[ดวงดาว '${rivalStar(l).name}' ตั้งค่าหัวคุณบนโต๊ะพนัน] นักล่าผู้ท้าชิงระดับสูงสามคนปรากฏตัวในชั้นปลอดภัย — ที่ที่ไม่ควรมีการต่อสู้`,
    choices: [
      { label: "สู้", tone: "danger", odds: (l) => fightOdds(l, foe(l, 1), 0.05), survival: (l) => survivalOdds(l, foe(l, 1)), run: (l, _c, ok) => { if (ok) { addFame(l, 6); gainExp(l, 600); l.flags.t19grudge = 1; return good("คุณล้มนักล่าทั้งสาม แล้วส่งหน้ากากของพวกมันกลับไปบนโต๊ะพนันของดาวคู่แข่ง"); } if (!chance(l, survivalOdds(l, foe(l, 1)))) { kill(l, "ถูกนักฆ่าที่ดวงดาวจ้างสังหารในชั้นปลอดภัย"); return bad("ค่าหัวถูกจ่ายครบ"); } return bad("คุณหนีรอดไปได้ทางหน้าต่าง" + hurt(l, 12, 25, "บาดแผลจากนักฆ่าที่ดวงดาวจ้าง")); } },
      { label: "ขอความคุ้มครองจากผู้ดูแลชั้น", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { l.flags.t19grudge = 2; return good("กฎชั้นปลอดภัยเหนือกว่าค่าหัว — นักล่าถูกโยนออกนอกหอคอย"); } return bad("ผู้ดูแลชั้นบอกว่า 'ไม่มีกฎห้ามดวงดาวจ้างคน' แล้วปิดประตู" + hurt(l, 6, 14, "บาดแผลจากนักฆ่าที่ดวงดาวจ้าง")); } },
    ],
  },
  {
    id: "t19.s.sponsor_proud",
    minAge: 12,
    maxAge: 90,
    weight: (l) => (starry(l) && !!sp(l) && wagerStats(l).won >= 1 ? 4 : 0),
    maxTimes: 2,
    system: true,
    text: (l) => `[ดวงดาว '${sp(l)!.name}' อวดคุณให้ดาวดวงอื่นฟัง] "เห็นไหม ข้าเลือกถูก" — คุณรู้สึกเหมือนลูกที่ถูกพ่อแม่อวดในงานเลี้ยงญาติ`,
    auto: (l) => { addMoney(l, 300_000); addStat(l, "happiness", 3); return "good"; },
  },
];
