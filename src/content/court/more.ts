// เหตุการณ์ราชสำนักเพิ่มเติม (M9): ชีวิตขุนนางและสามัญชนในจักรวรรดิ
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
const noble = (l: Life) => l.wealth !== "poor";
const single = (l: Life) => !people(l, "partner").length && !people(l, "spouse").length;
const other = (l: Life) => (l.gender === "m" ? "f" : "m");
const foe = (l: Life, d = 0) => clamp(rank(l) + d, 0, 8);
const winOdds = (l: Life, d = 0) => (l.power ? fightOdds(l, foe(l, d)) : clamp(0.25 + (l.stats.health - 50) / 120, 0.05, 0.7));
const lady = (l: Life) => (l.gender === "f" ? "คุณหนู" : "คุณชาย");

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
    id: "c2.c.pony",
    minAge: 5,
    maxAge: 10,
    when: noble,
    text: () => "ของขวัญวันเกิดปีนี้คือม้าแคระขนสีครีมที่มีโบว์สีฟ้าผูกที่หาง คุณตั้งชื่อมันว่า 'ขนมปัง'",
    auto: (l) => { addStat(l, "happiness", 6); return "good"; },
  },
  {
    id: "c2.c.secret_garden",
    minAge: 6,
    maxAge: 12,
    title: "สวนลับหลังกำแพง",
    text: (l) => `หลังกำแพงที่ปกคลุมด้วยไม้เลื้อย มีสวนร้างที่ไม่มีใครดูแล — และ${l.gender === "f" ? "เด็กผู้ชาย" : "เด็กผู้หญิง"}ผมดำคนหนึ่งนั่งกอดเข่าอยู่ แขนมีรอยฟกช้ำ`,
    choices: [
      {
        label: "นั่งลงข้างๆ แล้วแบ่งคุกกี้ให้",
        run: (l) => {
          const p = createPerson(l, "friend", { gender: other(l), age: l.age + 1, bond: 55 });
          l.flags.gardenFriend = p.id;
          return good(`${shortName(p)}ไม่ยอมบอกว่ามาจากตระกูลไหน แต่มาที่สวนนี้ทุกบ่ายวันพุธ — แล้ววันหนึ่งก็หายไปพร้อมสัญญาว่าจะกลับมา`);
        },
      },
      { label: "วิ่งไปบอกผู้ใหญ่", run: () => meh("พอผู้ใหญ่มาถึง สวนว่างเปล่า มีแค่ผ้าเช็ดหน้าปักตราสิงโตทองตกอยู่") },
    ],
  },
  {
    id: "c2.c.etiquette",
    minAge: 6,
    maxAge: 12,
    when: noble,
    text: () => "ครูมารยาทวางหนังสือสามเล่มบนหัวคุณแล้วสั่งให้เดินรอบห้องโถงร้อยรอบ ห้ามหล่นแม้แต่เล่มเดียว",
    choices: [
      { label: "อดทนจนครบร้อยรอบ", check: { stat: "health", dc: 45 }, run: (l, _c, ok) => { if (ok) { addStat(l, "looks", 3); return good("ครูพยักหน้าครั้งแรกในรอบปี ท่าเดินของคุณสง่างามขึ้นจริงๆ"); } addStat(l, "happiness", -4); return bad("หนังสือหล่นรอบที่เก้าสิบเก้า ต้องเริ่มใหม่ตั้งแต่ต้น"); } },
      { label: "แอบเอากาวทาหนังสือ", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { if (ok) { addStat(l, "happiness", 4); return good("ผ่านร้อยรอบในเวลาสิบนาที ครูประหลาดใจมาก"); } addStat(l, "happiness", -6); return bad("ครูจับได้ — คุณต้องคัดลายมือ 'ข้าจะไม่โกงอีก' ห้าร้อยครั้ง"); } },
    ],
  },
  {
    id: "c2.c.portrait",
    minAge: 5,
    maxAge: 14,
    text: () => "ภาพเหมือนบรรพบุรุษที่แขวนอยู่ปลายทางเดิน ดวงตาในภาพมองตามคุณทุกครั้งที่เดินผ่าน คืนนี้คุณได้ยินเสียงเคาะจากหลังกรอบรูป",
    choices: [
      {
        label: "ยกกรอบรูปออกดู",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { addMoney(l, 200_000); addStat(l, "luck", 2); return good("หลังกรอบรูปมีช่องลับ ข้างในเป็นถุงเหรียญทองเก่าและจดหมายที่ขึ้นต้นว่า 'ถึงลูกหลานผู้กล้าหาญ'"); }
          addStat(l, "happiness", -3);
          return meh("ข้างหลังมีแต่หนูตัวอ้วนกับใยแมงมุม หนูวิ่งผ่านเท้าคุณจนกรีดร้องลั่นคฤหาสน์");
        },
      },
      { label: "คลุมผ้าห่มจนถึงหัว", run: () => meh("เสียงเคาะเงียบไปตอนตีสาม คุณไม่กล้าเดินผ่านทางนั้นอีกหนึ่งเดือน") },
    ],
  },
  {
    id: "c2.c.urchin",
    minAge: 6,
    maxAge: 13,
    when: (l) => !noble(l),
    title: "ขนมปังก้อนสุดท้าย",
    text: () => "หน้าหนาวปีนี้แป้งแพงจนบ้านคุณไม่มีอะไรกินมาสองวัน ร้านขนมปังหัวมุมเพิ่งวางขนมปังร้อนๆ ไว้ริมหน้าต่าง",
    choices: [
      {
        label: "ขโมยมาหนึ่งก้อน",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { addStat(l, "health", 3); return meh("คุณวิ่งจนลมแทบขาด แบ่งขนมปังให้น้องๆ — เจ้าของร้านเห็น แต่แกล้งหันไปทางอื่น"); }
          addStat(l, "happiness", -6);
          return bad("ทหารยามจับได้ คุณถูกขังหนึ่งคืนในห้องเย็นเฉียบ");
        },
      },
      {
        label: "ขอทำงานแลกขนมปัง",
        run: (l) => { addStat(l, "health", 2); l.flags.bakerFriend = true; return good("เจ้าของร้านให้คุณนวดแป้งทุกเช้าแลกกับขนมปังสองก้อน — และสอนสูตรให้ทีละนิด"); },
      },
    ],
  },
  {
    id: "c2.c.wolf_pup",
    minAge: 5,
    maxAge: 12,
    title: "ลูกหมาในหิมะ",
    text: () => "คุณเก็บลูกหมาสีเงินที่ติดหิมะมาเลี้ยง มันโตเร็วผิดปกติ ตาเป็นสีทองอำพัน และไม่เคยเห่าเลย",
    choices: [
      { label: "เลี้ยงไว้ต่อ", run: (l) => { l.flags.spiritWolf = true; addStat(l, "luck", 3); return good("นักบวชที่มาเยี่ยมบ้านหน้าซีดเมื่อเห็นมัน \"นี่มันลูกหมาป่าภูตแห่งทิศเหนือ… มันเลือกเจ้าเป็นนาย\""); } },
      { label: "ส่งให้ผู้ใหญ่จัดการ", run: () => meh("คืนนั้นมันหายไป ทิ้งรอยเท้าไว้บนหิมะมุ่งไปทางทิศเหนือ") },
    ],
  },
  {
    id: "c2.c.credit",
    minAge: 7,
    maxAge: 15,
    when: (l) => people(l, "sibling").length > 0,
    text: (l) => `${shortName(people(l, "sibling")[0])}เอาเรียงความที่คุณเขียนไปส่งในชื่อตัวเอง แล้วได้คำชมจากพ่อต่อหน้าแขกทั้งงาน`,
    choices: [
      { label: "เปิดโปงต่อหน้าทุกคน", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { const s = people(l, "sibling")[0]; s.bond = clamp(s.bond - 20, 0, 100); if (ok) { addFame(l, 2); return good("คุณท่องเรียงความทั้งเรื่องได้คำต่อคำ ทุกคนรู้ทันทีว่าใครเขียน"); } return bad("ไม่มีใครเชื่อคุณ พ่อมองคุณเหมือนเด็กขี้อิจฉา"); } },
      { label: "ปล่อยไป", run: (l) => { const s = people(l, "sibling")[0]; s.bond = clamp(s.bond + 5, 0, 100); return meh("คืนนั้นพี่น้องคุณแอบเอาเค้กมาวางไว้หน้าห้องพร้อมโน้ต 'ขอโทษ'"); } },
    ],
  },
];

