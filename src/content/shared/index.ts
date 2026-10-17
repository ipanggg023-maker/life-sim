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

let loaded = false;

/** event ที่ใช้ร่วมกันทุกโลก (ข้อความเปลี่ยนตามโลก) */
export function loadSharedEvents() {
  if (loaded) return;
  loaded = true;
  registerEvents([...FATE_EVENTS, ...PARTY_EVENTS, ...NEMESIS_EVENTS, ...SECRET_QUEST_EVENTS, ...PAST_LIFE_EVENTS, ...SPONSOR_EVENTS, ...PHONE_EVENTS, DUAL_CLASS, ...CHAIN_EVENTS]);
}
