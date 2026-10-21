import { registerEvents } from "../../engine/events";
import { FATE_EVENTS } from "./fate";
import { NEMESIS_EVENTS } from "./nemesis";
import { PARTY_EVENTS } from "./party";
import { PAST_LIFE_EVENTS } from "./pastLife";
import { SECRET_QUEST_EVENTS } from "./systemQuest";
import { SPONSOR_EVENTS } from "./sponsorEvents";
import "./activities"; // งานพิเศษ / พักผ่อน (แทน Focus)
import "./skillUse"; // ใช้สกิลในฉาก + สกิลรักษาฟื้นสุขภาพ
import "./passiveHook"; // สกิลติดตัว
import "./achieveHook"; // แจ้งความสำเร็จระหว่างเล่น
import { PHONE_EVENTS } from "../phone";
import { DUAL_CLASS } from "./dualClass";
import { CHAIN_EVENTS } from "./chains";
import { COUNTRY_EVENTS } from "./countryEvents"; // M21: เหตุการณ์เฉพาะประเทศ ไทย/เกาหลี/ญี่ปุ่น
import { FREE_EVENTS } from "./freedom"; // M23: อิสระในการเล่น
import { MODERN23_EVENTS } from "./modern23";
import { LIFE23_EVENTS } from "./life23";
import "./collection"; // M23: ตู้สะสมของวิญญาณ
import { CLUB_EVENTS } from "./clubs"; // M25: ชมรม
import { BIZ_EVENTS } from "./business"; // M25: ธุรกิจและทรัพย์สิน
import { FRIEND_ORPHAN, RELATION_EVENTS } from "./relations"; // M25: ลูกมีเรื่องราว + เมนูคุย

let loaded = false;

/** event ที่ใช้ร่วมกันทุกโลก (ข้อความเปลี่ยนตามโลก) */
export function loadSharedEvents() {
  if (loaded) return;
  loaded = true;
  registerEvents(COUNTRY_EVENTS, "modern");
  registerEvents(MODERN23_EVENTS, "modern");
  registerEvents([...RELATION_EVENTS, FRIEND_ORPHAN, ...LIFE23_EVENTS, ...FREE_EVENTS, ...FATE_EVENTS, ...PARTY_EVENTS, ...NEMESIS_EVENTS, ...PHONE_EVENTS, ...CHAIN_EVENTS]);
  // ระบบ/ภารกิจลับ/ความทรงจำข้ามชาติ/ดวงดาว/คลาสที่สอง — ไม่มีในโลกแบบสมจริง
  registerEvents([...SECRET_QUEST_EVENTS, ...PAST_LIFE_EVENTS, ...SPONSOR_EVENTS, DUAL_CLASS], undefined, ["murim"]);
  // ชมรมโรงเรียน / ธุรกิจแบบยุคปัจจุบัน — ยุทธภพมีระบบของตัวเองตามแผน
  registerEvents([...CLUB_EVENTS, ...BIZ_EVENTS], undefined, ["murim"]);
}
