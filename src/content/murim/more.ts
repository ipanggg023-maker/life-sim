// เหตุการณ์ยุทธภพเพิ่มเติม (M9): ให้ชีวิตในยุทธภพไม่ซ้ำเร็ว
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../engine/util";
import { fightOdds, gainExp, luckyRankUp, markTurn, rankLabel, survivalOdds } from "../hunter/power";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const rank = (l: Life) => l.power?.rank ?? -1;
const single = (l: Life) => !people(l, "partner").length && !people(l, "spouse").length;
/** ระดับศัตรูทั่วไปที่เหมาะกับตัวเรา */
const foe = (l: Life, d = 0) => clamp(rank(l) + d, 0, 8);
/** โอกาสชนะ: มีวิชาใช้พลังต่อสู้ · ไม่มีใช้ร่างกาย */
const winOdds = (l: Life, d = 0) => (l.power ? fightOdds(l, foe(l, d)) : clamp(0.25 + (l.stats.health - 50) / 120, 0.05, 0.7));

function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

const CHILD: GameEvent[] = [
  {
    id: "m2.c.kite",
    minAge: 4,
    maxAge: 9,
    text: (l) => {
      const sib = people(l, "sibling")[0];
      return sib ? `คุณกับ${shortName(sib)}ทำว่าวจากกระดาษห่อยาของพ่อ ว่าวลอยสูงจนแตะเมฆบนยอดเขา` : "คุณทำว่าวจากกระดาษห่อยา ว่าวลอยสูงจนแตะเมฆบนยอดเขา เด็กทั้งหมู่บ้านวิ่งตาม";
    },
    auto: (l) => {
      addStat(l, "happiness", 5);
      for (const s of people(l, "sibling")) s.bond = clamp(s.bond + 5, 0, 100);
      return "good";
    },
  },
  {
    id: "m2.c.stray_dog",
    minAge: 5,
    maxAge: 12,
    title: "หมาจรหน้าศาลเจ้า",
    text: () => "หมาผอมกระดูกโปนตัวหนึ่งนอนตัวสั่นอยู่หน้าศาลเจ้า ขาหลังมีแผลเหมือนโดนคมกระบี่",
    choices: [
      {
        label: "แบ่งหมั่นโถวให้ แล้วพากลับบ้าน",
        run: (l) => {
          l.flags.loyalDog = true;
          addStat(l, "happiness", 6);
          return good("แม่บ่นอยู่สามวัน แต่ก็ตั้งชื่อให้มันว่า 'เสี่ยวหู' — มันไม่เคยห่างจากคุณอีกเลย");
        },
      },
      { label: "ทำแผลให้ แล้วปล่อยไป", run: (l) => { addStat(l, "happiness", 2); return meh("หมาเลียมือคุณครั้งหนึ่ง แล้ววิ่งหายเข้าไปในป่า"); } },
    ],
  },
  {
    id: "m2.c.fortune_stick",
    minAge: 5,
    maxAge: 14,
    text: (l) => {
      const lucky = l.stats.luck >= 55;
      return lucky
        ? "งานศาลเจ้าประจำปี คุณเขย่ากระบอกเซียมซีได้ใบที่ 1 'มังกรซ่อนในเหว รอวันทะยานฟ้า' หลวงจีนมองคุณนานผิดปกติ"
        : "งานศาลเจ้าประจำปี คุณเขย่ากระบอกเซียมซีได้ใบที่ 49 'ระวังน้ำ ระวังไฟ ระวังคนใกล้ตัว' แม่รีบพาคุณไปทำบุญแก้เคล็ด";
    },
    auto: (l) => {
      if (l.stats.luck >= 55) { addStat(l, "luck", 2); return "good"; }
      addStat(l, "happiness", -2);
      return "normal";
    },
  },
  {
    id: "m2.c.old_manual",
    minAge: 7,
    maxAge: 15,
    title: "คัมภีร์ขาดใต้หลังคา",
    text: () => "คุณปีนขึ้นไปเก็บลูกข่างบนขื่อหลังคา แล้วเจอห่อผ้าเก่าคร่ำ ข้างในคือคัมภีร์ขาดครึ่งเล่ม หน้าแรกเขียนว่า 'เคล็ดลมปราณ…' ที่เหลือถูกหนูแทะไปหมด",
    choices: [
      {
        label: "แอบฝึกตามที่อ่านออก",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) {
            l.flags.knowsMethod = true;
            addStat(l, "health", 4);
            return { text: "คุณเดาส่วนที่ขาดหายได้ถูก ลมหายใจไหลเวียนลื่นขึ้น — การฝึกยุทธ์ในอนาคตจะได้ผลดีกว่าคนอื่น", kind: "system" };
          }
          return bad(`คุณเดินลมปราณผิดทาง อาเจียนเป็นเลือดอยู่สองวัน${hurt(l, 8, 15, "เดินลมปราณผิดทางตั้งแต่เด็ก")}`);
        },
      },
      { label: "เอาไปให้พ่อดู", run: (l) => { addMoney(l, 3000); return meh("พ่อเอาไปขายร้านของเก่าได้สามตำลึง แล้วซื้อขนมให้คุณ"); } },
    ],
  },
  {
    id: "m2.c.river",
    minAge: 8,
    maxAge: 16,
    title: "เด็กตกน้ำ",
    text: () => "เด็กชายตัวเล็กลื่นตกลงแม่น้ำที่ไหลเชี่ยวหลังฝนตก ผู้ใหญ่ยังอยู่ไกล",
    choices: [
      {
        label: "กระโดดลงไปช่วย",
        tone: "danger",
        check: { stat: "health", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) {
            addFame(l, 4);
            l.flags.savedChild = true;
            return good("คุณลากเด็กขึ้นฝั่งได้ — พ่อของเด็กคือคหบดีใหญ่ในเมือง เขาจำชื่อคุณไว้");
          }
          return bad(`กระแสน้ำซัดคุณไปไกล คุณเกาะขอนไม้รอดมาได้${hurt(l, 10, 25, "จมน้ำขณะช่วยเด็ก")}`);
        },
      },
      { label: "วิ่งไปตามผู้ใหญ่", run: () => meh("ผู้ใหญ่มาทัน เด็กรอดอย่างหวุดหวิด คุณได้คำชมว่าใจเย็น") },
    ],
  },
  {
    id: "m2.c.calligraphy",
    minAge: 6,
    maxAge: 13,
    when: (l) => l.stats.smarts >= 45,
    text: () => "อาจารย์ประจำหมู่บ้านถือลายมือของคุณขึ้นให้ทั้งห้องดู \"ตัวอักษรนี้มีกระดูก! เด็กคนนี้เขียนเหมือนคนจับกระบี่\"",
    auto: (l) => { addStat(l, "smarts", 3); addStat(l, "happiness", 3); return "good"; },
  },
  {
    id: "m2.c.mute_friend",
    minAge: 6,
    maxAge: 12,
    title: "เพื่อนที่พูดไม่ได้",
    text: () => "เด็กหญิงลูกคนเลี้ยงม้าพูดไม่ได้ เด็กคนอื่นชอบปาหินใส่ เธอนั่งวาดรูปนกบนพื้นดินอยู่คนเดียวทุกวัน",
    choices: [
      {
        label: "นั่งวาดรูปด้วยกัน",
        run: (l) => {
          const p = createPerson(l, "friend", { gender: "f", age: l.age, bond: 60 });
          addStat(l, "happiness", 4);
          return good(`${shortName(p)}ยิ้มให้คุณครั้งแรก — คุณสองคนคิดภาษามือขึ้นมาใช้กันเอง`);
        },
      },
      { label: "ไม่ยุ่ง", run: () => meh("คุณเดินผ่านไป บางวันคุณยังนึกถึงรูปนกพวกนั้นอยู่") },
    ],
  },
];

