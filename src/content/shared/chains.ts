// เควสต่อเนื่อง (M22): เหตุการณ์ที่เคย "ตัดจบ" กลับมาเล่าต่อหลายตอน
// สถานะเก็บใน flags: q_<id> = ตอนที่ผ่านแล้ว, q_<id>_at = อายุตอนผ่านตอนล่าสุด
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, people, shortName } from "../../engine/util";
import { fightOdds, gainExp, luckyRankUp, markTurn, survivalOdds } from "../hunter/power";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const big = (text: string): Outcome => ({ text, kind: "milestone" });

const step = (l: Life, id: string) => Number(l.flags[`q_${id}`] ?? 0);
/** ผ่านตอนนี้แล้ว (จบเส้นเรื่องได้ด้วย end) */
function done(l: Life, id: string, n: number, end = false) {
  l.flags[`q_${id}`] = end ? 99 : n;
  l.flags[`q_${id}_at`] = l.age;
}
const since = (l: Life, id: string) => l.age - Number(l.flags[`q_${id}_at`] ?? -99);
/** ตอนถัดไปพร้อมหรือยัง: เริ่มเรื่องแล้ว อยู่ที่ตอน n และเว้นมาอย่างน้อย gap ปี */
const ready = (l: Life, id: string, n: number, gap: number, start: boolean) => start && step(l, id) === n && (n === 0 || since(l, id) >= gap);
const foe = (l: Life, d = 0) => clamp((l.power?.rank ?? 0) + d, 0, 8);
const fight = (l: Life, d = 0) => (l.power ? fightOdds(l, foe(l, d)) : clamp(0.3 + (l.stats.health - 50) / 100, 0.1, 0.8));
const live = (l: Life, d = 0) => (l.power ? survivalOdds(l, foe(l, d)) : 0.75);

function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

/** เส้นเรื่องที่ยังเปิดอยู่ — แสดงในแท็บพลังให้รู้ว่ายังมีเรื่องค้าง */
export interface Storyline {
  id: string;
  title: string;
  hint: string;
  /** เริ่มเส้นเรื่องแล้ว (จาก flag ของเหตุการณ์ต้นเรื่อง) */
  started: (l: Life) => boolean;
  parts: number;
}

export const STORYLINES: Storyline[] = [];
const story = (s: Storyline) => (STORYLINES.push(s), s);
export const openStories = (l: Life) => STORYLINES.filter((s) => s.started(l) && step(l, s.id) < s.parts && step(l, s.id) !== 99);

// ───────────────────────── ยุทธภพ ─────────────────────────

const MASTER = story({ id: "master", title: "ชายแก่กับตะเกียบคู่นั้น", hint: "อาจารย์ลับในป่าไผ่ยังมีบททดสอบสุดท้าย", started: (l) => !!l.flags.hiddenMaster, parts: 2 });
const SALT = story({ id: "salt", title: "เจ้าสาวหนีงาน", hint: "เจ้าพ่อค้าเกลือยังไม่ลืมค่าหัวของคุณ", started: (l) => !!l.flags.saltMerchantGrudge, parts: 2 });
const GRUDGE = story({ id: "grudge", title: "แค้นนี้ต้องชำระ", hint: "คุณชายตระกูลใหญ่ที่เตะแผงของแม่ยังลอยนวล", started: (l) => !!l.flags.grudge, parts: 2 });
const DEMON = story({ id: "demon", title: "คัมภีร์สีเลือด", hint: "ปราณมารในร่างยังไม่สงบ", started: (l) => !!l.flags.demonTouched, parts: 2 });
const DOG = story({ id: "dog", title: "เสี่ยวหู", hint: "หมาจรที่คุณช่วยไว้ยังอยู่ข้างกาย", started: (l) => !!l.flags.loyalDog, parts: 2 });
const SAVED = story({ id: "savedchild", title: "เด็กที่ตกน้ำ", hint: "ลูกชายคหบดีที่คุณช่วยไว้โตแล้ว", started: (l) => !!l.flags.savedChild, parts: 1 });
const SWEEPER = story({ id: "sweeper", title: "คนกวาดลานแห่งสำนัก", hint: "ชายแก่ที่กวาดลานข้างคุณทุกเช้ามีอะไรแปลกๆ", started: (l) => !!l.flags.sweeperWatched, parts: 1 });
const WANTED = story({ id: "wanted", title: "คนมีค่าหัว", hint: "ทหารจวนอำเภอยังตามล่าคุณ", started: (l) => !!l.flags.wanted, parts: 1 });

