import { registerEvents } from "../../engine/events";
import { FATE_EVENTS } from "./fate";
import "./focus"; // ลงทะเบียน Focus ประจำปี
import { PARTY_EVENTS } from "./party";

let loaded = false;

/** event ที่ใช้ร่วมกันทุกโลก (ข้อความเปลี่ยนตามโลก) */
export function loadSharedEvents() {
  if (loaded) return;
  loaded = true;
  registerEvents([...FATE_EVENTS, ...PARTY_EVENTS]);
}
