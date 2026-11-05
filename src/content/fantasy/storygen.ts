// เรื่องหลักที่ประกอบจากชิ้นส่วน: สถานการณ์ × คนในเรื่อง × จุดหักมุม · ในเมืองของคุณเอง
// ทุกชีวิตได้เรื่องที่ไม่ซ้ำกัน: วิญญาณจำชุดที่เคยเจอแล้ว · บางเรื่องทิ้งเส้นเรื่องที่กลับมาอีกหลายปีต่อมา
// แผนอยู่ที่ design/WHOLE_GAME_SPEC.md (Release 2)
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { remember } from "../../engine/npc";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addStat, clamp, createPerson, shortName } from "../../engine/util";
import { B, C, G, GOLD, N, P, PAY, type Res } from "./kit";
import { fightOdds } from "./power";
import { spread } from "./rumors";
import { addStanding, fl } from "./state";
import { cityOf } from "./cities";
import { stageAge } from "./folk";

/** คนในเรื่อง: อาชีพ (คำกลางๆ ปรับตามเพศเอง) */
export const ROLES = ["พ่อค้าเร่", "ช่างไม้", "นักดนตรีพเนจร", "ทหารปลดประจำการ", "หมอยาสมุนไพร", "ชาวประมง", "คนเลี้ยงแพะ", "นักบวชพเนจร",
  "ช่างทอผ้า", "คนส่งสาร", "นักล่าค่าหัว", "ลูกขุนนางตกยาก", "คนแจวเรือ", "นักเรียนเวท", "พรานป่า", "คนทำขนมปัง"];

