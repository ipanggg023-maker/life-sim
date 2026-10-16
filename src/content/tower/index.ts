import { registerEvents } from "../../engine/events";
import { CLIMB, INVITATION } from "./climb";
import { TOWER_EVENTS } from "./events";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของโลกหอคอย

let loaded = false;

/** โลกหอคอย — ต้องโหลดโลก Hunter ก่อน (ใช้ชีวิตประจำวันของโลกยุคปัจจุบันร่วมกัน) */
export function loadTowerWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([INVITATION, CLIMB, ...TOWER_EVENTS], "tower");
}
