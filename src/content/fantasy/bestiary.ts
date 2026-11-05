// สมุดสัตว์อสูร: เจอแล้วจำจุดอ่อนได้ · เจอบ่อยยิ่งสู้ง่าย (Release 9)
// ไม่พึ่งไฟล์อื่นนอกจาก state เพื่อให้ดันเจี้ยนและงานกิลด์ใช้ได้โดยไม่วนกัน
import type { Life } from "../../engine/types";
import { fl } from "./state";

export interface BeastEntry { name: string; weak: string; home: string }
/** จุดอ่อนเป็นคำ (ไฟ เงิน หอก การย่อง) และถิ่นที่อยู่ · ชื่อตรงกับสัตว์ในงานกิลด์และบอสดันเจี้ยน */
export const BESTIARY: BeastEntry[] = [
  { name: "ซาลาแมนเดอร์เพลิง", weak: "น้ำและหอกยาว", home: "ปล่องภูเขาไฟ" },
  { name: "โกเลมศิลา", weak: "ลมและค้อน", home: "เหมืองร้าง" },
  { name: "ภูตหนองน้ำ", weak: "ดินและไฟคบ", home: "หนองน้ำเค็ม" },
  { name: "ฮาร์ปี้", weak: "ไฟและธนู", home: "หน้าผาชายทะเล" },
  { name: "ซอมบี้ฝูงใหญ่", weak: "แสงและไฟ", home: "สุสานเก่า" },
  { name: "อัศวินเงา", weak: "แสงและเงิน", home: "ปราสาทร้าง" },
  { name: "ไวเวิร์นหนุ่ม", weak: "น้ำและหอก", home: "ยอดเขาหิน" },
  { name: "ราชาก็อบลิน", weak: "ไฟและการย่องเข้าหา", home: "รังใต้เนิน" },
  { name: "ราชาก็อบลินอ้วน", weak: "ไฟ", home: "รังก็อบลินใต้เนิน" },
  { name: "ราชินีศพในชุดเจ้าสาว", weak: "แสงและเงิน", home: "สุสานจมน้ำ" },
  { name: "งูผลึกเก้าหัว", weak: "ดินและค้อน", home: "ถ้ำผลึกร้องเพลง" },
  { name: "อัศวินกระดูกมังกร", weak: "น้ำและแสง", home: "หุบกระดูกมังกร" },
  { name: "สิ่งที่รออยู่ใต้หอคอย", weak: "แสง", home: "หอคอยเหว" },
  { name: "หมาป่าเขาเดียว", weak: "ไฟและเสียงดัง", home: "ป่าทางเหนือ" },
  { name: "โทรลใต้สะพาน", weak: "ไฟและแสงแดด", home: "ใต้สะพานหิน" },
  { name: "ไคเมร่าสามหัว", weak: "หอกยาวและน้ำ", home: "หุบเขาแห้ง" },
];
export const entryOf = (name: string) => BESTIARY.find((b) => b.name === name);
export const timesMet = (l: Life, name: string) => fl(l).bestiary?.[name] ?? 0;
export const knows = (l: Life, name: string) => timesMet(l, name) > 0;
/** เจอครั้งแรกจำจุดอ่อนได้ · สามครั้งขึ้นไปรู้ทางของมัน */
export const beastEdge = (l: Life, name: string) => (timesMet(l, name) >= 3 ? 0.08 : timesMet(l, name) >= 1 ? 0.04 : 0);
export function meet(l: Life, name: string) {
  const f = fl(l);
  f.bestiary = { ...f.bestiary, [name]: timesMet(l, name) + 1 };
}
