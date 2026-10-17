// M19 — บนโลก: กลับบ้านจากหอคอย · คนที่ปฏิเสธคำเชิญ · คนที่ประตูไม่เปิดให้
import type { GameEvent } from "../../engine/events";
import { pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../engine/util";
import { gainExp } from "../hunter/power";
import { team } from "./m19sys";
import { bad, big, climbing, family, floor, good, grounded, meh, refused, retired } from "./m19util";

/** ผู้ท้าชิงที่ผ่านชั้น 20 กลับโลกได้ */
const visiting = (l: Life) => climbing(l) && floor(l) >= 20;
const backHome = (l: Life) => retired(l) || visiting(l);

export const M19_EARTH: GameEvent[] = [
  {
    id: "t19.e.culture_shock",
    minAge: 18,
    maxAge: 80,
    weight: (l) => (backHome(l) ? 6 : 0),
    title: "กลับโลก",
    text: () => "บนโลกไม่มีใครเดินถอยหลัง ไม่มีใครห้ามพูด และไม่มีใครโหวตทิ้งใคร — คุณยืนนิ่งอยู่หน้าประตูเซเว่นนานจนพนักงานถามว่าเป็นอะไรหรือเปล่า",
    choices: [
      { label: "ซื้อของที่คิดถึงมาทั้งตะกร้า", run: (l) => { addMoney(l, -3000); addStat(l, "happiness", 6); return good("ไส้กรอก ขนมจีบ นมเย็น — คุณกินหมดบนม้านั่งหน้าร้าน แล้วร้องไห้โดยไม่รู้ตัว"); } },
      { label: "ก้มหัวขอบคุณพนักงานตามมารยาทหอคอย", run: (l) => { addFame(l, 1); return meh("พนักงานงง แล้วก้มหัวตอบ — คลิปนั้นมีคนถ่ายไว้ ชื่อคลิปว่า 'ผู้ท้าชิงกลับบ้าน'"); } },
    ],
  },
  {
    id: "t19.e.interview",
    minAge: 18,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (backHome(l) && l.fame >= 15 ? 6 : 0),
    title: "รายการทอล์กโชว์",
    text: () => "รายการทอล์กโชว์อันดับหนึ่งของประเทศเชิญคุณไปออก พิธีกรถามคำถามที่ทุกคนอยากรู้ \"ข้างบนนั้น… น่ากลัวแค่ไหนครับ\"",
    choices: [
      { label: "เล่าความจริงทั้งหมด", run: (l) => { addFame(l, 3); addStat(l, "happiness", -2); return meh("ห้องส่งเงียบกริบ เรตติ้งพุ่งสูงสุดในรอบปี — แต่วันรุ่งขึ้นยอดสมัครโรงเรียนกวดวิชาหอคอยลดลงครึ่งหนึ่ง"); } },
      { label: "เล่าแต่เรื่องตลก", check: { stat: "looks", dc: 50 }, skill: ["perform"], run: (l, _c, ok) => { if (ok) { addFame(l, 5); addMoney(l, 400_000); return good("เรื่องห่านของหอคอยทำให้พิธีกรหัวเราะจนตกเก้าอี้ คุณได้รายการของตัวเองหนึ่งซีซัน"); } return meh("มุกแป้กทุกมุก พิธีกรรีบตัดเข้าโฆษณา"); } },
      { label: "ถามพิธีกรกลับว่าบนโลกน่ากลัวแค่ไหน", run: (l) => { addStat(l, "smarts", 1); return meh("พิธีกรอึ้งไปสามวินาที แล้วตอบว่า \"ค่าเช่าบ้านครับ\" — ทั้งห้องส่งหัวเราะ"); } },
    ],
  },
  {
    id: "t19.e.ex_married",
    minAge: 22,
    maxAge: 60,
    weight: (l) => (backHome(l) ? 4 : 0),
    title: "คนที่ไม่รอ",
    text: () => "คนที่คุณเคยคบก่อนขึ้นหอคอยแต่งงานไปแล้ว — คุณเจอเขา/เธอที่ตลาดพร้อมลูกเล็กหนึ่งคน ทั้งคู่ยืนมองกันนานกว่าที่ควร",
    choices: [
      { label: "ทักทายแล้วอวยพร", run: (l) => { addStat(l, "happiness", 2); return good("\"ดีใจที่เธอยังอยู่นะ\" — คำพูดสั้นๆ ที่ปิดเรื่องราวที่ค้างมาหลายปี"); } },
      { label: "เดินหนีไปอีกทาง", run: (l) => { addStat(l, "happiness", -4); return meh("คุณเดินวนตลาดสามรอบจนแน่ใจว่าเขาไปแล้ว — ผู้ท้าชิงชั้น 20 ที่สู้ผู้คุมชั้นมานับไม่ถ้วน แพ้ตลาดสด"); } },
    ],
  },
  {
    id: "t19.e.tax_office",
    minAge: 20,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (backHome(l) && l.money >= 1_000_000 ? 5 : 0),
    title: "สรรพากรกับเหรียญหอคอย",
    text: (l) => `สรรพากรเรียกพบ — เหรียญหอคอยที่คุณแลกเป็นเงินบนโลกเข้าข่าย 'รายได้จากต่างมิติ' ต้องเสียภาษีย้อนหลัง ${money(l, Math.round(l.money * 0.1))}`,
    choices: [
      { label: "จ่ายตามกฎหมาย", run: (l) => { addMoney(l, -Math.round(l.money * 0.1)); addFame(l, 1); return meh("เจ้าหน้าที่ขอลายเซ็นคุณหลังใบเสร็จ \"ลูกผมเป็นแฟนคลับ\""); } },
      { label: "อุทธรณ์ว่าหอคอยไม่ใช่ประเทศ", tone: "danger", run: (l) => { if (l.stats.smarts >= 60) { addFame(l, 3); return good("คดีของคุณกลายเป็นบรรทัดฐาน — ผู้ท้าชิงทั้งประเทศได้ลดหย่อนภาษี และส่งดอกไม้มาขอบคุณ"); } addMoney(l, -Math.round(l.money * 0.15)); return bad("ศาลตัดสินว่า 'หอคอยตั้งอยู่บนแผ่นดินประเทศนี้' — เสียค่าทนายเพิ่มอีกก้อน"); } },
    ],
  },
  {
    id: "t19.e.government",
    minAge: 22,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (backHome(l) && (l.power?.rank ?? 0) >= 4 ? 5 : 0),
    title: "หน่วยงานลับของรัฐ",
    text: () => "ชายในชุดสูทดำมารอที่หน้าบ้าน \"รัฐต้องการผู้ท้าชิงระดับคุณเป็นที่ปรึกษา — มีบางอย่างจากหอคอยเริ่มรั่วลงมาบนโลก\"",
    choices: [
      { label: "รับงาน", run: (l) => { l.flags.t19agent = true; addMoney(l, 2_000_000); gainExp(l, 400); return big("คุณได้เห็นแฟ้มลับ — รากของหอคอยยาวลงไปใต้ดินถึงสามเมือง และมันกำลังเติบโต"); } },
      { label: "ปฏิเสธ — กลับมาเพื่อพักผ่อน", run: (l) => { addStat(l, "happiness", 3); return meh("ชายชุดดำทิ้งนามบัตรไว้ \"ข้อเสนอนี้มีอายุจนถึงวันที่มันไม่มีอายุ\""); } },
    ],
  },
  {
    id: "t19.e.ptsd",
    minAge: 18,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (backHome(l) && Number(l.flags.t19fallen ?? 0) > 0 ? 7 : 0),
    title: "เสียงที่ยังได้ยิน",
    text: () => "เสียงพลุงานวัดทำให้คุณหมอบลงกับพื้นกลางถนน คนรอบข้างหัวเราะก่อนจะเงียบไปเมื่อเห็นแผลเป็นบนแขน",
    choices: [
      { label: "ไปหาจิตแพทย์", run: (l) => { addMoney(l, -30_000); addStat(l, "happiness", 8); return good("หมอเป็นอดีตผู้ท้าชิงชั้น 12 — เขาไม่ต้องให้คุณอธิบายอะไรเลย"); } },
      { label: "เก็บไว้คนเดียว", run: (l) => { addStat(l, "happiness", -6); addStat(l, "health", -2); return bad("คุณนอนไม่หลับไปอีกหลายคืน แต่ไม่บอกใคร"); } },
      { label: "โทรหาเพื่อนร่วมทีม", show: (l) => team(l).length > 0, run: (l) => { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 5, 0, 100); addStat(l, "happiness", 5); return good("เพื่อนร่วมทีมรับสายตั้งแต่ริงแรก \"ได้ยินพลุเหมือนกันใช่ไหม\" — คุณคุยกันจนเช้า"); } },
    ],
  },
  {
    id: "t19.e.family_older",
    minAge: 22,
    maxAge: 80,
    weight: (l) => (visiting(l) && people(l, "mother").length + people(l, "father").length > 0 ? 5 : 0),
    title: "พ่อแม่แก่ลง",
    text: () => "เวลาบนหอคอยกับบนโลกเดินไม่เท่ากัน คุณกลับบ้านครั้งนี้ ผมของพ่อแม่ขาวไปทั้งหัว แม่เดินช้าลงจนคุณต้องหยุดรอ",
    choices: [
      { label: "อยู่บ้านนานขึ้นอีกเดือน", run: (l) => { for (const p of family(l)) p.bond = clamp(p.bond + 10, 0, 100); addStat(l, "happiness", 6); return good("คุณซ่อมหลังคา พาแม่ไปหาหมอ ฟังพ่อเล่าเรื่องเดิมซ้ำสิบรอบ — และไม่เบื่อสักรอบ"); } },
      { label: "ส่งเงินให้จ้างคนดูแล", run: (l) => { addMoney(l, -500_000); for (const p of family(l)) p.bond = clamp(p.bond + 3, 0, 100); return meh("แม่รับเงินไว้ แต่ถามประโยคเดียว \"ปีหน้ากลับมาอีกไหม\""); } },
      { label: "พาพ่อแม่ไปอยู่ชั้นปลอดภัยด้วย", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { if (ok) { for (const p of family(l)) p.bond = clamp(p.bond + 12, 0, 100); return good("หอคอยยอมให้ญาติผู้ท้าชิงชั้น 20 ขึ้นมาอยู่ได้ — แม่เปิดร้านขนมในชั้นปลอดภัยแล้วขายดีกว่าคุณปีน"); } return meh("เอกสารซับซ้อนเกินไป ทั้งคู่ไม่อยากทิ้งบ้านอยู่ดี"); } },
    ],
  },
  {
    id: "t19.e.reunion",
    minAge: 25,
    maxAge: 60,
    maxTimes: 1,
    weight: 4,
    title: "งานเลี้ยงรุ่น",
    text: (l) => (l.power ? "งานเลี้ยงรุ่นมัธยม — ทุกคนรุมถ่ายรูปกับคุณ แต่คนที่คุณอยากคุยด้วยที่สุดนั่งอยู่มุมห้องคนเดียว: เพื่อนที่ปฏิเสธคำเชิญปีเดียวกับคุณ" : "งานเลี้ยงรุ่นมัธยม — เพื่อนที่ขึ้นหอคอยกลับมาเป็นดาวของงาน ทุกคนรุมถ่ายรูป คุณนั่งกินกุ้งอยู่มุมห้อง"),
    choices: [
      { label: "ไปนั่งคุยกับคนที่มุมห้อง", run: (l) => { createPerson(l, "friend", { age: l.age, bond: 60 }); addStat(l, "happiness", 5); return good("คุณสองคนคุยกันเรื่องที่ไม่เกี่ยวกับหอคอยเลยทั้งคืน — เรื่องแมว เรื่องราคาข้าว เรื่องที่ไม่ต้องพิสูจน์อะไร"); } },
      { label: "อยู่กลางวง", run: (l) => { addFame(l, 1); return meh("คุณถ่ายรูปไปสองร้อยรูป จำชื่อคนในรูปได้สิบคน"); } },
    ],
  },
  {
    id: "t19.e.refuser_club",
    minAge: 20,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (refused(l) ? 8 : 0),
    title: "ชมรมผู้ปฏิเสธ",
    text: () => "มีชมรมเล็กๆ ของคนที่ปฏิเสธคำเชิญจากหอคอย นัดเจอกันทุกเดือนที่ร้านกาแฟ กฎข้อเดียวของชมรมคือ 'ห้ามพูดว่าถ้าวันนั้นรับไว้'",
    choices: [
      { label: "เข้าร่วม", run: (l) => { l.flags.t19refuserClub = true; addStat(l, "happiness", 6); createPerson(l, "friend", { age: l.age + randInt(l, -5, 10), bond: 60, job: "สมาชิกชมรมผู้ปฏิเสธ" }); return good("คนในชมรมเป็นครู หมอ คนขายก๋วยเตี๋ยว — ทุกคนมีชีวิตธรรมดาที่ไม่ธรรมดาเลย"); } },
      { label: "ไม่ไป — ไม่อยากนิยามตัวเองด้วยหอคอย", run: (l) => { addStat(l, "smarts", 1); return meh("คุณตัดสินใจเลิกพูดถึงหอคอยโดยสิ้นเชิง ซึ่งเป็นการนิยามตัวเองด้วยหอคอยอีกแบบ"); } },
    ],
  },
  {
    id: "t19.e.refuser_hate",
    minAge: 20,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (refused(l) ? 5 : 0),
    title: "คนขี้ขลาด",
    text: () => "คอมเมนต์ใต้รูปเก่าของคุณที่มีคนขุดขึ้นมา: 'นี่ไงคนที่ได้คำเชิญแล้วปฏิเสธ ขี้ขลาด เสียของ' — ยอดไลก์สามพัน",
    choices: [
      { label: "ตอบกลับยาวๆ", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { addFame(l, 4); return good("คุณเขียนเรื่องสิทธิ์ที่จะเลือกชีวิตตัวเอง — คนแชร์สองแสนครั้ง พร้อมแฮชแท็ก #ไม่ขึ้นก็ได้"); } addStat(l, "happiness", -4); return bad("ทะเลาะกับคนแปลกหน้าทั้งคืน แพ้ทุกรอบ"); } },
      { label: "วางมือถือแล้วไปกินข้าว", run: (l) => { addStat(l, "happiness", 2); return meh("ข้าวผัดอร่อยกว่าคอมเมนต์ทุกอัน"); } },
    ],
  },
  {
    id: "t19.e.industry_job",
    minAge: 22,
    maxAge: 60,
    maxTimes: 1,
    weight: (l) => (grounded(l) && !!l.flags.t19industry ? 12 : grounded(l) ? 3 : 0),
    title: "วิศวกรอุปกรณ์ผู้ท้าชิง",
    text: () => "บริษัทผลิตอุปกรณ์ผู้ท้าชิงรับสมัครวิศวกร — งานแรกคือออกแบบรองเท้าที่เดินถอยหลังได้เร็วเท่าเดินหน้า สำหรับชั้นที่มีกฎ 'เดินถอยหลังเท่านั้น'",
    choices: [
      { label: "สมัคร", check: { stat: "smarts", dc: 55 }, skill: ["study"], run: (l, _c, ok) => { if (ok) { addMoney(l, 600_000); l.flags.t19engineer = true; addStat(l, "happiness", 6); return good("รองเท้าของคุณขายหมดในวันเดียว ผู้ท้าชิงที่ชั้น 23 ส่งจดหมายขอบคุณมาว่ารอดเพราะรองเท้าคู่นี้"); } return meh("ตกสัมภาษณ์รอบสุดท้าย — แต่คุณได้ไอเดียรองเท้าแบบใหม่กลับมา"); } },
      { label: "ไม่สมัคร", run: () => meh("คุณดูโฆษณารองเท้าเดินถอยหลังในทีวีปีต่อมา แล้วคิดว่า 'ฉันก็คิดได้'") },
    ],
  },
  {
    id: "t19.e.caster_fan",
    minAge: 15,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (grounded(l) ? 4 : 0),
    text: () => "ผู้ท้าชิงที่คุณเชียร์มาตลอดผ่านชั้น 60 ได้! ทั้งบาร์ที่คุณนั่งดูถ่ายทอดสดลุกขึ้นกอดกันโดยไม่รู้จักชื่อกัน",
    choices: [
      { label: "ฉลองถึงเช้า", run: (l) => { addStat(l, "happiness", 6); addStat(l, "health", -2); return good("คุณร้องเพลงประจำทีมเขาจนเสียงแหบ — ชีวิตธรรมดาที่มีวันพิเศษแบบนี้ก็ไม่เลว"); } },
      { label: "เขียนจดหมายแฟนคลับไปที่หอคอย", run: (l) => { l.flags.t19fanLetter = true; return meh("สามเดือนต่อมามีจดหมายเรืองแสงตอบกลับมา ลายเซ็นของเขาพร้อมคำว่า 'ขอบคุณที่ดูอยู่'"); } },
    ],
  },
  {
    id: "t19.e.relief_worker",
    minAge: 20,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (grounded(l) ? 3 : 0),
    title: "อาสาสมัครฐานหอคอย",
    text: () => "ทุกเดือนจะมีผู้ท้าชิงบาดเจ็บถูกส่งกลับลงมาที่ฐานหอคอยโดยไม่มีใครรับ — มูลนิธิเล็กๆ รับอาสาสมัครไปช่วยดูแล",
    choices: [
      { label: "ไปช่วยทุกสุดสัปดาห์", skill: ["heal", "medical"], run: (l) => { addStat(l, "happiness", 7); addFame(l, 2); l.flags.t19volunteer = true; return good("ผู้ท้าชิงคนหนึ่งจับมือคุณก่อนหลับ \"เธอคือคนแรกบนโลกที่ไม่ถามว่าข้างบนเป็นยังไง\""); } },
      { label: "บริจาคเงินแทน", run: (l) => { addMoney(l, -20_000); addStat(l, "happiness", 2); return meh("มูลนิธิส่งรูปเตียงใหม่สามเตียงมาให้ดู"); } },
    ],
  },
  {
    id: "t19.e.tower_cult",
    minAge: 18,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (grounded(l) ? 3 : 0),
    title: "ลัทธิบูชาหอคอย",
    text: () => "เพื่อนชวนไปฟัง 'ธรรมะแห่งหอคอย' — ศาสดาบอกว่าคนที่ไม่ได้คำเชิญคือคนที่หอคอย 'เก็บไว้สำหรับวันสุดท้าย' ค่าสมาชิกเดือนละครึ่งเงินเดือน",
    choices: [
      { label: "ลุกออกกลางคัน", run: (l) => { addStat(l, "smarts", 1); return meh("คุณพาเพื่อนออกมาด้วย เพื่อนงอนสามวัน แล้วขอบคุณในวันที่สี่"); } },
      { label: "สมัครเป็นสมาชิก", tone: "danger", run: (l) => { addMoney(l, -Math.round(Math.max(0, l.money) * 0.3)); addStat(l, "happiness", -4); return bad("ศาสดาหนีไปพร้อมเงินกองทุนในเดือนที่สาม — หอคอยไม่ได้เก็บใครไว้ทั้งนั้น"); } },
      { label: "แอบถ่ายคลิปแฉ", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { if (ok) { addFame(l, 5); return good("คลิปของคุณทำให้ตำรวจบุกจับได้ทั้งเครือข่าย"); } return bad("โดนจับได้ถูกโยนออกมาหน้าวัด มือถือแตก"); } },
    ],
  },
  {
    id: "t19.e.climber_returns_dead",
    minAge: 15,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (people(l, "friend").length > 0 ? 3 : 0),
    title: "จดหมายแจ้งการเสียชีวิต",
    prepare: (l) => ({ id: pick(l, people(l, "friend")).id }),
    text: (l, c) => `ซองสีดำของหอคอยมาถึงบ้านของ${shortName(l.people.find((p) => p.id === c.id)!)} — ญาติของเขาที่ขึ้นไปเมื่อหลายปีก่อน ไม่ผ่านชั้น 31 ${shortName(l.people.find((p) => p.id === c.id)!)}โทรหาคุณเป็นคนแรก`,
    choices: [
      { label: "ไปอยู่เป็นเพื่อนทั้งคืน", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 15, 0, 100); return good("คุณไม่ได้พูดอะไรที่ฉลาด แค่นั่งอยู่ตรงนั้น — และนั่นคือสิ่งที่ต้องการ"); } },
      { label: "ช่วยจัดงานศพ", run: (l, c) => { addMoney(l, -10_000); const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 10, 0, 100); return meh("ไม่มีร่าง มีแต่ป้ายชื่อเรืองแสงที่หอคอยส่งมา แต่งานก็เรียบร้อยดี"); } },
    ],
  },
  {
    id: "t19.e.tower_tourism",
    minAge: 18,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (grounded(l) && l.money >= 200_000 ? 4 : 0),
    title: "ทัวร์ชั้นหนึ่ง",
    text: (l) => `บริษัททัวร์เปิดแพ็กเกจ 'เยือนชั้น 1 แบบปลอดภัย' ราคา ${money(l, 200_000)} — หอคอยอนุญาตให้คนที่ไม่ได้รับเชิญขึ้นไปดูลานชั้นแรกได้หนึ่งวัน`,
    choices: [
      { label: "ไป", run: (l) => { addMoney(l, -200_000); addStat(l, "happiness", 6); l.flags.t19visitedTower = true; return good("ลานชั้นหนึ่งกว้างเหมือนท้องฟ้าที่มีพื้น — ผู้ดูแลชั้นมองกลุ่มทัวร์แบบเบื่อๆ แต่พอคุณเดินผ่าน เขาพยักหน้าให้"); } },
      { label: "ไม่ไป", run: () => meh("คุณดูรีวิวทัวร์ในยูทูบแทน คนรีวิวบอกว่าห้องน้ำแพงมาก") },
    ],
  },
  {
    id: "t19.e.child_wants_tower",
    minAge: 30,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (people(l, "child").some((c) => c.age >= 8 && c.age <= 15) ? 6 : 0),
    title: "ลูกอยากขึ้นหอคอย",
    prepare: (l) => ({ id: people(l, "child").find((c) => c.age >= 8 && c.age <= 15)!.id }),
    text: (l, c) => `${shortName(l.people.find((p) => p.id === c.id)!)}เอาเรียงความ 'ถ้าฉันได้รับคำเชิญ' มาให้อ่าน — ${l.power ? "ทุกบรรทัดเขียนว่าอยากเป็นเหมือนพ่อ/แม่" : "ทุกบรรทัดเขียนว่าจะทำสิ่งที่พ่อ/แม่ไม่ได้ทำ"}`,
    choices: [
      { label: "ชมแล้วติดไว้บนตู้เย็น", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 10, 0, 100); return good("เรียงความอยู่บนตู้เย็นไปอีกสิบปี กระดาษเหลืองแต่ไม่มีใครกล้าเอาลง"); } },
      { label: "เล่าความจริงของหอคอยให้ฟัง", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 4, 0, 100); addStat(l, "smarts", 1); return meh("ลูกฟังจนจบแล้วถามว่า 'แต่ถ้าไม่มีใครขึ้นไป ใครจะไปดูว่าบนยอดมีอะไร' — คุณไม่มีคำตอบ"); } },
    ],
  },
  {
    id: "t19.e.stock_climb",
    minAge: 20,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (grounded(l) && l.money >= 300_000 ? 3 : 0),
    title: "กองทุนผู้ท้าชิง",
    text: () => "ธนาคารเปิด 'กองทุนผู้ท้าชิง' ให้คนทั่วไปลงทุนในทีมปีนหอคอย ได้ปันผลเมื่อทีมผ่านชั้น และขาดทุนเมื่อทีมตาย — โฆษณาเขียนว่า 'ปีนไปพร้อมพวกเขา'",
    choices: [
      { label: "ลงทุนในทีมดัง", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => { const s = Math.round(Math.max(0, l.money) * 0.2); if (ok) { addMoney(l, Math.round(s * 0.6)); return good("ทีมผ่านชั้น 55 ปันผลมาก้อนใหญ่"); } addMoney(l, -s); return bad("ทีมตายยกทีมที่ชั้น 52 — กองทุนแจ้งว่า 'ขอแสดงความเสียใจและหักค่าธรรมเนียม'"); } },
      { label: "ไม่ลงทุนกับชีวิตคน", run: (l) => { addStat(l, "happiness", 1); return meh("คุณเอาเงินไปฝากประจำ ดอกเบี้ยน้อยแต่ไม่มีใครตาย"); } },
    ],
  },
  {
    id: "t19.e.memorial_day",
    minAge: 10,
    maxAge: 95,
    maxTimes: 2,
    weight: 3,
    text: () => "วันรำลึกผู้ท้าชิงประจำปี ทั้งประเทศหยุดนิ่งหนึ่งนาทีตอนบ่ายสามโมง — เวลาที่เงาหอคอยพาดผ่านเมือง ทุกคนมองขึ้นไปพร้อมกัน",
    auto: (l) => { addStat(l, "happiness", 1); return "normal"; },
  },
  {
    id: "t19.e.second_family",
    minAge: 25,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (retired(l) && !people(l, "spouse").length ? 4 : 0),
    title: "ชีวิตหลังหอคอย",
    prepare: (l) => ({ g: l.gender === "m" ? "f" : "m" }),
    text: () => "คุณเปิดร้านเล็กๆ ใกล้ฐานหอคอย ลูกค้าประจำคนหนึ่งมาทุกวัน สั่งเมนูเดิม นั่งที่เดิม วันนี้เขา/เธอทิ้งโน้ตไว้ใต้แก้ว 'ร้านนี้ทำให้รู้สึกเหมือนกลับบ้าน'",
    choices: [
      { label: "เขียนโน้ตตอบ", check: { stat: "looks", dc: 45 }, run: (l, c, ok) => { if (ok) { createPerson(l, "partner", { gender: c.g as "m" | "f", age: l.age + randInt(l, -4, 4), bond: 60 }); addStat(l, "happiness", 8); return good("โน้ตกลายเป็นจดหมาย จดหมายกลายเป็นนัด — ชีวิตหลังหอคอยเริ่มมีชั้นใหม่ให้ปีน"); } return meh("วันต่อมาลูกค้าคนนั้นไม่มา แต่วันถัดไปก็กลับมานั่งที่เดิม"); } },
      { label: "แถมขนมให้แทนคำตอบ", run: (l) => { addStat(l, "happiness", 3); return meh("ลูกค้าคนนั้นยิ้ม — บางเรื่องไม่ต้องรีบ"); } },
    ],
  },
];
