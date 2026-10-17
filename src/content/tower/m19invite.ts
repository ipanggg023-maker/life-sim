// M19 — ช่วงวัยที่คำเชิญมาถึง (ก่อน/หลังคำเชิญ · คนที่ปฏิเสธ)
import type { GameEvent } from "../../engine/events";
import { pick } from "../../engine/rng";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../engine/util";
import { gainExp } from "../hunter/power";
import { bad, family, floor, good, grounded, meh, refused, waiting } from "./m19util";

const newbie = (l: Parameters<typeof floor>[0]) => !!l.power && floor(l) <= 6 && l.age - (l.power.awakenedAt ?? l.age) <= 2;

export const M19_INVITE: GameEvent[] = [
  {
    id: "t19.i.waiting_night",
    minAge: 17,
    maxAge: 20,
    when: waiting,
    title: "คืนก่อนวันเกิด",
    text: () => "คืนก่อนวันเกิดอายุสิบแปด ทั้งประเทศรู้ว่าคำเชิญมักมาตอนเที่ยงคืนของปีที่เหมาะสม คุณนั่งจ้องนาฬิกาอยู่บนเตียง แม่แอบมาเปิดประตูดูสามรอบ",
    choices: [
      { label: "นั่งรอจนเที่ยงคืน", run: (l) => { addStat(l, "happiness", -2); return meh("เที่ยงคืนผ่านไป… ไม่มีตัวอักษรสีทอง มีแต่เสียงแม่ถอนหายใจโล่งอกหลังประตู"); } },
      { label: "ไปนอนกับแม่", run: (l) => { for (const p of family(l)) if (p.relation === "mother") p.bond = clamp(p.bond + 10, 0, 100); return good("แม่ลูบหัวคุณเหมือนตอนห้าขวบ \"ไม่ว่าจะได้หรือไม่ได้ ลูกก็คือลูกแม่\""); } },
      { label: "เปิดไลฟ์รอคำเชิญ", check: { stat: "looks", dc: 50 }, skill: ["perform"], run: (l, _c, ok) => { if (ok) { addFame(l, 3); return good("คนดูสามหมื่นคนนั่งรอกับคุณ แม้คำเชิญจะไม่มา แต่ยอดฟอลโลว์มาแทน"); } return meh("มีคนดูสี่คน หนึ่งในนั้นพิมพ์ว่า 'นอนเถอะลูก' — แม่คุณเอง"); } },
    ],
  },
  {
    id: "t19.i.friend_invited",
    minAge: 17,
    maxAge: 22,
    title: "เพื่อนได้คำเชิญ",
    prepare: (l) => {
      const f = people(l, "friend");
      return { name: f.length ? shortName(pick(l, f)) : "เพื่อนสนิทสมัยมัธยม" };
    },
    text: (_l, c) => `${c.name}โทรมาตอนตีหนึ่ง เสียงสั่น "ฉันได้คำเชิญ… มันลอยอยู่ตรงหน้าเลย แกว่าฉันควรรับไหม"`,
    choices: [
      { label: "บอกให้รับ — ไปให้สุด", run: (l) => { addStat(l, "happiness", 1); return meh("เพื่อนหายเงียบไปสักพัก แล้วพิมพ์มาว่า 'ถ้าตายจะมาหลอกนะ' — สามวันต่อมาภาพของเขาโผล่ในถ่ายทอดสดชั้น 1"); } },
      { label: "ขอให้อยู่ด้วยกันบนโลก", run: (l) => { addStat(l, "happiness", 2); return meh("เพื่อนเงียบไปนาน \"…ขอบใจที่อยากให้อยู่\" เขาปฏิเสธคำเชิญ และไม่เคยรู้เลยว่าคิดถูกหรือผิด"); } },
      { label: "ขับรถไปหาทันที", run: (l) => { addStat(l, "health", -1); addStat(l, "happiness", 4); return good("ตีสามพวกคุณนั่งกินบะหมี่ข้างทาง คุยกันถึงตอนเช้า เพื่อนตัดสินใจได้เอง — และคุณอยู่ตรงนั้นตอนเขาตัดสินใจ"); } },
    ],
  },
  {
    id: "t19.i.envy",
    minAge: 19,
    maxAge: 24,
    when: grounded,
    text: () => "เพื่อนร่วมรุ่นที่ได้คำเชิญโพสต์รูปจากเมืองบนชั้น 5 — ท้องฟ้าสีม่วง ร้านกาแฟลอยได้ ยอดไลก์ห้าแสน คุณนั่งดูอยู่ในรถเมล์ที่ติดไฟแดงมาสิบห้านาที",
    choices: [
      { label: "กดไลก์แล้วปิดมือถือ", run: (l) => { addStat(l, "happiness", -2); return meh("ไฟเขียวพอดี ชีวิตคุณขยับต่อไปอีกหนึ่งป้าย"); } },
      { label: "เลิกติดตามทุกคนที่อยู่บนหอคอย", run: (l) => { addStat(l, "happiness", 3); return good("หน้าฟีดของคุณเต็มไปด้วยรูปแมวและสูตรอาหาร ชีวิตดีขึ้นนิดหนึ่ง"); } },
    ],
  },
  {
    id: "t19.i.newbie_lost",
    minAge: 10,
    maxAge: 50,
    when: newbie,
    title: "วันแรกในหอคอย",
    text: () => "ชั้น 1 ใหญ่กว่าที่ถ่ายทอดสดให้เห็นสิบเท่า ป้ายบอกทางเป็นภาษาที่อ่านได้แต่ไม่เข้าใจ ผู้ท้าชิงหน้าใหม่ร้อยคนยืนงงอยู่ในลานกว้างเหมือนวันปฐมนิเทศมหาวิทยาลัย",
    choices: [
      { label: "ตามกลุ่มที่ดูมั่นใจที่สุด", check: { stat: "luck", dc: 45 }, run: (_l, _c, ok) => ok ? good("กลุ่มนั้นคือรุ่นพี่ที่ลงมารับน้อง คุณได้ทัวร์ฟรีทั้งชั้นพร้อมข้าวกล่อง") : bad("กลุ่มนั้นมั่นใจเพราะเป็นพวกหลอกขายแผนที่ปลอม คุณเสียเงินไปเปล่าๆ") },
      { label: "นั่งอ่านป้ายจนเข้าใจ", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { gainExp(l, 120); return good("ป้ายบอกว่า 'ทางนี้ไม่ใช่ทางนั้น' — คุณใช้เวลาสองชั่วโมงกว่าจะเข้าใจว่ามันเป็นมุก แต่ก็ได้เรียนรู้ภาษาหอคอย"); } return meh("ยิ่งอ่านยิ่งงง แต่ก็มีคนมานั่งงงด้วยกันเป็นเพื่อน"); } },
      { label: "ตะโกนถามว่ามีใครเป็นคนไทยไหม", run: (l) => { createPerson(l, "friend", { age: l.age, bond: 55 }); return good("มีคนยกมือสิบคน สามคนในนั้นกลายเป็นเพื่อนกินข้าวด้วยกันทุกเย็น"); } },
    ],
  },
  {
    id: "t19.i.class_test",
    minAge: 10,
    maxAge: 50,
    when: newbie,
    text: () => "ผู้ดูแลชั้น 1 แจกแบบสอบถาม 'ความพร้อมทางจิตใจ' ข้อแรกถามว่า 'ท่านพร้อมจะตายหรือไม่' มีช่องให้เลือกแค่ 'ใช่' กับ 'ใช่'",
    choices: [
      { label: "ติ๊ก 'ใช่'", run: () => meh("ผู้ดูแลชั้นประทับตรา 'ผ่าน' โดยไม่มองหน้า") },
      { label: "เขียนช่องที่สามเอง: 'ยังไม่พร้อม แต่จะไม่ตาย'", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { addFame(l, 2); gainExp(l, 150); return good("ผู้ดูแลชั้นหยุดมือ แล้วยิ้มเป็นครั้งแรกในรอบสามปี (ตามข่าวลือ) — ชื่อคุณถูกจดลงสมุดเล่มพิเศษ"); } return meh("ผู้ดูแลชั้นขีดฆ่าแล้วติ๊ก 'ใช่' ให้แทน"); } },
    ],
  },
  {
    id: "t19.i.family_send_off",
    minAge: 10,
    maxAge: 50,
    when: (l) => !!l.power && l.age === l.power.awakenedAt && family(l).length > 0,
    title: "ลาบ้าน",
    text: () => "หอคอยให้เวลาผู้ท้าชิงใหม่เจ็ดวันก่อนต้องขึ้นไปจริง ทั้งบ้านทำเป็นปกติ แต่ตู้เย็นเต็มไปด้วยอาหารที่คุณชอบทั้งหมด",
    choices: [
      { label: "ทำทุกอย่างเหมือนเดิมทั้งเจ็ดวัน", run: (l) => { for (const p of family(l)) p.bond = clamp(p.bond + 8, 0, 100); addStat(l, "happiness", 5); return good("วันสุดท้ายพ่อขับรถไปส่งที่ฐานหอคอย ไม่มีใครพูดอะไร แต่วิทยุเปิดเพลงที่คุณร้องตามได้ทุกเพลง"); } },
      { label: "เขียนจดหมายทิ้งไว้ให้ทุกคน", run: (l) => { l.flags.t19letters = true; for (const p of family(l)) p.bond = clamp(p.bond + 5, 0, 100); return meh("คุณซ่อนจดหมายไว้ในที่ที่แต่ละคนจะเจอหลังคุณไปแล้ว — แม่เจอฉบับของแม่ในถังข้าวสาร"); } },
      { label: "หนีขึ้นไปก่อนกำหนดเพราะทนบรรยากาศไม่ไหว", run: (l) => { for (const p of family(l)) p.bond = clamp(p.bond - 6, 0, 100); gainExp(l, 200); return meh("คุณได้ฝึกก่อนคนอื่นสามวัน แต่ข้อความในมือถือจากแม่ค้างอยู่ไม่ได้ตอบ"); } },
    ],
  },
  {
    id: "t19.i.refuse_regret",
    minAge: 20,
    maxAge: 35,
    when: refused,
    title: "ถ้าวันนั้นรับไว้",
    text: () => "เพื่อนที่รับคำเชิญปีเดียวกับคุณขึ้นปกนิตยสาร 'ผู้ท้าชิงดาวรุ่งแห่งปี' คืนนั้นคุณฝันถึงตัวอักษรสีทองที่ค้างอยู่กลางห้องนอน",
    choices: [
      { label: "ยอมรับว่าตัวเองเลือกแล้ว", run: (l) => { addStat(l, "happiness", 4); l.flags.t19peace = true; return good("ตอนเช้าคุณชงกาแฟ มองออกไปนอกหน้าต่าง หอคอยยังอยู่ที่เดิม และคุณก็ยังอยู่ที่เดิม — ซึ่งก็ดีแล้ว"); } },
      { label: "เขียนจดหมายถึงหอคอย", run: (l) => { l.flags.t19wrote = true; return meh("คุณเผาจดหมายที่ฐานหอคอยตามความเชื่อโบราณ ควันลอยขึ้นตรงไปหายอด — ไม่เอียงสักนิด"); } },
    ],
  },
  {
    id: "t19.i.second_call",
    minAge: 22,
    maxAge: 45,
    weight: 4,
    when: (l) => refused(l) && !l.flags.t19secondCall,
    title: "คำเชิญครั้งที่สอง",
    system: false,
    text: () => "ตัวอักษรสีทองปรากฏขึ้นอีกครั้งตอนคุณกำลังล้างจาน 「ท่านเคยปฏิเสธ — หอคอยไม่เคยถามใครสองครั้ง ยกเว้นท่าน」",
    choices: [
      { label: "ครั้งนี้รับ", run: (l) => { l.flags.t19secondCall = true; l.flags.awakenDone = false; delete l.flags.refusedTower; l.flags.awakenAge = l.age + 1; return { text: "คุณเช็ดมือกับผ้ากันเปื้อน แล้วพยักหน้า ตัวอักษรค่อยๆ จางลง 「ปีหน้า เที่ยงคืน」", kind: "milestone" }; } },
      { label: "ปฏิเสธอีกครั้ง", run: (l) => { l.flags.t19secondCall = true; addStat(l, "happiness", 5); addFame(l, 1); return meh("ตัวอักษรกระพริบเหมือนกำลังหัวเราะ แล้วหายไป — มีคนเดียวในโลกที่ปฏิเสธหอคอยได้สองครั้ง"); } },
    ],
  },
  {
    id: "t19.i.not_qualified_grief",
    minAge: 18,
    maxAge: 30,
    when: (l) => grounded(l) && !l.flags.refusedTower && !!l.flags.dreamTower,
    title: "ประตูที่ไม่เปิด",
    text: () => "ทุกคนรู้ว่าคุณฝันอยากขึ้นหอคอยตั้งแต่เด็ก และทุกคนรู้ว่าประตูไม่เปิดให้คุณ ญาติๆ เลี่ยงพูดเรื่องหอคอยต่อหน้าคุณอย่างจงใจจนน่าอึดอัด",
    choices: [
      { label: "ไปทำงานในอุตสาหกรรมหอคอยแทน", run: (l) => { l.flags.t19industry = true; addStat(l, "smarts", 2); return good("ถ้าปีนไม่ได้ ก็ช่วยให้คนอื่นปีนได้ — คุณเริ่มเรียนวิศวกรรมอุปกรณ์ผู้ท้าชิง"); } },
      { label: "เผาสมุดวาดรูปหอคอยทั้งหมด", run: (l) => { addStat(l, "happiness", -3); l.flags.t19burned = true; return meh("ควันไฟลอยขึ้นตรงไปทางหอคอย คุณมองจนมันหายไป แล้วก็รู้สึกเบาขึ้นนิดหนึ่ง"); } },
      { label: "ตะโกนว่าจะกลับมาให้ได้", run: (l) => { l.flags.stubborn = true; addStat(l, "health", 2); return meh("คุณสมัครฟิตเนสรายปีในวันเดียวกัน — ไม่มีใครรู้ว่าหอคอยฟังอยู่หรือเปล่า"); } },
    ],
  },
  {
    id: "t19.i.recruiter",
    minAge: 10,
    maxAge: 50,
    when: (l) => newbie(l) && (l.power?.rank ?? 0) >= 3,
    title: "แมวมองจากกิลด์ใหญ่",
    text: () => "ยังไม่ทันได้ผ่านชั้นแรก แมวมองจากกิลด์ใหญ่สามกิลด์ก็มายืนเรียงรอหน้าห้องพัก แต่ละคนถือสัญญาหนาเท่าพจนานุกรม",
    choices: [
      { label: "อ่านสัญญาทุกหน้า", check: { stat: "smarts", dc: 55 }, skill: ["business"], run: (l, _c, ok) => { if (ok) { addMoney(l, 500_000); return good("หน้า 312 เขียนว่ากิลด์มีสิทธิ์ในอวัยวะของคุณถ้าตาย — คุณขีดออกแล้วเรียกค่าเซ็นเพิ่ม พวกเขายอม"); } return meh("คุณหลับไปตอนหน้า 40 แมวมองเดินกลับไปหมดแล้ว"); } },
      { label: "ปฏิเสธทั้งหมด — จะสร้างทีมเอง", run: (l) => { l.flags.t19ownTeam = true; addFame(l, 2); return meh("แมวมองคนหนึ่งยิ้ม \"ทุกคนพูดแบบนี้ตอนชั้นหนึ่ง\""); } },
    ],
  },
  {
    id: "t19.i.ceremony_crowd",
    minAge: 17,
    maxAge: 21,
    when: waiting,
    text: () => "ข้างฐานหอคอยมีงาน 'นับถอยหลังคำเชิญ' ประจำปี คนหนุ่มสาวนับหมื่นมานั่งรอเที่ยงคืนพร้อมกัน แผงขายหมวกรูปหอคอยกับธูปขอพรขายดีที่สุด",
    choices: [
      { label: "ไปนั่งรอกับเพื่อน", run: (l) => { addStat(l, "happiness", 5); return good("เที่ยงคืนมีแสงทองลอยขึ้นสามจุดในฝูงชน ทุกคนกรี๊ด ไม่มีจุดไหนเป็นของคุณ แต่คืนนั้นสนุกที่สุดในปี"); } },
      { label: "ไปขายน้ำ", check: { stat: "smarts", dc: 40 }, skill: ["business"], run: (l, _c, ok) => { if (ok) { addMoney(l, 12_000); return good("น้ำเปล่าขวดละสามเท่าขายหมดก่อนสี่ทุ่ม"); } return meh("ขายได้ห้าขวด อีกยี่สิบขวดกินเองจนท้องอืด"); } },
    ],
  },
  {
    id: "t19.i.invite_lottery",
    minAge: 18,
    maxAge: 30,
    when: (l) => grounded(l) && l.money > 50_000,
    title: "ขายคำเชิญ",
    text: () => "ในเว็บมืดมีคนประกาศขาย 'คำเชิญที่โอนสิทธิ์ได้' ราคาเท่าบ้านหนึ่งหลัง ข่าวว่ามีคนซื้อไปแล้วสิบคน และไม่มีใครกลับมาเล่าว่าใช้ได้จริงไหม",
    choices: [
      { label: "ซื้อ", tone: "danger", run: (l) => { addMoney(l, -Math.round(Math.max(0, l.money) * 0.4)); addStat(l, "happiness", -8); return bad("พัสดุที่ส่งมาคือกระดาษทองกับสติกเกอร์เรืองแสง และเบอร์ติดต่อที่ไม่มีอยู่จริง"); } },
      { label: "แจ้งตำรวจ", run: (l) => { addFame(l, 2); return good("ตำรวจทลายแก๊งได้ในสองเดือน คุณได้ใบประกาศเกียรติคุณกับข้าวกล่องหนึ่งกล่อง"); } },
      { label: "ปิดเว็บไป", run: () => meh("หอคอยไม่ได้ขายของออนไลน์ — คุณรู้แบบนั้นแหละ") },
    ],
  },
  {
    id: "t19.i.first_kill",
    minAge: 10,
    maxAge: 60,
    when: (l) => !!l.power && floor(l) >= 3 && floor(l) <= 15,
    title: "ครั้งแรกที่ฆ่า",
    text: () => "สัตว์ในบททดสอบไม่ได้ตายแล้วหายไปเหมือนในเกม มันส่งเสียงครางเหมือนสุนัขที่บ้าน แล้วหยุดหายใจในอ้อมแขนคุณ",
    choices: [
      { label: "ฝังมันก่อนไปต่อ", run: (l) => { addStat(l, "happiness", -2); l.flags.t19gentle = true; return meh("ผู้ท้าชิงคนอื่นมองคุณแปลกๆ แต่มีคนหนึ่งมาช่วยขุด"); } },
      { label: "บอกตัวเองว่ามันคือบททดสอบ", run: (l) => { gainExp(l, 150); addStat(l, "happiness", -4); return meh("คุณเดินต่อโดยไม่หันกลับไปมอง — แล้วก็ไม่เคยลืม"); } },
    ],
  },
  {
    id: "t19.i.parents_fight",
    minAge: 17,
    maxAge: 22,
    when: (l) => (waiting(l) || (!!l.power && floor(l) <= 3)) && people(l, "father").length > 0 && people(l, "mother").length > 0,
    text: () => "พ่อกับแม่ทะเลาะกันกลางดึก พ่ออยากให้คุณรับคำเชิญ 'เพื่ออนาคต' แม่บอกว่า 'อนาคตอะไรถ้าลูกตาย' ทั้งสองไม่รู้ว่าคุณได้ยินทุกคำ",
    choices: [
      { label: "ออกไปบอกว่าจะตัดสินใจเอง", run: (l) => { addStat(l, "happiness", 2); for (const p of family(l)) p.bond = clamp(p.bond + 3, 0, 100); return good("ทั้งสองเงียบ แล้วแม่ก็ร้องไห้ พ่อกอดทั้งคู่ไว้ — ครั้งแรกในรอบหลายปีที่บ้านนี้กอดกัน"); } },
      { label: "แกล้งหลับ", run: (l) => { addStat(l, "happiness", -3); return meh("พรุ่งนี้ทั้งคู่ยิ้มให้คุณเหมือนไม่มีอะไรเกิดขึ้น"); } },
    ],
  },
  {
    id: "t19.i.lucky_charm",
    minAge: 10,
    maxAge: 60,
    when: newbie,
    text: () => "ก่อนขึ้นบททดสอบแรก ยายส่งพระเครื่องรุ่น 'หอคอยรุ่นหนึ่ง' มาให้ทางไปรษณีย์ — ทำจากเศษหินที่ร่วงจากหอคอยเมื่อสามสิบปีก่อน (ยายบอก)",
    choices: [
      { label: "ห้อยคอไว้ตลอด", run: (l) => { addStat(l, "luck", 3); return good("ไม่รู้ว่าหินจริงหรือเปล่า แต่ทุกครั้งที่จับมันคุณหายใจช้าลง"); } },
      { label: "เก็บไว้ในกระเป๋า", run: (l) => { addStat(l, "happiness", 2); return meh("คุณส่งรูปพระเครื่องกลับไปให้ยาย ยายตอบมาว่า 'ห้อยคอ!!!' สามอัศเจรีย์"); } },
    ],
  },
  {
    id: "t19.i.debt_climber",
    minAge: 18,
    maxAge: 30,
    weight: (l) => (l.wealth === "poor" ? 10 : 2),
    when: (l) => !!l.power && floor(l) <= 10,
    title: "ปีนเพื่อใช้หนี้",
    text: (l) => `ที่บ้านโทรมาบอกว่าเจ้าหนี้ขู่จะยึดบ้าน หนี้เหลืออีก ${money(l, 400_000)} ในหอคอย ผู้ท้าชิงหน้าใหม่ที่รับงานเสี่ยงได้เงินเร็ว`,
    choices: [
      { label: "รับงานแบกเสบียงในชั้นอันตราย", tone: "danger", check: { stat: "health", dc: 50 }, run: (l, _c, ok) => { if (ok) { addMoney(l, 400_000); for (const p of family(l)) p.bond = clamp(p.bond + 10, 0, 100); return good("สามเดือนในชั้นที่ไม่มีใครอยากไป คุณส่งเงินกลับบ้านครบทุกบาท"); } addStat(l, "health", -15); return bad("กับดักระเบิดใกล้ตัว คุณรอด แต่หนี้ยังอยู่ — และตอนนี้มีค่ารักษาเพิ่มด้วย"); } },
      { label: "ขอยืมเพื่อนร่วมชั้น", check: { stat: "looks", dc: 50 }, run: (l, _c, ok) => { if (ok) { addMoney(l, 200_000); l.flags.t19owesFriend = true; return meh("เพื่อนโอนให้ครึ่งหนึ่งโดยไม่ถามอะไร \"ใช้คืนตอนถึงชั้น 30\""); } return meh("ทุกคนในชั้นต้นๆ จนพอๆ กับคุณ"); } },
    ],
  },
  {
    id: "t19.i.tower_language",
    minAge: 10,
    maxAge: 60,
    when: (l) => !!l.power && floor(l) <= 12,
    text: () => "ร้านหนังสือในชั้นปลอดภัยขาย 'พจนานุกรมภาษาหอคอย ฉบับนักท่องเที่ยว' ราคาแพงกว่าอาหารหนึ่งอาทิตย์",
    choices: [
      { label: "ซื้อมาอ่าน", check: { stat: "smarts", dc: 50 }, skill: ["study"], run: (l, _c, ok) => { addMoney(l, -8000); if (ok) { l.flags.towerLore = true; gainExp(l, 200); return good("คุณอ่านป้ายกฎของชั้นออกก่อนคนอื่นครึ่งวัน — ครึ่งวันในหอคอยคือชีวิต"); } return meh("ครึ่งเล่มเป็นวลีอย่าง 'ห้องน้ำอยู่ที่ไหน' กับ 'อย่าฆ่าฉัน'"); } },
      { label: "ถ่ายรูปไว้ทั้งเล่มแล้ววางคืน", run: (l) => { addFame(l, -1); return meh("เจ้าของร้านเห็น แต่ทำเป็นไม่เห็น — เขาก็เคยทำแบบนี้"); } },
    ],
  },
  {
    id: "t19.i.ex_left_behind",
    minAge: 18,
    maxAge: 30,
    when: (l) => !!l.power && floor(l) <= 10 && people(l, "partner").length > 0,
    prepare: (l) => ({ id: pick(l, people(l, "partner")).id }),
    title: "คนที่รออยู่บนโลก",
    text: (l, c) => `${shortName(l.people.find((p) => p.id === c.id)!)}ส่งข้อความมา "เวลาบนหอคอยกับบนโลกไม่เท่ากัน ใช่ไหม… เรายังรอได้อีกนานแค่ไหนกัน"`,
    choices: [
      { label: "สัญญาว่าจะกลับไปทุกปี", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 6, 0, 100); l.flags.t19promiseHome = true; return good("\"งั้นเราจะนับวันรอ\" — ข้อความตามมาด้วยรูปปฏิทินที่วงไว้แล้วหนึ่งวัน"); } },
      { label: "บอกให้ไม่ต้องรอ", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) { p.relation = "friend"; p.bond = clamp(p.bond - 10, 0, 100); } addStat(l, "happiness", -8); return bad("สามจุดขึ้นค้างอยู่นาน แล้วก็หายไป — ข้อความสุดท้ายคือ 'ดูแลตัวเองนะ'"); } },
    ],
  },
  {
    id: "t19.i.sibling_jealous",
    minAge: 18,
    maxAge: 30,
    when: (l) => !!l.power && people(l, "sibling").length > 0 && l.age - (l.power.awakenedAt ?? l.age) <= 3,
    prepare: (l) => ({ id: pick(l, people(l, "sibling")).id }),
    text: (l, c) => `${shortName(l.people.find((p) => p.id === c.id)!)}ไม่ได้รับคำเชิญ ทุกครั้งที่คุณโทรกลับบ้าน เสียงของพี่น้องในสายเย็นลงทีละนิด "ดีใจด้วยนะ ผู้ท้าชิง"`,
    choices: [
      { label: "ส่งเงินจากหอคอยไปช่วย", run: (l, c) => { addMoney(l, -50_000); const p = l.people.find((x) => x.id === c.id); if (p) p.bond = clamp(p.bond + 4, 0, 100); return meh("เงินถูกโอนคืนมาในวันเดียวกัน พร้อมข้อความ 'ไม่ได้อยากได้เงิน'"); } },
      { label: "ถามตรงๆ ว่าโกรธอะไร", check: { stat: "looks", dc: 45 }, run: (l, c, ok) => { const p = l.people.find((x) => x.id === c.id); if (ok && p) { p.bond = clamp(p.bond + 12, 0, 100); return good("\"ไม่ได้โกรธ… แค่กลัวว่าจะไม่ได้เจอกันอีก\" — คุณสองคนร้องไห้ในสายจนแบตหมด"); } if (p) p.bond = clamp(p.bond - 6, 0, 100); return bad("\"ไม่ได้โกรธ\" แล้วสายก็ตัดไป"); } },
    ],
  },
  {
    id: "t19.i.oldest_newbie",
    minAge: 35,
    maxAge: 70,
    when: (l) => !!l.power && l.age - (l.power.awakenedAt ?? 0) <= 1,
    title: "ผู้ท้าชิงหน้าใหม่ที่อายุมากที่สุด",
    text: (l) => `ผู้ท้าชิงหน้าใหม่ทั้งรุ่นอายุไม่ถึงยี่สิบห้า มีคุณคนเดียวที่อายุ ${l.age} เด็กๆ เรียกคุณว่า 'ลุง/ป้าหอคอย' แล้วมาขอให้ช่วยดูแผลทุกครั้งที่ล้ม`,
    choices: [
      { label: "รับบทผู้ปกครองของรุ่น", run: (l) => { addFame(l, 3); addStat(l, "happiness", 5); return good("คุณทำกับข้าวให้ทั้งรุ่นกินทุกเย็น — ทีมไหนก็อยากได้คุณเข้าทีม"); } },
      { label: "บอกว่าตัวเองมาปีน ไม่ได้มาเลี้ยงเด็ก", run: (l) => { gainExp(l, 200); return meh("เด็กๆ ถอยห่าง แต่พอคุณผ่านบททดสอบแรกเป็นคนแรก พวกเขาก็กลับมาขอเคล็ดลับ"); } },
    ],
  },
];