type Way = "force" | "wits" | "heart" | "luck";
interface Approach { label: string; way: Way | number; ok: string; bad: string; okFx?: Partial<Record<"joy" | "gold" | "fame" | "hp" | "iq", number>>; badFx?: Partial<Record<"joy" | "gold" | "fame" | "hp" | "iq", number>> }
/** สถานการณ์: ชื่อเรื่อง ฉากเปิด และทางเลือกสามทาง (ตัวเลข = จ่ายเงินเท่านั้นเหรียญทอง ได้ผลแน่นอน) · {n} คนในเรื่อง {r} อาชีพของเขา {c} เมือง */
interface Situation { id: string; title: string; text: string; ways: [Approach, Approach, Approach]; threat?: number }
export const SITUATIONS: Situation[] = [
  { id: "purse", title: "ถุงเงินที่หายไป", text: "{n} {r}ร้องกลางตลาด{c}ว่าคุณขโมยถุงเงินของเขา คนทั้งตลาดหยุดมอง", ways: [
    { label: "ชี้หาคนร้ายตัวจริง", way: "wits", ok: "คุณเห็นรอยมีดกรีดที่ก้นถุงของ{n} แล้วชี้ไปที่เด็กล้วงกระเป๋าที่กำลังวิ่งหนี ถุงเงินกลับคืนเจ้าของ", bad: "ไม่มีใครฟังคุณ ฝูงชนมองตามจนคุณเดินพ้นตลาด", okFx: { fame: 2, joy: 3 }, badFx: { joy: -4 } },
    { label: "ช่วย{n}ตามหาแทนที่จะเถียง", way: "heart", ok: "คุณกับ{n}เดินย้อนทางเดิมจนเจอถุงเงินในตะกร้าผักที่เขาวางไว้เอง {n}หน้าแดงขอโทษไม่หยุด", bad: "หาจนตลาดวาย ก็ไม่เจอ {n}ยังเชื่อว่าเป็นคุณ", okFx: { joy: 4 }, badFx: { joy: -3 } },
    { label: "ยื่นเงินให้เท่าที่เขาเสีย เพื่อจบเรื่อง", way: 8, ok: "{n}รับเงินไปพร้อมสีหน้าสับสน และเรื่องก็จบที่ตรงนั้น", bad: "", okFx: {} },
  ] },
  { id: "cart", title: "เกวียนพังกลางทาง", text: "บนถนนนอก{c} เกวียนของ{n} {r} ล้อหักตอนตะวันใกล้ตก เสียงหมาป่าดังมาจากชายป่า", ways: [
    { label: "เฝ้าเกวียนกับเขาทั้งคืน", way: "force", ok: "หมาป่าสามตัวเข้ามาใกล้ คุณไล่มันกลับเข้าป่าไปได้ทุกตัว พอเช้าทั้งคู่หัวเราะกับเรื่องเมื่อคืน", bad: "หมาป่าตัวหนึ่งกัดแขนคุณก่อนจะหนีไป เกวียนรอด แต่คุณได้แผลกลับบ้าน", okFx: { joy: 4 }, badFx: { hp: -6 } },
    { label: "ซ่อมเพลาด้วยของที่มี", way: "wits", ok: "คุณมัดไม้กับเชือกเป็นเพลาชั่วคราว เกวียนไปถึงหมู่บ้านถัดไปทันก่อนมืด", bad: "เพลาชั่วคราวหักอีกรอบกลางทาง ทั้งคู่ต้องเข็นเกวียนจนรุ่งเช้า", okFx: { iq: 1, joy: 3 }, badFx: { joy: -3, hp: -2 } },
    { label: "จ้างเกวียนจากหมู่บ้านถัดไป", way: 6, ok: "เกวียนเช่ามาถึงก่อนมืด ของทั้งหมดของ{n}ปลอดภัย", bad: "" },
  ] },
  { id: "letter", title: "จดหมายที่ห้ามเปิด", text: "ในโรงเตี๊ยมของ{c} {n} {r}ยื่นจดหมายปิดผนึกให้คุณ \"ช่วยส่งให้คนที่ท่าเรือ อย่าเปิดอ่าน\" มือของเขาสั่น", ways: [
    { label: "รับไปส่งโดยไม่ถามอะไร", way: "luck", ok: "คนที่ท่าเรืออ่านจดหมายแล้วร้องไห้ เป็นจดหมายขอโทษที่รอมายี่สิบปี", bad: "ยามที่ท่าเรือค้นตัวคุณ จดหมายนั้นเป็นแผนลักลอบขนของ คุณต้องเสียเงินปิดปาก", okFx: { joy: 5 }, badFx: { gold: -10, joy: -3 } },
    { label: "แอบเปิดอ่านก่อน", way: "wits", ok: "ในจดหมายคือคำเตือนว่ามีคนจะลอบทำร้ายผู้รับ คุณไปเตือนทันเวลา", bad: "ผนึกแตกคามือ {n}รู้ทันทีว่าคุณเปิดอ่าน และไม่ไว้ใจคุณอีกเลย", okFx: { fame: 2, joy: 3 }, badFx: { joy: -3 } },
    { label: "ถามจนเขายอมเล่าความจริง", way: "heart", ok: "{n}เล่าว่าเป็นจดหมายถึงลูกที่ไม่ได้เจอกันมานาน คุณช่วยพาเขาไปส่งเอง", bad: "{n}ไม่ยอมเล่า แล้วเดินออกจากโรงเตี๊ยมไปพร้อมจดหมาย", okFx: { joy: 6 }, badFx: { joy: -2 } },
  ] },
  { id: "fire", title: "ไฟไหม้กลางดึก", text: "ร้านของ{n} {r}ใน{c}ไฟลุกกลางดึก เขายืนตะโกนว่าของทั้งชีวิตอยู่ข้างใน", ways: [
    { label: "บุกเข้าไปช่วยขนของ", way: "force", ok: "คุณออกมาพร้อมหีบใบเดียวที่สำคัญที่สุดของ{n} ทั้งถนนปรบมือ", bad: "เพดานถล่มลงมาใกล้ตัว คุณออกมาได้พร้อมแผลไหม้ที่แขน", okFx: { fame: 3, joy: 3 }, badFx: { hp: -8 } },
    { label: "จัดคนทั้งถนนส่งน้ำเป็นแถว", way: "wits", ok: "ถังน้ำส่งต่อกันเป็นแถวยาว ไฟดับก่อนจะลามไปบ้านข้างๆ", bad: "คนไม่ฟังคำสั่ง ไฟลามไปอีกสองหลังก่อนจะดับ", okFx: { fame: 2 }, badFx: { joy: -4 } },
    { label: "ออกเงินช่วยเขาสร้างร้านใหม่", way: 15, ok: "ร้านใหม่ของ{n}เปิดในเดือนถัดมา ป้ายหน้าร้านมีชื่อคุณสลักอยู่มุมหนึ่ง", bad: "", okFx: { joy: 4 } },
  ] },
  { id: "beast", title: "สัตว์ร้ายเข้าหมู่บ้าน", text: "ทุกคืนมีสัตว์ร้ายลงมากินแกะของ{n} {r}ที่ชายป่านอก{c} คืนนี้มันกลับมาอีก", threat: 20, ways: [
    { label: "รอดักสู้กับมัน", way: "force", ok: "หมีป่าตัวใหญ่ล้มลงตรงหน้าคอก {n}เอาหนังมันมาให้คุณเป็นของขวัญ", bad: "มันฟาดคุณล้มแล้วหนีกลับเข้าป่า แกะรอดไปอีกคืน แต่คุณเจ็บหลายวัน", okFx: { fame: 2, joy: 4 }, badFx: { hp: -8 } },
    { label: "วางกับดักตามรอยเท้า", way: "wits", ok: "กับดักทำงานตั้งแต่คืนแรก สัตว์ร้ายไม่กลับมาอีกเลย", bad: "กับดักจับได้แต่สุนัขของเพื่อนบ้าน ทั้งหมู่บ้านไม่พอใจ", okFx: { iq: 1, joy: 3 }, badFx: { joy: -4 } },
    { label: "ก่อไฟรอบคอกทั้งคืน", way: "luck", ok: "แสงไฟไล่มันไป และมันย้ายไปหากินที่อื่น", bad: "ลมพัดไฟไปติดรั้ว คุณกับ{n}ดับไฟจนเช้า", okFx: { joy: 2 }, badFx: { joy: -3, gold: -3 } },
  ] },
  { id: "dice", title: "ลูกเต๋าถ่วงน้ำหนัก", text: "{n} {r}เสียเงินทั้งหมดในวงลูกเต๋าที่โรงเตี๊ยมของ{c} คุณเห็นเจ้ามือสลับลูกเต๋าใต้แขนเสื้อ", ways: [
    { label: "เปิดโปงเจ้ามือต่อหน้าทุกคน", way: "wits", ok: "คุณจับมือเจ้ามือไว้ตอนสลับลูกเต๋า ทุกคนในวงได้เงินคืน", bad: "เจ้ามือไวกว่า คุณถูกลากออกจากโรงเตี๊ยมข้อหากล่าวหาลอยๆ", okFx: { fame: 2, gold: 5 }, badFx: { joy: -4, hp: -2 } },
    { label: "ข่มขู่เจ้ามือหลังร้าน", way: "force", ok: "เจ้ามือคืนเงินให้{n}ทุกเหรียญ แล้วย้ายวงไปเมืองอื่นในคืนนั้น", bad: "เจ้ามือมีลูกน้องสามคน คุณกลับบ้านพร้อมตาเขียว", okFx: { joy: 3 }, badFx: { hp: -6 } },
    { label: "ใช้หนี้แทน{n}แล้วพาออกมา", way: 10, ok: "{n}สัญญาว่าจะไม่แตะลูกเต๋าอีก และคุณอยากเชื่อแบบนั้น", bad: "" },
  ] },
  { id: "child", title: "เด็กหลงในงานเทศกาล", text: "งานเทศกาลของ{c}แน่นไปด้วยผู้คน {n} {r}วิ่งมาหาคุณ ลูกของเขาหายไปในฝูงชน", ways: [
    { label: "ลุยหาในฝูงชนเอง", way: "luck", ok: "คุณเจอเด็กนั่งดูหมีเต้นระบำอยู่หลังเวที โดยไม่รู้เลยว่าทุกคนกำลังตามหา", bad: "หาจนงานเลิก เด็กเดินกลับบ้านเองตอนดึก {n}โกรธทุกคนที่ไม่ช่วยให้เร็วกว่านั้น", okFx: { joy: 6 }, badFx: { joy: -3 } },
    { label: "ขอให้ยามปิดประตูทุกบาน", way: "wits", ok: "ยามเจอเด็กที่ประตูทิศเหนือ กำลังเดินตามขบวนนักแสดงออกไป", bad: "ยามไม่สนใจคำขอของคนธรรมดา", okFx: { fame: 1, joy: 4 }, badFx: { joy: -3 } },
    { label: "ถามเด็กๆ ในงานว่าเห็นไหม", way: "heart", ok: "เด็กคนหนึ่งชี้ไปที่ร้านขนม ลูกของ{n}ยืนน้ำลายไหลอยู่ตรงนั้น", bad: "เด็กๆ ชี้ไปคนละทาง คุณวิ่งจนหมดแรง", okFx: { joy: 5 }, badFx: { joy: -2, hp: -2 } },
  ] },
  { id: "slander", title: "ข่าวลือใส่ร้าย", text: "มีคนปล่อยข่าวไปทั่ว{c}ว่าคุณกับ{n} {r}ร่วมกันโกงเงินวิหาร ทั้งที่ไม่มีใครทำ", ways: [
    { label: "ไปคุยกับ{n}ให้ร่วมแก้ข่าว", way: "heart", ok: "คุณสองคนไปยืนยันต่อหน้านักบวชด้วยกัน ข่าวลือเงียบลงในสัปดาห์เดียว", bad: "{n}คิดว่าคุณเป็นคนปล่อยข่าวเอง และหันหลังให้", okFx: { joy: 3 }, badFx: { joy: -4 } },
    { label: "สืบหาต้นตอของข่าว", way: "wits", ok: "ต้นตอคือพ่อค้าคู่แข่งของ{n} เขาต้องขอโทษกลางลานเมือง", bad: "สืบไปไม่ถึงไหน และยิ่งถามข่าวยิ่งดัง", okFx: { fame: 2, joy: 3 }, badFx: { joy: -3 } },
    { label: "บริจาคให้วิหารเพื่อพิสูจน์ตัว", way: 12, ok: "นักบวชประกาศชื่อคุณในพิธีเช้า ข่าวลือหายไปเอง", bad: "" },
  ] },
  { id: "oldnote", title: "ตั๋วหนี้ของพ่อแม่", text: "{n} {r}มาเคาะประตูพร้อมตั๋วหนี้เก่าที่มีลายมือคล้ายพ่อแม่ของคุณ ยอดหนี้ไม่ใช่น้อย", ways: [
    { label: "ตรวจลายมือให้ละเอียด", way: "wits", ok: "ลายมือในตั๋วหนี้เป็นของปลอม {n}เองก็ถูกคนอื่นหลอกขายตั๋วมา", bad: "ลายมือนั้นเป็นของจริง และคุณต้องผ่อนใช้หนี้ไปอีกนาน", okFx: { iq: 1, joy: 3 }, badFx: { gold: -12 } },
    { label: "เจรจาขอลดหนี้", way: "heart", ok: "{n}ยอมลดหนี้ครึ่งหนึ่ง เพราะพ่อแม่ของคุณเคยช่วยเขาไว้", bad: "{n}ไม่ยอมลดแม้แต่เหรียญเดียว", okFx: { gold: -5, joy: 2 }, badFx: { gold: -10, joy: -2 } },
    { label: "จ่ายให้ครบ เพื่อชื่อของตระกูล", way: 14, ok: "{n}ฉีกตั๋วหนี้ต่อหน้าคุณ และพูดถึงตระกูลคุณด้วยความนับถือไปทั้งเมือง", bad: "", okFx: { fame: 1 } },
  ] },
  { id: "marsh", title: "ทางลัดผ่านหนองน้ำ", text: "{n} {r}เสนอพาคุณเดินทางลัดผ่านหนองน้ำนอก{c} เร็วกว่าถนนหลวงครึ่งวัน แต่ว่ากันว่ามีคนหายไปในนั้น", ways: [
    { label: "เดินตามเขาไป", way: "luck", ok: "หนองน้ำสวยกว่าที่คิด คุณถึงปลายทางก่อนทุกคนในคาราวาน", bad: "คุณจมโคลนถึงเอว และเสียของไปครึ่งหนึ่งก่อนจะออกมาได้", okFx: { joy: 4, gold: 4 }, badFx: { gold: -6, hp: -3 } },
    { label: "สังเกตรอยเท้าก่อนก้าวทุกครั้ง", way: "wits", ok: "คุณเห็นรอยดินยุบที่{n}มองข้าม และพาทั้งคู่อ้อมไปได้", bad: "คุณระวังจนช้าเกินไป มืดกลางหนองน้ำ ทั้งคู่นอนบนต้นไม้ทั้งคืน", okFx: { iq: 1, joy: 3 }, badFx: { joy: -3 } },
    { label: "ไปทางถนนหลวงตามเดิม", way: "heart", ok: "{n}หัวเราะว่าคุณขี้ระวัง แต่ก็เดินไปด้วยกัน และคุยกันจนลืมความเหนื่อย", bad: "{n}แยกไปทางหนองน้ำคนเดียว และไม่มีใครเห็นเขาอีกหลายเดือน", okFx: { joy: 3 }, badFx: { joy: -4 } },
  ] },
  { id: "smuggle", title: "ของในกระเป๋า", text: "ที่ด่านเข้า{c} ยามค้นกระเป๋าคุณเจอห่อผงสีแดงที่คุณไม่เคยเห็น {n} {r}ที่ยืนข้างคุณหน้าซีด", ways: [
    { label: "อธิบายกับยามให้เข้าใจ", way: "heart", ok: "หัวหน้ายามเชื่อคุณ และพาตัว{n}ไปสอบแทน", bad: "ยามไม่เชื่อ คุณถูกขังหนึ่งคืนก่อนจะได้ออกมา", okFx: { joy: 2 }, badFx: { joy: -6 } },
    { label: "ชี้ให้ยามดูว่าห่อนั้นมัดแบบใคร", way: "wits", ok: "ปมเชือกเป็นแบบชาวเรือ เหมือนเชือกของ{n} ยามปล่อยคุณทันที", bad: "ยามมองว่าคุณพยายามโยนความผิด ค่าปรับหนักกว่าเดิม", okFx: { iq: 1 }, badFx: { gold: -8 } },
    { label: "ยัดเงินให้ยามเงียบๆ", way: 9, ok: "ยามยิ้ม ห่อนั้นหายไปจากโต๊ะ และคุณได้เข้าเมือง", bad: "" },
  ] },
  { id: "drunks", title: "คนเมาในลานเมือง", text: "คนเมากลุ่มหนึ่งรุมแกล้ง{n} {r}กลางลานเมือง{c} ไม่มีใครกล้าเข้าไปห้าม", ways: [
    { label: "เข้าไปขวางด้วยตัวเอง", way: "force", ok: "คนเมาแตกกระเจิงตั้งแต่คนแรกล้มลง {n}จับมือคุณแน่น", bad: "คุณล้มลงพร้อมคนเมาทั้งกลุ่ม ยามมาถึงพอดี แต่ปากคุณแตก", okFx: { fame: 2, joy: 3 }, badFx: { hp: -6 } },
    { label: "พูดตลกจนคนเมาหันมาหัวเราะ", way: "heart", ok: "คนเมาหัวเราะจนลืมว่ากำลังทำอะไร แล้วพากันไปหาเหล้าต่อ", bad: "มุกของคุณไม่ตลก และตอนนี้พวกมันสนใจคุณแทน", okFx: { joy: 4 }, badFx: { joy: -3, hp: -3 } },
    { label: "ตะโกนว่ายามกำลังมา", way: "luck", ok: "คนเมาวิ่งหนีกันชุลมุน คุณพา{n}ออกมาทางตรอกข้าง", bad: "ไม่มีใครเชื่อ คุณต้องลาก{n}วิ่งหนีเอง", okFx: { joy: 3 }, badFx: { joy: -2 } },
  ] },
  { id: "flood", title: "น้ำป่าไหลหลาก", text: "ฝนตกสามวันไม่หยุด น้ำป่าทะลักเข้าหมู่บ้านชายแดนของ{c} บ้านของ{n} {r}อยู่ริมน้ำที่สุด", threat: 16, ways: [
    { label: "ลุยน้ำเข้าไปช่วยคน", way: "force", ok: "คุณพาคนออกมาได้สามครอบครัว รวมถึงครอบครัวของ{n}", bad: "กระแสน้ำพัดคุณไปไกล คุณเกาะต้นไม้ได้ทัน แต่เจ็บทั้งตัว", okFx: { fame: 3, joy: 4 }, badFx: { hp: -9 } },
    { label: "นำทุกคนกั้นกระสอบทรายทางน้ำ", way: "wits", ok: "แนวกระสอบทรายกันน้ำไว้ได้ หมู่บ้านเสียหายน้อยกว่าทุกปี", bad: "แนวกระสอบพังตอนตีสาม ทุกคนต้องหนีขึ้นเนิน", okFx: { fame: 2 }, badFx: { joy: -4 } },
    { label: "เช่าเรือพายคนออกมา", way: 10, ok: "เรือสามลำขนคนออกมาได้หมดก่อนน้ำจะสูงที่สุด", bad: "", okFx: { fame: 1 } },
  ] },
  { id: "chest", title: "หีบเก่าราคาถูก", text: "{n} {r}ขายหีบไม้เก่าใบหนึ่งให้คุณในราคาเกือบฟรี \"ของปู่ ไม่รู้ข้างในมีอะไร\"", ways: [
    { label: "ซื้อแล้วงัดเปิดทันที", way: "luck", ok: "ใต้แผ่นไม้ชั้นล่างมีเหรียญทองโบราณซ่อนอยู่ คุณแบ่งให้{n}ครึ่งหนึ่ง", bad: "ข้างในมีแต่ผ้าขาดกับแมงมุมตัวใหญ่ที่กัดนิ้วคุณ", okFx: { gold: 12, joy: 4 }, badFx: { hp: -2, joy: -1 } },
    { label: "ดูลายแกะสลักก่อนตัดสินใจ", way: "wits", ok: "ลายบนหีบเป็นตราของช่างหลวงรุ่นเก่า หีบใบนี้มีค่ากว่าที่{n}คิดมาก คุณบอกเขาตามจริง", bad: "คุณดูไม่ออก และ{n}ขายหีบให้คนอื่นไปก่อน", okFx: { iq: 1, fame: 1, joy: 3 }, badFx: { joy: -1 } },
    { label: "ซื้อในราคาที่ยุติธรรม", way: 5, ok: "{n}ยิ้มกว้าง และเล่าเรื่องปู่ของเขาให้ฟังจนค่ำ", bad: "", okFx: { joy: 3 } },
  ] },
  { id: "challenge", title: "คำท้าในลานฝึก", text: "{n} {r}ท้าคุณประลองฝีมือกลางลานฝึกของ{c} คนมุงดูเต็มลาน", threat: 22, ways: [
    { label: "รับคำท้าและสู้เต็มที่", way: "force", ok: "คุณชนะด้วยท่าสุดท้าย {n}ลุกขึ้นคำนับคุณต่อหน้าทุกคน", bad: "{n}เก่งกว่าที่คิด คุณแพ้กลางลานพร้อมรอยช้ำ", okFx: { fame: 3, joy: 3 }, badFx: { hp: -5, joy: -3 } },
    { label: "หลอกล่อให้เขาเหนื่อยก่อน", way: "wits", ok: "{n}ฟาดลมจนหมดแรง คุณปัดอาวุธเขาหลุดมือด้วยท่าเดียว", bad: "เขาไม่ติดกับ และคุณเสียจังหวะจนล้มเอง", okFx: { fame: 2, iq: 1 }, badFx: { hp: -3, joy: -2 } },
    { label: "ปฏิเสธอย่างให้เกียรติ", way: "heart", ok: "คุณบอกว่าฝีมือของเขาไม่ต้องพิสูจน์ด้วยการล้มใคร {n}ยิ้มแล้วชวนคุณไปดื่มแทน", bad: "ฝูงชนโห่ว่าคุณกลัว {n}เดินจากไปด้วยท่าทีผู้ชนะ", okFx: { joy: 3 }, badFx: { fame: -1, joy: -3 } },
  ] },
  { id: "sick", title: "คนป่วยข้างทาง", text: "ระหว่างทางกลับ{c} คุณเจอ{n} {r}นอนตัวร้อนจัดอยู่ข้างทาง ไม่มีใครหยุดช่วย", ways: [
    { label: "ดูแลเขาทั้งคืนเอง", way: "heart", ok: "ไข้ลดลงตอนรุ่งเช้า {n}ลืมตามาเห็นคุณหลับอยู่ข้างกองไฟ", bad: "ไข้ไม่ลด และคุณติดไข้ไปด้วยหลายวัน", okFx: { joy: 5 }, badFx: { hp: -5 } },
    { label: "เก็บสมุนไพรตามที่เคยรู้มา", way: "wits", ok: "ยาต้มของคุณได้ผล {n}ลุกเดินได้ในวันถัดมา", bad: "สมุนไพรผิดชนิด {n}อาเจียนทั้งคืน แต่ก็รอด", okFx: { iq: 1, joy: 4 }, badFx: { joy: -3 } },
    { label: "จ้างเกวียนพาไปหาหมอในเมือง", way: 7, ok: "หมอบอกว่าถ้ามาช้ากว่านี้อีกครึ่งวันคงไม่รอด", bad: "", okFx: { joy: 3 } },
  ] },
];