const YOUTH: GameEvent[] = [
  {
    id: "m2.y.storyteller",
    minAge: 12,
    maxAge: 25,
    text: () => "นักเล่านิทานในโรงน้ำชาเล่าตำนาน 'กระบี่เดียวพิชิตสิบสองสำนัก' จนทั้งร้านเงียบกริบ คุณกลับบ้านแล้วนอนไม่หลับทั้งคืน",
    auto: (l) => { if (l.power) gainExp(l, 150); else addStat(l, "happiness", 4); return "good"; },
  },
  {
    id: "m2.y.first_wine",
    minAge: 15,
    maxAge: 22,
    text: () => "เพื่อนชวนไปดื่มเหล้าดอกท้อที่โรงเตี๊ยมเป็นครั้งแรก \"ลูกผู้ชายแห่งยุทธภพต้องดื่มเป็น!\"",
    choices: [
      { label: "ดื่มให้สุดทาง", run: (l) => { addStat(l, "happiness", 6); addStat(l, "health", -3); return meh("คุณตื่นมาบนหลังคาโรงเตี๊ยม ไม่รู้ว่าขึ้นมาได้ยังไง"); } },
      { label: "จิบนิดเดียว", run: (l) => { addStat(l, "happiness", 2); return meh("คุณนั่งดูเพื่อนเมาร้องเพลงแข่งกับนักดนตรี หัวเราะทั้งคืน"); } },
    ],
  },
  {
    id: "m2.y.insult",
    minAge: 13,
    maxAge: 30,
    title: "คุณชายจากตระกูลใหญ่",
    text: () => "คุณชายตระกูลใหญ่เตะโต๊ะขายของของแม่คุณจนล้ม \"หลีกไป คนชั้นต่ำ\" ลูกน้องสิบกว่าคนหัวเราะลั่น",
    choices: [
      {
        label: "สั่งสอนมันซะ",
        tone: "danger",
        odds: (l) => winOdds(l, 1),
        run: (l, _c, ok) => {
          if (ok) {
            addFame(l, 5);
            addStat(l, "happiness", 6);
            return good("ฝ่ามือเดียวของคุณทำให้คุณชายลอยไปกองกับกองผัก ทั้งตลาดโห่ร้อง — แต่ตระกูลนั้นจะไม่ลืมเรื่องนี้");
          }
          return bad(`ลูกน้องรุมคุณจนจมกองโคลน${hurt(l, 10, 20, "ถูกลูกน้องคุณชายรุมทำร้าย")}`);
        },
      },
      { label: "เก็บของที่หล่นอย่างเงียบๆ", run: (l) => { addStat(l, "happiness", -5); l.flags.grudge = true; return meh("คุณกัดฟันจนได้กลิ่นเลือด — วันหนึ่ง วันหนึ่งแน่นอน"); } },
      {
        label: "ยิ้มแล้วตอบกลับด้วยวาจา",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 3); return good("คำพูดของคุณทำให้คุณชายหน้าแดงจนพูดไม่ออก คนทั้งตลาดหัวเราะ — คราวนี้หัวเราะเยาะเขา"); }
          addStat(l, "happiness", -3);
          return bad("คุณชายตบหน้าคุณหนึ่งที แล้วเดินจากไปอย่างสบายใจ");
        },
      },
    ],
  },
  {
    id: "m2.y.sleeve_letter",
    minAge: 15,
    maxAge: 26,
    when: single,
    title: "จดหมายในแขนเสื้อ",
    text: (l) => `คุณพบจดหมายพับเล็กๆ ซ่อนในแขนเสื้อหลังกลับจากตลาด ลายมือบรรจง "${l.gender === "m" ? "ข้าเห็นท่านช่วยยายแก่ขนฟืนทุกเช้า… พรุ่งนี้ใต้ต้นหลิว" : "ข้าเฝ้ามองท่านซ้อมกระบี่ริมลำธารมาสามฤดู… พรุ่งนี้ใต้ต้นหลิว"}"`,
    choices: [
      {
        label: "ไปตามนัด",
        run: (l) => {
          const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -2, 3), bond: 65 });
          addStat(l, "happiness", 10);
          return { text: `💕 ${shortName(p)}ยืนรอใต้ต้นหลิวด้วยหน้าแดงก่ำ — ฤดูใบไม้ผลินั้นยาวนานที่สุดในชีวิตคุณ`, kind: "milestone" };
        },
      },
      { label: "แกล้งไม่เห็น", run: () => meh("วันรุ่งขึ้นต้นหลิวไหวลมอยู่ลำพัง") },
    ],
  },
  {
    id: "m2.y.chores",
    minAge: 12,
    maxAge: 22,
    when: (l) => l.job?.careerId === "disciple",
    text: () => "ศิษย์นอกอย่างคุณต้องกวาดลานหน้าสำนักทุกเช้า ตักน้ำร้อยถัง ผ่าฟืนห้าร้อยท่อน — ทุกวัน สามปีเต็ม",
    auto: (l) => {
      addStat(l, "health", 3);
      if (chance(l, 0.25)) {
        gainExp(l, 500);
        l.flags.sweeperWatched = true;
        return "good";
      }
      return "normal";
    },
  },
  {
    id: "m2.y.forbidden",
    weight: 4,
    minAge: 13,
    maxAge: 25,
    when: (l) => !!l.power,
    title: "เขตหวงห้ามหลังสำนัก",
    text: () => "หลังสำนักมีถ้ำที่ติดป้าย 'ผู้ใดเข้า ตาย' คืนนี้ไม่มีพระจันทร์ และยามเฝ้าประตูหลับอยู่",
    choices: [
      {
        label: "แอบเข้าไป",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 1)),
        survival: (l) => survivalOdds(l, foe(l, 1)),
        run: (l, _c, ok) => {
          if (ok) {
            luckyRankUp(l, "คุณพบรอยฝ่ามือบนผนังถ้ำ — วิชาที่บรรพจารย์ผนึกไว้");
            markTurn(l);
            return { text: "คุณออกมาก่อนฟ้าสาง ไม่มีใครรู้ว่าคืนนั้นคุณไปไหนมา", kind: "milestone" };
          }
          if (!chance(l, survivalOdds(l, foe(l, 1)))) {
            kill(l, "ติดค่ายกลในเขตหวงห้ามของสำนัก");
            return bad("ค่ายกลในถ้ำทำงาน…");
          }
          return bad(`ค่ายกลเหวี่ยงคุณกระเด็นออกมา ผู้อาวุโสจับได้และลงโทษให้คุกเข่าหนึ่งเดือน${hurt(l, 8, 16, "บาดเจ็บจากค่ายกล")}`);
        },
      },
      { label: "กฎก็คือกฎ", run: () => meh("คุณกลับไปนอน แต่ฝันถึงปากถ้ำนั้นทั้งคืน") },
    ],
  },
];