const MURIM: GameEvent[] = [
  {
    id: "q.master.1",
    world: "murim",
    minAge: 16,
    maxAge: 80,
    weight: 25,
    when: (l) => ready(l, MASTER.id, 0, 0, MASTER.started(l)) && since(l, "master") >= 0,
    title: "บททดสอบในป่าไผ่",
    text: () => "ชายแก่วางถ้วยชาลงบนตอไม้ \"สามปีแล้ว… วันนี้ถ้าเจ้าแตะชายเสื้อข้าได้ ข้าจะยอมรับว่าเจ้าเป็นศิษย์\"",
    choices: [
      {
        label: "เข้าโจมตีเต็มกำลัง",
        tone: "danger",
        odds: (l) => fight(l, 2),
        run: (l, _c, ok) => {
          done(l, MASTER.id, 1);
          if (ok) { luckyRankUp(l, "ปรมาจารย์ลับยอมรับคุณเป็นศิษย์สายตรง"); return big("ปลายนิ้วคุณแตะชายเสื้อเขาได้ — ชายแก่หัวเราะจนน้ำตาไหล \"ในที่สุด\""); }
          gainExp(l, 500);
          return meh("คุณไม่แตะแม้แต่ฝุ่นบนรองเท้า แต่เขาพยักหน้า \"ใจเจ้าผ่าน ฝีมือยังต้องฝึก\"");
        },
      },
      {
        label: "รินชาให้เขาแทน",
        check: { stat: "smarts", dc: 55 },
        skill: ["social"],
        run: (l, _c, ok) => {
          done(l, MASTER.id, 1);
          if (ok) { gainExp(l, 900); return big("ชายแก่นิ่งไป \"เจ้าเข้าใจสิ่งที่ข้าพยายามสอน… ยุทธ์ไม่ใช่การชนะ\""); }
          return meh("\"ชาเย็นแล้ว\" เขาบ่น แต่ก็ดื่มจนหมด");
        },
      },
    ],
  },
  {
    id: "q.master.2",
    world: "murim",
    minAge: 20,
    maxAge: 90,
    weight: 25,
    when: (l) => ready(l, MASTER.id, 1, 6, true),
    title: "ตะเกียบคู่สุดท้าย",
    text: () => "จดหมายสั้นๆ มาถึงพร้อมตะเกียบไม้ไผ่คู่หนึ่ง \"ข้าจะไปแล้ว ตะเกียบคู่นี้คือทุกอย่างที่ข้ามี — อย่าใช้มันคีบเหล้าอย่างเดียวล่ะ\"",
    choices: [
      {
        label: "รีบไปที่ป่าไผ่",
        run: (l) => {
          done(l, MASTER.id, 2, true);
          l.power?.items.push("ตะเกียบไม้ไผ่ของปรมาจารย์");
          gainExp(l, 1200);
          addStat(l, "happiness", -6);
          markTurn(l);
          return big("คุณไปทันเห็นเขายิ้มเป็นครั้งสุดท้าย — วิชาทั้งชีวิตของเขาถูกถ่ายทอดผ่านฝ่ามือที่เย็นลงทุกที");
        },
      },
    ],
  },
  {
    id: "q.salt.1",
    world: "murim",
    minAge: 17,
    maxAge: 60,
    weight: 15,
    when: (l) => ready(l, SALT.id, 0, 0, SALT.started(l)),
    title: "นักล่าค่าหัวของพ่อค้าเกลือ",
    text: () => "นักล่าค่าหัวสามคนตามหาคุณเจอในโรงเตี๊ยม \"ร้อยตำลึงสำหรับหัวคนที่ขโมยเจ้าสาวของเจ้าพ่อค้าเกลือ\"",
    choices: [
      {
        label: "สู้",
        tone: "danger",
        odds: (l) => fight(l, 0),
        survival: (l) => live(l, 0),
        run: (l, _c, ok) => {
          done(l, SALT.id, 1);
          if (ok) { addFame(l, 4); return good("นักล่าค่าหัวทั้งสามหนีกระเจิง — ข่าวลือว่าค่าหัวคุณไม่คุ้มเสี่ยงแพร่ไปทั่ว"); }
          if (!chance(l, live(l, 0))) { kill(l, "ถูกนักล่าค่าหัวของพ่อค้าเกลือสังหาร"); return bad("ร้อยตำลึง… ราคาชีวิตคุณแค่นั้นเอง"); }
          return bad(`คุณหนีรอดออกทางหน้าต่างพร้อมแผลที่หลัง${hurt(l, 8, 16, "บาดแผลจากนักล่าค่าหัว")}`);
        },
      },
      { label: "จ่ายเงินไถ่ค่าหัวตัวเอง", run: (l) => { done(l, SALT.id, 1); addMoney(l, -100_000); return meh("คุณจ่ายร้อยตำลึงให้พ่อค้าเกลือ — แพงกว่าค่าเจ้าสาวเสียอีก"); } },
    ],
  },
  {
    id: "q.salt.2",
    world: "murim",
    minAge: 22,
    maxAge: 80,
    weight: 15,
    when: (l) => ready(l, SALT.id, 1, 4, true),
    title: "เจ้าสาวคนนั้น",
    text: () => "ขบวนสินค้าหรูหราหยุดหน้าบ้านคุณ หญิงสาวในชุดพ่อค้าก้าวลงมา — เจ้าสาวที่คุณเคยพาหนี \"ตอนนี้ข้าเป็นเจ้าของกิจการเกลือครึ่งแคว้นแล้วนะ\"",
    choices: [
      {
        label: "ยินดีกับเธอ",
        run: (l) => {
          done(l, SALT.id, 2, true);
          addMoney(l, 500_000);
          if (!people(l, "spouse").length && !people(l, "partner").length && chance(l, 0.5)) {
            const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age, bond: 70, job: "เจ้าของกิจการเกลือ" });
            return big(`${shortName(p)}ยื่นถุงเงินห้าร้อยตำลึงให้ แล้วยิ้ม "ส่วนดอกเบี้ย… ข้าขอจ่ายเป็นชีวิตที่เหลือได้ไหม"`);
          }
          return good("เธอยื่นถุงเงินห้าร้อยตำลึง \"หนี้ชีวิต ข้าไม่เคยลืม\"");
        },
      },
    ],
  },
  {
    id: "q.grudge.1",
    world: "murim",
    minAge: 20,
    maxAge: 60,
    weight: 15,
    when: (l) => ready(l, GRUDGE.id, 0, 0, GRUDGE.started(l) && !!l.power),
    title: "คุณชายคนเดิม",
    text: () => "คุณชายที่เคยเตะแผงขายของของแม่คุณ ตอนนี้เป็นทายาทสำนักใหญ่ เขากำลังรังแกพ่อค้าแก่อีกคนกลางตลาด — เขาจำคุณไม่ได้ด้วยซ้ำ",
    choices: [
      {
        label: "ชำระแค้นเก่าต่อหน้าทุกคน",
        tone: "danger",
        odds: (l) => fight(l, 1),
        run: (l, _c, ok) => {
          done(l, GRUDGE.id, 1);
          if (ok) { addFame(l, 10); addStat(l, "happiness", 15); l.flags.revenge = true; return big("คุณสอนบทเรียนเดียวกับที่แม่คุณได้รับเมื่อสิบปีก่อน — แต่คราวนี้คนทั้งตลาดยืนข้างคุณ"); }
          return bad(`เขาแข็งแกร่งกว่าที่คิด แต่คุณไม่ถอย${hurt(l, 10, 20, "บาดเจ็บจากการชำระแค้น")}`);
        },
      },
      { label: "ปล่อยวาง", run: (l) => { done(l, GRUDGE.id, 1, true); addStat(l, "happiness", 5); return meh("คุณเดินผ่านไป ความแค้นที่แบกมาสิบปีเบาลงอย่างประหลาด"); } },
    ],
  },
  {
    id: "q.grudge.2",
    world: "murim",
    minAge: 22,
    maxAge: 80,
    weight: 12,
    when: (l) => ready(l, GRUDGE.id, 1, 3, true) && !!l.flags.revenge,
    title: "สำนักทวงแค้น",
    text: () => "เจ้าสำนักของคุณชายคนนั้นส่งศิษย์มาท้าประลอง — ถ้าคุณชนะ สำนักนั้นจะต้องปิดประตูขอโทษแม่คุณต่อหน้าทั้งเมือง",
    choices: [
      {
        label: "รับคำท้า",
        tone: "danger",
        odds: (l) => fight(l, 1),
        survival: (l) => live(l, 1),
        run: (l, _c, ok) => {
          done(l, GRUDGE.id, 2, true);
          if (ok) { addFame(l, 15); return big("สำนักนั้นคุกเข่าขอโทษหน้าบ้านแม่คุณ แม่ร้องไห้ — คราวนี้เป็นน้ำตาแห่งความภูมิใจ"); }
          if (!chance(l, live(l, 1))) { kill(l, "สิ้นชีพในการประลองกับสำนักคู่แค้น"); return bad("ความแค้นเอาชีวิตคุณไปจนได้…"); }
          return bad(`คุณแพ้ — แต่ศักดิ์ศรีที่สู้ไม่ถอยทำให้ทั้งเมืองยังนับถือคุณ${hurt(l, 10, 20, "บาดเจ็บสาหัส")}`);
        },
      },
    ],
  },
  {
    id: "q.demon.1",
    world: "murim",
    minAge: 18,
    maxAge: 80,
    weight: 15,
    when: (l) => ready(l, DEMON.id, 0, 0, DEMON.started(l)) && since(l, "demon") >= 0,
    title: "ปราณมารกำเริบ",
    text: () => "กลางดึก ดวงตาคุณเปลี่ยนเป็นสีแดง ปราณมารจากคัมภีร์สีเลือดพลุ่งพล่าน เสียงในหัวกระซิบให้ฆ่าคนที่นอนอยู่ห้องข้างๆ",
    choices: [
      {
        label: "นั่งสมาธิกดมันไว้",
        check: { stat: "smarts", dc: 60 },
        run: (l, _c, ok) => {
          done(l, DEMON.id, 1);
          if (ok) { gainExp(l, 800); return big("คุณกดปราณมารลงไปได้ และเรียนรู้ที่จะใช้มันโดยไม่ให้มันใช้คุณ"); }
          addFame(l, -15);
          return bad(`ตื่นมาอีกที ห้องทั้งห้องพังยับ ชาวบ้านมองคุณด้วยความหวาดกลัว${hurt(l, 8, 16, "ปราณมารย้อนกลับ")}`);
        },
      },
      { label: "ปล่อยให้ปราณมารนำทาง", tone: "danger", run: (l) => { done(l, DEMON.id, 1); l.flags.demonPath = true; luckyRankUp(l, "ปราณมารกลืนกินคุณจนพลังพุ่งพรวด"); addFame(l, -25); return bad("พลังพุ่งสูงจนน่ากลัว — แต่ครึ่งหนึ่งของคุณไม่ใช่คุณอีกต่อไป"); } },
    ],
  },
  {
    id: "q.demon.2",
    world: "murim",
    minAge: 20,
    maxAge: 90,
    weight: 15,
    when: (l) => ready(l, DEMON.id, 1, 3, true),
    title: "พันธมิตรยุทธจักรตามล่า",
    text: () => "พันธมิตรยุทธจักรออกประกาศ 「ผู้ใดฝึกคัมภีร์สีเลือด จะถูกกวาดล้าง」 — และรายชื่อแรกในประกาศคือชื่อคุณ",
    choices: [
      {
        label: "สู้กับทูตพันธมิตร",
        tone: "danger",
        odds: (l) => fight(l, 2),
        survival: (l) => live(l, 2),
        run: (l, _c, ok) => {
          done(l, DEMON.id, 2, true);
          if (ok) { addFame(l, -10); luckyRankUp(l, "คุณล้มทูตพันธมิตรได้ทั้งห้าคน"); return big("ยุทธภพทั้งแผ่นดินสั่นสะเทือน — ชื่อคุณกลายเป็นตำนานฝ่ายมาร"); }
          if (!chance(l, live(l, 2))) { kill(l, "ถูกพันธมิตรยุทธจักรกวาดล้าง"); return bad("ทูตพันธมิตรทั้งห้าพุ่งเข้ามาพร้อมกัน…"); }
          return bad(`คุณหนีรอดไปซ่อนตัวในหุบเขา${hurt(l, 15, 30, "บาดแผลจากการถูกตามล่า")}`);
        },
      },
      { label: "เผาคัมภีร์ แล้วมอบตัว", check: { stat: "looks", dc: 55 }, skill: ["social"], run: (l, _c, ok) => { done(l, DEMON.id, 2, true); if (ok) { addFame(l, 10); return big("ผู้นำพันธมิตรเห็นความจริงใจ ล้างชื่อคุณออกจากประกาศ"); } addMoney(l, -Math.round(Math.max(0, l.money) * 0.5)); return bad("คุณถูกปรับครึ่งหนึ่งของทรัพย์สิน และต้องถูกคุมประพฤติสิบปี"); } },
    ],
  },
  {
    id: "q.dog.1",
    world: "murim",
    minAge: 9,
    maxAge: 30,
    weight: 15,
    when: (l) => ready(l, DOG.id, 0, 0, DOG.started(l)),
    title: "เสี่ยวหูเห่า",
    text: () => "กลางดึก เสี่ยวหูเห่าไม่หยุดแล้วดึงชายเสื้อคุณไปที่หน้าต่าง — มีโจรภูเขาห้าคนกำลังปีนรั้วเข้ามา",
    choices: [
      { label: "ปลุกทุกคนในบ้านแล้วหนี", run: (l) => { done(l, DOG.id, 1); for (const p of l.people) if (p.alive && ["father", "mother", "sibling"].includes(p.relation)) p.bond = clamp(p.bond + 8, 0, 100); return good("ทั้งบ้านรอดเพราะเสี่ยวหู — พ่อซื้อกระดูกให้มันกินทุกวันตั้งแต่นั้น"); } },
      { label: "สู้ไปพร้อมเสี่ยวหู", tone: "danger", odds: (l) => fight(l, 0) + 0.15, run: (l, _c, ok) => { done(l, DOG.id, 1); if (ok) { addFame(l, 4); return good("เด็กกับหมาไล่โจรห้าคนกระเจิง — ข่าวลือแพร่ไปทั้งหมู่บ้าน"); } return bad(`โจรหนีไปพร้อมข้าวของ เสี่ยวหูได้แผลที่ขา${hurt(l, 4, 10, "ถูกโจรภูเขาทำร้าย")}`); } },
    ],
  },
  {
    id: "q.dog.2",
    world: "murim",
    minAge: 18,
    maxAge: 50,
    weight: 15,
    when: (l) => ready(l, DOG.id, 1, 9, true),
    title: "ลาก่อนเสี่ยวหู",
    text: () => "เสี่ยวหูแก่มากแล้ว มันเดินตามคุณช้าลงทุกวัน คืนนี้มันนอนซบตักคุณแล้วไม่ยอมลุก",
    choices: [{ label: "อยู่กับมันจนเช้า", run: (l) => { done(l, DOG.id, 2, true); addStat(l, "happiness", -8); l.flags.dogMemory = true; return big("คุณฝังเสี่ยวหูไว้ใต้ต้นท้อหน้าบ้าน ทุกปีจะมีกระดูกชิ้นหนึ่งวางอยู่ที่นั่นเสมอ"); } }],
  },
  {
    id: "q.savedchild.1",
    world: "murim",
    minAge: 22,
    maxAge: 80,
    weight: 12,
    when: (l) => ready(l, SAVED.id, 0, 0, SAVED.started(l)) && l.age >= 22,
    title: "หนี้ชีวิตที่ไม่ลืม",
    text: () => "ชายหนุ่มแต่งตัวภูมิฐานคุกเข่าลงต่อหน้าคุณ \"ข้าคือเด็กที่ท่านกระโดดลงไปช่วยในแม่น้ำวันนั้น — ตอนนี้ข้าเป็นเจ้าของสำนักคุ้มภัยใหญ่ที่สุดในแคว้น\"",
    choices: [
      { label: "รับคำขอบคุณ", run: (l) => { done(l, SAVED.id, 1, true); addMoney(l, 800_000); createPerson(l, "ally", { gender: "m", age: l.age - 8, bond: 90, job: "ลูกชายคหบดีที่คุณช่วยชีวิต" }); return big("เขามอบเงินแปดร้อยตำลึงและสาบานว่าจะยืนข้างคุณทุกการต่อสู้"); } },
    ],
  },
  {
    id: "q.sweeper.1",
    world: "murim",
    minAge: 16,
    maxAge: 50,
    weight: 15,
    when: (l) => ready(l, SWEEPER.id, 0, 0, SWEEPER.started(l)) && !!l.power,
    title: "คนกวาดลานที่ไม่ธรรมดา",
    text: () => "คืนที่ผู้บุกรุกปีนกำแพงสำนักเข้ามา ชายแก่ที่กวาดลานข้างคุณมาตลอดสามปี ปัดไม้กวาดทีเดียว ผู้บุกรุกทั้งสิบปลิวออกไปนอกกำแพง",
    choices: [
      { label: "คุกเข่าขอเป็นศิษย์", run: (l) => { done(l, SWEEPER.id, 1, true); luckyRankUp(l, "คนกวาดลานคืออดีตเจ้าสำนักที่สละตำแหน่ง"); markTurn(l); return big("\"สามปีที่เจ้ากวาดลานไม่เคยบ่น — นั่นคือบทเรียนแรก\" ชายแก่ยิ้ม แล้วยื่นไม้กวาดให้"); } },
      { label: "แกล้งไม่เห็น", run: (l) => { done(l, SWEEPER.id, 1, true); gainExp(l, 300); return meh("ชายแก่ยิ้มบางๆ แล้วกวาดลานต่อ — บางความลับก็ควรเป็นความลับ"); } },
    ],
  },
  {
    id: "q.wanted.1",
    world: "murim",
    minAge: 18,
    maxAge: 70,
    weight: 15,
    when: (l) => ready(l, WANTED.id, 0, 0, WANTED.started(l)) && since(l, "wanted") >= 0,
    title: "ชีวิตคนมีค่าหัว",
    text: () => "ทหารจวนอำเภอล้อมโรงเตี๊ยมที่คุณพัก — แต่ชาวบ้านที่คุณเคยช่วยเรื่องภาษีแอบเปิดประตูหลังให้",
    choices: [
      { label: "หนีไปร่วมกับกลุ่มกบฏ", run: (l) => { done(l, WANTED.id, 1, true); addFame(l, 6); l.flags.rebel = true; return big("คุณกลายเป็นผู้นำกลุ่มกบฏฝ่ายธรรมะ — สามปีต่อมา นายอำเภอคนนั้นถูกปลดจากตำแหน่ง"); } },
      { label: "มอบตัวเพื่อไม่ให้ชาวบ้านเดือดร้อน", check: { stat: "looks", dc: 55 }, skill: ["social"], run: (l, _c, ok) => { done(l, WANTED.id, 1, true); if (ok) { addFame(l, 10); return big("ศาลมณฑลตัดสินให้คุณพ้นผิด ชาวบ้านจุดประทัดรับกลับ"); } addStat(l, "health", -15); return bad("คุณถูกจำคุกหนึ่งปีก่อนข้าหลวงจะสั่งปล่อย"); } },
    ],
  },
];

