import { registerEvents } from "../../engine/events";
import { ORDINARY_EVENTS } from "./events";
import { CHALLENGE, SYSTEM_ARRIVAL } from "./system";
import "./careers"; // อาชีพตามเส้นทางของระบบชีวิต

let loaded = false;

/** โลกธรรมดา — มีแค่คุณคนเดียวที่มีระบบ (ใช้ชีวิตประจำวันของโลกยุคปัจจุบันร่วมกับโลก Hunter) */
export function loadOrdinaryWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([SYSTEM_ARRIVAL, CHALLENGE, ...ORDINARY_EVENTS], "ordinary");
}