const ADULT: GameEvent[] = [
  {
    id: "m2.a.escort",
    minAge: 18,
    maxAge: 50,
    title: "ขบวนสินค้าผ่านช่องเขามังกรดำ",
    text: () => "พ่อค้าผ้าไหมจ้างคุณคุ้มกันขบวนผ่านช่องเขามังกรดำ ค่าจ้างงาม — แต่ไม่มีขบวนไหนผ่านไปได้ครบทุกคันมาสามเดือนแล้ว",
    choices: [
      {
        label: "รับงาน",
        tone: "danger",
        odds: (l) => winOdds(l),
        survival: (l) => (l.power ? survivalOdds(l, foe(l)) : 0.75),
        run: (l, _c, ok) => {
          const pay = l.power ? 60_000 * (rank(l) + 2) : 25_000;
          if (ok) {
            addMoney(l, pay);
            addFame(l, 2);
            if (l.power) gainExp(l, 250);
            return good(`โจรภูเขาแตกพ่ายตั้งแต่ปะทะแรก ขบวนถึงปลายทางครบ ได้ค่าจ้าง ${money(l, pay)}`);
          }
          if (!chance(l, l.power ? survivalOdds(l, foe(l)) : 0.75)) {
            kill(l, "ถูกโจรภูเขาซุ่มโจมตีที่ช่องเขามังกรดำ");
            return bad("ลูกธนูพุ่งมาจากหน้าผาทั้งสองด้าน…");
          }
          return bad(`ขบวนถูกปล้นไปครึ่งหนึ่ง คุณหนีรอดมาพร้อมแผลเต็มตัว${hurt(l, 8, 18, "บาดแผลจากการปะทะโจร")}`);
        },
      },
      { label: "ปฏิเสธ", run: () => meh("ได้ข่าวว่าขบวนนั้นหายไปทั้งขบวน") },
    ],
  },
  {
    id: "m2.a.chopsticks",
    minAge: 16,
    maxAge: 50,
    title: "ตะเกียบคู่นั้น",
    text: () => "เกิดตีกันในโรงเตี๊ยม จอกเหล้าลอยมาทางคุณ — ชายแก่โต๊ะข้างๆ ยื่นตะเกียบมาคีบจอกไว้กลางอากาศโดยไม่หกสักหยด แล้วกินบะหมี่ต่อเหมือนไม่มีอะไรเกิดขึ้น",
    choices: [
      {
        label: "คุกเข่าขอเป็นศิษย์",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) {
            if (l.power) gainExp(l, 900);
            else addStat(l, "health", 8);
            l.flags.hiddenMaster = true;
            return { text: "ชายแก่หัวเราะ \"สามปีที่แล้วก็มีเด็กคุกเข่าแบบนี้ ข้าไล่ไป… เจ้าก็ไปซะ\" — แต่พรุ่งนี้เช้าเขามายืนรอที่ป่าไผ่หลังเมือง", kind: "milestone" };
          }
          return meh("พอคุณเงยหน้าขึ้นมา โต๊ะนั้นว่างเปล่า เหลือแค่เงินค่าบะหมี่วางไว้");
        },
      },
      { label: "เลี้ยงเหล้าหนึ่งไห", run: (l) => { addMoney(l, -2000); addStat(l, "luck", 2); return meh("ชายแก่ยกจอกให้ แล้วพูดลอยๆ ว่า \"ทางตะวันออกปีนี้อย่าไป\""); } },
    ],
  },
  {
    id: "m2.a.ginseng",
    weight: 4,
    minAge: 15,
    maxAge: 60,
    title: "โสมพันปีบนหน้าผา",
    text: () => "ข่าวลือว่ามีโสมพันปีขึ้นอยู่บนหน้าผาสูงร้อยจั้ง มีงูเหลือมขาวเฝ้าอยู่ ใครกินแล้วจะได้ลมปราณหกสิบปี",
    choices: [
      {
        label: "ปีนขึ้นไปเอา",
        tone: "danger",
        odds: (l) => winOdds(l, 1),
        survival: (l) => (l.power ? survivalOdds(l, foe(l, 1)) : 0.6),
        run: (l, _c, ok) => {
          if (ok) {
            addStat(l, "health", 15);
            if (l.power) luckyRankUp(l, "โสมพันปีเปลี่ยนลมปราณของคุณ");
            else addStat(l, "luck", 5);
            markTurn(l);
            return { text: "คุณกินโสมพันปีกลางหน้าผา ความร้อนแผ่ซ่านทั่วร่างจนไอน้ำพวยพุ่งออกจากหัว", kind: "milestone" };
          }
          if (!chance(l, l.power ? survivalOdds(l, foe(l, 1)) : 0.6)) {
            kill(l, "ตกหน้าผาขณะเก็บโสมพันปี");
            return bad("หินที่เหยียบอยู่หลุดออก…");
          }
          return bad(`งูเหลือมขาวฟาดคุณตกลงมากลางทาง${hurt(l, 12, 25, "งูเหลือมขาวเฝ้าโสม")}`);
        },
      },
      { label: "ขายข่าวให้คนอื่น", run: (l) => { addMoney(l, 20_000); return meh("คุณขายแผนที่ได้ยี่สิบตำลึง — คนซื้อไม่กลับลงมาอีกเลย"); } },
    ],
  },
  {
    id: "m2.a.flood",
    minAge: 14,
    maxAge: 70,
    title: "แม่น้ำเหลืองล้นตลิ่ง",
    text: () => "ฝนตกติดกันสิบวัน แม่น้ำเหลืองล้นตลิ่ง น้ำท่วมทั้งอำเภอ ชาวบ้านติดอยู่บนหลังคา",
    choices: [
      { label: "พายเรือช่วยคนทั้งคืน", run: (l) => { addFame(l, 8); addStat(l, "health", -6); addStat(l, "happiness", 5); return good("คุณช่วยคนได้สามสิบกว่าคน ทั้งอำเภอเรียกคุณว่า 'ผู้มีพระคุณ'"); } },
      { label: "ขนข้าวของบ้านตัวเองขึ้นที่สูง", run: (l) => { addMoney(l, 10_000); return meh("ข้าวของบ้านคุณรอด — แต่คุณได้ยินเสียงร้องขอความช่วยเหลือทั้งคืน"); } },
    ],
  },
  {
    id: "m2.a.gambling",
    minAge: 16,
    maxAge: 70,
    maxTimes: 2,
    text: () => "บ่อนพนันในตรอกมืดเปิดโต๊ะทอยลูกเต๋า เจ้ามือยิ้มกว้าง \"แทงใหญ่ได้ใหญ่ ท่านจอมยุทธ์\"",
    choices: [
      {
        label: "แทงหมดตัว",
        check: { stat: "luck", dc: 62 },
        run: (l, _c, ok) => {
          const stake = Math.max(5000, Math.round(Math.max(0, l.money) * 0.5));
          if (ok) { addMoney(l, stake * 2); return good(`ลูกเต๋าออกตามที่แทงสามตาซ้อน! ได้ ${money(l, stake * 2)}`); }
          addMoney(l, -stake);
          return bad(`เจ้ามือโกงลูกเต๋า — คุณเสีย ${money(l, stake)}`);
        },
      },
      {
        label: "จับโกงเจ้ามือ",
        check: { stat: "smarts", dc: 58 },
        run: (l, _c, ok) => {
          if (ok) { addMoney(l, 30_000); addFame(l, 2); return good("คุณบีบลูกเต๋าแตกให้ทุกคนเห็นตะกั่วข้างใน บ่อนยอมจ่ายค่าปิดปาก"); }
          return bad(`นักเลงในบ่อนลากคุณออกไปซ้อมหลังร้าน${hurt(l, 6, 14, "ถูกนักเลงบ่อนรุมทำร้าย")}`);
        },
      },
      { label: "เดินออกมา", run: () => meh("คุณไม่ได้อะไร และก็ไม่เสียอะไร") },
    ],
  },
  {
    id: "m2.a.bride",
    minAge: 17,
    maxAge: 40,
    title: "เจ้าสาวหนีงาน",
    text: () => "หญิงสาวในชุดเจ้าสาวสีแดงกระโดดขึ้นหลังม้าของคุณ \"ช่วยข้าด้วย! พ่อขายข้าให้เจ้าพ่อค้าเกลือที่แก่กว่าข้าสี่สิบปี\" ขบวนคนถือกระบองวิ่งตามมาติดๆ",
    choices: [
      {
        label: "ควบม้าพาหนี",
        odds: (l) => winOdds(l, 0),
        run: (l, _c, ok) => {
          if (ok) {
            addFame(l, 3);
            l.flags.saltMerchantGrudge = true;
            return good("คุณพาเธอไปส่งถึงบ้านป้าที่เมืองอื่น เธอเย็บถุงเงินให้หนึ่งใบเป็นที่ระลึก — เจ้าพ่อค้าเกลือประกาศค่าหัวคุณร้อยตำลึง");
          }
          return bad(`ม้าสะดุด คนของเจ้าพ่อค้าเกลือจับเจ้าสาวกลับไปได้${hurt(l, 5, 12, "ถูกคนของพ่อค้าเกลือรุมตี")}`);
        },
      },
      { label: "บอกให้ลงจากม้า", run: (l) => { addStat(l, "happiness", -4); return meh("เธอลงไปโดยไม่พูดอะไร สายตาตอนนั้นติดอยู่ในความทรงจำคุณนาน"); } },
    ],
  },
  {
    id: "m2.a.tax",
    minAge: 18,
    maxAge: 70,
    title: "นายอำเภอขูดรีด",
    text: () => "นายอำเภอคนใหม่ขึ้นภาษีสามเท่า ใครจ่ายไม่ไหวถูกยึดนา ชาวบ้านมาคุกเข่าหน้าบ้านคุณ",
    choices: [
      {
        label: "บุกจวนนายอำเภอ",
        tone: "danger",
        odds: (l) => winOdds(l, 0),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 10); addStat(l, "happiness", 6); return good("คุณแขวนนายอำเภอไว้หน้าจวนพร้อมสมุดบัญชีโกง ข้าหลวงมณฑลสั่งปลดเขาในเดือนนั้น"); }
          l.flags.wanted = true;
          return bad(`คุณถูกทหารรุมจับ หนีออกมาได้แต่กลายเป็นคนมีค่าหัว${hurt(l, 8, 18, "ถูกทหารจวนอำเภอรุมทำร้าย")}`);
        },
      },
      {
        label: "ยื่นฎีกาถึงข้าหลวง",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 5); return good("ฎีกาของคุณเขียนดีจนข้าหลวงต้องส่งคนมาสอบ ภาษีกลับมาเท่าเดิม"); }
          return bad("ฎีกาหายไปกลางทาง — นายอำเภอรู้ชื่อคุณแล้ว");
        },
      },
      { label: "จ่ายภาษีแทนชาวบ้านบางส่วน", run: (l) => { addMoney(l, -50_000); addFame(l, 4); return meh(`คุณเสียเงิน ${money(l, 50_000)} ชาวบ้านจุดธูปขอบคุณคุณทุกเช้า`); } },
    ],
  },
  {
    id: "m2.a.disciple",
    minAge: 25,
    maxAge: 70,
    when: (l) => rank(l) >= 3,
    title: "เด็กขอเป็นศิษย์",
    text: (l) => `เด็กกำพร้าคนหนึ่งคุกเข่าหน้าบ้านคุณกลางหิมะมาสามวันแล้ว "ได้โปรดรับข้าเป็นศิษย์ ข้าเห็นท่าน${rankLabel(l, rank(l))}สู้กับโจรเมื่อเดือนก่อน"`,
    choices: [
      {
        label: "รับเป็นศิษย์",
        run: (l) => {
          const p = createPerson(l, "ally", { age: randInt(l, 9, 13), bond: 70, job: "ศิษย์คนแรก" });
          addStat(l, "happiness", 8);
          return good(`${shortName(p)}กลายเป็นศิษย์คนแรกของคุณ — ทุกเช้ามีน้ำชาร้อนวางรอที่หน้าประตู`);
        },
      },
      { label: "ให้เงินแล้วส่งไปสำนักอื่น", run: (l) => { addMoney(l, -5000); return meh("เด็กรับเงินไป แต่หันกลับมามองคุณจนสุดสายตา"); } },
    ],
  },
  {
    id: "m2.a.wanted",
    minAge: 18,
    maxAge: 60,
    text: () => "คุณเห็นรูปตัวเองติดอยู่บนป้ายประกาศจับ ค่าหัวห้าร้อยตำลึง ข้อหาฆ่าคนทั้งตระกูล — แต่คุณไม่เคยไปเมืองนั้นด้วยซ้ำ",
    choices: [
      {
        label: "สืบหาตัวจริง",
        check: { stat: "smarts", dc: 60 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 8); if (l.power) gainExp(l, 400); return good("ตัวจริงคือคนที่หน้าตาคล้ายคุณจากลัทธิมาร คุณลากตัวมันมาส่งทางการเอง"); }
          addStat(l, "happiness", -6);
          return bad("คุณต้องปลอมตัวหลบนักล่าค่าหัวอยู่ครึ่งปี");
        },
      },
      { label: "หนีไปซ่อนในเขา", run: (l) => { addStat(l, "health", 3); addStat(l, "happiness", -3); return meh("คุณใช้ชีวิตในถ้ำครึ่งปี จนข่าวเงียบไปเอง"); } },
    ],
  },
  {
    id: "m2.a.alliance_meeting",
    minAge: 25,
    maxAge: 80,
    when: (l) => rank(l) >= 4,
    text: (l) => `พันธมิตรยุทธจักรส่งเทียบเชิญคุณ ในฐานะยอดฝีมือระดับ${rankLabel(l, rank(l))} เข้าร่วมประชุมใหญ่ที่จะกำหนดทิศทางของยุทธภพสิบปีข้างหน้า`,
    auto: (l) => { addFame(l, 6); addStat(l, "happiness", 4); return "good"; },
  },
  {
    id: "m2.a.poison_banquet",
    minAge: 18,
    maxAge: 70,
    title: "งานเลี้ยงวันเกิดเจ้าสำนัก",
    text: () => "งานเลี้ยงวันเกิดเจ้าสำนักใหญ่ คุณได้กลิ่นอัลมอนด์จางๆ จากไหเหล้าที่เพิ่งยกมา",
    choices: [
      {
        label: "ปัดไหเหล้าตกพื้น",
        check: { stat: "smarts", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 10); if (l.power) gainExp(l, 300); return good("เหล้ากัดพื้นจนเป็นรู ทั้งงานตกตะลึง — เจ้าสำนักติดหนี้ชีวิตคุณ"); }
          addFame(l, -4);
          return bad("ไม่มีพิษ… แค่เหล้าเก่า คุณกลายเป็นตัวตลกของงาน");
        },
      },
      { label: "ดื่มไปตามมารยาท", run: (l) => ({ text: `ทั้งงานล้มลงทีละคน คุณใช้ลมปราณขับพิษออกได้ครึ่งหนึ่ง${hurt(l, 15, 30, "พิษในงานเลี้ยงวันเกิดเจ้าสำนัก")}`, kind: "bad" }) },
    ],
  },
  {
    id: "m2.a.auction",
    weight: 4,
    minAge: 18,
    maxAge: 70,
    when: (l) => !!l.power && l.money >= 200_000,
    title: "งานประมูลคัมภีร์ลับ",
    text: () => "หอประมูลหมื่นสมบัติเปิดประมูลคัมภีร์ที่อ้างว่าเป็นของปรมาจารย์เมื่อสามร้อยปีก่อน ราคาเริ่มต้นสองร้อยตำลึง",
    choices: [
      {
        label: "ประมูลให้ได้",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          addMoney(l, -200_000);
          if (ok) { gainExp(l, 1500); return good("คัมภีร์เป็นของจริง! การฝึกปีนี้ก้าวกระโดด"); }
          return bad("คัมภีร์เป็นของปลอมที่คัดลอกจากหนังสือนิทานเด็ก");
        },
      },
      { label: "ดูเฉยๆ", run: () => meh("คัมภีร์ถูกประมูลไปในราคาพันตำลึง โดยคนที่สวมหน้ากาก") },
    ],
  },
  {
    id: "m2.a.demon_offer",
    weight: 3,
    minAge: 18,
    maxAge: 60,
    when: (l) => !!l.power && l.power.hunterClass !== "m_demon",
    title: "ข้อเสนอจากลัทธิมาร",
    text: () => "ทูตลัทธิมารสวรรค์วางคัมภีร์สีเลือดไว้บนโต๊ะ \"วิชาของสำนักธรรมะช้าเกินไปสำหรับคนอย่างท่าน ฝึกเล่มนี้ สามปีท่านจะไม่มีคู่ต่อสู้\"",
    choices: [
      {
        label: "รับคัมภีร์",
        tone: "danger",
        run: (l) => {
          luckyRankUp(l, "วิชามารปลุกพลังที่ซ่อนอยู่");
          addFame(l, -20);
          addStat(l, "happiness", -5);
          l.flags.demonTouched = true;
          return bad("พลังพุ่งขึ้นจนน่ากลัว — แต่ตาของคุณเริ่มแดงทุกครั้งที่โกรธ และฝ่ายธรรมะเริ่มจับตามอง");
        },
      },
      { label: "เผาคัมภีร์ต่อหน้าทูต", run: (l) => { addFame(l, 5); return good("ทูตหัวเราะ \"น่าเสียดาย\" แล้วหายไปในเงา"); } },
    ],
  },
];

