import { registerEvents } from "../../engine/events";
import { FATE_EVENTS } from "./fate";

let loaded = false;

/** event ที่ใช้ร่วมกันทุกโลก (ข้อความเปลี่ยนตามโลก) */
export function loadSharedEvents() {
  if (loaded) return;
  loaded = true;
  registerEvents(FATE_EVENTS);
}
