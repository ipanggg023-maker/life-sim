// M16 — ชีวิต Hunter: งานหน้า Gate สมาคม สื่อ คู่แข่ง และเรื่องเล็กๆ ที่มังฮวาไม่ค่อยเล่า
import type { Ctx, GameEvent } from "../../../engine/events";
import { chance, pick } from "../../../engine/rng";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../../engine/util";
import { addCores, addRep, myGuild, tierOf, CORE_TIERS } from "../m16";
import { GATE_PAY, RETAINER, fightOdds, gainExp, gateRewards, luckyRankUp, rankName, survivalOdds } from "../power";
import { bad, big, good, hurt, isHunter, lost, meh, rank, w } from "./m16kit";

const GR = (c: Ctx) => Number(c.gr);

export const HUNTER16_EVENTS: GameEvent[] = [
  {
    id: "h16.h_license_photo",
    minAge: 18,
    maxAge: 30,
    weight: (l) => w(isHunter(l), 6),
    text: () => "รูปบนใบอนุญาต Hunter ของคุณถ่ายตอนตาปิดครึ่งหนึ่ง และต้องใช้ไปอีกห้าปี ทุกครั้งที่ยื่นบัตรเข้า Gate เจ้าหน้าที่ต้องกลั้นหัวเราะ",
    choices: [
      { label: "จ่ายค่าธรรมเนียมทำบัตรใหม่", run: (l) => { addMoney(l, -1_500); return meh("รูปใหม่ตาเปิดครบสองข้าง แต่ทรงผมคุณวันนั้นแย่กว่าเดิม"); } },
      { label: "ภูมิใจกับมัน", run: (l) => { addStat(l, "happiness", 4); addFame(l, 1); return good("มีคนแคปรูปบัตรคุณไปทำมีม \"Hunter ตอนรู้ว่าต้องเข้า Gate วันจันทร์\" ยอดแชร์ทะลุล้าน"); } },
    ],
  },
  {
    id: "h16.h_raid_leader_bad",
    minAge: 18,
    maxAge: 50,
    weight: (l) => w(isHunter(l) && !myGuild(l), 6),
    prepare: (l) => ({ gr: clamp(rank(l), 0, 8) }),
    text: (_l, c) => `หัวหน้าทีมชั่วคราวของ Gate แรงก์ ${rankName(GR(c))} สั่งให้ทุกคนเดินเข้าทางแคบที่มีรอยกรงเล็บสดๆ บนผนัง "ฉันมีประสบการณ์ ฉันรู้"`,
    choices: [
      { label: "ทักท้วงต่อหน้าทุกคน", check: { stat: "smarts", dc: 55 }, skill: ["social"], run: (l, _c, ok) => (ok ? (addFame(l, 3), gainExp(l, 100), good("คุณชี้ให้ดูรอยกรงเล็บและทางลมที่ผิดปกติ ทีมเปลี่ยนเส้นทาง และเจอรังมอนสเตอร์ตรงที่หัวหน้าจะพาเดินเข้าไปพอดี")) : (addStat(l, "happiness", -3), meh("หัวหน้าไม่ฟัง ทีมเดินเข้าไป และคุณต้องลากเขาออกมาเองตอนเขาเจ็บ"))) },
      { label: "ตามไป แต่ระวังหลังให้ทุกคน", tone: "danger", odds: (l, c) => fightOdds(l, GR(c), 0.05), survival: (l, c) => survivalOdds(l, GR(c), 0.15), run: (l, c, ok) => (ok ? (gateRewards(l, GR(c), 0.8, true), addFame(l, 2), good("ซุ่มโจมตีมาจริงตามที่คิด คุณหันกลับไปสู้ก่อนใคร ทีมรอดครบทุกคน หัวหน้าเงียบไปตลอดทางกลับ")) : lost(l, GR(c), "ถูกซุ่มโจมตีใน Gate เพราะหัวหน้าทีมพาเดินผิดทาง", "มอนสเตอร์โผล่จากผนังทั้งสองข้าง")) },
      { label: "ขอแยกตัวออกจากทีม", run: (l) => { addFame(l, -1); return meh("คุณเคลียร์ทางเลี่ยงคนเดียว ได้คอร์น้อยกว่าคนอื่น แต่กลับบ้านได้ครบสามสิบสองซี่"); } },
    ],
  },
  {
    id: "h16.h_cameraman",
    minAge: 18,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && l.fame >= 15, 5),
    text: () => "ช่องยูทูบสาย Gate ขอส่งตากล้องตามคุณเข้า Gate หนึ่งรอบ ตากล้องแรงก์ F ถือไม้เซลฟี่และกลัวทุกอย่าง",
    choices: [
      { label: "พาเข้าไปและปกป้องเขา", run: (l) => { addFame(l, 6); addMoney(l, 400_000); addStat(l, "health", -2); return good("ไฮไลต์ของคลิปคือคุณรับกรงเล็บแทนตากล้องแล้วพูดว่า \"ถ่ายต่อไป\" ยอดวิวยี่สิบล้าน"); } },
      { label: "ปฏิเสธ Gate ไม่ใช่กองถ่าย", run: (l) => { addFame(l, 1); return meh("ช่องไปถ่ายกับ Hunter คนอื่น ตากล้องเป็นลมในห้องบอส"); } },
    ],
  },
  {
    id: "h16.h_mana_sickness",
    minAge: 20,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && (l.power?.gates ?? 0) >= 5, 5),
    text: () => "หลังเข้า Gate ติดต่อกันหลายครั้ง คุณเริ่มเห็นแสงสีฟ้ากะพริบตอนหลับตา หมอสมาคมวินิจฉัยว่า \"ภาวะมานาสะสมเกิน\" สั่งพักสามเดือน",
    choices: [
      { label: "พักตามหมอสั่ง", run: (l) => { addStat(l, "health", 6); addStat(l, "happiness", 4); l.doneThisYear.push("gate", "gate"); return good("คุณนอนตื่นสาย ทำอาหาร และเลี้ยงต้นไม้ ต้นไม้เรืองแสงเล็กน้อยตอนกลางคืน (คงจากคุณ)"); } },
      { label: "ไม่สน ลุยต่อ", run: (l) => { gainExp(l, 120); return bad("พลังเติบโตขึ้น แต่คุณเลือดกำเดาไหลทุกเช้า" + hurt(l, 4, 10, "ภาวะมานาสะสมเกินขนาด")); } },
    ],
  },
  {
    id: "h16.h_rank_reexam",
    minAge: 20,
    maxAge: 50,
    weight: (l) => w(isHunter(l) && rank(l) >= 1 && rank(l) <= 5, 4),
    text: (l) => `สมาคมเรียกตรวจแรงก์ซ้ำประจำห้าปี คุณยังขึ้น ${rankName(rank(l))} เท่าเดิม แต่เครื่องวัดสั่นแปลกๆ ตอนคุณวางมือ เจ้าหน้าที่ขอให้ "ลองอีกครั้งแบบตั้งใจ"`,
    choices: [
      { label: "ปล่อยพลังสุดตัว", check: { stat: "health", dc: 55 }, skill: ["combat"], run: (l, _c, ok) => { if (ok && chance(l, 0.45)) { luckyRankUp(l, "เครื่องวัดแรงก์ระเบิดเป็นเสี่ยงๆ"); return big("ทั้งห้องตรวจเงียบ เจ้าหน้าที่ยกโทรศัพท์โทรหาผู้อำนวยการ"); } gainExp(l, 150); return meh("เครื่องวัดสั่นแรงขึ้น แล้วหยุด ตัวเลขเดิม แต่เจ้าหน้าที่จดบางอย่างลงในแฟ้มสีแดง"); } },
      { label: "ซ่อนพลังไว้", run: (l) => { l.flags.hiddenStrength = true; return meh("คุณวางมือเบาๆ เหมือนจับแก้วน้ำ ตัวเลขเท่าเดิม ไม่มีใครต้องรู้"); } },
    ],
  },
  {
    id: "h16.h_monster_pet",
    minAge: 18,
    maxAge: 70,
    weight: (l) => w(isHunter(l), 4),
    text: () => "ในห้องบอสที่เคลียร์แล้ว มีลูกมอนสเตอร์ตัวเท่าแมวซ่อนอยู่ใต้ซาก มันมองคุณด้วยตาโตๆ แล้วร้อง \"กี๊\"",
    choices: [
      { label: "แอบเอากลับบ้าน", check: { stat: "luck", dc: 55 }, skill: ["stealth"], run: (l, _c, ok) => (ok ? (l.flags.monsterPet = true, addStat(l, "happiness", 10), good("คุณตั้งชื่อมันว่า \"บอสน้อย\" มันกินหมูกระทะได้ทีละสามกิโลและนอนบนหัวคุณทุกคืน สมาคมไม่รู้ (ยัง)")) : (addMoney(l, -500_000), addFame(l, -3), bad("เครื่องสแกนที่ประตู Gate ร้องลั่น คุณโดนปรับและบอสน้อยถูกส่งไปศูนย์วิจัย มันร้องกี๊ตามหลังคุณ"))) },
      { label: "ส่งให้ศูนย์วิจัย", run: (l) => { addFame(l, 2); return meh("นักวิจัยตั้งชื่อมันตามชื่อคุณ ทุกปีศูนย์ส่งรูปมันมาให้ ตอนนี้มันตัวเท่ารถตู้แล้ว"); } },
      { label: "ปล่อยไว้ในนั้น", run: (l) => { addStat(l, "happiness", -4); return meh("Gate ปิดลงข้างหลังคุณ พร้อมเสียงกี๊สุดท้าย"); } },
    ],
  },
  {
    id: "h16.h_cursed_item",
    minAge: 18,
    maxAge: 70,
    weight: (l) => w(isHunter(l), 4),
    text: () => "หีบในห้องลับมีแหวนสีดำวงหนึ่ง หน้าต่างระบบเด้งขึ้น: [ไอเทมต้องสาป — พลังโจมตีเพิ่มขึ้นอย่างมาก / ทุกคืนจะได้ยินเสียงร้องไห้]",
    choices: [
      { label: "สวม", run: (l) => { l.power?.items.push("แหวนแห่งเสียงร่ำไห้"); addStat(l, "happiness", -10); return { text: "พลังไหลบ่าเข้ามา และคืนนั้นคุณได้ยินเสียงผู้หญิงร้องไห้ข้างหูจนรุ่งเช้า", kind: "system" }; } },
      { label: "เอาไปขายให้นักสะสมของต้องสาป", run: (l) => { addMoney(l, RETAINER[clamp(rank(l), 0, 8)]); return good("นักสะสมเป็นคุณยายใจดีที่มีของต้องสาปสามร้อยชิ้น เธอบอกว่า \"เด็กคนนี้แค่เหงา\" แล้วร้องเพลงกล่อมแหวน"); } },
      { label: "ทิ้งไว้ในหีบ", run: () => meh("คุณปิดฝาหีบ เสียงร้องไห้เบาๆ ดังลอดออกมาจนคุณเดินพ้นห้อง") },
    ],
  },
  {
    id: "h16.h_fake_hunter",
    minAge: 20,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && l.fame >= 20, 5),
    text: () => "มีคนแอบอ้างเป็นคุณ เปิดคอร์สออนไลน์ \"ปลุกพลังแบบฉบับ Hunter ชื่อดัง\" ราคา 9,999 บาท นักเรียนสามพันคน",
    choices: [
      { label: "ไปเข้าคอร์สนั้นด้วยตัวเอง", run: (l) => { addFame(l, 5); addStat(l, "happiness", 6); return good("คุณเปิดกล้องตอนเขาไลฟ์ \"สวัสดีครับ ผมเอง\" ไลฟ์ตัดไปในสามวินาที คลิปหน้าเขาตอนนั้นกลายเป็นสติกเกอร์ยอดนิยมแห่งปี"); } },
      { label: "แจ้งความ และคืนเงินให้นักเรียนด้วยตัวเอง", run: (l) => { addMoney(l, -2_000_000); addFame(l, 8); return good("เงินที่คุณจ่ายไม่ได้คืนสักบาท แต่คนสามพันคนจำได้ว่าคุณไม่ต้องทำก็ได้"); } },
    ],
  },
  {
    id: "h16.h_heal_queue",
    minAge: 18,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && l.power?.hunterClass === "healer", 7),
    text: () => "ห้องฉุกเฉินหลัง Gate แรงก์ B มีคนเจ็บยี่สิบคน มานาของคุณพอรักษาได้ครบแค่สิบคน หมอถามว่าจะเริ่มจากใคร",
    choices: [
      { label: "รักษาคนอาการหนักที่สุดก่อน", check: { stat: "smarts", dc: 50 }, skill: ["heal", "medical"], run: (l, _c, ok) => (ok ? (addFame(l, 6), gainExp(l, 150), good("คุณจัดลำดับได้แม่นยำราวกับหมอสนาม ไม่มีใครเสียชีวิตคืนนั้น คุณหมดสติไปตอนตีสี่")) : (addStat(l, "happiness", -8), bad("คุณเลือกผิดหนึ่งคน… ชื่อของเขาจะอยู่ในใจคุณตลอดไป"))) },
      { label: "ดึงมานาเกินขีดจำกัด", tone: "danger", odds: () => 0.6, survival: () => 0.95, skill: ["heal"], run: (l, _c, ok) => (ok ? (addFame(l, 10), gainExp(l, 300), big("คุณรักษาครบยี่สิบคน แล้วล้มลงกลางห้อง หมอเรียกมันว่าปาฏิหาริย์ คุณเรียกมันว่าวันที่ปวดหัวที่สุดในชีวิต")) : bad("มานาย้อนกลับเข้าตัว เส้นเลือดฝอยในตาแตกทั้งสองข้าง" + hurt(l, 15, 30, "ดึงมานาเกินขีดจำกัดจนร่างกายพัง"))) },
    ],
  },
  {
    id: "h16.h_assassin_contract",
    minAge: 20,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && l.power?.hunterClass === "assassin", 6),
    text: () => "ซองไม่ระบุชื่อถูกสอดใต้ประตู ข้างในเป็นรูป Hunter แรงก์ A คนหนึ่ง และเช็คเงินสดที่ยังไม่ได้กรอกจำนวน \"คุณเป็นสายลอบสังหาร คุณคงเข้าใจ\"",
    choices: [
      { label: "เผาซองทิ้ง", run: (l) => { addStat(l, "happiness", 2); return meh("คุณดูกระดาษไหม้จนหมด แล้วรู้สึกว่ามีคนกำลังดูคุณอยู่"); } },
      { label: "ไปเตือน Hunter คนนั้น", check: { stat: "luck", dc: 50 }, skill: ["stealth", "social"], run: (l, _c, ok) => (ok ? (createPerson(l, "friend", { age: l.age + 5, bond: 70, job: "Hunter แรงก์ A" }), addFame(l, 3), good("เขาเชื่อคุณ และจับนักฆ่าคนที่สองได้คาบ้าน ตอนนี้เขาเป็นหนี้ชีวิตคุณหนึ่งครั้ง")) : (addStat(l, "happiness", -4), meh("เขาไม่เชื่อ และคิดว่าคุณคือคนที่ถูกจ้าง"))) },
    ],
  },
  {
    id: "h16.h_tank_hug",
    minAge: 18,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && l.power?.hunterClass === "tank", 6),
    text: () => "หลังรับบอสแทนทีมมาทั้งคืน ร่างกายคุณเต็มไปด้วยรอยช้ำ เด็กใหม่ในทีมถามว่า \"พี่ไม่กลัวตายเหรอครับ ยืนรับอยู่ข้างหน้าตลอด\"",
    choices: [
      { label: "\"กลัวสิ ถึงได้ยืนข้างหน้า\"", run: (l) => { addStat(l, "happiness", 6); addFame(l, 1); return good("เด็กคนนั้นจำประโยคนี้ไปเล่าในสัมภาษณ์ตอนเขาเป็นแรงก์ A ยี่สิบปีต่อมา"); } },
      { label: "แกล้งทำเป็นเท่ ยักไหล่", run: (l) => { addStat(l, "happiness", 2); return meh("แล้วคุณก็ร้องโอยตอนลุกจากเก้าอี้ เด็กพยายามไม่หัวเราะ"); } },
    ],
  },
  {
    id: "h16.h_summoner_shadow",
    minAge: 18,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && l.power?.hunterClass === "summoner", 6),
    text: () => "ทหารเงาตัวหนึ่งของคุณเริ่มทำตัวแปลก มันยืนเฝ้าหน้าห้องนอนทุกคืน และเมื่อวานมันทำอาหารเช้าไว้ให้ ไข่ไหม้ แต่ตั้งใจ",
    choices: [
      { label: "ตั้งชื่อให้มัน", run: (l) => { addStat(l, "happiness", 8); l.flags.namedShadow = true; return good("ทันทีที่ได้ชื่อ มันโค้งคำนับ และแสงในตาสีม่วงกลายเป็นสีทองจางๆ ทหารเงาตัวอื่นเริ่มรอคิวทำอาหารเช้า"); } },
      { label: "ปลดมันกลับเข้าเงา", run: (l) => { addStat(l, "happiness", -3); return meh("มันลังเลอยู่ครึ่งวินาทีก่อนจะสลายไป ครึ่งวินาทีที่คุณจำได้"); } },
    ],
  },
  {
    id: "h16.h_mage_library",
    minAge: 18,
    maxAge: 80,
    weight: (l) => w(isHunter(l) && l.power?.hunterClass === "mage", 6),
    text: () => "หอสมุดเวทแห่งชาติเปิดห้องหนังสือต้องห้ามให้นักเวทแรงก์สูงเข้าได้หนึ่งชั่วโมงต่อปี บรรณารักษ์เป็นโครงกระดูกที่พูดได้",
    choices: [
      { label: "อ่านตำราเวทโบราณ", check: { stat: "smarts", dc: 55 }, skill: ["study"], run: (l, _c, ok) => (ok ? (gainExp(l, 400), addStat(l, "smarts", 2), good("คุณเข้าใจวงเวทที่ไม่มีใครแปลออกมาสองร้อยปี บรรณารักษ์โครงกระดูกปรบมือ (เสียงแป๊กๆ)")) : (gainExp(l, 80), meh("ตัวอักษรเลื้อยหนีสายตาคุณ หนึ่งชั่วโมงหมดไปกับการอ่านคำนำ"))) },
      { label: "คุยกับบรรณารักษ์", run: (l) => { addStat(l, "happiness", 5); gainExp(l, 120); return good("เขาเคยเป็นนักเวทแรงก์ SS ที่ตายในห้องนี้เพราะอ่านเพลิน คำแนะนำของเขา: \"อย่าลืมกินข้าว\""); } },
    ],
  },
  {
    id: "h16.h_sword_dojo",
    minAge: 18,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && l.power?.hunterClass === "sword", 6),
    text: () => "ปรมาจารย์ดาบตาบอดในสำนักเล็กๆ ย่านฝั่งธนฯ ไม่ได้ตื่นพลัง แต่ปัดดาบมานาของคุณตกได้ด้วยไม้ไผ่ \"เจ้าฟันด้วยพลัง ไม่ได้ฟันด้วยดาบ\"",
    choices: [
      { label: "ขอเป็นศิษย์", run: (l) => { gainExp(l, 300); addStat(l, "health", 3); addMoney(l, -100_000); return good("หนึ่งปีกับการกวาดลานและฟันไม้ไผ่วันละพันครั้ง วันหนึ่งคุณฟันใบไม้ที่ร่วงลงมาขาดครึ่งโดยไม่ได้ใช้มานาเลย"); } },
      { label: "ไม่เชื่อ ท้าประลองจริงจัง", check: { stat: "health", dc: 65 }, skill: ["combat"], run: (l, _c, ok) => (ok ? (addFame(l, 1), meh("คุณชนะ ปรมาจารย์ยิ้ม \"ก็ใช่ เจ้าเก่ง แต่เจ้ายังไม่เข้าใจ\" คำนั้นค้างในใจคุณนานกว่าชัยชนะ")) : (gainExp(l, 200), good("คุณแพ้ให้ไม้ไผ่ แล้วกลับมาสำนักนี้ทุกเสาร์อาทิตย์"))) },
    ],
  },
  {
    id: "h16.h_double_gate",
    minAge: 20,
    maxAge: 60,
    weight: (l) => w(isHunter(l), 3),
    title: "Gate ซ้อน",
    prepare: (l) => ({ gr: clamp(rank(l) + 1, 0, 8) }),
    text: (_l, c) => `หลังล้มบอส ห้องบอสไม่เปิดทางออก แต่เปิดประตูที่สองที่ไม่มีใครเคยเห็น — "Gate ซ้อน" แรงก์ ${rankName(GR(c))} ระบบนับถอยหลังเวลาก่อนประตูแรกจะปิด`,
    choices: [
      {
        label: "ลุยประตูที่สอง",
        tone: "danger",
        odds: (l, c) => fightOdds(l, GR(c)),
        survival: (l, c) => survivalOdds(l, GR(c), 0.05),
        run: (l, c, ok) => {
          if (ok) { const r = gateRewards(l, GR(c), 1.5, true); addCores(l, tierOf(GR(c)), 2); l.flags.doubleGate = true; if (chance(l, 0.35)) luckyRankUp(l, "[ระบบ] ผู้พิชิต Gate ซ้อนคนแรก"); return big(`คุณออกมาจาก Gate ซ้อนเป็นคนแรกในประเทศ! ${r} · ได้${CORE_TIERS[tierOf(GR(c))].name} 2 ก้อน`); }
          return lost(l, GR(c), "ติดอยู่ใน Gate ซ้อน", "มอนสเตอร์ในประตูที่สองไม่ใช่ระดับที่ระบบบอก", 15, 30);
        },
      },
      { label: "วิ่งออกทางประตูแรกก่อนปิด", run: (l) => { gainExp(l, 100); return meh("คุณพุ่งออกมาตอนประตูเหลือช่องแค่ไหล่ ทีมสำรวจพบภายหลังว่าประตูที่สองนำไปสู่ Gate แรงก์ที่สูงกว่านั้นอีก"); } },
    ],
  },
  {
    id: "h16.h_rescue_mission",
    minAge: 20,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && rank(l) >= 2, 4),
    prepare: (l) => ({ gr: clamp(rank(l), 0, 8), n: pick(l, ["นักศึกษาฝึกงาน 4 คน", "ทีมสารคดี", "Hunter แรงก์ E 6 คน"]) }),
    text: (_l, c) => `สมาคมขอด่วน: ${c.n}ติดอยู่ใน Gate แรงก์ ${rankName(GR(c))} ที่ประตูกำลังจะกลายเป็นสีแดง เหลือเวลาประมาณหนึ่งชั่วโมง ค่าตอบแทนคือ "คำขอบคุณจากชาติ"`,
    choices: [
      {
        label: "เข้าไปช่วย",
        tone: "danger",
        odds: (l, c) => fightOdds(l, GR(c), 0.05),
        survival: (l, c) => survivalOdds(l, GR(c), 0.1),
        run: (l, c, ok) => {
          if (ok) { addFame(l, 10); addRep(l, 8); gainExp(l, 250); l.flags.savedHunter = Number(l.flags.savedHunter ?? 0) + 4; return big(`คุณพา${c.n}ออกมาครบ ประตูแดงตามหลังคุณไปสามวินาที ข่าวเรียกมันว่า "สามวินาทีที่ประเทศกลั้นหายใจ"`); }
          return lost(l, GR(c), "เสียชีวิตขณะช่วยผู้ติดค้างใน Gate", "คุณพาออกมาได้ครึ่งหนึ่ง และต้องกลับเข้าไปอีกรอบ");
        },
      },
      { label: "ปฏิเสธ เกินกำลัง", run: (l) => { addFame(l, -2); return meh("ทีมอื่นเข้าไปแทน รอดออกมาได้ไม่ครบ คุณไม่ได้ผิด แต่คุณก็นอนไม่หลับ"); } },
    ],
  },
  {
    id: "h16.h_rival_rookie",
    minAge: 25,
    maxAge: 55,
    weight: (l) => w(isHunter(l) && rank(l) >= 3, 4),
    text: (l) => `Hunter หน้าใหม่ที่สื่อตั้งฉายาว่า "ผู้สืบทอดของคุณ" ไลฟ์ท้าดวลเพื่อพิสูจน์ว่าแรงก์ ${rankName(rank(l))} อย่างคุณ "หมดยุคแล้ว"`,
    choices: [
      { label: "รับคำท้า", tone: "danger", odds: (l) => fightOdds(l, rank(l) - 1), survival: (l) => survivalOdds(l, rank(l) - 1, 0.25), run: (l, _c, ok) => (ok ? (addFame(l, 6), addStat(l, "happiness", 6), good("คุณชนะโดยไม่ชักอาวุธ แล้วยื่นมือดึงเขาลุก \"ฝีมือดี อีกสิบปีมาใหม่\" เขาร้องไห้ต่อหน้ากล้อง แล้วขอเป็นศิษย์")) : (addFame(l, -6), lost(l, rank(l) - 1, "ตายในการดวลไลฟ์สด", "คุณแพ้ต่อหน้าคนดูห้าล้าน", 6, 14))) },
      { label: "ส่งข้อความส่วนตัวชวนกินข้าว", run: (l) => { addStat(l, "happiness", 4); createPerson(l, "friend", { age: Math.max(18, l.age - 8), bond: 55, job: "Hunter หน้าใหม่" }); return good("เขาเป็นเด็กที่กดดันจากสื่อจนนอนไม่หลับ คุณเลี้ยงข้าวขาหมูและเล่าเรื่องตอนตัวเองโดนสื่อขยี้ เขาลบไลฟ์นั้นในคืนเดียวกัน"); } },
    ],
  },
  {
    id: "h16.h_overseas_call",
    minAge: 22,
    maxAge: 55,
    weight: (l) => w(isHunter(l) && rank(l) >= 5, 4),
    prepare: (l) => ({ where: pick(l, ["แอฟริกาใต้", "ชิลี", "มองโกเลีย", "นอร์เวย์"]), pay: GATE_PAY[clamp(rank(l), 0, 8)] * 2 }),
    text: (l, c) => `รัฐบาล${c.where}ขอความช่วยเหลือ: Gate แรงก์สูงแตกในเมืองหลวง ไม่มี Hunter ระดับนั้นในประเทศ ค่าตอบแทน ${money(l, Number(c.pay))} และสัญชาติกิตติมศักดิ์`,
    choices: [
      {
        label: "บินไปทันที",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l)),
        survival: (l) => survivalOdds(l, rank(l), 0.1),
        run: (l, c, ok) => {
          if (ok) { addMoney(l, Number(c.pay)); addFame(l, 12); addCores(l, tierOf(rank(l)), 2); return big(`ทั้งเมืองหลวงของ${c.where}ยืนปรบมือตอนคุณเดินออกมาจากซากตึก ภาพของคุณขึ้นแสตมป์ประจำปีของประเทศนั้น`); }
          return lost(l, rank(l), `เสียชีวิตขณะช่วย Gate Break ที่${c.where}`, "คุณสู้จนกองกำลังนานาชาติมาถึง แต่ไม่ได้เดินออกมาเอง");
        },
      },
      { label: "ส่งลูกศิษย์ไปแทน", run: (l) => { addFame(l, -2); return meh("ลูกศิษย์รอดกลับมา บอกว่าที่นั่นมีคนถือป้ายชื่อคุณรอที่สนามบิน"); } },
    ],
  },
  {
    id: "h16.h_ad_awkward",
    minAge: 20,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && l.fame >= 25, 4),
    text: () => "บริษัทผ้าอ้อมผู้ใหญ่อยากให้คุณเป็นพรีเซนเตอร์ สโลแกน \"มั่นใจทุกห้องบอส\" ค่าตัวสูงกว่าโฆษณาครั้งก่อนห้าเท่า",
    choices: [
      { label: "รับ งานสุจริต", run: (l) => { addMoney(l, (rank(l) + 1) * 1_500_000); addFame(l, -2); addStat(l, "happiness", 3); return meh("ทั้งประเทศจำโฆษณานี้ได้ ทุกครั้งที่คุณเข้า Gate ทีมจะพูดสโลแกนนี้พร้อมกัน"); } },
      { label: "ปฏิเสธอย่างสุภาพ", run: () => meh("Hunter คู่แข่งรับงานไปแทน และขายดีจนติดฉายา") },
    ],
  },
  {
    id: "h16.h_mentor_death",
    minAge: 30,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && people(l, "friend").some((p) => p.job?.includes("Hunter")), 3),
    prepare: (l) => ({ n: shortName(people(l, "friend").find((p) => p.job?.includes("Hunter"))!) }),
    text: (_l, c) => `ข่าวด่วนบอกว่า${c.n}เพื่อน Hunter ที่สอนคุณหลายอย่าง ไม่ได้กลับออกมาจาก Gate แรงก์สูง ดาบของเขาถูกส่งมาที่บ้านคุณพร้อมโน้ต "ฝากด้วย"`,
    choices: [
      { label: "ใช้ดาบของเขาต่อ", run: (l, c) => { const p = l.people.find((x) => shortName(x) === c.n); if (p) p.alive = false; l.power?.items.push(`ดาบของ${c.n}`); addStat(l, "happiness", -10); return meh("ดาบหนักกว่าที่คิด หนักเท่าที่เขาแบกมาทั้งชีวิต"); } },
      { label: "ไปเคลียร์ Gate นั้นให้ได้", tone: "danger", odds: (l) => fightOdds(l, rank(l) + 1), survival: (l) => survivalOdds(l, rank(l) + 1, 0.1), run: (l, c, ok) => { const p = l.people.find((x) => shortName(x) === c.n); if (p) p.alive = false; if (ok) { gateRewards(l, rank(l) + 1, 1, true); addFame(l, 8); return big(`คุณล้มบอสที่ฆ่า${c.n}ได้ และพาร่างของเขากลับบ้าน`); } return lost(l, rank(l) + 1, `ตายใน Gate เดียวกับ${c.n}`, "บอสตัวนั้นยังแข็งแกร่งเกินไป"); } },
    ],
  },
  {
    id: "h16.h_core_gift",
    minAge: 20,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && people(l, "spouse").length > 0, 4),
    prepare: (l) => ({ n: shortName(people(l, "spouse")[0]) }),
    text: (_l, c) => `วันครบรอบแต่งงาน คุณเพิ่งได้คอร์สีครามที่สวยที่สุดเท่าที่เคยเห็นมาจาก Gate ล่าสุด ${c.n}ชอบของที่เรืองแสงมาตลอด`,
    choices: [
      { label: "ให้ช่างทำเป็นจี้สร้อยคอ", run: (l, c) => { const s = l.people.find((x) => shortName(x) === c.n); if (s) s.bond = Math.min(100, s.bond + 15); addMoney(l, -50_000); addStat(l, "happiness", 8); return good(`${c.n}ใส่มันทุกวัน และบอกว่ามันอุ่นตอนคุณอยู่ใน Gate — เหมือนส่งข่าวว่ายังปลอดภัย`); } },
      { label: "ขายแล้วพาไปเที่ยวญี่ปุ่น", run: (l) => { addMoney(l, -100_000); addStat(l, "happiness", 6); return good("ทริปที่ไม่มีโทรศัพท์จากสมาคมเลยสักสาย"); } },
    ],
  },
  {
    id: "h16.h_insurance_reject",
    minAge: 20,
    maxAge: 60,
    weight: (l) => w(isHunter(l), 3),
    text: () => "บริษัทประกันชีวิตปฏิเสธใบสมัครของคุณ \"อาชีพ Hunter อยู่ในกลุ่มเสี่ยงสูงสุด เทียบเท่านักบินอวกาศและคนเลี้ยงจระเข้\"",
    choices: [
      { label: "ซื้อประกันเฉพาะทางของสมาคม", run: (l) => { addMoney(l, -RETAINER[clamp(rank(l), 0, 8)] * 0.1); return meh("เบี้ยแพงมาก แต่ถ้าคุณตาย ครอบครัวจะได้เงินมากพอจะไม่ต้องลำบาก — ความคิดที่ทั้งอุ่นใจและหดหู่"); } },
      { label: "เก็บเงินเองดีกว่า", run: (l) => { addStat(l, "smarts", 1); return meh("คุณเปิดบัญชีออมทรัพย์ชื่อ \"ถ้าไม่ได้กลับบ้าน\" และหวังว่าจะไม่มีใครต้องเปิดดู"); } },
    ],
  },
  {
    id: "h16.h_gate_cafe",
    minAge: 30,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && l.money >= 5_000_000, 3),
    text: () => "คุณเจอห้องแถวว่างหน้าทางเข้า Gate ถาวรของเมือง ที่ตรงนั้น Hunter ทุกคนต้องเดินผ่านทุกวัน แต่ไม่มีร้านกาแฟสักร้าน",
    choices: [
      { label: "เปิดร้านกาแฟ \"ก่อนเข้า Gate\"", check: { stat: "smarts", dc: 50 }, skill: ["business", "cook"], run: (l, _c, ok) => { addMoney(l, -3_000_000); if (ok) { l.flags.gateCafe = true; addMoney(l, 5_000_000); return good("เมนูขายดีคือ \"อเมริกาโน่ไว้อาลัย\" Hunter ทุกคนแวะ และหลายคนเขียนชื่อไว้บนผนังก่อนเข้า Gate"); } return bad("กาแฟอร่อย แต่ร้านปิดทุกครั้งที่ Gate ไม่เสถียร ซึ่งเกิดขึ้นบ่อยเกินไป"); } },
      { label: "เดินผ่านไป", run: () => meh("สองปีต่อมามีคนอื่นเปิดร้านตรงนั้น ชื่อร้านคือ \"ก่อนเข้า Gate\"") },
    ],
  },
  {
    id: "h16.h_kid_school_visit",
    minAge: 25,
    maxAge: 60,
    weight: (l) => w(isHunter(l) && people(l, "child").some((k) => k.age >= 6 && k.age <= 12), 5),
    prepare: (l) => ({ n: shortName(people(l, "child").find((k) => k.age >= 6 && k.age <= 12)!) }),
    text: (_l, c) => `โรงเรียนของ${c.n}จัดวัน "อาชีพของผู้ปกครอง" ลูกขอให้คุณใส่ชุดเกราะไปด้วย และ "อย่าเล่าเรื่องที่น่ากลัวนะ"`,
    choices: [
      { label: "เล่าแต่เรื่องตลก", run: (l, c) => { const k = l.people.find((x) => shortName(x) === c.n); if (k) k.bond = Math.min(100, k.bond + 10); addStat(l, "happiness", 6); return good(`เรื่องตอนคุณติดอยู่ในรังสไลม์สามชั่วโมงทำให้ทั้งห้องหัวเราะจนครูต้องขอให้หยุด ${c.n}ภูมิใจจนหน้าแดง`); } },
      { label: "เล่าความจริงว่าอาชีพนี้อันตรายแค่ไหน", run: (l) => { addStat(l, "happiness", 2); return meh("ห้องเงียบ เด็กคนหนึ่งยกมือถามว่า \"แล้วทำไมยังทำล่ะครับ\" คุณตอบว่า \"เพราะมีคนต้องทำ\" ครูน้ำตาซึม"); } },
    ],
  },
  {
    id: "h16.h_boss_memory",
    minAge: 25,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && (l.power?.bossKills ?? 0) >= 10, 3),
    text: () => "คืนหนึ่งคุณฝันเห็นภาพจากมุมมองของบอสที่คุณฆ่า — โลกอีกฝั่งของ Gate ฟ้าสีส้ม ลูกๆ ของมันรออยู่ในรัง",
    choices: [
      { label: "ไปหานักวิจัยที่ศึกษาเรื่องนี้", run: (l) => { addStat(l, "smarts", 3); l.flags.otherSide = true; return { text: "นักวิจัยบอกว่า Hunter แรงก์สูงหลายคนฝันแบบเดียวกัน แต่สมาคมขอให้ \"อย่าพูดเรื่องนี้ในที่สาธารณะ\"", kind: "system" }; } },
      { label: "ลืมมันซะ", run: (l) => { addStat(l, "happiness", -3); return meh("คุณพยายามลืม แต่ทุกครั้งที่ฟันบอสตัวต่อไป คุณจะลังเลครึ่งวินาที"); } },
    ],
  },
  {
    id: "h16.h_rank_up_party",
    minAge: 18,
    maxAge: 70,
    weight: (l) => w(isHunter(l) && rank(l) >= 4 && !l.flags.h16party, 5),
    text: (l) => `ครอบครัวจัดงานฉลองที่คุณกลายเป็นแรงก์ ${rankName(rank(l))} ญาติที่ไม่เคยเจอกันสิบปีมาครบ บางคนถือแฟ้มแผนธุรกิจมาด้วย`,
    choices: [
      { label: "ฟังแผนธุรกิจทุกคนอย่างตั้งใจ", check: { stat: "smarts", dc: 55 }, skill: ["business"], run: (l, _c, ok) => { l.flags.h16party = true; if (ok) { addMoney(l, 1_000_000); return good("หนึ่งในสิบแผนน่าสนใจจริงๆ — ร้านซ่อมชุดเกราะของลูกพี่ลูกน้อง ปีถัดมามันทำกำไร"); } addMoney(l, -2_000_000); return bad("คุณลงทุนกับฟาร์มหอยทากเรืองแสงของน้าเขย หอยทากหนีออกจากฟาร์มทั้งหมดในคืนเดียว"); } },
      { label: "ซ่อนตัวในห้องน้ำทั้งงาน", run: (l) => { l.flags.h16party = true; addStat(l, "happiness", 2); return meh("แม่เคาะประตูห้องน้ำสามครั้ง ครั้งสุดท้ายเอาเค้กมาส่งให้ทางช่องใต้ประตู"); } },
    ],
  },
  {
    id: "h16.h_core_allergy",
    minAge: 18,
    maxAge: 60,
    weight: (l) => w(isHunter(l), 3),
    text: () => "คุณเริ่มจามทุกครั้งที่จับคอร์ หมอบอกว่าเป็น \"ภูมิแพ้มานาตกค้าง\" พบได้หนึ่งในแสนคน Hunter แพ้คอร์ เหมือนชาวประมงแพ้ปลา",
    choices: [
      { label: "ใส่ถุงมือตะกั่วตลอดเวลา", run: (l) => { addMoney(l, -30_000); return meh("ถุงมือหนักจนคุณเปิดขวดน้ำไม่ได้ แต่ไม่จามอีกเลย"); } },
      { label: "ลองบำบัดภูมิแพ้ด้วยการจับคอร์ทุกวัน", check: { stat: "health", dc: 55 }, skill: ["heal"], run: (l, _c, ok) => (ok ? (addStat(l, "health", 2), good("สามเดือนผ่านไป ร่างกายปรับตัวได้ และคุณเริ่มรู้สึกได้ว่าคอร์ก้อนไหนเป็นของปลอม")) : bad("คุณจามจนตกบันไดสมาคม" + hurt(l, 3, 8, "ภูมิแพ้มานารุนแรง"))) },
    ],
  },
];