const LATER: GameEvent[] = [
  {
    id: "m2.e.disciples_visit",
    minAge: 55,
    maxAge: 95,
    text: () => "ตรุษจีนปีนี้ ศิษย์และลูกหลานกลับมาคารวะเต็มลานบ้าน เสียงประทัดดังไปทั้งหุบเขา",
    auto: (l) => { addStat(l, "happiness", 8); return "good"; },
  },
  {
    id: "m2.e.manual",
    minAge: 50,
    maxAge: 95,
    when: (l) => rank(l) >= 3,
    title: "คัมภีร์ของตัวเอง",
    text: () => "คุณเริ่มเขียนทุกสิ่งที่เรียนรู้มาทั้งชีวิตลงในคัมภีร์ เขียนไปลบไป ปีครึ่งผ่านไปถึงเสร็จ",
    choices: [
      { label: "มอบให้สำนัก", run: (l) => { addFame(l, 10); l.flags.wroteManual = true; return good("คัมภีร์ของคุณถูกเก็บไว้ในหอคัมภีร์ชั้นในสุด — ชื่อคุณจะอยู่ในยุทธภพไปอีกร้อยปี"); } },
      { label: "ซ่อนไว้ในถ้ำให้ผู้มีวาสนา", run: (l) => { l.flags.wroteManual = true; l.flags.stash = Number(l.flags.stash ?? 0) + 1_000_000; return meh("คุณสลักคำใบ้ไว้บนผนังถ้ำ 'ผู้ที่อ่านออก คือศิษย์ของข้า'"); } },
    ],
  },
  {
    id: "m2.e.last_duel",
    minAge: 60,
    maxAge: 95,
    when: (l) => rank(l) >= 2,
    title: "การประลองครั้งสุดท้าย",
    text: () => "ชายชราผมขาวที่คุณเคยสู้ด้วยเมื่อสี่สิบปีก่อนมายืนรอหน้าบ้าน \"เรายังไม่รู้ผลแพ้ชนะเลยนะ\"",
    choices: [
      {
        label: "ประลองกันอีกครั้ง",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 0)),
        survival: (l) => survivalOdds(l, foe(l, 0)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 5); addStat(l, "happiness", 10); return good("คุณชนะไปหนึ่งกระบวนท่า ทั้งสองหัวเราะจนน้ำตาไหล แล้วนั่งดื่มชาจนพระอาทิตย์ตก"); }
          if (!chance(l, survivalOdds(l, foe(l, 0)))) { kill(l, "ประลองครั้งสุดท้ายกับคู่ต่อสู้เก่า"); return bad("กระบวนท่าสุดท้ายในชีวิตคุณ… สวยที่สุดเท่าที่เคยใช้"); }
          addStat(l, "happiness", 5);
          return meh(`คุณแพ้ แต่ยิ้มได้ "ครั้งหน้าข้าเอาคืน"${hurt(l, 5, 12, "บาดเจ็บจากการประลอง")}`);
        },
      },
      { label: "ชวนดื่มชาแทน", run: (l) => { addStat(l, "happiness", 6); return meh("สองคนแก่นั่งเล่าความหลังจนดึก โดยไม่มีใครพูดถึงผลแพ้ชนะอีก"); } },
    ],
  },
  {
    id: "m2.m.harvest",
    minAge: 18,
    maxAge: 70,
    maxTimes: 3,
    when: (l) => !l.power && (l.wealth === "poor" || l.wealth === "middle"),
    text: (l) => pick(l, ["ปีนี้ฝนตกต้องตามฤดู ข้าวในนาเหลืองอร่ามเต็มทุ่ง", "สวนท้อของคุณออกผลดกจนกิ่งหัก พ่อค้าในเมืองมารับซื้อถึงที่"]),
    auto: (l) => { addMoney(l, randInt(l, 20, 60) * 1000); addStat(l, "happiness", 4); return "good"; },
  },
  {
    id: "m2.m.dumpling",
    minAge: 18,
    maxAge: 60,
    when: (l) => !l.power,
    title: "ร้านซาลาเปา",
    text: () => "คุณมีสูตรซาลาเปาไส้หมูของยายที่ใครกินก็ติดใจ ร้านเล็กๆ หัวมุมตลาดกำลังเซ้ง",
    choices: [
      {
        label: "เซ้งร้าน",
        check: { stat: "luck", dc: 45 },
        run: (l, _c, ok) => {
          addMoney(l, -30_000);
          if (ok) { addMoney(l, 150_000); addFame(l, 3); return good("ร้านซาลาเปาของคุณดังไปทั้งเมือง แม้แต่จอมยุทธ์ยังต่อคิว"); }
          return bad("ร้านเจ๊งในครึ่งปี — คนในเมืองนี้ชอบหมั่นโถวมากกว่า");
        },
      },
      { label: "ทำกินเองในบ้าน", run: (l) => { addStat(l, "happiness", 3); return meh("ซาลาเปาของยายยังอร่อยเหมือนเดิม"); } },
    ],
  },
];

export const MURIM_MORE: GameEvent[] = [...CHILD, ...YOUTH, ...ADULT, ...LATER];
