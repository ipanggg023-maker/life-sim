// M20 — คนในฐาน: ความรัก คู่แข่ง ลูกศิษย์ ครอบครัว และคนที่ไม่ได้กลับมา
import type { GameEvent } from "../../engine/events";
import { chance, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addStat, clamp, createPerson, people, shortName } from "../../engine/util";
import { gainExp } from "../hunter/power";
import { ROLE_INFO, addRes, bumpLoyalty, getBase, removeResident, withBase, type Role } from "./base";
import { residentToPartner } from "./m20core";
import { missingPerson } from "./scenario";
import { B, L, bad, baseName, big, good, hasRole, meh, pickRes, who } from "./m20kit";

const inB = (min = 14, extra?: (l: Life) => boolean) => ({ minAge: min, maxAge: 200, when: (l: Life) => B(l) && (!extra || extra(l)) });
const single = (l: Life) => !l.people.some((p) => (p.relation === "partner" || p.relation === "spouse") && p.alive);
const setRole = (l: Life, rid: number, role: Role) => withBase(l, (b) => { const r = b.res.find((x) => x.id === rid); if (r) r.role = role; });
const setTag = (l: Life, rid: number, tag: "rival" | undefined) => withBase(l, (b) => { const r = b.res.find((x) => x.id === rid); if (r) r.tag = tag; });