// ───────────────────────── ราชสำนัก ─────────────────────────

const GARDEN = story({ id: "garden", title: "สวนลับหลังกำแพง", hint: "เด็กในสวนลับสัญญาว่าจะกลับมา", started: (l) => !!l.flags.gardenFriend, parts: 2 });
const GLOVE = story({ id: "glove", title: "ถุงมือข้างเดียว", hint: "เจ้าของถุงมือในงานเต้นรำหน้ากากยังไม่เปิดเผยตัว", started: (l) => !!l.flags.maskGlove, parts: 1 });
const WOLF = story({ id: "wolf", title: "หมาป่าภูตแห่งทิศเหนือ", hint: "ลูกหมาป่าตาสีอำพันกลับไปทางทิศเหนือ", started: (l) => !!l.flags.spiritWolf, parts: 2 });
const SISTER = story({ id: "sister", title: "น้องบุญธรรม", hint: "น้องบุญธรรมที่ทุกคนเอ็นดูกำลังวางแผนบางอย่าง", started: (l) => !!l.flags.sisterSchemer, parts: 2 });
const BAKERY = story({ id: "bakery", title: "สูตรขนมจากโลกเก่า", hint: "ชีสเค้กของคุณดังไปถึงวัง", started: (l) => !!l.flags.recipe, parts: 2 });
const EXFIANCE = story({ id: "exfiance", title: "คู่หมั้นที่ถูกถอน", hint: "คนที่คุณถอนหมั้นต่อหน้าจักรพรรดิยังไม่ลืม", started: (l) => !!l.flags.engagementOff, parts: 1 });
const BASTARD = story({ id: "bastard", title: "ลูกนอกสมรสของเคานต์", hint: "พี่น้องต่างแม่ไม่ต้อนรับคุณ", started: (l) => !!l.flags.illegitimate, parts: 2 });
const CH3 = story({ id: "ch3", title: "ตัวประกอบที่ไม่ตาย", hint: "ตัวเอกเริ่มสงสัยว่าคุณเป็นใคร", started: (l) => !!l.flags.ch3Escaped, parts: 2 });
const PROF = story({ id: "prof", title: "เย็นวันพฤหัส", hint: "อาจารย์เวทอาวุโสกำลังซ่อนงานวิจัยบางอย่าง", started: (l) => !!l.flags.professorMentor, parts: 1 });
const LIBRARY = story({ id: "library", title: "ห้องทำงานของผู้ก่อตั้ง", hint: "ตำราในห้องลับยังมีหน้าที่หายไป", started: (l) => !!l.flags.secretLibrary, parts: 1 });