const YOUTH: GameEvent[] = [
  {
    id: "c2.y.debut",
    minAge: 15,
    maxAge: 19,
    when: noble,
    title: "งานเปิดตัวสู่สังคม",
    text: (l) => `คืนเปิดตัวสู่สังคมของ${lady(l)}ตระกูลของคุณ แชนเดอเลียร์คริสตัลส่องแสงระยิบระยับ สายตาทุกคู่ในห้องโถงหันมาที่บันไดใหญ่`,
    choices: [
      {
        label: "เดินลงบันไดอย่างสง่างาม",
        skill: ["social", "perform"],
        check: { stat: "looks", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 8); addStat(l, "happiness", 8); return good("ห้องโถงเงียบไปสามวินาที แล้วเสียงกระซิบดังทั่วงาน — บัตรเชิญเต้นรำของคุณเต็มภายในสิบนาที"); }
          addStat(l, "happiness", -6);
          return bad("ส้นรองเท้าพลิกตอนขั้นสุดท้าย — ไม่มีใครพูดอะไร แต่ทุกคนเห็น");
        },
      },
      { label: "เข้างานทางประตูข้าง", run: (l) => { addStat(l, "happiness", 2); return meh("คุณยืนกินมาการองอยู่มุมห้องทั้งคืน แล้วได้คุยกับคนที่น่าสนใจที่สุดในงาน — คนเสิร์ฟ"); } },
    ],
  },
  {
    id: "c2.y.masquerade",
    minAge: 16,
    maxAge: 28,
    when: single,
    title: "งานเต้นรำหน้ากาก",
    text: (l) => `ในงานเต้นรำหน้ากาก ${l.gender === "f" ? "ชายสวมหน้ากากสีเงิน" : "หญิงสวมหน้ากากขนนกสีดำ"}ยื่นมือมาขอเต้นรำ — ท่าเต้นสมบูรณ์แบบเหมือนเรียนมาจากในวัง`,
    choices: [
      {
        label: "เต้นรำจนจบเพลง",
        run: (l) => {
          if (chance(l, 0.5)) {
            const p = createPerson(l, "partner", { gender: other(l), age: l.age + randInt(l, 0, 4), bond: 60 });
            addStat(l, "happiness", 10);
            return { text: `💕 พอถอดหน้ากาก ${shortName(p)}ยิ้มให้คุณ "ข้าตามหาเจ้ามาทั้งคืน"`, kind: "milestone" };
          }
          addStat(l, "happiness", 5);
          return meh("ระฆังเที่ยงคืนดังขึ้น อีกฝ่ายรีบหายไปในฝูงชน ทิ้งไว้แค่ถุงมือหนึ่งข้าง");
        },
      },
      { label: "ปฏิเสธอย่างสุภาพ", run: () => meh("อีกฝ่ายโค้งให้แล้วถอยไป — คุณสงสัยไปทั้งปีว่าเป็นใคร") },
    ],
  },
  {
    id: "c2.y.glove",
    minAge: 15,
    maxAge: 35,
    title: "ถุงมือสีขาว",
    text: () => "บุตรชายมาร์ควิสดูหมิ่นเกียรติตระกูลคุณกลางงานเลี้ยง แล้วโยนถุงมือสีขาวลงที่เท้า — ท้าดวลตามธรรมเนียมขุนนาง",
    choices: [
      {
        label: "เก็บถุงมือขึ้นมา",
        tone: "danger",
        odds: (l) => winOdds(l, 1),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 8); if (l.power) gainExp(l, 300); return good("ดาบของคุณหยุดห่างคอเขาหนึ่งเส้นผม เขายอมแพ้ต่อหน้าทุกคน — ข่าวลือไปถึงวังในวันเดียว"); }
          addFame(l, -5);
          return bad(`คุณแพ้ต่อหน้าขุนนางทั้งเมือง${hurt(l, 6, 15, "แผลจากการดวลตามธรรมเนียมขุนนาง")}`);
        },
      },
      { label: "ให้อัศวินประจำตระกูลดวลแทน", run: (l) => { addMoney(l, -50_000); addFame(l, -2); return meh("อัศวินของคุณชนะ แต่คนพูดกันว่าคุณขี้ขลาด"); } },
    ],
  },
  {
    id: "c2.y.forbidden_tome",
    weight: 4,
    minAge: 12,
    maxAge: 30,
    when: (l) => !!l.power,
    title: "ตำราต้องห้ามในหอสมุด",
    text: () => "ชั้นหนังสือที่ถูกล่ามโซ่ในหอสมุดหลวงไม่ได้ล็อก ตำราปกหนังสีดำกระซิบเรียกชื่อคุณเบาๆ",
    choices: [
      {
        label: "เปิดอ่าน",
        check: { stat: "smarts", dc: 60 },
        run: (l, _c, ok) => {
          if (ok) { luckyRankUp(l, "คุณเข้าใจทฤษฎีวงเวทที่หายไปจากโลกนี้"); markTurn(l); return { text: "ตัวอักษรในตำราลอยขึ้นมาซึมเข้าตาคุณ — คุณเห็นวงเวทในแบบที่ไม่มีใครเคยเห็น", kind: "milestone" }; }
          return bad(`ตำราดูดมานาของคุณจนหมดสติ${hurt(l, 10, 20, "ถูกตำราต้องห้ามดูดพลังชีวิต")}`);
        },
      },
      { label: "แจ้งบรรณารักษ์", run: (l) => { addFame(l, 2); return meh("บรรณารักษ์หน้าซีด ล็อกโซ่ใหม่สามชั้น แล้วขอบคุณคุณเสียงสั่น"); } },
    ],
  },
  {
    id: "c2.y.letter_mixup",
    minAge: 14,
    maxAge: 22,
    text: () => "คนส่งจดหมายส่งจดหมายรักผิดบ้าน — มาถึงคุณแทนที่จะเป็นคุณหนูบ้านตรงข้าม ข้างในเขียนไว้ยาวสิบหน้า เต็มไปด้วยกลอนที่แย่ที่สุดที่คุณเคยอ่าน",
    choices: [
      { label: "เอาไปส่งให้ถึงมือเจ้าของ", run: (l) => { addStat(l, "happiness", 4); addFame(l, 1); return good("สองคนนั้นได้แต่งงานกันปีถัดมา และเชิญคุณเป็นแขกคนสำคัญ"); } },
      { label: "อ่านออกเสียงให้เพื่อนฟัง", run: (l) => { addStat(l, "happiness", 6); addFame(l, -2); return meh("ทั้งเมืองท่องกลอนนั้นได้ภายในสัปดาห์เดียว เจ้าของจดหมายไม่มองหน้าคุณอีกเลย"); } },
    ],
  },
  {
    id: "c2.y.tea_rumor",
    minAge: 14,
    maxAge: 30,
    when: noble,
    title: "ข่าวลือจากงานน้ำชา",
    text: () => "หลังงานน้ำชา คุณหนูตระกูลเคานต์ล้มป่วย ข่าวลือแพร่ไปทั่วว่าคุณใส่บางอย่างในชาของเธอ",
    choices: [
      {
        label: "สืบหาความจริง",
        check: { stat: "smarts", dc: 58 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 6); return good("คุณพบว่าเธอแพ้ขนมเค้กที่สาวใช้ของเธอเองนำมา ข่าวลือพลิกกลับเป็นคำชม"); }
          addFame(l, -10);
          return bad("หลักฐานไม่พอ ชื่อเสียงคุณติดคำว่า 'แม่มดแห่งงานน้ำชา' ไปอีกหลายปี");
        },
      },
      { label: "ส่งดอกไม้ไปเยี่ยม", run: (l) => { addFame(l, 2); return meh("เธอส่งจดหมายขอบคุณกลับมา ข่าวลือค่อยๆ เงียบลง"); } },
    ],
  },
  {
    id: "c2.y.hunt",
    minAge: 15,
    maxAge: 45,
    title: "เทศกาลล่าสัตว์หลวง",
    text: () => "เทศกาลล่าสัตว์ประจำปีของราชวงศ์ ผู้ที่ล่าสัตว์ได้ใหญ่ที่สุดจะได้รับพรจากจักรพรรดิ — และปีนี้มีข่าวลือว่ามีหมีเวทมนตร์หลงเข้ามาในป่า",
    choices: [
      {
        label: "ตามรอยหมีเวทมนตร์",
        tone: "danger",
        odds: (l) => winOdds(l, 1),
        survival: (l) => (l.power ? survivalOdds(l, foe(l, 1)) : 0.7),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 12); if (l.power) gainExp(l, 500); addMoney(l, 300_000); return good(`คุณล้มหมีเวทมนตร์ได้ต่อหน้าราชวงศ์ จักรพรรดิพระราชทานรางวัล ${money(l, 300_000)}`); }
          if (!chance(l, l.power ? survivalOdds(l, foe(l, 1)) : 0.7)) { kill(l, "ถูกหมีเวทมนตร์ขย้ำในเทศกาลล่าสัตว์หลวง"); return bad("เงาขนาดยักษ์ยืนขึ้นบนสองขาหลัง…"); }
          return bad(`หมีฟาดคุณตกจากหลังม้า${hurt(l, 10, 22, "บาดเจ็บจากหมีเวทมนตร์")}`);
        },
      },
      { label: "ล่ากระต่ายอยู่ชายป่า", run: (l) => { addStat(l, "happiness", 3); return meh("คุณได้กระต่ายสามตัว และชมวิวป่าฤดูใบไม้ร่วงอย่างสบายใจ"); } },
    ],
  },
];

