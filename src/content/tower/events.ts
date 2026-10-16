// ชีวิตในโลกที่มีหอคอย: ทั้งคนที่ได้คำเชิญ และคนที่ใช้ชีวิตอยู่ใต้เงาของมัน
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../engine/util";
import { fightOdds, gainExp, luckyRankUp, markTurn, rankName, survivalOdds } from "../hunter/power";
import { floorOf } from "./climb";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const rank = (l: Life) => l.power?.rank ?? -1;
const climbing = (l: Life) => !!l.power && l.job?.careerId === "climber";
const foe = (l: Life, d = 0) => clamp(rank(l) + d, 0, 8);

function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

const YOUNG: GameEvent[] = [
  {
    id: "tower.c.broadcast",
    minAge: 5,
    maxAge: 12,
    text: () => "ทีวีทุกช่องถ่ายทอดสดผู้ท้าชิงคนแรกของประเทศที่ผ่านชั้น 30 ได้ คุณนั่งดูโดยไม่กะพริบตา แล้ววาดรูปหอคอยเต็มสมุดทั้งเล่ม",
    auto: (l) => { l.flags.dreamTower = true; addStat(l, "happiness", 4); return "good"; },
  },
  {
    id: "tower.c.toy",
    minAge: 4,
    maxAge: 9,
    text: () => "ของเล่นที่ขายดีที่สุดปีนี้คือโมเดลหอคอยที่กดปุ่มแล้วมีไฟขึ้นทีละชั้น คุณได้มาเป็นของขวัญวันเกิด",
    auto: (l) => { addStat(l, "happiness", 5); return "good"; },
  },
  {
    id: "tower.y.returnee",
    minAge: 13,
    maxAge: 19,
    title: "ผู้ที่กลับมาจากหอคอย",
    text: () => "ศิษย์เก่าที่กลับมาจากชั้น 20 มาพูดที่โรงเรียน แขนข้างหนึ่งของเขาเป็นแขนกล \"ถ้าได้คำเชิญ… คิดให้ดีก่อนรับ\"",
    choices: [
      {
        label: "ไปถามเขาหลังงานจบ",
        check: { stat: "smarts", dc: 45 },
        run: (l, _c, ok) => {
          if (ok) { l.flags.towerLore = true; return good("เขาบอกเคล็ดลับชั้นแรกๆ ให้ \"อย่าเชื่อใครที่ยิ้มให้ตอนโหวต\" — คุณจดไว้ทุกคำ"); }
          return meh("เขามองหน้าคุณแล้วส่ายหัว \"เด็กแบบนายตายตั้งแต่ชั้นสาม\"");
        },
      },
      { label: "ไม่สนใจ", run: () => meh("คุณหลับในหอประชุมจนจบงาน") },
    ],
  },
  {
    id: "tower.family_invited",
    minAge: 8,
    maxAge: 30,
    when: (l) => people(l, "sibling").length > 0,
    title: "พี่น้องที่ขึ้นหอคอย",
    prepare: (l) => ({ name: shortName(pick(l, people(l, "sibling"))) }),
    text: (_l, c) => `${c.name}ได้รับคำเชิญจากหอคอย คืนก่อนออกเดินทาง ${c.name}ยื่นสร้อยให้คุณ "เก็บไว้ให้หน่อย เดี๋ยวกลับมาเอาคืน"`,
    choices: [
      {
        label: "ขอให้อย่าไป",
        run: (l, c) => {
          const s = l.people.find((p) => shortName(p) === c.name);
          if (s && chance(l, 0.5)) { s.bond = clamp(s.bond + 10, 0, 100); return good(`${c.name}ฉีกคำเชิญทิ้งต่อหน้าคุณ "ก็ได้… ครอบครัวสำคัญกว่า"`); }
          if (s && chance(l, 0.4)) { s.alive = false; l.flags.lossAge = l.age; addStat(l, "happiness", -20); return bad(`${c.name}ไปจนได้ สามปีต่อมา จดหมายจากหอคอยแจ้งว่า${c.name}ไม่ผ่านชั้นที่ 11`); }
          return meh(`${c.name}ไป และส่งข้อความกลับมาทุกเดือนว่ายังสบายดี`);
        },
      },
      { label: "เชียร์ให้ไปให้สุด", run: (l, c) => { addStat(l, "happiness", 3); return meh(`${c.name}กอดคุณแน่น แล้วหายไปในแสงสีทอง`); } },
    ],
  },
];

