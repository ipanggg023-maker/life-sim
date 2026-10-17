import { registerEvents } from "../../engine/events";
import { ORDINARY_EVENTS } from "./events";
import { CHALLENGE, SYSTEM_ARRIVAL } from "./system";
import "./careers"; // อาชีพเฉพาะทาง (ใช้ STR–LUK)
import "./sys"; // ระบบชีวิต: ค่าสถานะ เลเวล การฝึก
import { M21_SYS_EVENTS } from "./m21sys"; // M21: วิวัฒนาการระบบ ร้านค้า ดวงตาประเมินค่า
import { M21_QUEST_EVENTS } from "./m21quests"; // M21: ภารกิจลงโทษ/ลับ/ต่อเนื่อง
import { M21_CAREER_EVENTS } from "./m21careers"; // M21: อาชีพเฉพาะทางเพิ่ม + เหตุการณ์ในอาชีพ
import { M21_LIFE_EVENTS } from "./m21life"; // M21: ชีวิตในโลกธรรมดา (ตามสายค่าสถานะ)

let loaded = false;

/** โลกธรรมดา — มีแค่คุณคนเดียวที่มีระบบ (ใช้ชีวิตประจำวันของโลกยุคปัจจุบันร่วมกับโลก Hunter) */
export function loadOrdinaryWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([SYSTEM_ARRIVAL, CHALLENGE, ...ORDINARY_EVENTS, ...M21_SYS_EVENTS, ...M21_QUEST_EVENTS, ...M21_CAREER_EVENTS, ...M21_LIFE_EVENTS], "ordinary");
}
