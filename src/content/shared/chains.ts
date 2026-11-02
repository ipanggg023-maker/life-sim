// เควสต่อเนื่อง (M22): เหตุการณ์ที่เคย "ตัดจบ" กลับมาเล่าต่อหลายตอน
// สถานะเก็บใน flags: q_<id> = ตอนที่ผ่านแล้ว, q_<id>_at = อายุตอนผ่านตอนล่าสุด
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, people, shortName } from "../../engine/util";
import { fightOdds, gainExp, luckyRankUp, markTurn, survivalOdds } from "../core/power";

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


const COURT: GameEvent[] = [
];

// ───────────────────────── โลกยุคปัจจุบัน ─────────────────────────

const GAMER = story({ id: "gamer", title: "เด็กติดเกม", hint: "เกมที่เล่นทั้งคืนตอนมัธยมอาจไม่ได้ไร้ค่า", started: (l) => !!l.flags.gamer, parts: 2 });
const OLYMPIAD = story({ id: "olympiad", title: "เหรียญทองโอลิมปิกวิชาการ", hint: "มหาวิทยาลัยต่างประเทศยังจับตาคุณ", started: (l) => !!l.flags.olympiad, parts: 1 });
const ORDAINED = story({ id: "ordained", title: "เพื่อนที่บวชด้วยกัน", hint: "เพื่อนที่บวชพร้อมคุณยังไม่สึก", started: (l) => !!l.flags.ordained, parts: 1 });

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
];

/** ตอนต่อของเส้นเรื่อง: น้ำหนักสูงพิเศษ — เรื่องที่เริ่มแล้วควรได้เดินต่อ ไม่จมหายไปในกอง event ทั่วไป */
export const CHAIN_EVENTS: GameEvent[] = [...MURIM, ...COURT, ...MODERN].map((e) => ({ ...e, weight: typeof e.weight === "number" ? e.weight * 3 : e.weight }));