const ADULT: GameEvent[] = [
  {
    id: "c2.a.estate_debt",
    minAge: 20,
    maxAge: 60,
    when: noble,
    title: "บัญชีที่ไม่ลงตัว",
    text: () => "สมุดบัญชีของตระกูลมีตัวเลขแปลกๆ — ผู้ดูแลที่ดินยักยอกเงินมาหลายปีจนตระกูลเป็นหนี้พ่อค้าเกือบหมดตัว",
    choices: [
      {
        label: "ตรวจบัญชีเองทั้งหมด",
        check: { stat: "smarts", dc: 58 },
        run: (l, _c, ok) => {
          if (ok) { addMoney(l, 800_000); addFame(l, 3); return good("คุณจับผู้ดูแลได้คาหนังคาเขา ได้เงินคืนมาเกือบหมด และปรับระบบใหม่จนที่ดินทำกำไรเป็นปีแรก"); }
          addMoney(l, -400_000);
          return bad("ผู้ดูแลหนีไปก่อนพร้อมเงินอีกก้อน ตระกูลต้องขายที่ดินผืนหนึ่งใช้หนี้");
        },
      },
      { label: "ไล่ผู้ดูแลออก แล้วจ้างคนใหม่", run: (l) => { addMoney(l, -100_000); return meh("ผู้ดูแลคนใหม่ซื่อสัตย์ — แต่ก็ไม่ได้เก่งอะไร"); } },
    ],
  },
  {
    id: "c2.a.old_count",
    minAge: 18,
    maxAge: 35,
    when: (l) => single(l) && l.wealth !== "elite",
    title: "ข้อเสนอการแต่งงาน",
    text: () => "เคานต์ผู้มั่งคั่งอายุหกสิบส่งข้อเสนอแต่งงานมา พร้อมสินสอดที่ล้างหนี้ตระกูลคุณได้ทั้งหมด ครอบครัวมองคุณอย่างมีความหวัง",
    choices: [
      { label: "ตอบตกลงเพื่อครอบครัว", run: (l) => { const p = createPerson(l, "spouse", { gender: other(l), age: 60, bond: 30, job: "เคานต์" }); addMoney(l, 2_000_000); addStat(l, "happiness", -12); return meh(`คุณแต่งงานกับ${shortName(p)} — คฤหาสน์ใหญ่โต เงียบเหงา และเย็นเฉียบ`); } },
      { label: "ปฏิเสธ", run: (l) => { addStat(l, "happiness", 4); for (const p of l.people) if (p.relation === "father" || p.relation === "mother") p.bond = clamp(p.bond - 10, 0, 100); return meh("พ่อไม่พูดกับคุณหนึ่งเดือน แต่คุณนอนหลับสบายทุกคืน"); } },
    ],
  },
  {
    id: "c2.a.border_war",
    minAge: 18,
    maxAge: 55,
    when: (l) => !!l.power,
    title: "สงครามชายแดน",
    text: () => "อาณาจักรเพื่อนบ้านบุกข้ามแม่น้ำชายแดน จักรพรรดิออกราชโองการเรียกผู้มีวงเวทและอัศวินทุกคนไปแนวหน้า",
    choices: [
      {
        label: "ออกรบแนวหน้า",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 1)),
        survival: (l) => survivalOdds(l, foe(l, 1)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 15); gainExp(l, 1000); addMoney(l, 500_000); return { text: "คุณตีทัพข้าศึกแตกที่สะพานหิน ได้รับเหรียญกล้าหาญจากมือจักรพรรดิ", kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, foe(l, 1)))) { kill(l, "สิ้นชีพในสงครามชายแดน"); return bad("ลูกธนูเวทพุ่งผ่านโล่ของคุณ…"); }
          return bad(`ทัพแตก คุณถอยกลับมาพร้อมแผลฉกรรจ์${hurt(l, 12, 25, "บาดแผลจากสงครามชายแดน")}`);
        },
      },
      { label: "ประจำการแนวหลัง", run: (l) => { addFame(l, 2); gainExp(l, 200); return meh("คุณดูแลเสบียงและรักษาทหารที่บาดเจ็บจนสงครามจบ"); } },
    ],
  },
  {
    id: "c2.a.salon",
    minAge: 22,
    maxAge: 70,
    when: (l) => noble(l) && l.money >= 300_000,
    title: "ซาลอนของคุณ",
    text: () => "คุณเปิดห้องรับแขกของคฤหาสน์เป็นซาลอน ให้กวี นักวิชาการ และนักเวทหนุ่มสาวมาถกเถียงกันทุกคืนวันศุกร์",
    choices: [
      { label: "เชิญคนหัวก้าวหน้า", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { addMoney(l, -100_000); if (ok) { addFame(l, 10); return good("ซาลอนของคุณกลายเป็นศูนย์กลางความคิดใหม่ของนครหลวง"); } addFame(l, -3); return bad("มีคนพูดเรื่องการเมืองเกินเลย ทหารวังมาเคาะประตู"); } },
      { label: "เชิญแต่คนในวงสังคมเดิม", run: (l) => { addMoney(l, -50_000); addFame(l, 3); return meh("ปลอดภัย สง่างาม และน่าเบื่อนิดหน่อย"); } },
    ],
  },
  {
    id: "c2.a.knight_oath",
    minAge: 20,
    maxAge: 60,
    when: (l) => l.fame >= 15,
    title: "คำสาบานของอัศวิน",
    text: () => "อัศวินหนุ่มที่คุณเคยช่วยไว้จากการถูกใส่ร้ายคุกเข่าลงต่อหน้าคุณ ยื่นดาบด้วยสองมือ \"ชีวิตนี้ของกระหม่อมเป็นของท่าน\"",
    choices: [
      { label: "รับคำสาบาน", run: (l) => { const p = createPerson(l, "ally", { gender: "m", age: l.age - randInt(l, 0, 5), bond: 75, job: "อัศวินผู้สาบานตน" }); return good(`${shortName(p)}กลายเป็นอัศวินประจำตัวของคุณ ไม่เคยห่างเกินสิบก้าว`); } },
      { label: "ปล่อยให้เป็นอิสระ", run: (l) => { addFame(l, 3); return meh("\"ชีวิตเจ้าเป็นของเจ้า\" — อัศวินร้องไห้ แล้วออกเดินทางไปปกป้องคนอื่นแทน"); } },
    ],
  },
  {
    id: "c2.a.spy",
    minAge: 18,
    maxAge: 70,
    when: noble,
    text: () => "คุณสังเกตว่าสาวใช้คนใหม่ชอบยืนนานผิดปกติหน้าห้องทำงาน และกระดาษในลิ้นชักถูกขยับไปนิดหนึ่ง",
    choices: [
      { label: "วางกับดักข้อมูลปลอม", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { if (ok) { addFame(l, 4); return good("ข้อมูลปลอมไปโผล่ที่ตระกูลคู่แข่ง — คุณรู้แล้วว่าใครอยู่เบื้องหลัง และใช้มันกลับไปเล่นงาน"); } addMoney(l, -200_000); return bad("สาวใช้หายไปพร้อมสัญญาการค้าฉบับจริง"); } },
      { label: "ไล่ออกทันที", run: () => meh("สาวใช้ออกไปเงียบๆ คุณไม่มีวันรู้ว่าใครส่งมา") },
    ],
  },
  {
    id: "c2.a.dragon",
    weight: 4,
    minAge: 20,
    maxAge: 70,
    when: (l) => rank(l) >= 4,
    title: "เงามังกรเหนือภูเขา",
    text: (l) => `มังกรแดงตื่นจากการจำศีลห้าร้อยปี เผาหมู่บ้านไปแล้วสามแห่ง จักรพรรดิประกาศว่าใครปราบได้จะได้รับตำแหน่งดยุก — ในฐานะผู้มี${rankLabel(l, rank(l))} คุณคือหนึ่งในไม่กี่คนที่มีสิทธิ์`,
    choices: [
      {
        label: "ไปปราบมังกร",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 2)),
        survival: (l) => survivalOdds(l, foe(l, 2)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 30); addMoney(l, 5_000_000); luckyRankUp(l, "คุณกลืนหัวใจมังกร"); markTurn(l); return { text: "🐉 มังกรแดงล้มลงบนยอดเขา เสียงสะเทือนไปถึงนครหลวง — ชื่อของคุณถูกจารึกในพงศาวดาร", kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, foe(l, 2)))) { kill(l, "ถูกเปลวไฟมังกรแดงเผา"); return bad("ลมหายใจมังกรกลืนทุกอย่าง…"); }
          return bad(`คุณหนีออกมาได้พร้อมแผลไฟไหม้ครึ่งตัว${hurt(l, 15, 30, "แผลไฟไหม้จากมังกร")}`);
        },
      },
      { label: "ช่วยอพยพชาวบ้านแทน", run: (l) => { addFame(l, 8); return good("คุณพาชาวบ้านสองหมู่บ้านหนีพ้นได้ทัน — มีคนปั้นรูปคุณไว้ที่ลานหมู่บ้าน"); } },
    ],
  },
  {
    id: "c2.a.orphanage",
    minAge: 22,
    maxAge: 80,
    when: (l) => l.money >= 500_000,
    text: () => "บ้านเด็กกำพร้าข้างวิหารหลังคารั่ว เด็กๆ นอนเบียดกันหลบฝน แม่อธิการขอความช่วยเหลือจากทุกตระกูลแต่ไม่มีใครตอบ",
    choices: [
      { label: "สร้างอาคารใหม่ให้ทั้งหลัง", run: (l) => { addMoney(l, -500_000); addFame(l, 10); addStat(l, "happiness", 10); return good("เด็กๆ ตั้งชื่ออาคารหลังใหม่ตามชื่อคุณ และร้องเพลงขอบคุณทุกวันอาทิตย์"); } },
      { label: "บริจาคเล็กน้อย", run: (l) => { addMoney(l, -50_000); addFame(l, 2); return meh("พอซ่อมหลังคาได้ ฤดูหนาวนี้เด็กๆ ไม่ต้องเปียกฝน"); } },
    ],
  },
  {
    id: "c2.a.inheritance",
    minAge: 25,
    maxAge: 70,
    when: (l) => noble(l) && !!l.flags.inherited,
    title: "ญาติจากต่างแดน",
    text: () => "ลูกพี่ลูกน้องที่ไม่เคยเจอหน้าปรากฏตัวพร้อมพินัยกรรมฉบับ 'ใหม่กว่า' ที่ยกทรัพย์สินครึ่งหนึ่งให้เขา",
    choices: [
      {
        label: "พิสูจน์ว่าพินัยกรรมปลอม",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 4); return good("ตราประทับบนพินัยกรรมเป็นแบบที่เพิ่งใช้เมื่อสองปีก่อน — พ่อคุณตายไปก่อนนั้น ญาติคนนั้นถูกจับข้อหาปลอมเอกสาร"); }
          addMoney(l, -Math.round(Math.max(0, l.money) * 0.3));
          return bad("ศาลตัดสินให้แบ่งทรัพย์สิน คุณเสียไปเกือบหนึ่งในสาม");
        },
      },
      { label: "ยอมความ ให้เงินก้อนหนึ่ง", run: (l) => { addMoney(l, -300_000); return meh("ญาติรับเงินแล้วหายไปจากชีวิตคุณ"); } },
    ],
  },
  {
    id: "c2.a.tower_exam",
    weight: 5,
    minAge: 16,
    maxAge: 50,
    maxTimes: 2,
    when: (l) => !!l.power && rank(l) < 8,
    title: "สอบเลื่อนวงเวท",
    text: (l) => `หอคอยเวทเงินเปิดสอบเลื่อนวงเวทประจำปี กรรมการสามคนจะทดสอบว่าคุณพร้อมขึ้นสู่${rankLabel(l, rank(l) + 1)}หรือไม่`,
    choices: [
      {
        label: "เข้าสอบ",
        odds: (l) => clamp(fightOdds(l, foe(l, 1)) - 0.1 + l.stats.smarts / 400, 0.05, 0.9),
        run: (l, _c, ok) => {
          if (ok) { luckyRankUp(l, "คุณสอบผ่านต่อหน้ากรรมการหอคอยเวท"); return good("กรรมการคนกลางยิ้มเป็นครั้งแรกในรอบสิบปี"); }
          gainExp(l, 300);
          return bad("วงเวทแตกกลางการสอบ — ปีหน้าค่อยมาใหม่");
        },
      },
      { label: "รอให้พร้อมกว่านี้", run: (l) => { gainExp(l, 150); return meh("คุณขังตัวในห้องทดลองอีกหนึ่งปี"); } },
    ],
  },
  {
    id: "c2.a.cursed_jewel",
    minAge: 16,
    maxAge: 70,
    text: () => "ของขวัญจากผู้ไม่ประสงค์ออกนามคือสร้อยทับทิมสีเลือดนก สวยจนลืมหายใจ — แต่ตั้งแต่ได้มา ดอกไม้ในห้องคุณเหี่ยวทุกเช้า",
    choices: [
      { label: "ให้นักบวชตรวจ", run: (l) => { addStat(l, "luck", 3); return good("นักบวชถอนคำสาปออก ทับทิมกลายเป็นสีชมพูอ่อน — และคุณได้รู้ว่าใครส่งมา"); } },
      { label: "ใส่ไปงานเลี้ยง", check: { stat: "luck", dc: 60 }, run: (l, _c, ok) => { if (ok) { addFame(l, 5); return good("ทั้งงานจ้องสร้อยของคุณ — คำสาปดูเหมือนจะไม่ทำงานกับคนดวงแข็ง"); } return bad(`คุณล้มหมดสติกลางงาน${hurt(l, 10, 20, "คำสาปจากสร้อยทับทิม")}`); } },
    ],
  },
  {
    id: "c2.a.audience",
    minAge: 20,
    maxAge: 80,
    maxTimes: 2,
    when: (l) => l.fame >= 30,
    text: () => "ราชเลขาธิการนำราชสาส์นมาส่งถึงคฤหาสน์ จักรพรรดิประสงค์จะพบคุณเป็นการส่วนพระองค์ในสวนหลวง",
    auto: (l) => { addFame(l, 6); addStat(l, "happiness", 5); if (l.job) l.job.performance = clamp(l.job.performance + 10, 0, 100); return "good"; },
  },
  {
    id: "c2.a.ambush",
    minAge: 16,
    maxAge: 70,
    title: "ซุ่มโจมตีกลางทาง",
    text: () => "รถม้าของคุณหยุดกะทันหันกลางป่า เสียงคนขับม้าเงียบไป — ลูกธนูปักอยู่ที่ประตูรถม้า",
    choices: [
      {
        label: "ออกไปสู้",
        tone: "danger",
        odds: (l) => winOdds(l, 0),
        survival: (l) => (l.power ? survivalOdds(l, foe(l, 0)) : 0.7),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 4); if (l.power) gainExp(l, 300); return good("คุณจัดการโจรได้หมด หนึ่งในนั้นสารภาพว่าถูกจ้างโดยตระกูลคู่แข่ง"); }
          if (!chance(l, l.power ? survivalOdds(l, foe(l, 0)) : 0.7)) { kill(l, "ถูกซุ่มโจมตีกลางทางในป่า"); return bad("ลูกธนูดอกที่สองไม่พลาดเป้า…"); }
          addMoney(l, -Math.round(Math.max(0, l.money) * 0.1));
          return bad(`โจรปล้นทรัพย์ไปแล้วหนีหาย${hurt(l, 8, 16, "บาดแผลจากโจรป่า")}`);
        },
      },
      { label: "ซ่อนในรถม้า", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => { if (ok) return meh("หน่วยลาดตระเวนผ่านมาพอดี โจรแตกฮือไป"); addMoney(l, -Math.round(Math.max(0, l.money) * 0.2)); return bad("โจรลากคุณออกมาแล้วปล้นทุกอย่าง แม้แต่รองเท้า"); } },
    ],
  },
];