const CLIMBER: GameEvent[] = [
  {
    id: "tower.market",
    minAge: 10,
    maxAge: 80,
    maxTimes: 3,
    when: (l) => !!l.power && l.money >= 100_000,
    text: () => "ตลาดในชั้นปลอดภัยมีพ่อค้าจากชั้นบนลงมาขายของ แผงหนึ่งขายขวดน้ำเรืองแสงที่ติดป้ายว่า 'ของจากชั้น 60'",
    choices: [
      {
        label: "ซื้อมาหนึ่งขวด",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          addMoney(l, -100_000);
          if (ok) { const item = pick(l, ["น้ำยาฟื้นพลังชั้นบน", "เกราะพลังงานพกพา", "ขนนกนำทาง"]); l.power!.items.push(item); return good(`ของจริง! คุณได้「${item}」`); }
          return bad("น้ำในขวดเป็นแค่น้ำผสมสีเรืองแสง พ่อค้าหายไปแล้ว");
        },
      },
      { label: "ดูเฉยๆ", run: () => meh("คุณเดินดูจนทั่วตลาด ของทุกชิ้นแพงกว่าบนโลกสิบเท่า") },
    ],
  },
  {
    id: "tower.vote",
    minAge: 12,
    maxAge: 70,
    when: climbing,
    title: "การโหวต",
    text: () => "บททดสอบพิเศษ: ทีมของคุณต้องโหวตส่งหนึ่งคนกลับลงไปชั้นแรก ทุกคนหันมามองคุณ — และเด็กผู้หญิงที่ขาเจ็บมุมห้อง",
    choices: [
      { label: "โหวตตัวเอง", run: (l) => { l.flags.floor = Math.max(1, floorOf(l) - 5); addFame(l, 8); addStat(l, "happiness", 4); return good("ทั้งทีมเงียบ แล้วเด็กคนนั้นร้องไห้ — คุณถูกส่งกลับลงไปห้าชั้น แต่ทั้งหอคอยรู้ชื่อคุณแล้ว"); } },
      { label: "โหวตตามเสียงส่วนใหญ่", run: (l) => { addStat(l, "happiness", -8); return bad("เด็กคนนั้นหายไปในแสง คุณไม่มองตาใครในทีมอีกเลยทั้งปี"); } },
      {
        label: "หาทางแก้กฎ",
        check: { stat: "smarts", dc: 60 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 5); gainExp(l, 500); return good("คุณพบว่ากฎไม่ได้ห้ามโหวต 'ผู้คุมชั้น' — ทั้งทีมโหวตใส่เขา และหอคอยยอมรับ"); }
          addStat(l, "happiness", -5);
          return bad("หอคอยไม่ยอมรับคำตอบ — สุ่มส่งคนกลับไปหนึ่งคน และคนนั้นไม่ใช่คุณ");
        },
      },
    ],
  },
  {
    id: "tower.pk",
    weight: 5,
    minAge: 12,
    maxAge: 70,
    when: climbing,
    title: "นักล่าผู้ท้าชิง",
    text: () => "ระหว่างพักในทางเดินระหว่างชั้น กลุ่มนักล่าผู้ท้าชิงสามคนปิดทางหน้าหลัง \"คะแนนแกเยอะดีนี่\"",
    choices: [
      {
        label: "สู้",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 0)),
        survival: (l) => survivalOdds(l, foe(l, 0)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 4); gainExp(l, 400); return good("สามคนนั้นนอนกองอยู่กับพื้น คุณยึดคะแนนของพวกมันคืนมาทั้งหมด"); }
          if (!chance(l, survivalOdds(l, foe(l, 0)))) { kill(l, "ถูกนักล่าผู้ท้าชิงสังหารในทางเดินระหว่างชั้น"); return bad("ไม่มีกล้องถ่ายทอดในทางเดินระหว่างชั้น…"); }
          return bad(`คุณหนีออกมาได้แต่เสียคะแนนไปมาก${hurt(l, 8, 18, "บาดแผลจากนักล่าผู้ท้าชิง")}`);
        },
      },
      { label: "ยอมให้คะแนนไปครึ่งหนึ่ง", run: (l) => { addMoney(l, -Math.round(Math.max(0, l.money) * 0.15)); return meh("พวกมันหัวเราะแล้วหลีกทาง — คุณจำหน้าทั้งสามคนไว้"); } },
    ],
  },
  {
    id: "tower.fans",
    minAge: 14,
    maxAge: 80,
    maxTimes: 3,
    when: (l) => climbing(l) && l.fame >= 20,
    text: () => "คลิปไฮไลต์ของคุณมียอดดูทะลุร้อยล้าน แบรนด์จากโลกภายนอกแย่งกันส่งสัญญาโฆษณามาที่ชั้นปลอดภัย",
    auto: (l) => { addMoney(l, randInt(l, 5, 20) * 100_000); addFame(l, 3); return "good"; },
  },
  {
    id: "tower.return_home",
    minAge: 22,
    maxAge: 70,
    when: climbing,
    title: "กลับบ้าน",
    text: () => "หอคอยอนุญาตให้ผู้ท้าชิงที่ผ่านชั้น 20 กลับโลกได้หนึ่งเดือน แม่ยืนรอที่สนามบินพร้อมกล่องข้าวที่คุณชอบตอนเด็ก",
    choices: [
      { label: "ใช้เวลากับครอบครัวให้เต็มที่", run: (l) => { for (const p of l.people) if (p.alive && ["father", "mother", "sibling", "spouse", "child"].includes(p.relation)) p.bond = clamp(p.bond + 12, 0, 100); addStat(l, "happiness", 12); return good("หนึ่งเดือนที่สั้นที่สุดในชีวิต คุณกลับขึ้นหอคอยพร้อมเหตุผลที่จะต้องรอดกลับมา"); } },
      { label: "ไม่กลับขึ้นไปอีกแล้ว", run: (l) => { l.job = undefined; addStat(l, "happiness", 8); return meh("คุณวางป้ายผู้ท้าชิงไว้บนโต๊ะ — ชีวิตบนโลกอาจไม่ยิ่งใหญ่ แต่มันเป็นของคุณ"); } },
    ],
  },
  {
    id: "tower.ruling_family",
    minAge: 18,
    maxAge: 50,
    when: (l) => climbing(l) && rank(l) >= 4 && !people(l, "spouse").length,
    title: "ตระกูลผู้ปกครองชั้นบน",
    text: (l) => `ตระกูลที่ปกครองชั้น 60–70 ส่งทูตมาหาคุณ "ท่านหญิง${l.gender === "f" ? "… ขออภัย ท่านชาย" : ""}ของเราสนใจผู้ท้าชิงระดับ ${rankName(rank(l))} อย่างท่าน หากแต่งงานเข้าตระกูล ท่านจะได้ทางลัดสู่ชั้นบน"`,
    choices: [
      {
        label: "ตกลงแต่งงานเข้าตระกูล",
        run: (l) => {
          const p = createPerson(l, "spouse", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -3, 3), bond: 35, job: "ทายาทตระกูลผู้ปกครอง" });
          l.flags.floor = Math.max(floorOf(l), Math.min(60, floorOf(l) + 15));
          addMoney(l, 5_000_000);
          addStat(l, "happiness", -5);
          return meh(`คุณแต่งงานกับ${shortName(p)} — ประตูชั้นบนเปิดให้คุณ แต่ทุกก้าวมีสายตาของตระกูลจับจ้อง`);
        },
      },
      { label: "ปฏิเสธ — จะปีนด้วยตัวเอง", run: (l) => { addFame(l, 4); l.flags.rulingGrudge = true; return meh("ทูตยิ้มบางๆ \"น่าเสียดาย ชั้นบนไม่ค่อยใจดีกับคนที่ปฏิเสธเรา\""); } },
    ],
  },
  {
    id: "tower.guardian_deal",
    minAge: 18,
    maxAge: 80,
    when: (l) => climbing(l) && floorOf(l) >= 30,
    title: "ข้อเสนอของผู้ดูแลชั้น",
    text: (l) => `ผู้ดูแลชั้น ${floorOf(l)} ที่ไม่เคยพูดกับผู้ท้าชิงคนไหน เรียกคุณไปคุยส่วนตัว "ข้าส่งเจ้าข้ามไปห้าชั้นได้ แลกกับความทรงจำที่มีค่าที่สุดหนึ่งอย่าง"`,
    choices: [
      { label: "ยอมแลก", run: (l) => { l.flags.floor = Math.min(100, floorOf(l) + 5); addStat(l, "happiness", -12); return bad("คุณข้ามไปห้าชั้น — และจำไม่ได้อีกแล้วว่าทำไมถึงร้องไห้ทุกครั้งที่ได้กลิ่นดอกมะลิ"); } },
      { label: "ปฏิเสธ", run: (l) => { gainExp(l, 300); return meh("ผู้ดูแลชั้นหัวเราะ \"คนที่ปฏิเสธมักไปได้ไกลกว่า\""); } },
    ],
  },
  {
    id: "tower.outsider_hunt",
    weight: 5,
    minAge: 12,
    maxAge: 80,
    when: (l) => l.power?.hunterClass === "t_outsider",
    title: "ผู้บุกรุกถูกตามล่า",
    text: () => "ประกาศจากชั้นบนสุดถูกส่งไปทั่วหอคอย 「ผู้บุกรุกที่ไม่ได้รับเชิญอยู่ในหอคอย — ผู้ใดจับได้ จะได้ข้ามสิบชั้น」 ทุกคนหันมามองคุณ",
    choices: [
      {
        label: "สู้กับทุกคนที่เข้ามา",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 1)),
        survival: (l) => survivalOdds(l, foe(l, 1)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 10); luckyRankUp(l, "พลังจากภายนอกตื่นขึ้นระหว่างถูกล่า"); markTurn(l); return { text: "คุณล้มนักล่าค่าหัวทั้งหมด — ผู้ปกครองชั้นบนเริ่มกลัวคุณจริงๆ แล้ว", kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, foe(l, 1)))) { kill(l, "ถูกตามล่าในฐานะผู้บุกรุกหอคอย"); return bad("คนที่จับคุณได้ข้ามไปสิบชั้นจริงๆ"); }
          return bad(`คุณหนีไปซ่อนในชั้นที่ถูกทิ้งร้าง${hurt(l, 10, 22, "บาดแผลจากการถูกตามล่า")}`);
        },
      },
      { label: "ซ่อนตัวในชั้นล่าง", run: (l) => { addStat(l, "happiness", -6); return meh("คุณใช้ชื่อปลอมอยู่ในชั้นสามหนึ่งปี จนข่าวเงียบลง"); } },
    ],
  },
];