/** จุดหักมุมท้ายเรื่อง · บางแบบเปิดเส้นเรื่องที่กลับมาอีกหลายปีต่อมา */
export type Twist = "none" | "returns" | "grudge" | "rumor" | "friend" | "family";
export const TWISTS: Twist[] = ["none", "returns", "grudge", "rumor", "friend", "family"];
export const MAX_STORYLINES = 3;
/** ความเจ็บจากเรื่องที่ประกอบขึ้น (เท่ากับ HL_HURT ของเรื่องหลักที่เขียนไว้) */
export const STORY_HURT = 0.2;
export interface Storyline { kind: "help" | "revenge" | "family"; pid: string; due: number; title: string }
export const storylinesOf = (l: Life): Storyline[] => (fl(l).storylines ??= []);

const sit = (c: Ctx) => SITUATIONS[Number(c.s)] ?? SITUATIONS[0];
const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
export const keyOf = (c: Ctx) => `ft.sg:${sit(c).id}.${c.r}.${c.t}`;
/** แทนที่ {n} {r} {c} ในข้อความ */
function fmt(l: Life, c: Ctx, t: string) {
  const p = who(l, c);
  return t.replace(/\{n\}/g, p ? shortName(p) : "เขา").replace(/\{r\}/g, p?.job ?? "").replace(/\{c\}/g, cityOf(l).name).replace(/\s+/g, " ").trim();
}

