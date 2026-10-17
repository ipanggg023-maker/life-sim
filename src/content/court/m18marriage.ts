// M18 — การเมืองของการแต่งงาน และชีวิตผู้ใหญ่ในราชสำนัก
import type { GameEvent } from "../../engine/events";
import { chance } from "../../engine/rng";
import { addFame, addMoney, addStat, createPerson, money, people, shortName } from "../../engine/util";
import { W, bad, big, good, married, meh, noble, other, rivalName, single } from "./m18common";
import { FACTION_INFO, addFac, addRumor, addSoc, ally, badRumors, fac, soc, type Faction } from "./politics";

const spouse = (l: Parameters<typeof married>[0]) => people(l, "spouse")[0];
const kids = (l: Parameters<typeof married>[0]) => people(l, "child");

export const M18_MARRIAGE: GameEvent[] = [
  {
    id: "c18.m.three_suitors",
    minAge: 18,
    maxAge: 28,
    weight: (l) => (single(l) && noble(l) ? W + 4 : 0),
    title: "สามข้อเสนอแต่งงาน",
    text: () => "ในสัปดาห์เดียว พ่อแม่ของคุณได้รับข้อเสนอแต่งงานสามฉบับ: จากหลานชาย/หลานสาวของจักรพรรดินี จากบุตรของพระคาร์ดินัลที่สละสมณเพศ และจากทายาทของแกรนด์ดยุก",
    choices: [
      { label: "👑 ฝ่ายราชวงศ์", run: (l) => { const p = createPerson(l, "spouse", { gender: other(l), age: l.age + 2, bond: 55, job: "พระญาติราชวงศ์" }); addFac(l, "royal", 20); addFac(l, "noble", -5); l.flags.c18PolMarriage = "royal"; addFame(l, 8); return big(`คุณแต่งงานกับ${shortName(p)} ในโบสถ์ของพระราชวัง ทุกคนบอกว่าเป็นคู่ที่เหมาะสม — ไม่มีใครถามว่ารักกันไหม`); } },
      { label: "⛪ ฝ่ายวิหาร", run: (l) => { const p = createPerson(l, "spouse", { gender: other(l), age: l.age + 1, bond: 60, job: "อดีตนักบวช" }); addFac(l, "temple", 20); addFac(l, "royal", -5); l.flags.c18PolMarriage = "temple"; return big(`${shortName(p)}สวดภาวนาก่อนนอนทุกคืน และขอบคุณเทพธิดาที่ได้พบคุณ — เป็นชีวิตที่สงบอย่างประหลาด`); } },
      { label: "🎩 ฝ่ายขุนนาง", run: (l) => { const p = createPerson(l, "spouse", { gender: other(l), age: l.age + 3, bond: 50, job: "ทายาทแกรนด์ดยุก" }); addFac(l, "noble", 20); addFac(l, "temple", -5); l.flags.c18PolMarriage = "noble"; addMoney(l, 300_000); return big(`สินสอด ${money(l, 300_000)} กับคู่สมรสอย่าง${shortName(p)} ผู้ที่เอาสัญญาก่อนสมรสสามสิบหน้ามาให้เซ็นในวันหมั้น`); } },
      { label: "ปฏิเสธทั้งสาม", run: (l) => { addFac(l, "royal", -4); addFac(l, "temple", -4); addFac(l, "noble", -4); addRumor(l, "c18.r.refused_three", "ลือกันว่าคุณปฏิเสธข้อเสนอแต่งงานจากทั้งสามขั้วอำนาจ — ต้องมีคนลับแน่ๆ", true, false, 3); return meh("ทั้งสามขั้วไม่พอใจเล็กน้อย และทั้งเมืองอยากรู้ว่าคุณรอใคร"); } },
    ],
  },
  {
    id: "c18.m.loveless",
    minAge: 20,
    maxAge: 45,
    weight: (l) => (l.flags.c18PolMarriage && married(l) ? W + 4 : 0),
    text: (l) => `สามปีหลังแต่งงานเพื่อการเมือง ${spouse(l) ? shortName(spouse(l)!) : "คู่สมรส"}นั่งตรงข้ามคุณที่โต๊ะอาหารยาวสิบเมตร ไม่มีใครพูดอะไรมาสามวันแล้ว`,
    choices: [
      { label: "ย้ายเก้าอี้ไปนั่งข้างๆ", run: (l) => { const p = spouse(l); if (p) p.bond = Math.min(100, p.bond + 25); addStat(l, "happiness", 6); return good("อีกฝ่ายตกใจจนทำส้อมหล่น แล้วหัวเราะออกมา — เป็นครั้งแรกที่คุณได้ยินเสียงหัวเราะนั้น"); } },
      { label: "ต่างคนต่างอยู่ ยึดตามสัญญา", run: (l) => { addStat(l, "happiness", -3); return meh("การแต่งงานของคุณเป็นพันธมิตรที่ดี และเป็นชีวิตคู่ที่เงียบที่สุดในนครหลวง"); } },
      { label: "แอบมีคนรักลับ", run: (l) => { createPerson(l, "partner", { gender: other(l), age: l.age, bond: 70 }); addRumor(l, `c18.r.affair_${l.age}`, "ลือกันว่ามีคนเห็นคุณออกจากโรงละครกับคนที่ไม่ใช่คู่สมรส", true, false, 4); return bad("หัวใจคุณเต้นแรงอีกครั้ง — และหนังสือพิมพ์ซุบซิบก็เช่นกัน"); } },
    ],
  },
  {
    id: "c18.m.matchmaker_aunt",
    minAge: 19,
    maxAge: 30,
    weight: (l) => (single(l) ? W : 0),
    text: () => "ป้าทวดผู้เป็นแม่สื่อมือหนึ่งของวงสังคมจัดงานน้ำชา 'บังเอิญ' ให้คุณเจอคนโสดเจ็ดคนในบ่ายเดียว",
    choices: [
      { label: "ร่วมมือเต็มที่", check: { stat: "looks", dc: 50 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { const p = createPerson(l, "partner", { gender: other(l), age: l.age + 1, bond: 60 }); addSoc(l, 3); return good(`คนที่เจ็ด ${shortName(p)} คือคนเดียวที่ไม่พูดเรื่องสินสอด — คุณคุยกันจนป้าทวดต้องจุดเทียน`); } return meh("คุณจำชื่อได้สองคน และทั้งสองคนชื่อเดียวกัน"); } },
      { label: "แกล้งทำตัวน่ารำคาญให้ทุกคนหนี", run: (l) => { addStat(l, "happiness", 4); addSoc(l, -2); return meh("คุณเล่าเรื่องเชื้อราในรองเท้าบู๊ตตลอดบ่าย ป้าทวดสาบานว่าจะไม่ช่วยคุณอีก — แล้วก็นัดงานใหม่ในสัปดาห์ถัดไป"); } },
    ],
  },
  {
    id: "c18.m.elopement",
    minAge: 18,
    maxAge: 30,
    weight: (l) => (people(l, "partner").length && noble(l) ? W : 0),
    title: "หนีตามกัน",
    text: (l) => `ครอบครัวคุณปฏิเสธ${shortName(people(l, "partner")[0])}เพราะ 'ไม่มีประโยชน์ทางการเมือง' อีกฝ่ายรอคุณอยู่ที่ประตูหลังพร้อมม้าสองตัว`,
    choices: [
      { label: "หนีไปแต่งงานที่วิหารชนบท", run: (l) => { const p = people(l, "partner")[0]; p.relation = "spouse"; p.bond = 90; addSoc(l, -10); addStat(l, "happiness", 15); addRumor(l, "c18.r.eloped", "ทั้งเมืองพูดถึงการหนีตามกันที่โรแมนติกที่สุดของทศวรรษ", true, true, 4); return big("บาทหลวงชนบทแต่งงานให้โดยไม่ถามนามสกุล ครอบครัวโกรธ สังคมนินทา แต่คุณไม่เคยมีความสุขขนาดนี้"); } },
      { label: "อยู่บ้าน — หน้าที่มาก่อน", run: (l) => { const p = people(l, "partner")[0]; p.alive = false; l.people = l.people.filter((x) => x.id !== p.id); addStat(l, "happiness", -12); return bad("ม้าสองตัวยืนรอจนรุ่งสาง แล้วเหลือตัวเดียว"); } },
    ],
  },
  {
    id: "c18.m.inlaw_war",
    minAge: 22,
    maxAge: 50,
    weight: (l) => (married(l) && noble(l) ? W : 0),
    text: () => "แม่สามี/แม่ภรรยาเข้ามาคุมกุญแจห้องเก็บเงินของคฤหาสน์ 'ข้าดูแลบ้านนี้มาสามสิบปี เจ้าจะรู้อะไร'",
    choices: [
      { label: "ยึดกุญแจคืนด้วยบัญชีที่ตรวจพบการยักยอก", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { if (ok) { addMoney(l, 40_000); addStat(l, "happiness", 6); return good("คุณพบว่าเงินหายไปปีละสองพันเหรียญ — เข้ากระเป๋าพ่อบ้านที่แม่สามีไว้ใจ แม่สามีมองคุณด้วยความเคารพเป็นครั้งแรก"); } return bad("บัญชีของคุณผิดสามบรรทัด แม่สามีชี้ให้ดูต่อหน้าคนรับใช้ทั้งบ้าน"); } },
      { label: "ปล่อยไป แลกกับความสงบ", run: (l) => { addStat(l, "happiness", -3); return meh("บ้านสงบ แต่คุณต้องขออนุญาตทุกครั้งที่อยากซื้อดอกไม้"); } },
      { label: "เชิญแม่สามีร่วมก่อตั้งสมาคมสตรีการกุศล", run: (l) => { addSoc(l, 5); addFac(l, "temple", 4); return good("แม่สามีพบเวทีใหม่ที่ยิ่งใหญ่กว่าห้องเก็บเงิน และเลิกยุ่งกับบ้านคุณไปโดยปริยาย"); } },
    ],
  },
  {
    id: "c18.m.heir_betrothal",
    minAge: 32,
    maxAge: 60,
    weight: (l) => (kids(l).some((k) => k.age >= 6 && k.age <= 16) && noble(l) ? W + 3 : 0),
    title: "หมั้นหมายลูก",
    prepare: (l) => ({ k: kids(l).find((k) => k.age >= 6 && k.age <= 16)?.id ?? "" }),
    text: (l, c) => `ตระกูลต่างๆ เริ่มส่งข้อเสนอหมั้นหมายมาให้${shortName(l.people.find((p) => p.id === c.k) ?? kids(l)[0])} ลูกของคุณ — นี่คือหมากที่สำคัญที่สุดของตระกูลในรอบรุ่น`,
    choices: [
      { label: "หมั้นกับตระกูลของขั้วที่คุณหนุน", show: (l) => !!ally(l), run: (l) => { const f = ally(l) as Faction; addFac(l, f, 15); return meh(`การหมั้นผูกตระกูลคุณกับ${FACTION_INFO[f].name}ไว้อีกชั่วคน — ลูกของคุณยังเด็กเกินกว่าจะเข้าใจว่าเพิ่งถูกขาย`); } },
      { label: "ให้ลูกเลือกเองเมื่อโต", run: (l) => { addSoc(l, -3); addStat(l, "happiness", 5); const k = kids(l)[0]; if (k) k.bond = Math.min(100, k.bond + 15); return good("ทั้งวงสังคมว่าคุณประหลาด แต่ลูกของคุณกอดคุณแน่นกว่าทุกครั้ง"); } },
      { label: "เปิดประมูลเงียบ", run: (l) => { addMoney(l, 250_000); addSoc(l, -4); return meh(`ตระกูลพ่อค้าใหม่ชนะการประมูลที่ ${money(l, 250_000)} ขุนนางเก่าพากันเบือนหน้า แต่เงินก็คือเงิน`); } },
    ],
  },
  {
    id: "c18.m.divorce_scandal",
    minAge: 25,
    maxAge: 60,
    weight: (l) => (married(l) && (spouse(l)?.bond ?? 100) < 30 ? W + 4 : 0),
    title: "ฟ้องหย่า",
    text: () => "การหย่าร้างในจักรวรรดิต้องได้รับอนุญาตจากวิหาร และทุกครั้งที่มีขุนนางยื่นฟ้อง หนังสือพิมพ์จะขายหมดภายในชั่วโมง",
    choices: [
      { label: "ยื่นเรื่องต่อวิหาร", run: (l) => { if (fac(l, "temple") >= 20 || chance(l, 0.4)) { l.people = l.people.filter((x) => x.relation !== "spouse"); addSoc(l, -6); addStat(l, "happiness", 8); return meh("วิหารอนุมัติ — คุณเป็นอิสระ และเป็นหัวข้อสนทนาของทุกงานเลี้ยงไปอีกหนึ่งปี"); } addFac(l, "temple", -6); addSoc(l, -8); return bad("วิหารปฏิเสธ 'สิ่งที่เทพธิดาผูกไว้ มนุษย์ไม่อาจแก้' — ตอนนี้ทั้งเมืองรู้ว่าคุณอยากหนี"); } },
      { label: "ทนต่อไปเพื่อชื่อเสียงตระกูล", run: (l) => { addStat(l, "happiness", -6); return meh("คุณยิ้มให้กันในงานเลี้ยง และไม่พูดกันเลยในรถม้าขากลับ"); } },
    ],
  },
  {
    id: "c18.m.royal_mistress",
    minAge: 20,
    maxAge: 35,
    weight: (l) => (fac(l, "royal") >= 30 && l.stats.looks >= 60 ? W + 2 : 0),
    text: () => "องค์ชายรองส่งดอกกุหลาบสีน้ำเงินมาทุกเช้า — ในราชสำนัก นี่คือคำเชิญให้เป็น 'คนโปรด' ที่ไม่มีวันได้เป็นคู่สมรส",
    choices: [
      { label: "ตอบรับ — อำนาจคืออำนาจ", run: (l) => { addFac(l, "royal", 15); addMoney(l, 120_000); addSoc(l, -6); addRumor(l, "c18.r.favorite", "ลือกันว่าดอกกุหลาบสีน้ำเงินของวังส่งถึงบ้านคุณทุกเช้า", true, false, 4); return meh("คุณได้คฤหาสน์ริมทะเลสาบ เครื่องเพชรสามหีบ และสายตาอิจฉาของทั้งราชสำนัก"); } },
      { label: "ส่งดอกกุหลาบคืนพร้อมบทกวีปฏิเสธที่สุภาพที่สุด", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { addFac(l, "royal", 4); addSoc(l, 5); return good("องค์ชายรองเก็บบทกวีไว้ในลิ้นชัก และเลิกส่งดอกไม้ — แต่เริ่มส่งหนังสือดีๆ มาให้แทน"); } addFac(l, "royal", -8); return bad("บทกวีของคุณใช้คำว่า 'น่าเบื่อ' ในความหมายที่ผิด องค์ชายรองไม่พอใจมาก"); } },
    ],
  },
  {
    id: "c18.m.spouse_politics",
    minAge: 25,
    maxAge: 65,
    weight: (l) => (married(l) ? W : 0),
    text: (l) => `${spouse(l) ? shortName(spouse(l)!) : "คู่สมรส"}กลับบ้านมาด้วยสีหน้าเคร่งเครียด 'สภาขอให้ข้าลงคะแนนต่อต้านวิหาร แต่แม่ข้าเป็นนางชีอาวุโส…' และหันมาถามความเห็นคุณ`,
    choices: [
      { label: "แนะให้ลงคะแนนตามสภา", run: (l) => { addFac(l, "noble", 8); addFac(l, "temple", -6); return meh("คืนวันอาทิตย์ แม่สามีไม่มากินมื้อค่ำ — เป็นครั้งแรกในรอบยี่สิบปี"); } },
      { label: "แนะให้งดออกเสียง", run: (l) => { const p = spouse(l); if (p) p.bond = Math.min(100, p.bond + 10); return good("คู่สมรสของคุณถอนหายใจโล่งอก 'เจ้าเข้าใจข้าเสมอ'"); } },
      { label: "แนะให้ใช้เสียงนี้ต่อรองทั้งสองฝ่าย", check: { stat: "smarts", dc: 55 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { addFac(l, "noble", 5); addFac(l, "temple", 5); addMoney(l, 50_000); return good("วิหารสัญญาจะสร้างโรงพยาบาลในที่ดินของตระกูล สภาสัญญาลดภาษี — เสียงเดียวได้สองอย่าง"); } addFac(l, "noble", -5); addFac(l, "temple", -5); return bad("ทั้งสองฝ่ายรู้ว่าถูกเล่นเกม และคู่สมรสของคุณต้องรับผลแทน"); } },
    ],
  },
  {
    id: "c18.a.estate_choice",
    minAge: 28,
    maxAge: 60,
    weight: (l) => (noble(l) ? W : 0),
    text: () => "ชาวไร่ในที่ดินของตระกูลยื่นฎีกาขอลดค่าเช่าเพราะน้ำท่วม พ่อบ้านเสนอให้ไล่ออกแล้วหาคนใหม่",
    choices: [
      { label: "ลดค่าเช่าครึ่งหนึ่ง", run: (l) => { addMoney(l, -30_000); addSoc(l, 4); addFac(l, "temple", 4); return good("ชาวไร่จัดงานเลี้ยงขอบคุณ ร้องเพลงที่มีชื่อคุณอยู่ในท่อนฮุก"); } },
      { label: "ไล่ออกตามคำแนะนำ", run: (l) => { addMoney(l, 20_000); addSoc(l, -4); addRumor(l, `c18.r.cruel_lord_${l.age}`, "ลือกันว่าเจ้าที่ดินคนหนึ่งไล่ชาวไร่ออกกลางน้ำท่วม", true, false, 3); return bad("รถเข็นของครอบครัวชาวไร่ลุยโคลนออกไปจากที่ดิน — ภาพนี้ไปถึงหน้าหนังสือพิมพ์ฉบับเช้า"); } },
      { label: "ลงไปช่วยซ่อมเขื่อนด้วยตัวเอง", check: { stat: "health", dc: 45 }, run: (l, _c, ok) => { if (ok) { addSoc(l, 8); addFame(l, 4); return good("ภาพเจ้าที่ดินถือพลั่วยืนในโคลน กลายเป็นภาพวาดที่ถูกพูดถึงไปทั่วจักรวรรดิ"); } addStat(l, "health", -5); return meh("คุณลื่นล้มในโคลนสามครั้ง ชาวไร่หัวเราะ แต่ก็ชอบคุณมากขึ้น (สุขภาพ -5)"); } },
    ],
  },
  {
    id: "c18.a.portrait_politics",
    minAge: 25,
    maxAge: 70,
    weight: (l) => (soc(l) >= 50 ? W : 0),
    text: () => "จิตรกรหลวงจะวาดภาพหมู่ 'ผู้มีเกียรติแห่งจักรวรรดิ' ตำแหน่งในภาพสำคัญกว่าตำแหน่งในราชการ — ใครอยู่ใกล้จักรพรรดิ ใครอยู่ในเงา",
    choices: [
      { label: "จ่ายจิตรกรให้วาดคุณใกล้บัลลังก์", run: (l) => { addMoney(l, -20_000); addFac(l, "royal", 6); addFame(l, 4); return meh("ภาพแขวนในห้องโถงใหญ่ คุณยืนห่างจากจักรพรรดิเพียงหนึ่งช่วงแขน — ร้อยปีต่อมานักประวัติศาสตร์จะเดาว่าคุณสำคัญมาก"); } },
      { label: "ขอยืนข้างสังฆราช", run: (l) => { addFac(l, "temple", 6); return meh("ในภาพ คุณยืนในแสงสีทองจากหน้าต่างวิหาร จิตรกรบอกว่าเป็น 'อุบัติเหตุทางแสง'"); } },
      { label: "ขอให้วาดตัวเองหาวอยู่มุมภาพ", run: (l) => { addStat(l, "happiness", 6); addSoc(l, 2); return good("ภาพนี้ถูกพูดถึงมากที่สุดในรอบศตวรรษ — เพราะคนหาวในมุมภาพคือคนเดียวที่ดูเป็นมนุษย์"); } },
    ],
  },
  {
    id: "c18.a.rival_downfall",
    minAge: 28,
    maxAge: 70,
    weight: W,
    title: "คู่ปรับล้ม",
    text: (l) => `${rivalName(l)}คู่ปรับของคุณมาตลอดชีวิต ล้มละลายเพราะลงทุนในเหมืองที่ไม่มีอยู่จริง ทุกคนหันหลังให้ — และวันนี้เขา/เธอยืนอยู่หน้าประตูบ้านคุณ`,
    choices: [
      { label: "เปิดประตูรับ", run: (l) => { addSoc(l, 5); addStat(l, "happiness", 6); const p = createPerson(l, "friend", { age: l.age, bond: 50 }); p.name = rivalName(l); return good("คุณสองคนนั่งดื่มชาโดยไม่พูดอะไรนาน แล้วคู่ปรับก็ร้องไห้ — ศัตรูสามสิบปีกลายเป็นเพื่อนในบ่ายเดียว"); } },
      { label: "ปิดประตู", run: (l) => { addStat(l, "happiness", 2); return meh("คุณเห็นเงาของเขา/เธอยืนนิ่งหน้าประตูนานจนฝนตก — ชัยชนะที่ไม่หวานอย่างที่คิด"); } },
      { label: "เปิดประตู แล้วจ้างเป็นเลขานุการ", run: (l) => { addMoney(l, -10_000); addSoc(l, 3); return meh("คู่ปรับเก่าของคุณเก่งงานเอกสารอย่างน่าประหลาด และรู้ความลับของทุกตระกูลในนครหลวง"); } },
    ],
  },
  {
    id: "c18.a.opera_box",
    minAge: 20,
    maxAge: 70,
    weight: (l) => (noble(l) ? W - 1 : 0),
    text: () => "โรงละครหลวงเปิดประมูลช่องที่นั่งส่วนตัวที่อยู่ตรงข้ามช่องของจักรพรรดิ — ใครนั่งช่องนั้นจะถูกมองตลอดการแสดง มากกว่านักแสดงบนเวที",
    choices: [
      { label: "ประมูลให้ได้", run: (l) => { addMoney(l, -60_000); addSoc(l, 8); addFac(l, "royal", 3); return good("ทุกคืนวันเสาร์ ทั้งโรงละครมองว่าคุณใส่ชุดอะไร คุยกับใคร และหัวเราะตรงไหน"); } },
      { label: "ปล่อยให้คู่แข่งได้ไป แล้วนั่งแถวหน้าธรรมดา", run: (l) => { addStat(l, "happiness", 3); return meh("คุณดูละครได้ชัดที่สุดในชีวิต และคู่แข่งของคุณปวดคอจากการหันไปยิ้มให้จักรพรรดิ"); } },
    ],
  },
  {
    id: "c18.a.court_poet",
    minAge: 20,
    maxAge: 60,
    weight: W - 1,
    text: () => "กวีราชสำนักแต่งกลอนล้อเลียนคุณ อ่านในงานเลี้ยงหลวงต่อหน้าแขกสามร้อยคน — ทุกคนหัวเราะ รวมทั้งจักรพรรดิ",
    choices: [
      { label: "ลุกขึ้นแต่งกลอนตอบกลับสดๆ", check: { stat: "smarts", dc: 60 }, skill: ["perform", "social"], run: (l, _c, ok) => { if (ok) { addSoc(l, 10); addFac(l, "royal", 5); return good("กลอนของคุณเจ็บกว่า ตลกกว่า และสัมผัสดีกว่า กวีราชสำนักลาออกในวันรุ่งขึ้น"); } addSoc(l, -6); return bad("คุณติดคำสัมผัสคำว่า 'ส้ม' ห้องเงียบไปสามวินาทีก่อนจะหัวเราะหนักกว่าเดิม"); } },
      { label: "หัวเราะด้วยอย่างมีน้ำใจ", run: (l) => { addSoc(l, 3); return meh("คนที่หัวเราะเยาะตัวเองได้ คือคนที่ไม่มีใครเยาะได้นาน"); } },
    ],
  },
  {
    id: "c18.a.loan_shark_duke",
    minAge: 25,
    maxAge: 60,
    weight: (l) => (l.money < 20_000 && noble(l) ? W + 3 : 0),
    text: () => "ตระกูลของคุณกำลังร่อแร่ทางการเงิน ดยุกพ่อค้าเงินกู้เสนอให้ยืมโดยไม่มีดอกเบี้ย — 'ข้าขอแค่สิทธิ์เสนอชื่อหนึ่งครั้งในอนาคต'",
    choices: [
      { label: "รับเงินกู้", run: (l) => { addMoney(l, 200_000); l.flags.c18DukeFavor = true; return meh(`${money(l, 200_000)} เข้าบัญชีภายในวัน และคุณรู้สึกเหมือนเซ็นสัญญากับปีศาจที่สุภาพมาก`); } },
      { label: "ปฏิเสธ แล้วขายเครื่องเพชรประจำตระกูล", run: (l) => { addMoney(l, 80_000); addSoc(l, -4); addStat(l, "happiness", -4); return meh("มงกุฎของย่าทวดไปอยู่ในตู้กระจกของภรรยาพ่อค้า — คุณเห็นมันทุกงานเลี้ยง"); } },
    ],
  },
  {
    id: "c18.a.duke_favor_called",
    minAge: 27,
    maxAge: 70,
    weight: (l) => (l.flags.c18DukeFavor ? 20 : 0),
    text: () => "ดยุกพ่อค้าเงินกู้มาทวงสิทธิ์เสนอชื่อ: เขาต้องการให้คุณเสนอชื่อลูกชายของเขาเข้าตำแหน่งเสนาบดีคลัง — คนที่ไม่รู้แม้แต่วิธีนับเงินทอน",
    choices: [
      { label: "เสนอชื่อตามสัญญา", run: (l) => { l.flags.c18DukeFavor = false; addSoc(l, -5); addFac(l, "royal", -5); return bad("เสนาบดีคลังคนใหม่ทำงบประมาณขาดดุลในสามเดือน ทุกคนรู้ว่าใครเสนอชื่อ"); } },
      { label: "เสนอชื่อ แล้วแอบส่งที่ปรึกษาเก่งๆ ไปคุมเขา", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { l.flags.c18DukeFavor = false; if (ok) { addFac(l, "royal", 6); addSoc(l, 4); return good("ที่ปรึกษาของคุณทำงานแทนเขาทุกอย่าง กระทรวงคลังดีที่สุดในรอบสิบปี — และดยุกเป็นหนี้คุณแทน"); } addSoc(l, -3); return bad("ลูกชายดยุกไล่ที่ปรึกษาออกในวันแรก 'ข้าไม่ต้องการพี่เลี้ยง'"); } },
      { label: "ผิดสัญญา แล้วคืนเงินเป็นงวด", run: (l) => { l.flags.c18DukeFavor = false; addMoney(l, -150_000); addFac(l, "noble", -10); return meh("ดยุกรับเงินคืนด้วยรอยยิ้มบางๆ และจดชื่อคุณลงในสมุดเล่มที่คนเรียกว่า 'สมุดสีดำ'"); } },
    ],
  },
  {
    id: "c18.a.child_debut",
    minAge: 35,
    maxAge: 60,
    weight: (l) => (kids(l).some((k) => k.age >= 16 && k.age <= 19) ? W + 3 : 0),
    title: "งานเปิดตัวสังคมของลูก",
    text: () => "ลูกของคุณเปิดตัวสู่สังคมปีนี้ ความนิยมของพ่อแม่คือบันไดขั้นแรก — หรือโซ่ตรวนเส้นแรก",
    choices: [
      { label: "ใช้เส้นสายทั้งหมดให้ลูกเป็นดาวเด่น", run: (l) => { addMoney(l, -50_000); const k = kids(l).find((x) => x.age >= 16); if (k) k.bond = Math.min(100, k.bond + (soc(l) >= 50 ? 10 : -5)); return soc(l) >= 50 ? good("ลูกของคุณเต้นรำกับองค์ชายรองในเพลงแรก ทั้งห้องโถงปรบมือ — มรดกของคุณส่งต่อแล้ว") : bad("ชื่อเสียงของคุณตามไปถึงงานของลูก ครึ่งห้องเมินหน้า ลูกร้องไห้ในรถม้าขากลับ"); } },
      { label: "ปล่อยให้ลูกเดินทางของตัวเอง", run: (l) => { const k = kids(l).find((x) => x.age >= 16); if (k) k.bond = Math.min(100, k.bond + 8); addStat(l, "happiness", 4); return meh("ลูกของคุณไม่ได้เป็นดาวเด่น แต่ได้เพื่อนจริงสามคน ซึ่งหายากกว่ามาก"); } },
    ],
  },
  {
    id: "c18.a.rumor_child",
    minAge: 30,
    maxAge: 60,
    weight: (l) => (kids(l).length && badRumors(l).length ? W + 2 : 0),
    text: () => "ลูกของคุณกลับจากโรงเรียนพร้อมน้ำตา เพื่อนๆ ล้อเรื่องข่าวลือเกี่ยวกับพ่อแม่ที่ลอยอยู่ในวงน้ำชา",
    choices: [
      { label: "อธิบายความจริงให้ลูกฟังทั้งหมด", run: (l) => { const k = kids(l)[0]; if (k) k.bond = Math.min(100, k.bond + 12); return good("ลูกฟังจบแล้วพูดว่า 'งั้นเราจะไม่แพ้พวกเขาใช่ไหม' — คุณรู้ว่าลูกโตขึ้นในคืนนั้น"); } },
      { label: "ไปคุยกับพ่อแม่ของเด็กที่ล้อ", check: { stat: "smarts", dc: 50 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { addSoc(l, 3); return good("พ่อแม่ของเด็กคนนั้นขอโทษ และสั่งให้ลูกขอโทษต่อหน้าชั้นเรียน"); } addSoc(l, -3); return bad("การคุยกลายเป็นการทะเลาะ ข่าวลือใหม่เกิดขึ้นจากเรื่องนี้"); } },
    ],
  },
  {
    id: "c18.a.ambassador",
    minAge: 28,
    maxAge: 60,
    weight: (l) => (fac(l, "royal") >= 35 ? W + 2 : 0),
    title: "ทูตไปต่างแดน",
    text: () => "จักรพรรดิแต่งตั้งคุณเป็นทูตไปราชสำนักของอาณาจักรทางทะเล ภารกิจ: ป้องกันไม่ให้พวกเขาเป็นพันธมิตรกับวิหาร",
    choices: [
      { label: "ทำภารกิจด้วยการทูตอย่างประณีต", check: { stat: "smarts", dc: 60 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { addFac(l, "royal", 15); addFac(l, "temple", -6); addFame(l, 12); addMoney(l, 80_000); return big("สนธิสัญญาสามทะเลถูกลงนาม — ราชวงศ์ได้พันธมิตรทางเรือ ส่วนวิหารได้จดหมายแสดงความเสียใจ"); } addFac(l, "royal", -8); return bad("คุณเผลอชมภรรยาของกษัตริย์ต่างแดนผิดธรรมเนียม — ซึ่งในวัฒนธรรมนั้นแปลว่าท้าดวล"); } },
      { label: "แอบตกลงกับวิหารลับหลังจักรพรรดิ", run: (l) => { addFac(l, "temple", 15); addFac(l, "royal", -5); l.flags.c18Secret = "treaty"; return meh("สนธิสัญญามีสองฉบับ — ฉบับที่จักรพรรดิเห็น และฉบับที่สังฆราชเก็บไว้"); } },
      { label: "ปฏิเสธตำแหน่ง", run: (l) => { addFac(l, "royal", -6); return meh("ตำแหน่งตกเป็นของคนอื่น และอาณาจักรทางทะเลก็เป็นพันธมิตรกับวิหารในปีต่อมา"); } },
    ],
  },
  {
    id: "c18.a.masquerade_murder",
    minAge: 22,
    maxAge: 65,
    weight: W - 1,
    title: "ศพในงานหน้ากาก",
    text: () => "ในงานเต้นรำหน้ากาก มีคนพบศพบารอนในห้องสมุด ประตูทุกบานถูกล็อก แขกทั้งหมดต้องอยู่ในคฤหาสน์จนกว่าจะพบคนร้าย — และหน้ากากของคุณมีคราบไวน์แดงที่ดูเหมือนเลือด",
    choices: [
      { label: "สืบหาคนร้ายเอง", check: { stat: "smarts", dc: 60 }, skill: ["study"], run: (l, _c, ok) => { if (ok) { addFame(l, 10); addSoc(l, 8); return good("คนร้ายคือภรรยาของบารอนเอง — คุณสังเกตว่านางรู้ว่าศพอยู่ห้องไหนก่อนมีใครบอก"); } addSoc(l, -8); addRumor(l, `c18.r.murder_suspect_${l.age}`, "ลือกันว่าคุณคือผู้ต้องสงสัยหมายเลขหนึ่งในคดีศพงานหน้ากาก", true, false, 4); return bad("ทฤษฎีของคุณผิด และคราบไวน์บนหน้ากากทำให้ทุกคนจ้องคุณแทน"); } },
      { label: "ล้างหน้ากากในห้องน้ำอย่างเงียบๆ", check: { stat: "luck", dc: 45 }, run: (l, _c, ok) => (ok ? meh("ไม่มีใครเห็น คนร้ายถูกจับได้ในรุ่งเช้า คุณกลับบ้านอย่างหมดแรง") : (addRumor(l, `c18.r.mask_wash_${l.age}`, "ลือกันว่ามีคนแอบล้างคราบเลือดออกจากหน้ากากในคืนเกิดเหตุ", true, false, 4), bad("สาวใช้เห็นคุณล้างคราบแดง เรื่องนี้ไปถึงหูตำรวจหลวงก่อนเช้า"))) },
    ],
  },
  {
    id: "c18.a.charity_hospital",
    minAge: 30,
    maxAge: 75,
    weight: (l) => (l.money >= 200_000 ? W : 0),
    text: () => "คุณมีเงินพอจะสร้างโรงพยาบาลการกุศล แต่ต้องเลือกว่าจะให้ใครดูแล: วิหาร (มีหมอและนางพยาบาล) วังหลวง (มีงบประมาณ) หรือสมาคมแพทย์อิสระ (ไม่มีอะไรนอกจากความรู้)",
    choices: [
      { label: "ยกให้วิหาร", run: (l) => { addMoney(l, -150_000); addFac(l, "temple", 15); addSoc(l, 6); return good("โรงพยาบาลเปิดพร้อมระฆังและบทสวด ผู้ป่วยหายเร็วขึ้น — หรืออย่างน้อยก็รู้สึกได้รับพร"); } },
      { label: "ยกให้วังหลวง", run: (l) => { addMoney(l, -150_000); addFac(l, "royal", 15); addSoc(l, 6); return good("ป้ายหน้าโรงพยาบาลเขียนว่า 'โรงพยาบาลหลวง' ตัวใหญ่ และชื่อคุณตัวเล็กกว่ามากอยู่ข้างใต้"); } },
      { label: "ยกให้แพทย์อิสระ", run: (l) => { addMoney(l, -150_000); addSoc(l, 10); addFame(l, 6); addFac(l, "temple", -4); return good("แพทย์อิสระค้นพบวิธีรักษาไข้ทรพิษในปีที่สาม — วิหารไม่พอใจที่ไม่ใช่ปาฏิหาริย์ แต่ทั้งจักรวรรดิรู้ชื่อคุณ"); } },
    ],
  },
  {
    id: "c18.a.secret_child",
    minAge: 30,
    maxAge: 60,
    weight: (l) => (Math.abs(l.seed) % 3 === 0 ? W - 1 : 0),
    maxTimes: 1,
    text: () => "เด็กหญิงอายุแปดขวบมาเคาะประตูพร้อมจดหมายจากแม่ที่เสียชีวิตแล้ว ในจดหมายอ้างว่าเด็กคนนี้เป็นลูกนอกสมรสของพ่อคุณ — น้องต่างแม่ของคุณ",
    choices: [
      { label: "รับเข้าบ้าน", run: (l) => { createPerson(l, "sibling", { gender: "f", age: 8, bond: 50 }); addSoc(l, -4); addStat(l, "happiness", 5); addRumor(l, "c18.r.bastard", "ลือกันว่าตระกูลของคุณรับลูกนอกสมรสเข้าบ้าน", true, false, 3); return good("น้องสาวคนใหม่กอดตุ๊กตาผ้าเก่าแน่น และไม่ยอมปล่อยมือคุณตลอดคืนแรก"); } },
      { label: "ให้เงินแล้วส่งไปโรงเรียนประจำ", run: (l) => { addMoney(l, -30_000); return meh("เด็กหญิงเขียนจดหมายมาทุกเดือน คุณอ่านทุกฉบับ แต่ตอบแค่บางฉบับ"); } },
    ],
  },
];