const MUNDANE: GameEvent[] = [
  {
    id: "tower.relic",
    minAge: 12,
    maxAge: 70,
    when: (l) => !l.power,
    text: () => "หลังพายุ คลื่นซัดเศษวัตถุประหลาดจากหอคอยมาเกยหาด — ก้อนผลึกเรืองแสงขนาดกำปั้นวางอยู่ตรงเท้าคุณ",
    choices: [
      { label: "ขายให้สถาบันวิจัย", run: (l) => { const m = randInt(l, 2, 8) * 100_000; addMoney(l, m); return good(`สถาบันวิจัยหอคอยรับซื้อในราคา ${money(l, m)}`); } },
      { label: "เก็บไว้ที่บ้าน", run: (l) => { addStat(l, "luck", 3); l.flags.relicHome = true; return meh("ผลึกเรืองแสงเบาๆ ทุกคืน ห้องคุณอบอุ่นขึ้นอย่างประหลาด"); } },
    ],
  },
  {
    id: "tower.stocks",
    minAge: 20,
    maxAge: 70,
    when: (l) => l.money >= 200_000,
    text: () => "หุ้นบริษัทผลิตอุปกรณ์ผู้ท้าชิงพุ่งทุกครั้งที่มีคนผ่านชั้นใหม่ ข่าวลือว่าทีมใหญ่จะบุกชั้น 50 เดือนหน้า",
    choices: [
      {
        label: "ทุ่มซื้อหุ้น",
        check: { stat: "luck", dc: 52 },
        run: (l, _c, ok) => {
          const stake = Math.round(Math.max(0, l.money) * 0.4);
          if (ok) { addMoney(l, stake); return good(`ทีมนั้นผ่านชั้น 50 จริง! พอร์ตคุณโตขึ้น ${money(l, stake)}`); }
          addMoney(l, -Math.round(stake * 0.6));
          return bad("ทีมนั้นตายยกทีมที่ชั้น 49 หุ้นดิ่งเหว");
        },
      },
      { label: "ไม่เล่น", run: () => meh("คุณดูกราฟขึ้นลงอยู่ห่างๆ") },
    ],
  },
  {
    id: "tower.child_invited",
    minAge: 36,
    maxAge: 80,
    when: (l) => people(l, "child").some((c) => c.age >= 16 && c.age <= 22),
    title: "คำเชิญถึงลูก",
    prepare: (l) => ({ name: shortName(people(l, "child").find((c) => c.age >= 16 && c.age <= 22)!) }),
    text: (_l, c) => `${c.name}ยื่นกระดาษเรืองแสงสีทองให้คุณดู มือสั่น "หอคอยเชิญหนู… พ่อแม่จะว่ายังไง"`,
    choices: [
      { label: "ให้ไปตามฝัน", run: (l) => { addStat(l, "happiness", -4); addFame(l, 2); return meh("คุณนั่งดูถ่ายทอดสดทุกคืน ตั้งแต่วันนั้นไม่เคยปิดทีวีก่อนเห็นชื่อลูก"); } },
      { label: "ขอให้อยู่บ้าน", run: (l, c) => { const k = l.people.find((p) => shortName(p) === c.name); if (k) k.bond = clamp(k.bond - 15, 0, 100); return meh(`${c.name}ฉีกคำเชิญทิ้ง แต่ไม่คุยกับคุณไปหลายเดือน`); } },
    ],
  },
  {
    id: "tower.news_top",
    minAge: 10,
    maxAge: 90,
    text: (l) => pick(l, [
      "[ข่าวด่วน] ผู้ท้าชิงชาวต่างชาติผ่านชั้น 77 ได้เป็นคนแรก! ตลาดหุ้นทั่วโลกพุ่งขึ้น",
      "[ข่าวด่วน] ทีมผู้ท้าชิงสามสิบคนหายตัวไปในชั้น 45 หอคอยไม่ให้คำอธิบาย",
      "[ข่าวด่วน] นักวิจัยพบว่าหอคอยสูงขึ้นอีกหนึ่งชั้นทุกสิบปี — ไม่มีใครรู้ว่ายอดอยู่ที่ไหนจริงๆ",
    ]),
    auto: () => "normal",
  },
];


export const TOWER_EVENTS: GameEvent[] = [...YOUNG, ...CLIMBER, ...MUNDANE];