const COURT: GameEvent[] = [
  {
    id: "q.garden.1",
    world: "court",
    minAge: 16,
    maxAge: 30,
    weight: 25,
    when: (l) => ready(l, GARDEN.id, 0, 0, GARDEN.started(l)),
    title: "คนที่กลับมาจากสวนลับ",
    text: (l) => `ในงานเลี้ยงต้อนรับทายาทดยุกที่กลับจากชายแดน ${l.gender === "f" ? "ชายหนุ่ม" : "หญิงสาว"}ผมดำหันมามองคุณ แล้วยื่นผ้าเช็ดหน้าปักตราสิงโตทองที่ขาดมุมหนึ่ง "สวนหลังกำแพงยังอยู่ไหม?"`,
    choices: [
      { label: "\"ฉันไปรอทุกบ่ายวันพุธ\"", run: (l) => { done(l, GARDEN.id, 1); const p = l.people.find((x) => x.id === l.flags.gardenFriend); if (p) { p.bond = 85; p.job = "ทายาทดยุก"; } addStat(l, "happiness", 10); return big("เด็กในสวนลับคือทายาทดยุกที่ทั้งจักรวรรดิพูดถึง — และเขาจำทุกอย่างได้"); } },
      { label: "แกล้งจำไม่ได้", run: (l) => { done(l, GARDEN.id, 1, true); return meh("เขาเก็บผ้าเช็ดหน้ากลับเงียบๆ — บางสัญญาก็ปล่อยให้จบในวัยเด็ก"); } },
    ],
  },
  {
    id: "q.garden.2",
    world: "court",
    minAge: 18,
    maxAge: 35,
    weight: 25,
    when: (l) => ready(l, GARDEN.id, 1, 1, true) && !people(l, "spouse").length,
    title: "คำขอแต่งงานในสวนลับ",
    text: () => "สวนหลังกำแพงถูกปลูกใหม่ทั้งสวน ดอกไม้ทุกต้นคือดอกที่คุณเคยบอกว่าชอบตอนเด็ก — และใครบางคนคุกเข่าอยู่กลางสวน",
    choices: [
      { label: "ตอบตกลง", run: (l) => { done(l, GARDEN.id, 2, true); const p = l.people.find((x) => x.id === l.flags.gardenFriend); if (p) { p.relation = "spouse"; p.bond = 95; } addFame(l, 10); addStat(l, "happiness", 20); markTurn(l); return big("💍 งานแต่งงานของทายาทดยุกจัดในสวนเล็กๆ หลังกำแพง — แขกมีแค่คนที่รักคุณจริงๆ"); } },
      { label: "ขอเวลา", run: (l) => { done(l, GARDEN.id, 2, true); return meh("\"ข้ารอได้ ข้ารอมาสิบปีแล้ว\""); } },
    ],
  },
  {
    id: "q.glove.1",
    world: "court",
    minAge: 17,
    maxAge: 35,
    weight: 20,
    when: (l) => ready(l, GLOVE.id, 0, 0, GLOVE.started(l)),
    title: "เจ้าของถุงมือ",
    text: () => "ประกาศจากวังแปะทั่วนครหลวง 「ผู้ที่ถือถุงมือข้างซ้ายจากงานเต้นรำหน้ากาก โปรดมาที่วัง」 — ถุงมือข้างนั้นอยู่ในลิ้นชักคุณ",
    choices: [
      { label: "ไปที่วัง", run: (l) => { done(l, GLOVE.id, 1, true); addFame(l, 12); if (!people(l, "partner").length && !people(l, "spouse").length) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + 1, bond: 80, job: "เชื้อพระวงศ์" }); return big(`${shortName(p)} — เชื้อพระวงศ์ที่ปลอมตัวไปงานเต้นรำ — ยิ้มเมื่อเห็นถุงมือในมือคุณ "ข้าตามหาเจ้ามาทั้งปี"`); } return good("เจ้าของถุงมือคือเชื้อพระวงศ์ — แม้คุณจะมีคนรักแล้ว แต่มิตรภาพนี้ทำให้คุณมีเพื่อนในวัง"); } },
      { label: "ส่งถุงมือคืนทางไปรษณีย์", run: (l) => { done(l, GLOVE.id, 1, true); return meh("ถุงมือกลับถึงเจ้าของ พร้อมโน้ตไม่ลงชื่อ — บางเรื่องก็สวยตรงที่ไม่มีตอนจบ"); } },
    ],
  },
  {
    id: "q.wolf.1",
    world: "court",
    minAge: 14,
    maxAge: 50,
    weight: 15,
    when: (l) => ready(l, WOLF.id, 0, 0, WOLF.started(l)) && l.age >= 14,
    title: "เสียงหอนจากทิศเหนือ",
    text: () => "รถม้าของคุณถูกฝูงมอนสเตอร์ล้อมกลางป่าหิมะ — แล้วหมาป่าสีเงินตัวใหญ่เท่าม้าก็กระโจนลงมาจากหน้าผา ดวงตาสีอำพันคู่นั้นคุ้นเหลือเกิน",
    choices: [
      { label: "เรียกชื่อที่เคยตั้งให้", run: (l) => { done(l, WOLF.id, 1); addStat(l, "luck", 3); return big("หมาป่าภูตจัดการฝูงมอนสเตอร์ในพริบตา แล้วเอาหัวมาซบไหล่คุณเหมือนตอนเป็นลูกหมา"); } },
    ],
  },
  {
    id: "q.wolf.2",
    world: "court",
    minAge: 18,
    maxAge: 60,
    weight: 15,
    when: (l) => ready(l, WOLF.id, 1, 3, true),
    title: "สัญญากับหมาป่าภูต",
    text: () => "หมาป่าภูตมาหาคุณในคืนพระจันทร์เต็มดวง ร่างของมันเรืองแสง — ภูตชั้นสูงขอทำสัญญากับมนุษย์ได้เพียงครั้งเดียวในชีวิต",
    choices: [
      { label: "ทำสัญญา", run: (l) => { done(l, WOLF.id, 2, true); l.flags.wolfPact = true; if (l.power) luckyRankUp(l, "สัญญากับหมาป่าภูตแห่งทิศเหนือ"); else addStat(l, "health", 15); markTurn(l); return big("วงเวทสีเงินผูกคุณกับหมาป่าภูตไว้ตลอดกาล — ทุกฤดูหนาว มันจะมาหาคุณเสมอ"); } },
      { label: "ปล่อยให้มันเป็นอิสระ", run: (l) => { done(l, WOLF.id, 2, true); addStat(l, "happiness", 4); return meh("หมาป่าภูตหอนยาวหนึ่งครั้ง แล้วหายไปในพายุหิมะ"); } },
    ],
  },
  {
    id: "q.sister.1",
    world: "court",
    minAge: 14,
    maxAge: 30,
    weight: 15,
    when: (l) => ready(l, SISTER.id, 0, 0, SISTER.started(l)),
    title: "สร้อยที่หายไป",
    text: () => "สร้อยไข่มุกของแม่หายไป และสาวใช้ “บังเอิญ” เจอมันในห้องคุณ — น้องบุญธรรมยืนร้องไห้อยู่ข้างแม่",
    choices: [
      { label: "ขอให้ตรวจลายนิ้วมือเวท", check: { stat: "smarts", dc: 55 }, skill: ["social", "study"], run: (l, _c, ok) => { done(l, SISTER.id, 1); if (ok) { addFame(l, 4); return good("ลายนิ้วมือบนสร้อยเป็นของน้องบุญธรรม — แม่มองนางด้วยสายตาที่ไม่เคยมองมาก่อน"); } addStat(l, "happiness", -8); return bad("ไม่มีใครเชื่อคุณ ท่านพ่อสั่งกักบริเวณหนึ่งเดือน"); } },
      { label: "เงียบไว้ก่อน แล้วเก็บหลักฐาน", run: (l) => { done(l, SISTER.id, 1); l.flags.sisterEvidence = true; return meh("คุณยอมรับผิดแทน แต่จดทุกอย่างลงสมุดเล่มเล็ก"); } },
    ],
  },
  {
    id: "q.sister.2",
    world: "court",
    minAge: 16,
    maxAge: 35,
    weight: 15,
    when: (l) => ready(l, SISTER.id, 1, 2, true),
    title: "หน้ากากที่หลุดกลางงานเลี้ยง",
    text: () => "งานเลี้ยงหมั้นของน้องบุญธรรม — นางกำลังจะได้แต่งงานกับคนที่คุณแอบชอบ ด้วยแผนการที่ทำลายชื่อเสียงคุณมาตลอด",
    choices: [
      { label: "เปิดสมุดหลักฐานต่อหน้าทุกคน", show: (l) => !!l.flags.sisterEvidence, run: (l) => { done(l, SISTER.id, 2, true); addFame(l, 15); return big("ทุกแผนการถูกอ่านออกเสียงกลางงาน — งานหมั้นล่ม น้องบุญธรรมถูกส่งไปสำนักชีทางใต้"); } },
      { label: "อวยพรให้นาง", run: (l) => { done(l, SISTER.id, 2, true); addStat(l, "happiness", 4); return meh("คุณยกแก้วอวยพร — ปล่อยให้ชีวิตลงโทษนางเอง ซึ่งมันก็ลงโทษจริงในอีกไม่กี่ปี"); } },
    ],
  },
  {
    id: "q.bakery.1",
    world: "court",
    minAge: 14,
    maxAge: 50,
    weight: 15,
    when: (l) => ready(l, BAKERY.id, 0, 0, BAKERY.started(l)) && l.age >= 14,
    title: "ร้านขนมสาขาสอง",
    text: () => "คิวหน้าร้านขนมปังยาวถึงหัวมุมทุกเช้า พ่อค้าผ้าไหมเสนอทุนให้เปิดสาขาในย่านขุนนาง",
    choices: [
      { label: "เปิดสาขา", check: { stat: "smarts", dc: 50 }, skill: ["business", "cook"], run: (l, _c, ok) => { done(l, BAKERY.id, 1); if (ok) { addMoney(l, 600_000); addFame(l, 5); return good("ชีสเค้กกลายเป็นของที่ขุนนางทุกตระกูลต้องมีในงานน้ำชา"); } addMoney(l, -100_000); return bad("สาขาใหม่ขาดทุน — คนย่านขุนนางชอบขนมฝรั่งเศสมากกว่า"); } },
      { label: "อยู่ร้านเดิม ทำให้ดีที่สุด", run: (l) => { done(l, BAKERY.id, 1); addStat(l, "happiness", 4); return meh("ร้านเล็กๆ ที่คนรู้จักทั้งเมือง — แค่นี้ก็พอแล้ว"); } },
    ],
  },
  {
    id: "q.bakery.2",
    world: "court",
    minAge: 18,
    maxAge: 70,
    weight: 15,
    when: (l) => ready(l, BAKERY.id, 1, 3, true),
    title: "ราชโองการเรื่องขนม",
    text: () => "ราชเลขาธิการถือราชสาส์นมาถึงร้าน — จักรพรรดินีทรงโปรดชีสเค้กมากจนอยากให้เป็น 'ขนมประจำราชวงศ์'",
    choices: [{ label: "รับพระราชทาน", run: (l) => { done(l, BAKERY.id, 2, true); addMoney(l, 2_000_000); addFame(l, 15); markTurn(l); return big("ป้ายตราราชวงศ์ถูกแขวนหน้าร้าน — สามัญชนคนแรกที่ได้ส่งขนมเข้าวังตลอดชีพ"); } }],
  },
  {
    id: "q.exfiance.1",
    world: "court",
    minAge: 18,
    maxAge: 40,
    weight: 15,
    when: (l) => ready(l, EXFIANCE.id, 0, 0, EXFIANCE.started(l)) && l.age >= 18,
    title: "คู่หมั้นเก่า",
    text: () => "คู่หมั้นเก่าที่คุณถอนหมั้นต่อหน้าจักรพรรดิ ตอนนี้มีอำนาจในสภาขุนนาง และกำลังยื่นเรื่องยึดที่ดินตระกูลคุณ",
    choices: [
      { label: "เจรจาตรงๆ", check: { stat: "looks", dc: 55 }, skill: ["social"], run: (l, _c, ok) => { done(l, EXFIANCE.id, 1, true); if (ok) { addFame(l, 6); return good("คุณพูดสิ่งที่ไม่เคยได้พูดตอนถอนหมั้น — อีกฝ่ายถอนเรื่อง และเป็นครั้งแรกที่ทั้งคู่ยิ้มให้กัน"); } addMoney(l, -1_000_000); return bad("การเจรจาล้มเหลว ตระกูลเสียที่ดินผืนใหญ่"); } },
      { label: "สู้ในสภาด้วยหลักฐานทุจริตของเขา", check: { stat: "smarts", dc: 60 }, skill: ["study"], run: (l, _c, ok) => { done(l, EXFIANCE.id, 1, true); if (ok) { addFame(l, 12); return big("หลักฐานทุจริตทำให้เขาหลุดจากสภา — ราชสำนักเริ่มจับตาคุณในฐานะนักการเมือง"); } addFame(l, -8); return bad("หลักฐานไม่พอ คุณกลายเป็นคนใส่ร้ายในสายตาขุนนาง"); } },
    ],
  },
  {
    id: "q.bastard.1",
    world: "court",
    minAge: 12,
    maxAge: 30,
    weight: 15,
    when: (l) => ready(l, BASTARD.id, 0, 0, BASTARD.started(l)),
    title: "พี่น้องต่างแม่",
    text: () => "ลูกชายคนโตของเคานต์โยนอาหารของคุณลงพื้นต่อหน้าคนรับใช้ \"ลูกเมียน้อยไม่มีสิทธิ์นั่งโต๊ะเดียวกับเรา\"",
    choices: [
      { label: "เก็บขึ้นมากินต่อหน้าเขา", run: (l) => { done(l, BASTARD.id, 1); addStat(l, "happiness", -4); l.flags.bastardPatience = true; return meh("คนรับใช้หลายคนมองคุณด้วยความนับถือ — ความอดทนเป็นอาวุธอย่างหนึ่ง"); } },
      { label: "ท้าดวลดาบ", tone: "danger", odds: (l) => fight(l, 0), run: (l, _c, ok) => { done(l, BASTARD.id, 1); if (ok) { addFame(l, 6); return good("ดาบของพี่ชายต่างแม่หลุดจากมือ ท่านเคานต์มองคุณด้วยสายตาที่ต่างไป"); } return bad(`คุณแพ้ และถูกขังในห้องเก็บของสามวัน${hurt(l, 3, 8, "บาดเจ็บจากการดวล")}`); } },
    ],
  },
  {
    id: "q.bastard.2",
    world: "court",
    minAge: 20,
    maxAge: 60,
    weight: 15,
    when: (l) => ready(l, BASTARD.id, 1, 4, true),
    title: "พินัยกรรมของเคานต์",
    text: () => "ท่านเคานต์ล้มป่วยหนัก และเรียกคุณเข้าห้องคนเดียว \"ข้าดูเจ้ามาตลอด… ในบรรดาลูกทั้งหมด เจ้าคนเดียวที่ไม่เคยขออะไรจากข้า\"",
    choices: [
      { label: "รับตำแหน่งทายาท", run: (l) => { done(l, BASTARD.id, 2, true); l.wealth = "elite"; addMoney(l, 5_000_000); addFame(l, 15); markTurn(l); return big("ลูกนอกสมรสกลายเป็นเคานต์คนใหม่ — พี่น้องต่างแม่ทั้งหมดต้องคุกเข่าในพิธีสืบตำแหน่ง"); } },
      { label: "ขอแค่ให้แม่ได้กลับมาอยู่ด้วย", run: (l) => { done(l, BASTARD.id, 2, true); addStat(l, "happiness", 15); return big("ท่านเคานต์ร้องไห้ แล้วส่งรถม้าไปรับแม่คุณกลับมาในวันนั้น"); } },
    ],
  },
  {
    id: "q.ch3.1",
    world: "court",
    minAge: 15,
    maxAge: 25,
    weight: 20,
    when: (l) => ready(l, CH3.id, 0, 0, CH3.started(l)) && since(l, "ch3") >= 0,
    title: "\"เธอเป็นใครกันแน่\"",
    text: (l) => `${l.gender === "f" ? "ลิเซีย" : "ลิออน"} ตัวเอกของนิยาย ดักรอคุณหลังเลิกเรียน "เธอรู้ว่ากับดักจะทำงานก่อนที่มันจะทำงาน — เธอรู้อะไรอีก?"`,
    choices: [
      { label: "บอกความจริงว่ามาจากโลกอื่น", run: (l) => { done(l, CH3.id, 1); l.flags.heroKnows = true; addStat(l, "happiness", 6); return big("ตัวเอกนิ่งไปนาน แล้วยื่นมือมา \"งั้นช่วยฉันเปลี่ยนตอนจบด้วยนะ\""); } },
      { label: "โกหกว่าแค่โชคดี", run: (l) => { done(l, CH3.id, 1); return meh("ตัวเอกไม่เชื่อ แต่ก็ไม่ถามต่อ — และเริ่มคอยจับตาคุณทุกวัน"); } },
    ],
  },
  {
    id: "q.ch3.2",
    world: "court",
    minAge: 18,
    maxAge: 30,
    weight: 20,
    when: (l) => ready(l, CH3.id, 1, 2, true),
    title: "ตอนจบที่ไม่มีในนิยาย",
    text: () => "ไคลแมกซ์ของนิยายมาถึง — ในต้นฉบับ ตัวเอกต้องเสียสละตัวเองเพื่อผนึกราชาปีศาจ แต่คุณรู้ทางที่สาม",
    choices: [
      { label: "ใช้ความรู้จากนิยายเปลี่ยนตอนจบ", tone: "danger", odds: (l) => clamp(0.4 + (l.stats.smarts - 50) / 100 + (l.flags.heroKnows ? 0.2 : 0), 0.1, 0.9), run: (l, _c, ok) => { done(l, CH3.id, 2, true); if (ok) { addFame(l, 25); if (l.power) luckyRankUp(l, "คุณเขียนตอนจบใหม่ให้นิยาย"); markTurn(l); return big("ราชาปีศาจถูกผนึกโดยไม่มีใครต้องตาย — ตัวประกอบที่ควรตายในบทที่ 3 คือคนที่ช่วยทั้งเรื่องไว้"); } addStat(l, "health", -20); return bad("เนื้อเรื่องต้านกลับ ตัวเอกเสียสละตามต้นฉบับ — คุณได้แต่มองจากที่ไกล"); } },
      { label: "ปล่อยให้เนื้อเรื่องดำเนินไป", run: (l) => { done(l, CH3.id, 2, true); addStat(l, "happiness", -10); return meh("ตอนจบเป็นไปตามนิยายทุกตัวอักษร — คุณรอดในฐานะตัวประกอบ แต่หัวใจไม่เคยเบาอีกเลย"); } },
    ],
  },
  {
    id: "q.prof.1",
    world: "court",
    minAge: 18,
    maxAge: 40,
    weight: 20,
    when: (l) => ready(l, PROF.id, 0, 0, PROF.started(l)) && l.age >= 18,
    title: "งานวิจัยชิ้นสุดท้าย",
    text: () => "อาจารย์เวทอาวุโสเสียชีวิตอย่างสงบ ทนายนำกล่องไม้มาให้คุณ ข้างในคืองานวิจัยวงเวทที่เขาไม่เคยเผยแพร่ พร้อมโน้ต \"ทำให้มันเสร็จแทนข้าที\"",
    choices: [
      { label: "ทำงานวิจัยต่อจนเสร็จ", check: { stat: "smarts", dc: 60 }, skill: ["study"], run: (l, _c, ok) => { done(l, PROF.id, 1, true); if (ok) { if (l.power) luckyRankUp(l, "งานวิจัยของอาจารย์ปลดล็อกวงเวทใหม่"); addFame(l, 12); return big("งานวิจัยของสองคนสองรุ่นเปลี่ยนทฤษฎีเวทของทั้งจักรวรรดิ"); } return meh("คุณติดอยู่ที่หน้าสุดท้ายหลายปี — แต่ทุกคืนวันพฤหัส คุณยังเปิดกล่องนั้นดู"); } },
    ],
  },
  {
    id: "q.library.1",
    world: "court",
    minAge: 15,
    maxAge: 50,
    weight: 15,
    when: (l) => ready(l, LIBRARY.id, 0, 3, LIBRARY.started(l)) && l.age >= 15,
    title: "หน้าที่หายไป",
    text: () => "ในห้องทำงานของผู้ก่อตั้งสถาบัน มีตำราเล่มหนึ่งที่หน้าสุดท้ายถูกฉีกออก รอยฉีกเรืองแสงจางๆ เหมือนรอให้ใครสักคนต่อให้ครบ",
    choices: [
      { label: "ตามหาหน้าที่หายไปทั่วนครหลวง", check: { stat: "luck", dc: 55 }, run: (l, _c, ok) => { done(l, LIBRARY.id, 1, true); if (ok) { if (l.power) luckyRankUp(l, "คุณต่อตำราของผู้ก่อตั้งได้ครบ"); else addStat(l, "smarts", 8); markTurn(l); return big("หน้าสุดท้ายซ่อนอยู่ในปกหนังสือนิทานเด็กในหอสมุดหลวง — ตำราที่ครบแล้วส่องแสงทั้งห้อง"); } return meh("คุณตามหาอยู่สามปีโดยไม่เจออะไรเลย"); } },
    ],
  },
];