/** โอกาสตามวิธี · การต่อสู้ใช้พลังจริง ความสูงวัยก็มีผล */
function oddsOf(l: Life, w: Way, threat: number) {
  if (w === "force") return fightOdds(l, threat + Math.max(0, stageAge(l) - 55) / 2);
  if (w === "wits") return clamp(0.35 + (l.stats.smarts - 50) / 110, 0.1, 0.9);
  if (w === "heart") return clamp(0.35 + (l.stats.looks - 50) / 180 + (l.stats.happiness - 50) / 200 + l.fame / 400, 0.1, 0.9);
  return clamp(0.3 + (l.stats.luck - 50) / 120, 0.1, 0.85);
}

/** ปิดท้ายเรื่อง: คนในเรื่องจำ จุดหักมุมทำงาน บางทีเปิดเส้นเรื่อง */
function ending(won: boolean, a: Approach): Res {
  return (l, c) => {
    const p = who(l, c);
    const fx = won ? a.okFx ?? {} : a.badFx ?? {};
    if (fx.gold) l.money += fx.gold * GOLD;
    // เหมือนเรื่องหลักที่เขียนไว้: ความเจ็บเบาลง ให้ทั้งชีวิตที่มีเรื่องเยอะไม่สั้นลง (ข้อความยังเล่าเต็ม)
    if (fx.joy) addStat(l, "happiness", fx.joy < 0 ? Math.round(fx.joy * 0.6) : fx.joy);
    if (fx.hp) addStat(l, "health", fx.hp < 0 ? Math.round(fx.hp * STORY_HURT) : fx.hp);
    if (fx.iq) addStat(l, "smarts", fx.iq);
    if (fx.fame) l.fame = Math.max(0, l.fame + fx.fame);
    let text = fmt(l, c, won ? a.ok : a.bad);
    if (p) {
      remember(l, p, "sg", `${sit(c).title}: ${won ? "คุณช่วยเขาไว้" : "คุณพลาดตอนเขาต้องการ"}`, 2, won ? { love: 10, trust: 10, debt: 15 } : { trust: -8 });
      p.bond = clamp(p.bond + (won ? 12 : -6), 0, 100);
    }
    const t = c.t as Twist;
    const open = (kind: Storyline["kind"], lo: number, hi: number) => {
      if (!p || storylinesOf(l).length >= MAX_STORYLINES) return;
      storylinesOf(l).push({ kind, pid: p.id, due: l.age + randInt(l, lo, hi), title: sit(c).title });
    };
    if (t === "returns" && won) { open("help", 3, 8); text += ` ก่อนจากกัน ${p ? shortName(p) : "เขา"}บอกว่าจะไม่ลืมวันนี้`; }
    else if (t === "grudge" && (!won || a.way === "force")) { open("revenge", 2, 6); if (p) remember(l, p, "sg_grudge", "คุณทำให้เขาเสียหน้า", 2, { grudge: 25 }); text += ` ${p ? shortName(p) : "เขา"}มองคุณด้วยสายตาที่บอกว่ายังไม่จบ`; }
    else if (t === "rumor") { spread(l, `${won ? "ช่วย" : "ทิ้ง"}${p ? shortName(p) : "คนแปลกหน้า"}ตอน${sit(c).title}`, won ? 1 : -1, 40); text += won ? " เรื่องนี้ไปถึงหูคนทั้งเมืองในไม่กี่วัน" : " และคนทั้งเมืองก็รู้เรื่องนี้ในไม่กี่วัน"; }
    else if (t === "friend" && won && p) { p.relation = "friend"; p.bond = clamp(p.bond + 15, 0, 100); text += ` หลังจากวันนั้น ${shortName(p)}แวะมาหาคุณบ่อยขึ้น`; }
    else if (t === "family" && p) { open("family", 2, 6); text += ` ${shortName(p)}พูดเบาๆ ว่ารู้จักพ่อแม่ของคุณตั้งแต่ก่อนคุณเกิด`; }
    if (won) addStanding(l, 1);
    return { text, kind: won ? "good" : "bad" };
  };
}

