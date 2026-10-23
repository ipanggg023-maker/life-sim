// Phase 4 — วิชายุทธ์แบบเก็บสะสมได้ · ลมปราณเป็น "ปี" · ความเข้าใจ · ความชำนาญ · ความเข้ากันได้ของวิชา (MURIM_PLAN §4, §8.1, §18.5)
// วิชาให้เอกลักษณ์ ไม่ใช่ตัวเลขอย่างเดียว: แต่ละวิชามีจุดเด่น จุดอ่อน สายสำนัก และความเสี่ยงเมื่อใช้ผิด
import { injure } from "../../../engine/body";
import { chance, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { clamp, log } from "../../../engine/util";
import { gift } from "../life/gifts";

export type ArtType = "sword" | "saber" | "fist" | "palm" | "finger" | "spear" | "staff" | "qinggong" | "hidden" | "poison" | "medicine" | "internal";
export type School = "orthodox" | "unorthodox" | "demonic" | "neutral";

export interface ArtDef {
  id: string;
  name: string;
  type: ArtType;
  /** 1 ทั่วไป · 2 พื้นฐานสำนัก · 3 วิชาลับสำนัก · 4 ตำนานที่สูญหาย */
  grade: 1 | 2 | 3 | 4;
  school: School;
  /** สำนักเจ้าของ (id ในทำเนียบสำนัก) */
  sect?: string;
  desc: string;
  strong: string;
  weak: string;
}

export interface KnownArt {
  id: string;
  /** ความชำนาญ 0–100 */
  m: number;
  /** ได้มาจากไหน */
  src: string;
  since: number;
  /** วิชาที่คิดค้นเอง */
  own?: { name: string; type: ArtType; school: School };
}

export const TYPE_NAME: Record<ArtType, string> = {
  sword: "กระบี่", saber: "ดาบ", fist: "หมัด", palm: "ฝ่ามือ", finger: "ดรรชนี", spear: "ทวน", staff: "กระบอง",
  qinggong: "วิชาตัวเบา", hidden: "อาวุธลับ", poison: "พิษ", medicine: "แพทย์", internal: "ลมปราณ",
};
export const GRADE_NAME = ["", "วิชาทั่วไป", "วิชาพื้นฐานสำนัก", "วิชาลับสำนัก", "วิชาตำนาน"];

export const ARTS: ArtDef[] = [
  // ── วิชาทั่วไป (หาได้ตามตลาด/ครูฝึก) ──
  { id: "a_long_fist", name: "หมัดยาวสามสิบสองท่า", type: "fist", grade: 1, school: "neutral", desc: "หมัดพื้นฐานที่เด็กทุกสำนักเรียนก่อนอย่างอื่น", strong: "ฝึกง่าย ใช้ได้ทุกสถานการณ์", weak: "ยอดฝีมืออ่านทางออกหมด" },
  { id: "a_basic_sword", name: "กระบี่สามตัด", type: "sword", grade: 1, school: "neutral", desc: "เพลงกระบี่ของสำนักคุ้มภัย ตรงไปตรงมา", strong: "มั่นคง", weak: "ไม่มีท่าพลิกแพลง" },
  { id: "a_breathing", name: "เคล็ดหายใจห้าธาตุ", type: "internal", grade: 1, school: "neutral", desc: "วิชาลมปราณพื้นฐานที่แพร่หลายที่สุด", strong: "ปลอดภัย ไม่ขัดกับวิชาไหน", weak: "สะสมลมปราณได้ช้า" },
  { id: "a_rope_dart", name: "มีดบินผูกเชือก", type: "hidden", grade: 1, school: "unorthodox", desc: "อาวุธลับของโจรภูเขาและนักฆ่าข้างถนน", strong: "จู่โจมจากระยะไกล", weak: "ฝ่ายธรรมะดูแคลน" },
  { id: "a_herb_needle", name: "เข็มเงินฝังจุด", type: "medicine", grade: 1, school: "neutral", desc: "ตำราฝังเข็มของหมอบ้าน", strong: "รักษาบาดแผลตัวเองได้เร็วขึ้น", weak: "แทบไม่ช่วยในการต่อสู้" },
  { id: "a_cloud_step", name: "ก้าวเมฆลอย", type: "qinggong", grade: 1, school: "neutral", desc: "วิชาตัวเบาขั้นต้น วิ่งบนหลังคาได้", strong: "หนีและไล่ตามได้ดี", weak: "ต้องใช้ลมปราณมาก" },
  // ── วิชาพื้นฐานสำนัก ──
  { id: "s_vajra_fist", name: "หมัดอรหันต์วัชระ", type: "fist", grade: 2, school: "orthodox", sect: "vajra", desc: "รากฐานของศิษย์วัดวัชระทุกรูป", strong: "แข็งแกร่ง ทนทาน", weak: "ช้า" },
  { id: "s_cloud_sword", name: "กระบี่เมฆาไหลเวียน", type: "sword", grade: 2, school: "orthodox", sect: "cloud", desc: "ใช้ความอ่อนสยบความแข็ง ดุจเมฆที่ไม่มีวันถูกฟันขาด", strong: "รับแล้วสวนกลับได้ดีที่สุด", weak: "อ่อนแอเมื่อต้องบุกก่อน" },
  { id: "s_alliance_sword", name: "กระบี่สามพันธมิตร", type: "sword", grade: 2, school: "orthodox", sect: "alliance", desc: "เพลงกระบี่พลิ้วไหวเหมือนกลีบดอกเหมยกลางพายุ", strong: "เร็วและเปลี่ยนทิศได้ไม่คาดฝัน", weak: "ใช้แรงมาก" },
  { id: "s_willow_needle", name: "เข็มใบหลิว", type: "hidden", grade: 1, school: "neutral", desc: "อาวุธลับที่หญิงในยุทธภพนิยมพกไว้ในปิ่นผม", strong: "แม่นยำและเงียบ", weak: "ไม่มีพลังทำลายมาก" },
  { id: "s_beggar_staff", name: "กระบองตีสุนัข", type: "staff", grade: 2, school: "orthodox", sect: "beggar", desc: "กระบองไม้ไผ่ที่ปราบได้ทั้งหมาและมาร", strong: "พลิกแพลงได้ไม่สิ้นสุด", weak: "ต้องฝึกนานกว่าจะเห็นผล" },
  { id: "s_tang_poison", name: "ร้อยพิษตระกูลถัง", type: "poison", grade: 2, school: "unorthodox", sect: "tang", desc: "พิษร้อยชนิดในแขนเสื้อ", strong: "ศัตรูเสียเลือดต่อเนื่อง", weak: "ฝ่ายธรรมะเกลียดชัง" },
  { id: "s_cult_palm", name: "ฝ่ามือโลหิตมาร", type: "palm", grade: 2, school: "demonic", sect: "cult", desc: "วิชาพื้นฐานของพรรคมาร เผาผลาญเลือดตัวเองเป็นพลัง", strong: "รุนแรงมาก", weak: "กัดกินร่างกายผู้ใช้" },
  // ── วิชาลับสำนัก ──
  { id: "x_yijin", name: "คัมภีร์เปลี่ยนเส้นเอ็น", type: "internal", grade: 3, school: "orthodox", sect: "vajra", desc: "วิชาลมปราณสูงสุดของวัดวัชระ", strong: "ลมปราณหนาแน่นและบริสุทธิ์", weak: "ขัดกับวิชามารทุกชนิด" },
  { id: "x_taiji", name: "ลมปราณเมฆาไร้ขั้ว", type: "internal", grade: 3, school: "orthodox", sect: "cloud", desc: "ลมปราณที่หมุนเวียนไม่สิ้นสุด", strong: "อายุยืน ฟื้นตัวเร็ว", weak: "ต้องใช้ความเข้าใจสูงมาก" },
  { id: "x_heavenly_demon", name: "คัมภีร์มารสวรรค์", type: "internal", grade: 3, school: "demonic", sect: "cult", desc: "วิชาของประมุขพรรคมาร", strong: "พลังพุ่งเร็วที่สุดในใต้หล้า", weak: "ธาตุไฟเข้าแทรกง่าย ขัดกับวิชาธรรมะทุกชนิด" },
  { id: "x_dragon_palm", name: "สิบแปดฝ่ามือพิชิตมังกร", type: "palm", grade: 3, school: "orthodox", sect: "beggar", desc: "วิชาที่ประมุขพรรคกระยาจกถ่ายทอดให้คนเดียวในแต่ละรุ่น", strong: "พลังทำลายสูงสุดในฝ่ายธรรมะ", weak: "กินลมปราณมหาศาล" },
  { id: "x_tang_rain", name: "พิรุณเข็มพันเล่ม", type: "hidden", grade: 3, school: "unorthodox", sect: "tang", desc: "อาวุธลับสูงสุดของตระกูลถัง", strong: "ไม่มีใครหลบได้ทั้งหมด", weak: "เข็มแต่ละชุดราคาแพงมาก" },
  { id: "x_alliance_seal", name: "ตราลมปราณพันธมิตร", type: "internal", grade: 3, school: "orthodox", sect: "alliance", desc: "วิชาลมปราณที่ผู้นำพันธมิตรใช้ประสานกำลังคน", strong: "มั่นคง ไม่มีจุดอ่อนชัดเจน", weak: "ไม่โดดเด่นด้านใดเลย" },
  // ── วิชาตำนานที่สูญหาย ──
  { id: "l_nine_yang", name: "คัมภีร์เก้าสุริยัน", type: "internal", grade: 4, school: "neutral", desc: "วิชาลมปราณที่หายไปจากยุทธภพสามร้อยปี", strong: "ร่างกายแทบไม่บาดเจ็บ พิษไม่ระคาย", weak: "ต้องฝึกนานมากกว่าจะสมบูรณ์" },
  { id: "l_lone_sword", name: "เก้ากระบวนกระบี่เดียวดาย", type: "sword", grade: 4, school: "neutral", desc: "กระบี่ที่ไม่มีท่า จึงไม่มีใครอ่านทางออก", strong: "ชนะท่าทุกท่าในใต้หล้า", weak: "ต้องใช้ความเข้าใจสูงยิ่ง" },
  { id: "l_beggar_breath", name: "ลมหายใจขอทานเฒ่า", type: "internal", grade: 4, school: "orthodox", desc: "วิธีหายใจที่ขอทานลึกลับสอนให้ในศาลเจ้าร้าง", strong: "เปิดเส้นชีพจรที่อุดตันได้", weak: "ไม่มีใครรู้ว่ามันมาจากไหน" },
  { id: "l_cave_scroll", name: "คัมภีร์ใต้น้ำตก", type: "palm", grade: 4, school: "neutral", desc: "คัมภีร์หนังสัตว์จากถ้ำลับ ของปรมาจารย์ที่ไม่มีใครรู้จักชื่อ", strong: "พลังฝ่ามือมหาศาล", weak: "บางบทเขียนเลือนจนต้องเดาเอง" },
  { id: "l_forbidden", name: "วิชาต้องห้ามปกดำ", type: "internal", grade: 4, school: "demonic", desc: "คัมภีร์ที่สำนักเก็บไว้ไม่ให้ใครฝึก", strong: "พลังก้าวกระโดด", weak: "กัดกินจิตใจ เสี่ยงธาตุไฟเข้าแทรกทุกปี" },
  // ── วิชาทั่วไปชุดสอง (MURIM_V2 ระยะ 2) ──
  { id: "a_tiger_saber", name: "ดาบพยัคฆ์ห้าท่า", type: "saber", grade: 1, school: "neutral", desc: "เพลงดาบของมือปราบและผู้คุ้มกันทั่วแผ่นดิน", strong: "หนักแน่น ตรงไปตรงมา", weak: "เปิดช่องว่างเมื่อฟันพลาด" },
  { id: "a_iron_spear", name: "ทวนเหล็กทะลวงทัพ", type: "spear", grade: 1, school: "neutral", desc: "ทวนของทหารในสนามรบ ไม่สวยแต่ฆ่าคนได้จริง", strong: "ระยะยาว ใช้ในศึกใหญ่ได้ดี", weak: "อืดอาดในที่แคบ" },
  { id: "a_point_finger", name: "ดรรชนีสกัดสามสิบหกจุด", type: "finger", grade: 2, school: "neutral", desc: "จิ้มจุดชีพจรให้ศัตรูขยับไม่ได้ — ชนะได้โดยไม่ต้องหลั่งเลือด", strong: "หยุดศัตรูโดยไม่ฆ่า จับเป็นได้", weak: "ไร้ผลกับคนที่ย้ายจุดชีพจรได้" },
  { id: "a_eagle_claw", name: "กรงเล็บพญาอินทรี", type: "finger", grade: 1, school: "neutral", desc: "จับ บิด หักข้อต่อ — วิชาของมือปราบทางเหนือ", strong: "ปลดอาวุธศัตรูได้ง่าย", weak: "ต้องเข้าประชิดตัว" },
  { id: "a_drunken_fist", name: "หมัดเมาแปดเซียน", type: "fist", grade: 2, school: "neutral", desc: "ยิ่งเมายิ่งเก่ง ล้มเหมือนจะล้มแต่ไม่เคยล้ม", strong: "คาดเดาไม่ได้ ศัตรูประมาท", weak: "ต้องดื่มเหล้าก่อนสู้ เสียสุขภาพ" },
  { id: "a_narrow_fist", name: "หมัดประตูแคบ", type: "fist", grade: 1, school: "neutral", desc: "หมัดระยะประชิดที่หญิงชราคนหนึ่งคิดขึ้นในซอยแคบ", strong: "เร็วที่สุดในระยะสามฟุต", weak: "สู้คนถืออาวุธยาวลำบาก" },
  { id: "a_grass_float", name: "เหยียบหญ้าไม่ไหว", type: "qinggong", grade: 2, school: "neutral", desc: "วิ่งบนยอดหญ้าโดยไม่ให้ใบหญ้าโน้ม", strong: "หนีได้ ไล่ทัน", weak: "กินลมปราณเร็ว" },
  { id: "a_iron_shirt", name: "เสื้อเกราะเหล็ก", type: "internal", grade: 2, school: "neutral", desc: "ฝึกให้ผิวหนังรับดาบได้ — เจ็บทุกวันจนชิน", strong: "บาดเจ็บน้อยลงมาก", weak: "มีจุดตายจุดเดียวที่ต้องปกปิดตลอดชีวิต" },
  { id: "a_flying_dagger", name: "มีดบินไร้เงา", type: "hidden", grade: 2, school: "unorthodox", desc: "มีดเล่มเดียวที่ไม่มีใครเห็นตอนออกจากมือ", strong: "ปลิดชีพก่อนศัตรูรู้ตัว", weak: "มีดหายแล้วก็หมดทาง" },
  { id: "a_hundred_herbs", name: "ตำราร้อยสมุนไพร", type: "medicine", grade: 2, school: "neutral", desc: "ตำราหมอยาที่บันทึกต่อกันมาสิบชั่วคน", strong: "รักษาพิษและแผลได้แทบทุกชนิด", weak: "ไม่ช่วยในการต่อสู้เลย" },
  { id: "a_lion_roar", name: "สิงห์คำรามฝ่าฟ้า", type: "internal", grade: 2, school: "orthodox", desc: "ตะโกนด้วยลมปราณจนศัตรูหูอื้อ มือสั่น", strong: "ทำลายขวัญคนหมู่มาก", weak: "ใช้แล้วคอแหบสามวัน" },
  { id: "a_cotton_palm", name: "ฝ่ามือนุ่นห่อเหล็ก", type: "palm", grade: 1, school: "neutral", desc: "ฝ่ามือที่ดูเบาเหมือนสำลี แต่แรงทะลุไปถึงอวัยวะภายใน", strong: "บาดเจ็บภายใน ศัตรูไม่รู้ตัว", weak: "ช้ากว่าดาบ" },
  // ── สำนักและตระกูลชุดใหม่ ──
  { id: "s_plum_sword", name: "กระบี่บุปผาเหมยยี่สิบสี่ท่า", type: "sword", grade: 2, school: "orthodox", sect: "plum", desc: "เพลงกระบี่ของสำนักเขาบุปผา ปลายกระบี่บานเป็นดอกเหมยกลางอากาศ", strong: "งดงามและหลอกตา ศัตรูไม่รู้ว่าดอกไหนจริง", weak: "ต้องฝึกนานกว่าจะเห็นดอกแรก" },
  { id: "x_plum_rain", name: "กระบี่ดอกเหมยโปรยฟ้า", type: "sword", grade: 3, school: "orthodox", sect: "plum", desc: "วิชาลับที่สำนักเขาบุปผาทำหายไปเมื่อร้อยปีก่อน — ดอกเหมยร้อยดอกร่วงพร้อมกัน", strong: "โจมตีทุกทิศพร้อมกัน", weak: "ใช้ลมปราณหมดตัวในครั้งเดียว" },
  { id: "s_snow_sword", name: "กระบี่หิมะพันลี้", type: "sword", grade: 2, school: "orthodox", sect: "snow", desc: "กระบี่ที่เย็นจนลมหายใจของศัตรูเป็นไอ", strong: "ทำให้ศัตรูช้าลง", weak: "อ่อนแรงในแดนใต้ที่ร้อนชื้น" },
  { id: "x_snow_heart", name: "ลมปราณใจหิมะ", type: "internal", grade: 3, school: "orthodox", sect: "snow", desc: "ใจสงบเหมือนหิมะบนยอดเขาที่ไม่เคยละลาย", strong: "ธาตุไฟไม่เข้าแทรก อายุยืน", weak: "ความรู้สึกจางลงทีละน้อย" },
  { id: "s_jade_palm", name: "ฝ่ามือหยกขาว", type: "palm", grade: 2, school: "orthodox", sect: "jade", desc: "ฝ่ามือของภิกษุณีเขาหยก นุ่มนวลจนศัตรูไม่ทันระวัง", strong: "สยบโดยไม่ฆ่า", weak: "ไม่หนักพอกับคนเกราะหนา" },
  { id: "x_jade_sword", name: "กระบี่สิบสองเทพธิดา", type: "sword", grade: 3, school: "orthodox", sect: "jade", desc: "เพลงกระบี่ที่เจ้าสำนักเขาหยกถ่ายทอดให้ศิษย์หญิงคนเดียวในแต่ละรุ่น", strong: "เร็วและพลิ้วที่สุดในฝ่ายธรรมะ", weak: "ต้องรักษาศีลเคร่งครัด" },
  { id: "s_nangong_sword", name: "กระบี่ฟ้าคำรามหนานกง", type: "sword", grade: 2, school: "orthodox", sect: "nangong", desc: "กระบี่ของตระกูลหนานกง ทุกท่าดังเหมือนฟ้าผ่า", strong: "หนักและเร็วในเวลาเดียวกัน", weak: "ทุกคนในยุทธภพรู้จักท่าของตระกูลนี้" },
  { id: "x_nangong_thunder", name: "กระบี่สายฟ้ามังกรฟ้า", type: "sword", grade: 3, school: "orthodox", sect: "nangong", desc: "วิชาประจำผู้นำตระกูลหนานกง", strong: "พลังทำลายสูงสุดในห้าตระกูล", weak: "ตระกูลจะไม่ยอมให้คนนอกตระกูลได้ไป" },
  { id: "s_peng_saber", name: "ดาบฟ้าคะนองตระกูลเผิง", type: "saber", grade: 2, school: "orthodox", sect: "peng", desc: "ดาบหนักที่ตระกูลเผิงใช้ผ่าศัตรูพร้อมโล่", strong: "ทลายการป้องกัน", weak: "ใจร้อนตามคนในตระกูล" },
  { id: "x_peng_wild", name: "ดาบคลั่งร้อยชั่ง", type: "saber", grade: 3, school: "orthodox", sect: "peng", desc: "ยิ่งโกรธยิ่งแรง — ผู้นำตระกูลเผิงทุกคนตายเพราะโกรธ", strong: "แรงที่สุดในบรรดาวิชาดาบ", weak: "ควบคุมตัวเองไม่ได้" },
  { id: "s_zhuge_array", name: "ค่ายกลแปดทิศ", type: "hidden", grade: 2, school: "orthodox", sect: "zhuge", desc: "กองหินแปดกอง ใครเดินเข้าไปก็หลงทาง", strong: "ศัตรูมากแค่ไหนก็หลงได้", weak: "ต้องมีเวลาเตรียม" },
  { id: "x_zhuge_crossbow", name: "หน้าไม้สิบดอกเทพกลไก", type: "hidden", grade: 3, school: "orthodox", sect: "zhuge", desc: "หน้าไม้ที่ยิงสิบดอกในลมหายใจเดียว ตระกูลจูเก๋อไม่เคยขายให้ใคร", strong: "คนธรรมดาก็ฆ่ายอดฝีมือได้", weak: "ลูกดอกแต่ละชุดสร้างนานหนึ่งเดือน" },
  { id: "s_blood_claw", name: "กรงเล็บโลหิต", type: "finger", grade: 2, school: "demonic", sect: "blood", desc: "เล็บที่แช่เลือดสัตว์ทุกคืนจนแข็งเหมือนเหล็ก", strong: "ศัตรูเลือดไหลไม่หยุด", weak: "ทุกคนที่เห็นแผลรู้ว่าใครทำ" },
  { id: "x_blood_sea", name: "คัมภีร์ทะเลโลหิต", type: "internal", grade: 3, school: "demonic", sect: "blood", desc: "ดูดเลือดและลมปราณของศัตรูมาเป็นของตัวเอง", strong: "ยิ่งฆ่ายิ่งแข็งแกร่ง", weak: "ต้องฆ่าเรื่อยๆ ไม่อย่างนั้นลมปราณย้อนกลับมากัดกิน" },
  { id: "s_shadow_step", name: "ก้าวเงาพันหน้า", type: "qinggong", grade: 2, school: "unorthodox", sect: "shadow", desc: "เดินในฝูงชนแล้วหายไปเหมือนไม่เคยมีตัวตน", strong: "สะกดรอยและหนีได้ดีที่สุด", weak: "ไม่ช่วยในการต่อสู้ซึ่งหน้า" },
  { id: "x_shadow_kill", name: "ดาบเงาเดียวปลิดชีพ", type: "saber", grade: 3, school: "unorthodox", sect: "shadow", desc: "ฟันครั้งเดียว ไม่เคยต้องฟันครั้งที่สอง", strong: "ลอบสังหารสำเร็จเกือบทุกครั้ง", weak: "ถ้าพลาดครั้งแรก ก็ไม่มีแผนสอง" },
  { id: "s_green_saber", name: "ดาบป่าเขียว", type: "saber", grade: 2, school: "unorthodox", sect: "blackway", desc: "ดาบของโจรป่าเขียวร้อยค่าย ฟันแบบคนที่ไม่มีอะไรจะเสีย", strong: "ดุดัน ข่มขวัญ", weak: "ไม่มีท่าป้องกันเลย" },
  { id: "x_green_chain", name: "โซ่เหล็กร้อยวง", type: "hidden", grade: 3, school: "unorthodox", sect: "blackway", desc: "โซ่ที่หัวหน้าโจรใหญ่ใช้รัดคอแม่ทัพมาแล้วสามคน", strong: "จับเป็นได้แม้ยอดฝีมือ", weak: "ต้องใช้แรงมหาศาล" },
  // ── วิชาตำนานชุดสอง ──
  { id: "l_sword_tomb", name: "กระบี่ไร้นามจากสุสานกระบี่", type: "sword", grade: 4, school: "neutral", desc: "เจ้าของสุสานกระบี่ฝังกระบี่ไว้ทีละเล่มตามวัย — เล่มสุดท้ายคือไม้ธรรมดา", strong: "ไม่ต้องใช้กระบี่ดีก็ชนะได้", weak: "ต้องเข้าใจว่าทำไมไม้ชนะเหล็ก" },
  { id: "l_heaven_palm", name: "ฝ่ามือพลิกฟ้า", type: "palm", grade: 4, school: "neutral", desc: "ฝ่ามือเดียวที่เคยพังกำแพงเมืองทั้งด้าน", strong: "พลังทำลายสูงสุดที่บันทึกไว้", weak: "ใช้ได้สามครั้งในชีวิต" },
  { id: "l_dragon_spear", name: "ทวนมังกรเจ็ดดาว", type: "spear", grade: 4, school: "neutral", desc: "ทวนของขุนพลที่ฝ่าทัพแสนคนเพื่ออุ้มเด็กคนเดียวออกมา", strong: "ไม่มีใครขวางได้ในสนามรบ", weak: "สอนต่อได้เฉพาะคนที่ภักดีจริง" },
  { id: "l_moon_glaive", name: "ง้าวจันทร์เสี้ยวมังกรเขียว", type: "saber", grade: 4, school: "neutral", desc: "ง้าวหนักแปดสิบสองชั่งของขุนพลเคราดำผู้ไม่เคยทรยศพี่น้อง", strong: "ฟันครั้งเดียวขาดทั้งคนทั้งม้า", weak: "หนักจนคนธรรมดายกไม่ขึ้น" },
  { id: "l_six_meridian", name: "ดรรชนีเทพหกชีพจร", type: "finger", grade: 4, school: "neutral", desc: "ลมปราณพุ่งออกจากนิ้วเป็นกระบี่ไร้รูปหกเล่ม", strong: "ฆ่าคนจากระยะสิบก้าวโดยไม่ต้องถืออาวุธ", weak: "ใช้ได้บ้างไม่ได้บ้างตามใจ" },
  { id: "l_ghost_step", name: "ก้าวภูตพันลี้", type: "qinggong", grade: 4, school: "neutral", desc: "ก้าวเดียวถึงหลังคาอีกฝั่งของเมือง", strong: "ไม่มีใครตามทัน", weak: "ร่างกายเหนื่อยล้าหนักหลังใช้" },
  { id: "l_immortal_scroll", name: "คัมภีร์เซียนอมตะ", type: "internal", grade: 4, school: "neutral", desc: "คัมภีร์ของนักพรตที่อยู่มาสามร้อยปี — ไม่ได้สอนให้เก่ง แต่สอนให้ไม่ตาย", strong: "อายุยืนกว่าคนทั่วไปมาก", weak: "ต้องตัดความโลภทั้งหมด" },
];

export const artById = (id: string) => ARTS.find((a) => a.id === id);

/** ข้อมูลวิชาที่รู้ (รวมวิชาที่คิดค้นเอง) */
export function artInfo(k: KnownArt): ArtDef {
  if (k.own) return { id: k.id, name: k.own.name, type: k.own.type, grade: 4, school: k.own.school, desc: "วิชาที่คุณคิดค้นขึ้นเอง", strong: "ไม่มีใครเคยเห็น จึงไม่มีใครรับทัน", weak: "ยังไม่เสถียร ต้องขัดเกลาด้วยการใช้จริง" };
  return artById(k.id) ?? ARTS[0];
}

export const masteryWord = (m: number) => (m >= 100 ? "เหนือรูปแบบ" : m >= 80 ? "สมบูรณ์" : m >= 50 ? "ชำนาญใหญ่" : m >= 20 ? "ชำนาญน้อย" : "เริ่มเรียน");
const tier = (m: number) => (m >= 100 ? 5 : m >= 80 ? 4 : m >= 50 ? 3 : m >= 20 ? 2 : 1);

export const artsOf = (l: Life): KnownArt[] => (l.mwArts ??= []);
export const knows = (l: Life, id: string) => artsOf(l).some((a) => a.id === id);

/** เรียนวิชาใหม่ — คืนข้อความต่อท้าย */
export function learn(l: Life, id: string, src: string, quiet = false): string {
  if (knows(l, id)) return "";
  const a = artById(id);
  if (!a) return "";
  artsOf(l).push({ id, m: 0, src, since: l.age });
  if (!quiet) log(l, `📜 ได้เรียน「${a.name}」(${GRADE_NAME[a.grade]} · ${TYPE_NAME[a.type]}) — ${a.desc}`, "good");
  return ` (ได้วิชา「${a.name}」)`;
}

// ───────── ลมปราณ (ปี) · ความเข้าใจ ─────────

export const qiYears = (l: Life) => Number(l.flags.mwQi ?? 0);
export function addQi(l: Life, years: number) {
  // พรสวรรค์: ลมปราณสะสมเร็ว/ช้าลง (ไม่กระทบตอนเสียลมปราณ)
  const m = years > 0 ? Math.max(0.2, 1 + gift(l, "qi")) : 1;
  l.flags.mwQi = Math.round((qiYears(l) + years * m) * 10) / 10;
}

/** ความเข้าใจ (0–100): ความเร็วในการเรียน และโอกาสคิดค้นวิชาเอง — เกิดมาไม่เท่ากัน ค่อยๆ ลึกซึ้งขึ้นตามวัยและการศึกษา */
export function comprehension(l: Life): number {
  if (l.flags.mwComp === undefined) {
    let h = 0;
    for (const ch of l.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    l.flags.mwComp = clamp(Math.round(l.stats.smarts * 0.55 + (h % 31)), 5, 95);
  }
  return Number(l.flags.mwComp);
}

/** โบนัสพลังต่อสู้จากวิชาและลมปราณ (ยุทธภพ) — เพดานราวหนึ่งขั้นครึ่ง */
export function martialBonus(l: Life): number {
  if (l.worldId !== "murim" || !l.power) return 0;
  let arts = 0;
  for (const k of artsOf(l)) {
    const a = artInfo(k);
    const fight = a.type === "medicine" ? 0.2 : a.type === "qinggong" ? 0.6 : 1;
    arts += a.grade * tier(k.m) * 0.45 * fight;
  }
  const qi = Math.min(10, Math.sqrt(qiYears(l)) * 1.3);
  // อาวุธที่ตีเอง (งานช่างตีเหล็ก): ธรรมดา +1.5 · ชั้นดี +3 · ชั้นเลิศ +4.5 · ในตำนาน +6
  const weapon = Number(l.flags.mwWeaponTier ?? 0) * 1.5;
  return Math.round(Math.min(18, arts) + qi + weapon);
}

/** ความเร็วในการเรียน (คูณ) */
export const learnRate = (l: Life) => (0.6 + comprehension(l) / 100 + rootOf(l) * 0.05) * (1 + gift(l, "learn"));

/** ฝึกวิชาหนึ่งวิชา — เพิ่มความชำนาญตามความเข้าใจ */
export function practise(l: Life, id: string, base: number): number {
  const k = artsOf(l).find((a) => a.id === id);
  if (!k) return 0;
  const cap = (l.power?.rank ?? 0) >= 6 ? 100 : 99; // เหนือรูปแบบได้เฉพาะขั้นหลอมรวมขึ้นไป
  const before = k.m;
  k.m = clamp(Math.round(k.m + base * learnRate(l)), 0, cap);
  if (masteryWord(k.m) !== masteryWord(before)) log(l, `✨「${artInfo(k).name}」ก้าวสู่ระดับ${masteryWord(k.m)}`, "good");
  return k.m - before;
}

/** ลมปราณต่างขั้วในตัวเดียวกัน: ธรรมะ + มาร → เสี่ยงธาตุไฟเข้าแทรกทุกปี */
export function conflicted(l: Life): boolean {
  const internals = artsOf(l).map(artInfo).filter((a) => a.type === "internal" || a.school === "demonic");
  return internals.some((a) => a.school === "orthodox") && internals.some((a) => a.school === "demonic");
}

/** กำลังภายใน (ปี) ที่ต้องสะสมก่อนทะลวงจากขั้น r — ยอดฝีมือขั้นสูงหายากจริง (MURIM_PLAN §4) */
export const QI_NEED = [0, 3, 24, 55, 85, 120, 160, 210, 999];
/** รากฐาน (ผลการตรวจกระดูกตอนคัดศิษย์) 0–8: ยิ่งดียิ่งเรียนเร็ว สะสมลมปราณเร็ว */
export const rootOf = (l: Life) => Number(l.flags.mwRoot ?? l.power?.rank ?? 0);

/** อายุขัยที่ยืดออกตามขั้นฝีมือ (ปี) */
export const REALM_LIFE = [0, 0, 0, 2, 8, 15, 25, 40, 60];

/** ทุกปี: ลมปราณสะสมเอง · วิชาขัดกันอาจแปรปรวน · ความเข้าใจลึกขึ้นตามวัย */
export function tickMartial(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  comprehension(l);
  if (l.power) {
    const hasInternal = artsOf(l).some((k) => artInfo(k).type === "internal");
    addQi(l, (0.15 + (hasInternal ? 0.25 : 0) + (l.flags.plan === "train" ? 0.75 : 0)) * (1 + rootOf(l) * 0.14));
  }
  if (l.age % 10 === 0 && l.age >= 20 && Number(l.flags.mwComp) < 95) l.flags.mwComp = Number(l.flags.mwComp) + 1;
  if (conflicted(l) && chance(l, 0.08 * Math.max(0, 1 + gift(l, "deviation")))) {
    l.stats.health = clamp(l.stats.health - randInt(l, 6, 14), 0, 100);
    log(l, "🔥 ลมปราณธรรมะกับมารในตัวคุณปะทะกันกลางดึก — เลือดทะลักออกจากปาก ธาตุไฟเข้าแทรก", "bad");
    if (chance(l, 0.3)) injure(l, "meridians", "internal", 2, "ลมปราณต่างขั้วปะทะกัน");
  }
  if (knows(l, "l_forbidden") && chance(l, 0.06)) {
    l.stats.happiness = clamp(l.stats.happiness - 6, 0, 100);
    log(l, "🌑 เสียงกระซิบในหัวดังขึ้นทุกครั้งที่คุณโกรธ — วิชาต้องห้ามกำลังกินใจคุณทีละนิด", "bad");
  }
}