// ───────────────────────── โลกยุคปัจจุบัน ─────────────────────────

const GAMER = story({ id: "gamer", title: "เด็กติดเกม", hint: "เกมที่เล่นทั้งคืนตอนมัธยมอาจไม่ได้ไร้ค่า", started: (l) => !!l.flags.gamer, parts: 2 });
const BLOOD = story({ id: "blood", title: "เงินเปื้อนเลือด", hint: "ห้าล้านที่คุณรับมาไม่ได้มาฟรีๆ", started: (l) => !!l.flags.blood, parts: 1 });
const OLYMPIAD = story({ id: "olympiad", title: "เหรียญทองโอลิมปิกวิชาการ", hint: "มหาวิทยาลัยต่างประเทศยังจับตาคุณ", started: (l) => !!l.flags.olympiad, parts: 1 });
const ORDAINED = story({ id: "ordained", title: "เพื่อนที่บวชด้วยกัน", hint: "เพื่อนที่บวชพร้อมคุณยังไม่สึก", started: (l) => !!l.flags.ordained, parts: 1 });
const HUNTERC = story({ id: "huntercontact", title: "Hunter ที่ยิ้มให้", hint: "Hunter ที่คุณเจอยังเก็บเบอร์คุณไว้", started: (l) => !!l.flags.hunterContact, parts: 1 });
const DREAMH = story({ id: "dreamhunter", title: "ฮีโร่ในทีวี", hint: "Hunter แรงก์ S ที่คุณเห็นในทีวีตอนเด็กยังอยู่ในวงการ", started: (l) => !!l.flags.dreamHunter, parts: 2 });
const RULING = story({ id: "ruling", title: "ตระกูลที่ถูกปฏิเสธ", hint: "ตระกูลผู้ปกครองชั้นบนไม่ชอบคนที่ปฏิเสธ", started: (l) => !!l.flags.rulingGrudge, parts: 1 });
const RELIC = story({ id: "relic", title: "ผลึกเรืองแสงในบ้าน", hint: "ผลึกจากหอคอยในห้องคุณสว่างขึ้นทุกปี", started: (l) => !!l.flags.relicHome, parts: 1 });
const TLORE = story({ id: "towerlore", title: "ทีมที่หายไปในชั้น 20", hint: "ศิษย์เก่าแขนกลยังตามหาทีมเก่าของเขา", started: (l) => !!l.flags.towerLore, parts: 1 });
const MAFIA = story({ id: "mafia", title: "หนี้มาเฟีย", hint: "โทรศัพท์จากเบอร์แปลกๆ ไม่เคยหยุด", started: (l) => !!l.flags.mafiaDebt, parts: 2 });
const HEIR = story({ id: "heir", title: "ทายาทที่แกล้งโง่", hint: "ญาติทุกคนยังประมาทคุณ — ตอนนี้", started: (l) => !!l.flags.hiddenHeir, parts: 1 });
const SYSLORE = story({ id: "syslore", title: "ผู้ใช้คนก่อนหน้า", hint: "ระบบเคยมีผู้ใช้มาก่อนคุณ", started: (l) => !!l.flags.systemLore, parts: 2 });
const NOVEL = story({ id: "novel", title: "ผู้เขียนนิยายที่ไม่มีใครอ่าน", hint: "คนเขียนนิยายเรื่องนั้นไม่เคยตอบข้อความคุณ", started: (l) => !!l.flags.readNovel, parts: 2 });