/** ทางเลือกหนึ่งทาง: จ่ายเงิน = ได้ผลแน่นอน · ทางอื่นมีโอกาสสำเร็จตามวิธี */
function wayChoice(s: Situation, a: Approach): Choice {
  const label = (l: Life, c: Ctx) => fmt(l, c, a.label);
  if (typeof a.way === "number") { const g = a.way; return PAY(a.label, g, ending(true, a), { label: (l: Life, c: Ctx) => `${fmt(l, c, a.label)} (${g} เหรียญทอง)` }); }
  const w = a.way;
  return P(label, (l) => oddsOf(l, w, s.threat ?? 14), ending(true, a), ending(false, a));
}

/** หนึ่งสถานการณ์ = หนึ่งเรื่อง · คนในเรื่องและจุดหักมุมมาจาก ctx */
const STORIES: GameEvent[] = SITUATIONS.map((s, i) => ({
  id: `ft.sg.${s.id}`, world: "fantasy", minAge: 14, maxAge: 900, manual: true, maxTimes: 0, title: s.title,
  text: (l: Life, c: Ctx) => fmt(l, { ...c, s: i }, s.text),
  choices: s.ways.map((a) => {
    const ch = wayChoice(s, a);
    // ending อ่านสถานการณ์จาก ctx.s · ใส่ไว้ให้แน่ใจแม้ ctx เก่าจะไม่มี
    const run = ch.run;
    return { ...ch, run: (l: Life, c: Ctx, ok?: boolean) => run(l, { ...c, s: i }, ok as boolean) };
  }),
}));