export const M20_PEOPLE: GameEvent[] = [
  {
    id: "a20.p.doctor_love",
    ...inB(18, (l) => single(l) && hasRole(l, ["doctor"])),
    title: "เวรดึกในห้องพยาบาล",
    prepare: (l) => pickRes(l, ["doctor"]),
    text: (l, c) => `หลังเย็บแผลให้คนเจ็บคนที่สิบสองของคืน หมอ${who(l, c)}นั่งพิงผนังข้างคุณ ส่งกาแฟสำเร็จรูปแก้วสุดท้ายให้ "แบ่งกันคนละครึ่งไหม"`,
    choices: [
      { label: "จับมือเขาไว้", check: { stat: "looks", dc: 45 }, skill: ["social"], run: (l, c, ok) => { if (ok) { residentToPartner(l, Number(c.rid)); addStat(l, "happiness", 12); return good(`กาแฟเย็นชืดไปแล้ว แต่ไม่มีใครปล่อยมือ — ตั้งแต่คืนนั้น ${c.name}คือคนรักของคุณ`); } return meh(`${c.name}ยิ้มแล้วลุกไปดูคนไข้ "ไว้ถ้าโลกไม่แตกแล้วค่อยว่ากันนะ"`); } },
      { label: "ดื่มกาแฟเงียบๆ ด้วยกัน", run: (l, c) => { bumpLoyalty(l, Number(c.rid), 15); return meh(`คุณสองคนนั่งเงียบจนฟ้าสาง ความเงียบแบบนั้นหายากในวันสิ้นโลก${addRes(l, { med: 2 })}`); } },
    ],
  },
  {
    id: "a20.p.confession",
    ...inB(16, single),
    maxTimes: 2,
    title: "คำสารภาพบนดาดฟ้า",
    prepare: (l) => pickRes(l, ["mechanic", "soldier", "farmer", "teacher", "merchant"]),
    text: (l, c) => `ดาวเต็มฟ้าคืนนี้ ${who(l, c)}ยื่นแหวนที่ดัดจากลวดทองแดงให้ "ฉันไม่รู้ว่าพรุ่งนี้เราจะยังอยู่ไหม — เลยต้องพูดวันนี้"`,
    choices: [
      { label: "รับแหวน", run: (l, c) => { residentToPartner(l, Number(c.rid)); addStat(l, "happiness", 14); return good(`ลวดทองแดงคมนิดหน่อย แต่พอดีนิ้ว — คนทั้งฐานรู้ข่าวก่อนเช้า${addRes(l, { morale: 6 })}`); } },
      { label: "ปฏิเสธอย่างอ่อนโยน", run: (l, c) => { bumpLoyalty(l, Number(c.rid), -5); return meh(`${c.name}พยักหน้า ยังเรียกคุณว่าเพื่อนเหมือนเดิม แต่ไม่มองตาคุณไปหลายวัน`); } },
    ],
  },
  {
    id: "a20.p.rival_rise",
    ...inB(16, (l) => L(l) && !getBase(l)!.res.some((r) => r.tag === "rival") && hasRole(l, ["soldier", "merchant"])),
    title: "คนที่อยากนั่งเก้าอี้คุณ",
    prepare: (l) => pickRes(l, ["soldier", "merchant"]),
    text: (l, c) => `ในการประชุมฐาน ${who(l, c)}ลุกขึ้นค้านทุกข้อเสนอของคุณต่อหน้าทุกคน และมีคนปรบมือให้มากกว่าที่คุณคาด`,
    choices: [
      { label: "ให้ตำแหน่งรองผู้นำ — ดึงศัตรูมาใกล้ตัว", run: (l, c) => { bumpLoyalty(l, Number(c.rid), 25); return good(`${c.name}เงียบไปพักหนึ่ง แล้วยื่นมือมาจับ "ผมจะทำให้ดีกว่าที่คุณคิด"${addRes(l, { morale: 4 })}`); } },
      { label: "โต้กลับด้วยตัวเลข", check: { stat: "smarts", dc: 55 }, run: (l, c, ok) => { if (ok) return good(`คุณกางบัญชีเสบียงทุกหน้า — ทุกคนเห็นว่าใครทำงานจริง ${c.name}นั่งลงเงียบๆ${addRes(l, { morale: 5 })}`); setTag(l, Number(c.rid), "rival"); bumpLoyalty(l, Number(c.rid), -20); return bad(`ตัวเลขน่าเบื่อเกินไป คนฟังหลับไปครึ่งห้อง — ${c.name}กลายเป็นคู่แข่งชิงอำนาจของคุณอย่างเปิดเผย`); } },
      { label: "ปล่อยให้พูดไป", run: (l, c) => { setTag(l, Number(c.rid), "rival"); return meh(`${c.name}ได้ผู้ติดตามเพิ่มทุกสัปดาห์${addRes(l, { morale: -3 })}`); } },
    ],
  },
  {
    id: "a20.p.rival_end",
    ...inB(16, (l) => L(l) && getBase(l)!.res.some((r) => r.tag === "rival")),
    weight: 14,
    title: "คู่แข่งในฐาน",
    prepare: (l) => { const r = getBase(l)!.res.find((x) => x.tag === "rival")!; return { rid: r.id, name: r.n }; },
    text: (l, c) => `${who(l, c)}ถูกสัตว์อสูรล้อมอยู่นอกกำแพงระหว่างออกสำรวจ — ไม่มีใครเห็นนอกจากคุณบนหอสังเกตการณ์`,
    choices: [
      { label: "กระโดดลงไปช่วย", tone: "danger", check: { stat: "health", dc: 50 }, survival: () => 0.92, skill: ["combat"], run: (l, c, ok) => { if (ok) { setTag(l, Number(c.rid), undefined); bumpLoyalty(l, Number(c.rid), 80); gainExp(l, 300); return big(`คุณลากเขากลับเข้ากำแพง ${c.name}ร้องไห้ "ทำไมช่วยผม" — "เพราะคุณเป็นคนของฐานนี้" ตั้งแต่วันนั้นเขาคือคนที่ภักดีที่สุดของคุณ`); } return bad(`คุณช่วยไม่ทัน${(removeResident(l, Number(c.rid)), addRes(l, { morale: -4 }))}`); } },
      { label: "แกล้งมองไม่เห็น", run: (l, c) => { removeResident(l, Number(c.rid)); addStat(l, "happiness", -12); return bad(`${c.name}ไม่ได้กลับมา คุณได้ฐานคืนทั้งหมด และฝันร้ายทุกคืน`); } },
    ],
  },
  {
    id: "a20.p.orphan_student",
    ...inB(18, (l) => hasRole(l, ["kid"])),
    title: "ลูกศิษย์ตัวเล็ก",
    prepare: (l) => pickRes(l, ["kid"]),
    text: (l, c) => `${who(l, c)}เด็กกำพร้าในฐาน ถือไม้กวาดมาเป็นดาบ แล้วคุกเข่าตรงหน้าคุณ "สอนหนูสู้ได้ไหม หนูไม่อยากซ่อนใต้เตียงอีกแล้ว"`,
    choices: [
      { label: "สอนทุกเช้า", run: (l, c) => { bumpLoyalty(l, Number(c.rid), 20); l.flags.a20pupil = Number(c.rid); addStat(l, "happiness", 6); return good(`${c.name}ล้มวันละร้อยครั้ง และลุกวันละร้อยครั้ง`); } },
      { label: "ส่งไปห้องเรียนแทน", run: (_l, c) => meh(`${c.name}ทำหน้ามุ่ย แต่ไป — สามเดือนต่อมาเขาอ่านหนังสือออกเป็นคนแรกของรุ่น`) },
    ],
  },
  {
    id: "a20.p.kid_grows",
    ...inB(20, (l) => hasRole(l, ["kid"]) && Number(l.flags.baseFounded ?? 999) + 4 <= l.age),
    maxTimes: 3,
    title: "เด็กที่โตในซากเมือง",
    prepare: (l) => pickRes(l, ["kid"]),
    text: (l, c) => `${who(l, c)}ที่เคยเป็นเด็กกำพร้าตัวเล็ก ตอนนี้สูงเกือบเท่าคุณแล้ว — ถึงเวลาที่ฐานต้องให้หน้าที่`,
    choices: [
      { label: "ให้เป็นยามแนวหน้า", run: (l, c) => { setRole(l, Number(c.rid), "soldier"); return good(`${c.name}ใส่เกราะที่คุณเคยใส่ตอนอายุเท่ากัน${addRes(l, { morale: 4 })}`); } },
      { label: "ให้ช่วยหมอในห้องพยาบาล", run: (l, c) => { setRole(l, Number(c.rid), "doctor"); return good(`${c.name}มือนิ่งกว่าหมอบางคน${addRes(l, { med: 2 })}`); } },
      { label: "ให้ไปอยู่กับช่างในเวิร์กช็อป", run: (l, c) => { setRole(l, Number(c.rid), "mechanic"); return good(`${c.name}ประกอบวิทยุจากซากมือถือได้ในสัปดาห์แรก${addRes(l, { mat: 3 })}`); } },
    ],
  },
  {
    id: "a20.p.reunion",
    ...inB(10, (l) => !!missingPerson(l)),
    weight: 18,
    title: "คนที่ยืนอยู่หน้าประตู",
    prepare: (l) => ({ name: shortName(missingPerson(l)!) }),
    text: (l, c) => `ยามวิ่งมาตามคุณ "มีคนบอกว่าเป็นครอบครัวของผู้นำ" — คนที่ยืนอยู่หน้าประตู${baseName(l)}ผอมจนแทบจำไม่ได้ แต่คุณรู้ทันทีว่าคือ${c.name}`,
    choices: [
      { label: "วิ่งออกไป", run: (l, c) => { const p = missingPerson(l)!; delete l.flags.missingId; p.bond = 100; addStat(l, "happiness", 25); return big(`${c.name}เดินตามชื่อ${baseName(l)}ที่ผู้รอดชีวิตพูดกันปากต่อปากมาหลายร้อยกิโล — ฐานของคุณกลายเป็นที่ที่คนตามหากันเจอ${addRes(l, { morale: 10 })}`); } },
    ],
  },
  {
    id: "a20.p.sibling_deputy",
    ...inB(16, (l) => L(l) && people(l, "sibling").length > 0),
    prepare: (l) => ({ name: shortName(people(l, "sibling")[0]) }),
    text: (_l, c) => `${c.name}ขอเป็นรองผู้นำ "ฉันรู้จักนายดีกว่าใครในโลก ถ้านายตัดสินใจผิด ฉันจะเป็นคนแรกที่บอก"`,
    choices: [
      { label: "ตกลง", run: (l, c) => { const s = people(l, "sibling")[0]; s.bond = clamp(s.bond + 15, 0, 100); return good(`${c.name}ด่าคุณต่อหน้าที่ประชุมสามครั้งในเดือนแรก — และถูกทั้งสามครั้ง${addRes(l, { morale: 6 })}`); } },
      { label: "ไม่ — ไม่อยากให้ใครหาว่าเล่นพวก", run: (l, c) => { const s = people(l, "sibling")[0]; s.bond = clamp(s.bond - 8, 0, 100); return meh(`${c.name}เข้าใจ แต่ไม่ทักคุณที่โรงอาหารไปสองอาทิตย์`); } },
    ],
  },
  {
    id: "a20.p.parent_farm",
    ...inB(16, (l) => l.people.some((p) => (p.relation === "mother" || p.relation === "father") && p.alive)),
    prepare: (l) => ({ name: shortName(l.people.find((p) => (p.relation === "mother" || p.relation === "father") && p.alive)!) }),
    text: (_l, c) => `${c.name}อาสาดูแลแปลงผักในฐาน ทั้งที่หลังไม่ค่อยดี ทุกเย็นจะเก็บผักที่สวยที่สุดไว้ให้คุณหนึ่งกำ`,
    choices: [
      { label: "ไปช่วยรดน้ำทุกเย็น", run: (l, c) => { const p = l.people.find((x) => shortName(x) === c.name); if (p) p.bond = clamp(p.bond + 12, 0, 100); addStat(l, "happiness", 8); return good(`ผู้นำฐานถือบัวรดน้ำอยู่ข้าง${c.name}ทุกเย็น — คนในฐานบอกว่าภาพนี้ทำให้มีหวัง${addRes(l, { food: 4, morale: 4 })}`); } },
      { label: "ขอให้พักบ้าง", run: (_l, c) => meh(`${c.name}บอกว่า "ถ้าพักแล้วจะทำอะไร นั่งรอโลกแตกรอบสองเหรอ"`) },
    ],
  },
  {
    id: "a20.p.bodyguard",
    ...inB(16, (l) => hasRole(l, ["soldier"])),
    prepare: (l) => pickRes(l, ["soldier"]),
    text: (l, c) => `ระหว่างตรวจกำแพง ลูกธนูของแก๊งปล้นพุ่งมาจากความมืด — ${who(l, c)}กระโดดขวางหน้าคุณ`,
    choices: [
      { label: "แบกเขาไปห้องพยาบาล", check: { stat: "luck", dc: 45, bonus: (l) => getBase(l)!.b.clinic * 0.1 }, skill: ["heal", "medical"], run: (l, c, ok) => { if (ok) { bumpLoyalty(l, Number(c.rid), 30); return good(`ลูกธนูพลาดหัวใจไปสองนิ้ว ${c.name}ตื่นมาถามคำแรกว่า "ผู้นำปลอดภัยไหม"${addRes(l, { med: -3 })}`); } removeResident(l, Number(c.rid)); addStat(l, "happiness", -10); return bad(`${c.name}จับมือคุณไว้จนลมหายใจสุดท้าย${addRes(l, { morale: -6 })}`); } },
    ],
  },
  {
    id: "a20.p.dying",
    ...inB(16),
    prepare: (l) => pickRes(l),
    text: (l, c) => `แผลที่ขาของ${who(l, c)}ติดเชื้อจนดำ หมอบอกว่าต้องใช้ยาปฏิชีวนะห้าหน่วย — ยาในคลังมี ${getBase(l)!.med}`,
    choices: [
      { label: "ใช้ยา", show: (l) => getBase(l)!.med >= 5, run: (l, c) => { bumpLoyalty(l, Number(c.rid), 20); return good(`${c.name}รอด และเดินกะเผลกไปขอบคุณคุณทุกเช้า${addRes(l, { med: -5 })}`); } },
      { label: "ตัดขาทิ้ง", run: (l, c) => { addStat(l, "happiness", -4); return meh(`${c.name}รอด ช่างในฐานทำขาเทียมจากท่อประปาให้${addRes(l, { mat: -3, morale: -2 })}`); } },
      { label: "เก็บยาไว้ให้คนที่มีโอกาสรอดมากกว่า", run: (l, c) => { removeResident(l, Number(c.rid)); addStat(l, "happiness", -8); return bad(`${c.name}เข้าใจ — นั่นแหละที่ทำให้มันเจ็บที่สุด`); } },
    ],
  },
  {
    id: "a20.p.triangle",
    ...inB(16),
    title: "รักสามเส้าในวันสิ้นโลก",
    text: () => "ช่างหนุ่มกับอดีตทหารต่อยกันกลางโรงอาหารเพราะผู้หญิงคนเดียวกัน ทั้งคู่เป็นกำลังสำคัญของฐาน — และผู้หญิงคนนั้นยืนกอดอกมองอยู่ด้วยสีหน้าเบื่อหน่าย",
    choices: [
      { label: "ถามผู้หญิงคนนั้นว่าต้องการอะไร", run: (l) => { addStat(l, "happiness", 4); return good(`"ฉันต้องการให้สองคนนี้เลิกทำตัวเป็นไก่ชน แล้วไปซ่อมกำแพง" — ทั้งโรงอาหารปรบมือ${addRes(l, { morale: 6, mat: 4 })}`); } },
      { label: "ให้ทั้งคู่ไปเฝ้ายามกะเดียวกันหนึ่งเดือน", run: (l) => meh(`หนึ่งเดือนต่อมา สองคนนั้นกลายเป็นเพื่อนสนิท และเลิกสนใจผู้หญิงคนนั้นทั้งคู่${addRes(l, { morale: 3 })}`) },
    ],
  },
  {
    id: "a20.p.invention",
    ...inB(16, (l) => L(l) && hasRole(l, ["mechanic"])),
    prepare: (l) => pickRes(l, ["mechanic"]),
    text: (l, c) => `${who(l, c)}ลากเครื่องประหลาดมาโชว์ — หน้าไม้ยิงอัตโนมัติจากมอเตอร์เครื่องซักผ้า \"ขอวัสดุอีกแปดหน่วย ผมจะติดรอบกำแพงทั้งฐาน\"`,
    choices: [
      { label: "อนุมัติ", show: (l) => getBase(l)!.mat >= 8, check: { stat: "luck", dc: 40 }, run: (l, c, ok) => { if (ok) { withBase(l, (b) => { b.mat -= 8; if (b.b.wall < 5) b.b.wall++; }); return good(`หน้าไม้ยิงทะลุหัวสัตว์อสูรได้จากร้อยเมตร — กำแพงขึ้นเป็น Lv.${getBase(l)!.b.wall} ${c.name}ได้ฉายาว่า 'เทพเครื่องซักผ้า'`); } withBase(l, (b) => { b.mat -= 8; }); return bad(`ต้นแบบระเบิดตอนทดสอบ คิ้วของ${c.name}หายไปข้างหนึ่ง`); } },
      { label: "ขอดูต้นแบบยิงก่อน", run: (_l, c) => meh(`หน้าไม้ยิงโดนถังน้ำของฐานแตก ${c.name}บอกว่า "ยังปรับศูนย์ไม่เสร็จ"`) },
    ],
  },
  {
    id: "a20.p.teacher_story",
    ...inB(16, (l) => hasRole(l, ["teacher"])),
    prepare: (l) => pickRes(l, ["teacher"]),
    text: (l, c) => `ครู${who(l, c)}ขอให้คุณไปสอนวิชา "ประวัติศาสตร์วันสิ้นโลก" ให้เด็กๆ — "พวกเขาควรรู้ว่าทำไมโลกเป็นแบบนี้ จากคนที่อยู่ตรงนั้นจริง"`,
    choices: [
      { label: "สอนความจริง แม้จะโหดร้าย", skill: ["study", "social"], check: { stat: "smarts", dc: 45 }, run: (l, _c, ok) => good(ok ? `เด็กๆ ฟังนิ่ง แล้วเด็กคนหนึ่งถามว่า "ถ้าโลกพังอีก เราจะไม่ทิ้งกันใช่ไหม"${addRes(l, { morale: 6 })}` : `คุณพูดวกวนจนเด็กหลับ — ครูบอกว่าครั้งแรกของทุกคนก็เป็นแบบนี้${addRes(l, { morale: 2 })}`) },
      { label: "เล่าเฉพาะเรื่องที่ทำให้ยิ้มได้", run: (l) => { addStat(l, "happiness", 5); return meh(`คุณเล่าเรื่องดวงดาวที่แพ้พนันจนตกเก้าอี้ ทั้งห้องหัวเราะ${addRes(l, { morale: 4 })}`); } },
    ],
  },
  {
    id: "a20.p.soldier_night",
    ...inB(16, (l) => hasRole(l, ["soldier"])),
    prepare: (l) => pickRes(l, ["soldier"]),
    text: (l, c) => `${who(l, c)}อดีตทหารที่เก่งที่สุดในฐาน ตัวแข็งทื่อทุกครั้งที่ได้ยินเสียงฟ้าร้อง คืนนี้เขาซ่อนตัวอยู่ใต้บันไดพร้อมปืนที่ขึ้นนก`,
    choices: [
      { label: "นั่งลงข้างเขา แล้วเล่าเรื่องไร้สาระจนพายุผ่าน", check: { stat: "looks", dc: 40 }, skill: ["social", "heal"], run: (l, c, ok) => { bumpLoyalty(l, Number(c.rid), ok ? 25 : 8); return ok ? good(`ตอนฟ้าสาง เขาปลดนกปืนแล้วหัวเราะกับมุกห่วยๆ ของคุณ`) : meh("เขาไม่ได้ฟังสักคำ แต่ก็ไม่ได้ยิงใคร"); } },
      { label: "ปลดอาวุธเขาแล้วให้พัก", run: (l, c) => { bumpLoyalty(l, Number(c.rid), -10); return meh(`${c.name}รู้สึกอับอาย แต่ไม่มีใครเจ็บตัว${addRes(l, { morale: -1 })}`); } },
    ],
  },
  {
    id: "a20.p.merchant_scheme",
    ...inB(16, (l) => L(l) && hasRole(l, ["merchant"]) && getBase(l)!.allies > 0),
    prepare: (l) => pickRes(l, ["merchant"]),
    text: (l, c) => `${who(l, c)}กระซิบแผน: ขายน้ำผสมน้ำฝนให้ฐานพันธมิตรในราคาน้ำสะอาด \"เขาไม่มีทางรู้ เราได้กำไรเห็นๆ\"`,
    choices: [
      { label: "ไม่มีทาง", run: (l, c) => { bumpLoyalty(l, Number(c.rid), -5); return good(`${c.name}ยักไหล่ "ผู้นำซื่อเกินไป" แต่คนในฐานที่ได้ยินชื่นชมคุณ${addRes(l, { morale: 4 })}`); } },
      { label: "ลองดู", check: { stat: "luck", dc: 55 }, run: (l, _c, ok) => { if (ok) return meh(`ได้ของกลับมาเยอะ และไม่มีใครรู้ — ยัง${addRes(l, { food: 15, med: 4 })}`); withBase(l, (b) => { b.allies = Math.max(0, b.allies - 1); b.feud += 15; }); addFame(l, -5); return bad("ฐานพันธมิตรตรวจน้ำแล้วพบ — พวกเขาตัดความสัมพันธ์ และเล่าเรื่องนี้ให้ทุกฐานฟัง"); } },
    ],
  },
  {
    id: "a20.p.priest_doubt",
    ...inB(16, (l) => hasRole(l, ["priest"])),
    prepare: (l) => pickRes(l, ["priest"]),
    text: (l, c) => `${who(l, c)}ผู้นำศรัทธาที่ปลอบใจทุกคนในฐาน มาหาคุณกลางดึก \"ถ้าดวงดาวคือพระเจ้า แล้วพวกมันทำแบบนี้เพื่อความบันเทิง… ผมจะสวดให้ใครฟัง\"`,
    choices: [
      { label: "\"สวดให้คนในฐานฟัง พวกเขาได้ยินจริง\"", run: (l, c) => { bumpLoyalty(l, Number(c.rid), 20); return good(`เขานิ่งไปนาน แล้วพยักหน้า — เช้าวันต่อมาเขานำสวดเหมือนเดิม แต่เสียงหนักแน่นกว่าเดิม${addRes(l, { morale: 6 })}`); } },
      { label: "บอกว่าคุณก็ไม่รู้เหมือนกัน", run: (l) => { addStat(l, "smarts", 1); return meh("คุณสองคนนั่งไม่รู้ด้วยกันจนเช้า ซึ่งก็ทำให้รู้สึกดีขึ้นอย่างประหลาด"); } },
    ],
  },
  {
    id: "a20.p.harvest",
    ...inB(14, (l) => hasRole(l, ["farmer"]) && getBase(l)!.b.farm > 0),
    prepare: (l) => pickRes(l, ["farmer"]),
    text: (l, c) => `${who(l, c)}เก็บเกี่ยวข้าวรอบแรกจากนาบนดาดฟ้า ได้แค่สามกระสอบ แต่เขาร้องไห้เหมือนได้ทองคำ`,
    choices: [
      { label: "หุงแจกทุกคนคืนนี้", run: (l) => { addStat(l, "happiness", 8); return good(`ข้าวใหม่หอมไปทั้งฐาน ไม่มีใครพูด ทุกคนแค่กิน${addRes(l, { food: 6, morale: 10 })}`); } },
      { label: "เก็บไว้เป็นเมล็ดพันธุ์", run: (l, c) => { bumpLoyalty(l, Number(c.rid), 10); return meh(`${c.name}พยักหน้าเห็นด้วย ฤดูหน้านาบนดาดฟ้าจะใหญ่ขึ้นสามเท่า${addRes(l, { food: 14 })}`); } },
    ],
  },
  {
    id: "a20.p.hidden_power",
    ...inB(16, (l) => (l.power?.rank ?? 0) >= 1),
    prepare: (l) => pickRes(l, ["farmer", "teacher", "merchant", "mechanic"]),
    text: (l, c) => `ระหว่างสัตว์อสูรบุก คุณเห็น${who(l, c)}ที่ปกติเป็น${ROLE_INFO[String(c.role) as Role]?.name ?? "คนธรรมดา"} ใช้สกิลระดับสูงฆ่ามันในดาบเดียว แล้วกลับไปทำงานเหมือนไม่มีอะไรเกิดขึ้น`,
    choices: [
      { label: "ชวนเข้าทีมรบ", check: { stat: "looks", dc: 50 }, skill: ["social"], run: (l, c, ok) => { if (ok) { removeResident(l, Number(c.rid)); const p = createPerson(l, "ally", { age: clamp(l.age + randInt(l, -5, 8), 16, 80), bond: 70, job: "ผู้รอดชีวิตที่ซ่อนพลัง" }); p.name = String(c.name); p.short = String(c.name); withBase(l, (b) => { b.pop += 1; }); return good(`${c.name}ถอนหายใจ "ผมแค่อยากเป็นคนธรรมดา… ก็ได้ เพื่อคุณ" — เขาเข้าร่วมทีมของคุณ`); } return meh(`${c.name}ยิ้ม "คุณเห็นผิดแล้ว" แล้วกลับไปทำงาน`); } },
      { label: "เคารพความลับของเขา", run: (l, c) => { bumpLoyalty(l, Number(c.rid), 25); return meh(`${c.name}รู้ว่าคุณรู้ และรู้ว่าคุณไม่บอกใคร — นั่นมีค่ากว่าการเข้าทีม`); } },
    ],
  },
  {
    id: "a20.p.baby",
    ...inB(20, (l) => l.people.some((p) => (p.relation === "spouse" || p.relation === "partner") && p.alive) && people(l, "child").length < 3),
    title: "เด็กที่เกิดในซากเมือง",
    prepare: (l) => ({ name: shortName(l.people.find((p) => (p.relation === "spouse" || p.relation === "partner") && p.alive)!) }),
    text: (_l, c) => `${c.name}จับมือคุณแล้ววางไว้บนท้อง "ฉันรู้ว่าโลกเป็นแบบนี้… แต่ฉันอยากให้มีใครสักคนได้เห็นวันที่มันดีขึ้น"`,
    choices: [
      { label: "\"เราจะสร้างวันนั้นให้เขาเอง\"", run: (l) => { const k = createPerson(l, "child", { age: 0, bond: 90, lastName: l.lastName }); addStat(l, "happiness", 15); return big(`${shortName(k)}เกิดในห้องพยาบาลของ${baseName(l)} คนทั้งฐานมายืนออกันหน้าประตู${addRes(l, { pop: 1, morale: 10 })}`); } },
      { label: "\"ยังไม่ใช่ตอนนี้\"", run: (_l, c) => meh(`${c.name}พยักหน้าช้าๆ คุณสองคนกอดกันนานกว่าปกติ`) },
    ],
  },
  {
    id: "a20.p.child_sky",
    ...inB(14, (l) => people(l, "child").some((c) => c.age >= 4 && c.age <= 12)),
    prepare: (l) => ({ name: shortName(people(l, "child").find((c) => c.age >= 4 && c.age <= 12)!) }),
    text: (_l, c) => `${c.name}ถามขณะนั่งบนตักคุณ "ทำไมท้องฟ้าเป็นสีแดงคะ ในหนังสือมันเป็นสีฟ้า"`,
    choices: [
      { label: "\"วันหนึ่งพ่อแม่จะทำให้มันกลับเป็นสีฟ้า\"", run: (l, c) => { const k = l.people.find((p) => shortName(p) === c.name); if (k) k.bond = clamp(k.bond + 10, 0, 100); addStat(l, "happiness", 6); return good(`${c.name}ยกนิ้วก้อยมาเกี่ยวสัญญา — คุณจะต้องรักษาสัญญานี้ให้ได้`); } },
      { label: "เล่าความจริงทั้งหมด", run: (l) => { addStat(l, "happiness", -2); return meh("เด็กฟังเงียบๆ แล้วถามว่า 'ดวงดาวดูเราอยู่ตอนนี้ไหม' — คุณโบกมือขึ้นฟ้าให้ดู"); } },
    ],
  },
  {
    id: "a20.p.friend_raider",
    ...inB(16, (l) => people(l, "friend").length > 0),
    title: "เพื่อนเก่าในแก๊งปล้น",
    prepare: (l) => ({ name: shortName(people(l, "friend")[0]) }),
    text: (_l, c) => `หัวหน้าแก๊งปล้นที่ล้อมฐานอยู่ถอดหน้ากากออก — ${c.name} เพื่อนสนิทสมัยเรียนที่คุณคิดว่าตายไปแล้วตั้งแต่คืนแรก`,
    choices: [
      { label: "ชวนเขาเข้าฐาน พร้อมคนของเขา", check: { stat: "looks", dc: 50 }, skill: ["social"], run: (l, c, ok) => { if (ok) { withBase(l, (b) => { b.feud = Math.max(0, b.feud - 30); }); return good(`${c.name}ร้องไห้กลางลาน "ฉันทำเรื่องแย่ๆ ไปเยอะมาก" — "ตอนนี้มาทำเรื่องดีๆ ด้วยกัน"${addRes(l, { pop: randInt(l, 8, 15), morale: 4 })}`); } return bad(`${c.name}ส่ายหัว "สายไปแล้ว" แล้วสั่งถอยทัพ — มิตรภาพเหลือแค่ความทรงจำ`); } },
      { label: "บอกให้เขาไปให้พ้น", run: (l, c) => { const f = people(l, "friend")[0]; f.bond = Math.max(0, f.bond - 30); return meh(`${c.name}มองคุณนาน แล้วสั่งลูกน้องถอย ไม่มีใครยิงสักนัด`); } },
    ],
  },
  {
    id: "a20.p.rumor",
    ...inB(16, (l) => L(l) && getBase(l)!.res.length >= 2),
    prepare: (l) => pickRes(l),
    text: (l, c) => `ข่าวลือแพร่ทั่วฐานว่าคุณแอบให้ส่วนปันพิเศษกับ${who(l, c)} คนในฐานเริ่มมองเขาด้วยสายตาไม่เป็นมิตร`,
    choices: [
      { label: "เปิดบัญชีปันส่วนให้ทุกคนดู", check: { stat: "smarts", dc: 45 }, run: (l, _c, ok) => (ok ? good(`ตัวเลขชัดเจน ข่าวลือหายไปในวันเดียว${addRes(l, { morale: 4 })}`) : bad(`บัญชีเขียนด้วยลายมือคุณเอง ซึ่งไม่มีใครอ่านออก — ข่าวลือแรงขึ้น${addRes(l, { morale: -4 })}`)) },
      { label: "ไม่อธิบาย — ผู้นำไม่ต้องแก้ตัว", run: (l, c) => { bumpLoyalty(l, Number(c.rid), -10); return meh(`ข่าวลือค่อยๆ เงียบไปเอง แต่${c.name}ถูกกีดกันจากวงข้าวไปหลายเดือน${addRes(l, { morale: -2 })}`); } },
    ],
  },
  {
    id: "a20.p.birthday",
    ...inB(16),
    text: (l) => `คุณกลับจากเวรยามแล้วเจอทุกคนใน${baseName(l)}ซ่อนตัวอยู่ในโรงอาหาร "เซอร์ไพรส์!" — เค้กทำจากขนมปังแห้งชุบนมข้นหวาน ปักเทียน ${l.age} เล่มที่หามาจากซากวัด`,
    auto: (l) => { addStat(l, "happiness", 12); addRes(l, { morale: 6 }); return "good"; },
  },
  {
    id: "a20.p.deputy",
    ...inB(18, (l) => L(l) && getBase(l)!.res.length >= 3 && !l.flags.a20deputy),
    title: "แต่งตั้งรองผู้นำ",
    prepare: (l) => { const top = [...getBase(l)!.res].filter((r) => !r.tag).sort((a, b) => b.loy - a.loy); return { rid: top[0].id, name: top[0].n, rid2: top[top.length - 1].id, name2: top[top.length - 1].n }; },
    text: (_l, c) => `ฐานใหญ่เกินกว่าคุณจะดูแลคนเดียว ผู้สมัครรองผู้นำสองคน: ${c.name} ที่ภักดีต่อคุณที่สุด กับ ${c.name2} ที่เก่งที่สุดแต่ไม่ค่อยลงรอยกับคุณ`,
    choices: [
      { label: (_l, c) => `เลือก${c.name}`, run: (l, c) => { l.flags.a20deputy = String(c.name); bumpLoyalty(l, Number(c.rid), 10); return good(`${c.name}ทำตามทุกคำสั่ง ฐานเดินเรียบ — และไม่มีใครกล้าค้านคุณอีก${addRes(l, { morale: 3 })}`); } },
      { label: (_l, c) => `เลือก${c.name2}`, run: (l, c) => { l.flags.a20deputy = String(c.name2); bumpLoyalty(l, Number(c.rid2), 30); return good(`${c.name2}ตกใจที่ได้รับเลือก แล้วทำงานหนักกว่าใครเพื่อพิสูจน์ตัวเอง${addRes(l, { mat: 6, food: 6 })}`); } },
    ],
  },
  {
    id: "a20.p.last_letter",
    ...inB(16),
    prepare: (l) => pickRes(l),
    text: (l, c) => `ก่อนออกสำรวจที่อันตรายที่สุดของปี ${who(l, c)}ยื่นซองจดหมายให้ "ถ้าผมไม่กลับมา ช่วยส่งให้ลูกสาวผมที่ฐานทางใต้ด้วย"`,
    choices: [
      { label: "สัญญาว่าจะส่ง", run: (l, c) => { if (chance(l, 0.5)) { bumpLoyalty(l, Number(c.rid), 15); return good(`${c.name}กลับมา แล้วขอจดหมายคืน "ไว้ผมเอาไปให้เองดีกว่า"`); } removeResident(l, Number(c.rid)); addFame(l, 2); return meh(`${c.name}ไม่ได้กลับมา คุณเดินทางสามวันไปส่งจดหมายด้วยตัวเอง ลูกสาวเขากอดจดหมายแล้วขอบคุณคุณ`); } },
      { label: "บอกให้เขาเอาไปให้เอง — ห้ามตาย", run: (l, c) => { bumpLoyalty(l, Number(c.rid), 10); return meh(`${c.name}หัวเราะ "คำสั่งผู้นำ" แล้วเก็บจดหมายใส่กระเป๋าเสื้อ`); } },
    ],
  },
];