const MODERN: GameEvent[] = [
  {
    id: "q.gamer.1",
    world: "modern",
    minAge: 18,
    maxAge: 28,
    weight: 15,
    when: (l) => ready(l, GAMER.id, 0, 0, GAMER.started(l)),
    title: "แมวมองทีมอีสปอร์ต",
    text: () => "ข้อความจากทีมอีสปอร์ตอาชีพ \"เราดูรีเพลย์ของคุณตั้งแต่สมัยมัธยม — สนใจมาคัดตัวไหม\"",
    choices: [
      { label: "ไปคัดตัว", check: { stat: "luck", dc: 50 }, skill: ["game"], run: (l, _c, ok) => { done(l, GAMER.id, 1); if (ok) { addMoney(l, 300_000); addFame(l, 6); l.flags.esports = true; return good("คุณติดตัวสำรองของทีม — คืนที่เคยเล่นเกมจนแม่บ่นกลายเป็นเงินเดือนแล้ว"); } return meh("คุณตกรอบสุดท้าย — แต่ได้รู้ว่าตัวเองเกือบถึง"); } },
      { label: "ปฏิเสธ — โตแล้ว", run: (l) => { done(l, GAMER.id, 1, true); return meh("คุณลบเกมทิ้ง แล้วไปสมัครงานบริษัท"); } },
    ],
  },
  {
    id: "q.gamer.2",
    world: "modern",
    minAge: 19,
    maxAge: 32,
    weight: 15,
    when: (l) => ready(l, GAMER.id, 1, 2, true) && !!l.flags.esports,
    title: "รอบชิงชนะเลิศระดับโลก",
    text: () => "ตัวหลักของทีมป่วยกะทันหันก่อนรอบชิงแชมป์โลก โค้ชหันมามองคุณ \"ถึงตาเธอแล้ว\"",
    choices: [
      { label: "ลงแข่ง", tone: "danger", skill: ["game"], odds: (l) => clamp(0.35 + l.stats.luck / 200 + l.stats.smarts / 300, 0.1, 0.85), run: (l, _c, ok) => { done(l, GAMER.id, 2, true); if (ok) { addMoney(l, 3_000_000); addFame(l, 20); markTurn(l); return big("🏆 ตัวสำรองพาทีมคว้าแชมป์โลก — ทั้งประเทศเห็นชื่อคุณบนจอยักษ์"); } addFame(l, 4); return meh("ทีมแพ้ในเกมสุดท้าย แต่การเล่นของคุณกลายเป็นไฮไลต์ที่คนดูซ้ำทั้งปี"); } },
    ],
  },
  {
    id: "q.blood.1",
    world: "hunter",
    minAge: 20,
    maxAge: 70,
    weight: 15,
    when: (l) => ready(l, BLOOD.id, 0, 3, BLOOD.started(l)) && since(l, "blood") >= 0,
    title: "อดีตที่ตามมาหลอน",
    text: () => "ชายแปลกหน้ายื่นรูปถ่ายเก่าให้ — เป็นรูปวันที่คุณรับเงินห้าล้านนั้น \"สมาคม Hunter ยังไม่รู้เรื่องนี้… ห้าล้านแลกกับความเงียบไหม?\"",
    choices: [
      { label: "จ่าย", run: (l) => { done(l, BLOOD.id, 1, true); addMoney(l, -5_000_000); addStat(l, "happiness", -10); return bad("คุณจ่ายคืนทุกบาท — และนอนไม่หลับไปอีกหลายเดือน"); } },
      { label: "ไปสารภาพกับสมาคมเอง", run: (l) => { done(l, BLOOD.id, 1, true); addFame(l, -5); addStat(l, "happiness", 12); return big("ถูกพักงานหนึ่งปี แต่เป็นครั้งแรกในรอบหลายปีที่คุณนอนหลับสนิท"); } },
      { label: "จัดการคนแบล็กเมล์", tone: "danger", odds: (l) => fight(l, 0), run: (l, _c, ok) => { done(l, BLOOD.id, 1, true); if (ok) { addStat(l, "happiness", -6); return meh("ชายคนนั้นหายไปจากเมือง — ความลับยังเป็นความลับ แต่คุณรู้ว่าตัวเองเป็นคนแบบไหนแล้ว"); } addFame(l, -20); return bad("เขาหนีไปพร้อมรูปถ่าย — ข่าวฉาวเต็มหน้าหนึ่งในสัปดาห์ถัดมา"); } },
    ],
  },
  {
    id: "q.olympiad.1",
    world: "modern",
    minAge: 18,
    maxAge: 25,
    weight: 20,
    when: (l) => ready(l, OLYMPIAD.id, 0, 0, OLYMPIAD.started(l)) && l.age >= 18,
    title: "ทุนเรียนต่างประเทศ",
    text: () => "จดหมายจากมหาวิทยาลัยระดับโลก — กรรมการที่เคยคุมสอบโอลิมปิกวิชาการจำคุณได้ และเสนอทุนเต็มจำนวน",
    choices: [
      { label: "ไปเรียน", run: (l) => { done(l, OLYMPIAD.id, 1, true); addStat(l, "smarts", 8); addFame(l, 5); for (const p of l.people) if (p.alive && ["father", "mother"].includes(p.relation)) p.bond = clamp(p.bond - 5, 0, 100); return big("สี่ปีในต่างแดน คุณกลับมาพร้อมปริญญาและเพื่อนจากสามสิบประเทศ"); } },
      { label: "อยู่ดูแลครอบครัว", run: (l) => { done(l, OLYMPIAD.id, 1, true); for (const p of l.people) if (p.alive && ["father", "mother"].includes(p.relation)) p.bond = clamp(p.bond + 10, 0, 100); return meh("แม่ร้องไห้ตอนรู้ว่าคุณปฏิเสธทุนเพื่อเธอ"); } },
    ],
  },
  {
    id: "q.ordained.1",
    world: "modern",
    minAge: 25,
    maxAge: 70,
    weight: 12,
    when: (l) => ready(l, ORDAINED.id, 0, 5, ORDAINED.started(l)) && since(l, "ordained") >= 0 && l.age >= 25,
    title: "หลวงพี่เพื่อนเก่า",
    text: () => "เพื่อนที่บวชพร้อมคุณตอนนั้นไม่สึกอีกเลย ตอนนี้เป็นเจ้าอาวาสวัดเล็กๆ ต่างจังหวัด และส่งจดหมายมาชวนไปปฏิบัติธรรมสักสัปดาห์",
    choices: [
      { label: "ไปหา", run: (l) => { done(l, ORDAINED.id, 1, true); addStat(l, "happiness", 12); addStat(l, "health", 4); return good("หนึ่งสัปดาห์ที่ไม่มีมือถือ คุณกลับมาพร้อมใจที่เบาเหมือนอายุยี่สิบ"); } },
      { label: "ส่งปัจจัยไปทำบุญแทน", run: (l) => { done(l, ORDAINED.id, 1, true); addMoney(l, -20_000); addStat(l, "luck", 2); return meh("หลวงพี่ส่งรูปศาลาที่สร้างเสร็จกลับมา พร้อมคำว่า 'อนุโมทนา'"); } },
    ],
  },
  {
    id: "q.huntercontact.1",
    world: "hunter",
    minAge: 18,
    maxAge: 40,
    weight: 15,
    when: (l) => ready(l, HUNTERC.id, 0, 1, HUNTERC.started(l)) && l.age >= 18,
    title: "ข้อความจาก Hunter คนนั้น",
    text: () => "Hunter ที่คุณเคยยิ้มให้หลังเหตุการณ์ Gate Break ส่งข้อความมา \"เลิกงานแล้วไปกินหมูกระทะกันไหม? ผมยังจำรอยยิ้มนั้นได้\"",
    choices: [
      { label: "ไป", run: (l) => { done(l, HUNTERC.id, 1, true); if (!people(l, "partner").length && !people(l, "spouse").length) { const p = createPerson(l, "partner", { age: l.age + randInt(l, 0, 5), bond: 70, job: "Hunter แรงก์ B" }); return big(`💕 คุณกับ${shortName(p)}คุยกันจนร้านปิด — วันรุ่งขึ้นเขาส่งดอกไม้มาที่ทำงาน`); } createPerson(l, "friend", { age: l.age + 2, bond: 65, job: "Hunter แรงก์ B" }); return good("คุณมีเพื่อนเป็น Hunter แล้วหนึ่งคน — ข้อมูลวงในเพียบ"); } },
      { label: "ไม่ตอบ", run: (l) => { done(l, HUNTERC.id, 1, true); return meh("ข้อความนั้นค้างอยู่ในแชตหลายปี"); } },
    ],
  },
  {
    id: "q.dreamhunter.1",
    world: "hunter",
    minAge: 19,
    maxAge: 40,
    weight: 15,
    when: (l) => ready(l, DREAMH.id, 0, 0, DREAMH.started(l)) && !!l.power,
    title: "ฮีโร่ในวัยเด็ก",
    text: () => "Hunter แรงก์ S ที่คุณเห็นในทีวีตอนเด็กมาเยี่ยมศูนย์ฝึก — เขาหยุดตรงหน้าคุณ \"สายตาเธอเหมือนฉันตอนหนุ่มๆ\"",
    choices: [
      { label: "ขอให้เขาสอน", check: { stat: "looks", dc: 50 }, skill: ["social"], run: (l, _c, ok) => { done(l, DREAMH.id, 1); if (ok) { gainExp(l, 800); l.flags.heroMentor = true; return good("เขาสอนคุณทุกเสาร์ — ความฝันวัยเด็กกลายเป็นความจริงครึ่งหนึ่งแล้ว"); } return meh("เขาหัวเราะ \"มาใหม่ตอนแรงก์ B นะ\""); } },
      { label: "ยื่นสมุดวาดรูปตอนเด็กให้เซ็น", run: (l) => { done(l, DREAMH.id, 1); addStat(l, "happiness", 10); return good("เขาเซ็นให้ทุกหน้า แล้วเขียนว่า 'รอเจอกันในสนามรบนะ'"); } },
    ],
  },
  {
    id: "q.dreamhunter.2",
    world: "hunter",
    minAge: 22,
    maxAge: 60,
    weight: 15,
    when: (l) => ready(l, DREAMH.id, 1, 4, true) && !!l.power,
    title: "การต่อสู้ครั้งสุดท้ายของฮีโร่",
    text: () => "Gate แดงเปิดกลางเมือง Hunter แรงก์ S คนนั้นยืนขวางทางเข้าคนเดียว เลือดเต็มตัว \"มาพอดี… ช่วยฉันหน่อย\"",
    choices: [
      { label: "เข้าไปสู้เคียงข้างเขา", tone: "danger", odds: (l) => fight(l, 2), survival: (l) => live(l, 1), run: (l, _c, ok) => { done(l, DREAMH.id, 2, true); if (ok) { luckyRankUp(l, "สู้เคียงข้างฮีโร่ในวัยเด็กจนปิด Gate แดงได้"); addFame(l, 15); return big("คุณกับฮีโร่ปิด Gate แดงได้ — ข่าวพาดหัว 'ส่งต่อคบเพลิง' ทั่วประเทศ"); } if (!chance(l, live(l, 1))) { kill(l, "สิ้นชีพเคียงข้างฮีโร่ในวัยเด็กที่ Gate แดง"); return bad("คุณยืนอยู่ข้างเขาจนวินาทีสุดท้าย…"); } l.power?.items.push("ดาบของฮีโร่"); addStat(l, "happiness", -15); return bad("ฮีโร่ล้มลงโดยมีคุณอยู่ข้างกาย — ดาบของเขาตกมาอยู่ในมือคุณ"); } },
    ],
  },
  {
    id: "q.ruling.1",
    world: "tower",
    minAge: 20,
    maxAge: 60,
    weight: 15,
    when: (l) => ready(l, RULING.id, 0, 2, RULING.started(l)) && since(l, "ruling") >= 0 && !!l.power,
    title: "บททดสอบที่ถูกจัดฉาก",
    text: () => "ผู้คุมชั้นคราวนี้แข็งแกร่งผิดปกติ — และตราบนเกราะของมันคือตราของตระกูลที่คุณเคยปฏิเสธ",
    choices: [
      { label: "สู้ให้ทุกคนเห็น", tone: "danger", odds: (l) => fight(l, 1), survival: (l) => live(l, 1), run: (l, _c, ok) => { done(l, RULING.id, 1, true); if (ok) { addFame(l, 15); return big("คุณล้มผู้คุมที่ตระกูลส่งมา ต่อหน้ากล้องถ่ายทอดทุกตัว — ตระกูลนั้นเสียหน้าไปทั้งหอคอย"); } if (!chance(l, live(l, 1))) { kill(l, "ถูกผู้คุมชั้นที่ตระกูลผู้ปกครองจัดฉากสังหาร"); return bad("ตระกูลนั้นไม่เคยลืมคนที่ปฏิเสธ…"); } return bad(`คุณรอดมาได้ และเอาคลิปเกราะไปเปิดโปงทีหลัง${hurt(l, 10, 22, "บาดแผลจากบททดสอบจัดฉาก")}`); } },
    ],
  },
  {
    id: "q.relic.1",
    world: "tower",
    minAge: 14,
    maxAge: 70,
    weight: 15,
    when: (l) => ready(l, RELIC.id, 0, 3, RELIC.started(l)) && since(l, "relic") >= 0,
    title: "ผลึกที่เรียกชื่อคุณ",
    text: () => "ผลึกในห้องคุณสว่างจ้ากลางดึก แล้วฉายภาพห้องหนึ่งบนชั้น 33 — มีคนติดอยู่ในนั้น กำลังเคาะผนังขอความช่วยเหลือ",
    choices: [
      { label: "แจ้งสถาบันวิจัยหอคอย", run: (l) => { done(l, RELIC.id, 1, true); addMoney(l, 1_000_000); addFame(l, 6); return good("ทีมกู้ภัยช่วยผู้ท้าชิงที่ติดอยู่สามปีออกมาได้ — สถาบันมอบรางวัลให้คุณ"); } },
      { label: "เก็บเป็นความลับ แล้วรอคำเชิญ", run: (l) => { done(l, RELIC.id, 1, true); if (!l.power && !l.flags.awakenDone) { l.flags.awakenAge = l.age + 1; return big("ผลึกกระซิบตอบ — ปีหน้า คำเชิญจะมาถึงคุณ"); } addStat(l, "luck", 4); return meh("ภาพนั้นหายไป แต่ผลึกยังอุ่นอยู่ในมือคุณทุกคืน"); } },
    ],
  },
  {
    id: "q.towerlore.1",
    world: "tower",
    minAge: 19,
    maxAge: 50,
    weight: 15,
    when: (l) => ready(l, TLORE.id, 0, 0, TLORE.started(l)) && Number(l.flags.floor ?? 0) >= 20,
    title: "ทีมที่หายไปในชั้น 20",
    text: () => "คุณเจอเหรียญทีมเก่าในซากห้องของชั้น 20 — ชื่อบนเหรียญคือชื่อทีมของศิษย์เก่าแขนกลที่เคยมาพูดที่โรงเรียน",
    choices: [
      { label: "ตามหาทีมนั้น", tone: "danger", odds: (l) => fight(l, 0), run: (l, _c, ok) => { done(l, TLORE.id, 1, true); if (ok) { addFame(l, 8); gainExp(l, 600); return big("คุณเจอผู้รอดชีวิตสองคนที่ติดอยู่ในห้องลับสิบปี — ศิษย์เก่าแขนกลร้องไห้ตอนเห็นเพื่อนเก่าเดินออกจากแสง"); } return bad(`คุณเจอแค่โครงกระดูกกับบันทึก — แต่ได้นำมันกลับไปให้ครอบครัวของพวกเขา${hurt(l, 5, 12, "ติดกับดักในชั้นร้าง")}`); } },
    ],
  },
  {
    id: "q.mafia.1",
    world: "ordinary",
    minAge: 20,
    maxAge: 70,
    weight: 15,
    when: (l) => ready(l, MAFIA.id, 0, 1, MAFIA.started(l)) && since(l, "mafia") >= 0,
    title: "งานแรกที่เจ้านายสั่ง",
    text: () => "เบอร์แปลกโทรมาตอนตีสอง \"ถึงเวลาจ่ายหนี้แล้ว — คืนพรุ่งนี้ไปส่งกระเป๋าใบหนึ่งที่ท่าเรือ ห้ามเปิดดู\"",
    choices: [
      { label: "ไปส่ง", run: (l) => { done(l, MAFIA.id, 1); addMoney(l, 500_000); addStat(l, "happiness", -8); return bad("กระเป๋าหนักผิดปกติ คุณไม่ถามอะไร — และรู้ว่านี่ยังไม่ใช่งานสุดท้าย"); } },
      { label: "แจ้งตำรวจ", run: (l) => { done(l, MAFIA.id, 1); l.flags.mafiaInformant = true; return meh("ตำรวจขอให้คุณทำทีเป็นไปส่ง — คุณกลายเป็นสายลับโดยไม่ได้ตั้งใจ"); } },
    ],
  },
  {
    id: "q.mafia.2",
    world: "ordinary",
    minAge: 21,
    maxAge: 75,
    weight: 15,
    when: (l) => ready(l, MAFIA.id, 1, 2, true),
    title: "คืนที่ท่าเรือ",
    text: (l) => (l.flags.mafiaInformant ? "ตำรวจล้อมท่าเรือ — แต่มีคนในสถานีปล่อยข่าว มาเฟียรู้แล้วว่าคุณเป็นสาย" : "เจ้านายเรียกคุณไปพบ \"แกทำงานดี — ถึงเวลาขึ้นเป็นมือขวาของฉันแล้ว\""),
    choices: [
      { label: (l) => (l.flags.mafiaInformant ? "หนีออกจากท่าเรือ" : "ปฏิเสธ แล้วตัดขาด"), tone: "danger", odds: (l) => fight(l, 0), run: (l, _c, ok) => { done(l, MAFIA.id, 2, true); if (ok) { addFame(l, 5); return big(l.flags.mafiaInformant ? "คุณรอดออกมาได้ และคำให้การของคุณทำให้เครือข่ายมาเฟียล่มทั้งเครือข่าย" : "คุณเดินออกจากห้องนั้นได้ทั้งที่ทุกคนคิดว่าคุณจะไม่ได้ออกมา — มาเฟียไม่ยุ่งกับคุณอีก"); } addStat(l, "health", -25); if (l.stats.health <= 0) { kill(l, "ถูกมาเฟียเก็บที่ท่าเรือ"); return bad("ทะเลคืนนั้นมืดสนิท…"); } return bad("คุณรอดมาด้วยแผลกระสุนที่ไหล่ — และต้องย้ายเมืองไปเริ่มต้นใหม่"); } },
      { label: "ยอมเป็นคนของพวกมัน", show: (l) => !l.flags.mafiaInformant, run: (l) => { done(l, MAFIA.id, 2, true); addMoney(l, 5_000_000); addFame(l, -20); return bad("คุณรวยขึ้นมาก — และไม่มีวันได้นอนหลับสนิทอีกเลย"); } },
    ],
  },
  {
    id: "q.heir.1",
    world: "ordinary",
    minAge: 25,
    maxAge: 60,
    weight: 15,
    when: (l) => ready(l, HEIR.id, 0, 3, HEIR.started(l)) && since(l, "heir") >= 0,
    title: "ศึกชิงบัลลังก์ของตระกูล",
    text: () => "คุณปู่ประธานล้มป่วย ญาติทุกคนเริ่มแย่งหุ้น — และไม่มีใครนับคุณเป็นคู่แข่ง เพราะทุกคนคิดว่าคุณเป็นแค่ทายาทหัวทึบ",
    choices: [
      { label: "เปิดไพ่ที่ซ่อนไว้ทั้งหมด", check: { stat: "smarts", dc: 55 }, skill: ["business"], run: (l, _c, ok) => { done(l, HEIR.id, 1, true); if (ok) { addMoney(l, 50_000_000); addFame(l, 20); markTurn(l); return big("หุ้นที่คุณเก็บเงียบมาสิบปีมากพอจะคุมบอร์ด — ทายาทหัวทึบกลายเป็นประธานคนใหม่ในคืนเดียว"); } addMoney(l, 5_000_000); return meh("คุณได้ส่วนแบ่งพอสมควร แต่บัลลังก์ตกเป็นของลุง"); } },
    ],
  },
  {
    id: "q.syslore.1",
    world: "ordinary",
    minAge: 20,
    maxAge: 70,
    weight: 15,
    when: (l) => ready(l, SYSLORE.id, 0, 2, SYSLORE.started(l)) && since(l, "syslore") >= 0,
    title: "หลุมศพของผู้ใช้คนก่อน",
    text: () => "ระบบนำทางคุณไปที่สุสานเก่าชานเมือง หลุมศพหนึ่งสลักวันตายตรงกับวันที่ระบบของคุณเริ่มทำงาน — ข้างหลุมมีกล่องเหล็กฝังอยู่",
    choices: [
      { label: "เปิดกล่อง", run: (l) => { done(l, SYSLORE.id, 1); if (l.sys) l.sys.points += 8; addStat(l, "smarts", 3); return big("ในกล่องคือบันทึกของผู้ใช้คนก่อน — 'ระบบไม่ใช่ศัตรู แต่อย่าเชื่อทุกภารกิจ' พร้อมแต้มสถานะที่เขาเก็บไว้ให้คนต่อไป (+8)"); } },
      { label: "ปล่อยให้เขาพักผ่อน", run: (l) => { done(l, SYSLORE.id, 1, true); addStat(l, "happiness", 3); return meh("คุณวางดอกไม้ไว้หน้าหลุม — ระบบเงียบไปทั้งวัน เหมือนกำลังไว้อาลัย"); } },
    ],
  },
  {
    id: "q.syslore.2",
    world: "ordinary",
    minAge: 25,
    maxAge: 80,
    weight: 15,
    when: (l) => ready(l, SYSLORE.id, 1, 4, true) && !!l.sys,
    title: "ภารกิจที่ผู้ใช้คนก่อนล้มเหลว",
    system: true,
    text: () => "[ระบบ] ภารกิจพิเศษ: 「เชื่อใจคนหนึ่งคนด้วยชีวิต」 — บันทึกของผู้ใช้คนก่อนบอกว่าเขาตายเพราะภารกิจนี้",
    choices: [
      { label: "เลือกเชื่อใจคนที่รักที่สุด", run: (l) => { done(l, SYSLORE.id, 2, true); const p = l.people.filter((x) => x.alive && x.relation !== "rival").sort((a, b) => b.bond - a.bond)[0]; if (p && p.bond >= 70) { if (l.sys) l.sys.points += 10; p.bond = 100; markTurn(l); return big(`คุณบอกความลับเรื่องระบบกับ${shortName(p)} — ${shortName(p)}กอดคุณแน่น "ฉันรู้มานานแล้วว่าเธอแบกอะไรอยู่" [ภารกิจสำเร็จ: แต้มสถานะ +10]`); } addStat(l, "happiness", -10); return bad("คนที่คุณเลือกยังไม่พร้อมจะรับความลับนั้น — ระบบบันทึกว่า 'ล้มเหลว' เหมือนผู้ใช้คนก่อน"); } },
      { label: "ปฏิเสธภารกิจ", run: (l) => { done(l, SYSLORE.id, 2, true); return meh("[ระบบ] รับทราบ — บางภารกิจก็ไม่ควรรับ"); } },
    ],
  },
  {
    id: "q.novel.1",
    world: "apocalypse",
    minAge: 16,
    maxAge: 80,
    weight: 25,
    when: (l) => ready(l, NOVEL.id, 0, 0, NOVEL.started(l)) && !!l.flags.doomed && !l.flags.rebuilt,
    title: "ผู้เขียน",
    text: () => "ในฐานผู้รอดชีวิตแห่งหนึ่ง มีชายผอมโซนั่งเขียนอะไรบางอย่างในสมุดตลอดเวลา — ปกสมุดเขียนว่า 'วิธีเอาตัวรอดหลังวันที่โลกพัง ตอนที่ 3,001'",
    choices: [
      { label: "\"ผมคือผู้อ่านคนเดียวของคุณ\"", run: (l) => { done(l, NOVEL.id, 1); const p = createPerson(l, "ally", { gender: "m", age: l.age + randInt(l, 3, 10), bond: 80, job: "ผู้เขียนนิยายวันสิ้นโลก" }); markTurn(l); return big(`${shortName(p)}ทำปากกาหล่น แล้วหัวเราะทั้งน้ำตา "ผมเขียนต่อทุกวัน… เพราะรู้ว่ามีคนหนึ่งคนอ่านอยู่"`); } },
    ],
  },
  {
    id: "q.novel.2",
    world: "apocalypse",
    minAge: 18,
    maxAge: 90,
    weight: 25,
    when: (l) => ready(l, NOVEL.id, 1, 2, true) && !!l.flags.doomed && !l.flags.rebuilt,
    title: "ตอนจบที่ยังไม่ได้เขียน",
    text: () => "ผู้เขียนยื่นสมุดเล่มสุดท้ายให้ \"ผมเขียนตอนจบไม่ได้ เพราะทุกตอนจบที่คิดไว้ มีคนต้องตาย… คุณช่วยเขียนให้หน่อย\"",
    choices: [
      { label: "เขียนตอนจบที่ทุกคนรอด", run: (l) => { done(l, NOVEL.id, 2, true); l.flags.happyEnding = true; if (l.power) luckyRankUp(l, "[ระบบ] ผู้อ่านคนสุดท้ายได้รับสิทธิ์เขียนตอนจบ"); return big("ตัวอักษรบนหน้าสุดท้ายเรืองแสง — หน้าต่างระบบทั้งโลกกระพริบพร้อมกันหนึ่งครั้ง"); } },
      { label: "คืนสมุดให้เขาเขียนเอง", run: (l) => { done(l, NOVEL.id, 2, true); addStat(l, "happiness", 5); return meh("\"ถ้ามีคุณอ่าน ผมคงเขียนได้\" — เขาเริ่มเขียนอีกครั้ง"); } },
    ],
  },
];

/** ตอนต่อของเส้นเรื่อง: น้ำหนักสูงพิเศษ — เรื่องที่เริ่มแล้วควรได้เดินต่อ ไม่จมหายไปในกอง event ทั่วไป */
export const CHAIN_EVENTS: GameEvent[] = [...MURIM, ...COURT, ...MODERN].map((e) => ({ ...e, weight: typeof e.weight === "number" ? e.weight * 3 : e.weight }));