const LATER: GameEvent[] = [
  {
    id: "c2.e.memoir",
    minAge: 50,
    maxAge: 95,
    when: (l) => l.fame >= 20,
    text: () => "บันทึกความทรงจำที่คุณเขียนตอนแก่ถูกพิมพ์ขาย ทั้งนครหลวงแย่งกันอ่าน — โดยเฉพาะบทที่เล่าเรื่องงานเลี้ยงในวัง",
    auto: (l) => { addMoney(l, 1_000_000); addFame(l, 5); return "good"; },
  },
  {
    id: "c2.e.grandchild_ball",
    minAge: 55,
    maxAge: 95,
    when: (l) => people(l, "child").length > 0,
    text: () => "คืนนี้หลานคนโตเปิดตัวสู่สังคม คุณนั่งดูจากระเบียงชั้นบน นึกถึงคืนที่ตัวเองเดินลงบันไดนั้นเมื่อหลายสิบปีก่อน",
    auto: (l) => { addStat(l, "happiness", 10); return "good"; },
  },
  {
    id: "c2.e.portrait",
    minAge: 50,
    maxAge: 95,
    when: noble,
    text: (l) => pick(l, ["จิตรกรหลวงวาดภาพเหมือนของคุณไว้แขวนในห้องโถงใหญ่ คู่กับภาพบรรพบุรุษ", "คุณปลูกกุหลาบพันธุ์ใหม่จนได้รางวัลในงานสวนของราชวงศ์ ตั้งชื่อตามคนที่คุณรักที่สุด"]),
    auto: (l) => { addStat(l, "happiness", 6); return "good"; },
  },
  {
    id: "c2.m.bakery_contest",
    minAge: 16,
    maxAge: 60,
    when: (l) => !noble(l) || !!l.flags.bakerFriend,
    title: "การประกวดขนมของเทศกาลฤดูร้อน",
    text: () => "เทศกาลฤดูร้อนจัดประกวดขนมหวาน ผู้ชนะจะได้ส่งขนมเข้าวังหนึ่งปี",
    choices: [
      {
        label: "ลงประกวด",
        check: { stat: "smarts", dc: 50, bonus: (l) => (l.flags.bakerFriend ? 0.15 : 0) },
        run: (l, _c, ok) => {
          if (ok) { addMoney(l, 400_000); addFame(l, 8); return good("ทาร์ตผลไม้ของคุณชนะขาดลอย คนในวังเริ่มเรียกคุณว่า 'มือทอง'"); }
          return meh("ได้รางวัลชมเชย — กรรมการแอบมาซื้อกลับบ้านทีหลัง");
        },
      },
      { label: "ไปเดินชิมอย่างเดียว", run: (l) => { addStat(l, "happiness", 4); addStat(l, "health", -1); return meh("คุณชิมไปสามสิบร้าน ท้องแทบแตก"); } },
    ],
  },
];

export const COURT_MORE: GameEvent[] = [...CHILD, ...YOUTH, ...ADULT, ...LATER];