/** เรื่องที่ยังไม่เคยเจอทั้งในชาตินี้และชาติก่อน · สถานการณ์เดียวกันห่างกันอย่างน้อย 15 ปีในชีวิตเดียว */
export function storyCtx(l: Life): { id: string; make: () => Ctx } | undefined {
  if (!l.ft || l.age < 14) return;
  const past = new Set(l.pastSeen ?? []);
  const used = (s: number) => Object.keys(l.seenAt ?? {}).some((k) => k.startsWith(`ft.sg:${SITUATIONS[s].id}.`) && l.age - (l.seenAt![k] ?? -99) < 15);
  const open = SITUATIONS.map((_, i) => i).filter((i) => !used(i));
  if (!open.length) return;
  const s0 = pick(l, open);
  return { id: `ft.sg.${SITUATIONS[s0].id}`, make: () => {
    for (let tries = 0; tries < 40; tries++) {
      const s = s0, r = randInt(l, 0, ROLES.length - 1), t = pick(l, TWISTS);
      const key = `ft.sg:${SITUATIONS[s].id}.${r}.${t}`;
      if (past.has(key) || l.seen[key]) continue;
      const p: Person = createPerson(l, "friend", { age: Math.max(16, l.age + randInt(l, -12, 12)), bond: 30, job: ROLES[r] });
      l.seen[key] = 1; (l.seenAt ??= {})[key] = l.age;
      return { s, r, t, pid: p.id, title: SITUATIONS[s].title };
    }
    const p = createPerson(l, "friend", { age: Math.max(16, l.age + randInt(l, -12, 12)), bond: 30, job: pick(l, ROLES) });
    return { s: s0, r: 0, t: "none", pid: p.id, title: SITUATIONS[s0].title };
  } };
}

// ── เส้นเรื่องที่กลับมา ──
const cnm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const CONT: GameEvent = {
  id: "ft.sg.cont", world: "fantasy", minAge: 14, maxAge: 900, manual: true, maxTimes: 0, title: "เรื่องที่ยังไม่จบ",
  text: (l, c) => c.kind === "help" ? `${cnm(l, c)}ที่คุณช่วยไว้ตอน "${c.title}" กลับมาที่${cityOf(l).name}พร้อมห่อของใบใหญ่ \"ข้าบอกแล้วว่าจะไม่ลืม\"`
    : c.kind === "revenge" ? `${cnm(l, c)}จากเรื่อง "${c.title}" กลับมาพร้อมคนอีกสองคน ยืนรอคุณอยู่หน้าบ้าน`
    : `${cnm(l, c)}จากเรื่อง "${c.title}" ส่งจดหมายมา ข้างในเป็นเรื่องของพ่อแม่คุณที่ไม่มีใครเคยเล่า`,
  choices: [
    C("รับน้ำใจไว้", G((l, c) => `ในห่อมีเหรียญทองกับของฝากจากบ้านเกิดของ${cnm(l, c)} คุณสองคนนั่งคุยกันจนค่ำ`, { gold: 15, joy: 6 }, (l, c) => { const p = who(l, c); if (p) { p.relation = "friend"; p.bond = clamp(p.bond + 15, 0, 100); } }), { show: (_l, c) => c.kind === "help" }),
    C("ขอให้ช่วยเรื่องงานแทน", G((l, c) => `${cnm(l, c)}พาคุณไปรู้จักคนใหญ่คนโตของเมือง ประตูหลายบานเปิดให้คุณตั้งแต่วันนั้น`, { fame: 3 }, (l) => { addStanding(l, 3); if (l.job) l.job.performance = clamp(l.job.performance + 10, 0, 100); }), { show: (_l, c) => c.kind === "help" }),
    P("สู้ให้จบ", (l) => fightOdds(l, 22), G((l, c) => `${cnm(l, c)}กับพวกล้มลงทีละคน แล้วไม่กลับมาที่${cityOf(l).name}อีก`, { fame: 2, joy: 3 }), B((l, c) => `คุณแพ้ ${cnm(l, c)}เหยียบหน้าคุณไว้กับพื้นก่อนจะจากไป`, { hp: -9, joy: -5 }), { show: (_l, c) => c.kind === "revenge" }),
    C("ขอโทษเรื่องวันนั้น", N((l, c) => `${cnm(l, c)}เงียบไปนาน แล้วถุยน้ำลายลงพื้น \"ครั้งนี้ข้าปล่อย\"`, { joy: -2 }, (l, c) => { const p = who(l, c); if (p) remember(l, p, "sg_sorry", "คุณยอมขอโทษ", 2, { grudge: -20 }); }), { show: (_l, c) => c.kind === "revenge" }),
    PAY("จ่ายให้เขาจบเรื่อง", 12, N((l, c) => `${cnm(l, c)}รับเงินแล้วเดินจากไป เรื่องจบ แต่คุณรู้สึกขมในปาก`, { joy: -1 }), { show: (_l, c) => c.kind === "revenge" }),
    C("อ่านจนจบ", G("พ่อแม่ของคุณเคยช่วยคนทั้งหมู่บ้านไว้ในปีอดอยาก คุณเข้าใจพวกเขามากขึ้นกว่าตอนที่ยังมีชีวิต", { joy: 6, iq: 1 }), { show: (_l, c) => c.kind === "family" }),
    C((l, c) => `ไปหา${cnm(l, c)}เพื่อฟังจากปาก`, G((l, c) => `${cnm(l, c)}เล่าทั้งคืน และให้ของที่พ่อแม่คุณฝากไว้กับเขาเมื่อนานมาแล้ว`, { joy: 8, gold: 6 }, (l, c) => { const p = who(l, c); if (p) p.bond = clamp(p.bond + 20, 0, 100); }), { show: (_l, c) => c.kind === "family" }),
  ],
};

/** ปีนี้มีเส้นเรื่องถึงกำหนดไหม · คนในเรื่องต้องยังมีชีวิต */
function storylineYear(l: Life) {
  if (l.worldId !== "fantasy" || !l.ft || !l.alive) return;
  const list = storylinesOf(l);
  const i = list.findIndex((s) => s.due <= l.age);
  if (i < 0) return;
  const s = list.splice(i, 1)[0];
  const p = l.people.find((x) => x.id === s.pid && x.alive);
  if (!p || chance(l, 0.1)) return;
  runEvent(l, "ft.sg.cont", { pid: s.pid, kind: s.kind, title: s.title });
}

export const STORY_GEN_EVENTS: GameEvent[] = [...STORIES, CONT];
export function loadStoryGen() {
  yearHooks.push(storylineYear);
}
