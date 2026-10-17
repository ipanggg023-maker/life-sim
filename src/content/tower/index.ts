import { registerEvents } from "../../engine/events";
import { yearHooks } from "../../engine/game";
import { CLIMB, INVITATION } from "./climb";
import { TOWER_EVENTS } from "./events";
import { M19_EVENTS } from "./m19";
import { towerYear } from "./m19sys";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของโลกหอคอย

let loaded = false;

/** โลกหอคอย — ต้องโหลดโลก Hunter ก่อน (ใช้ชีวิตประจำวันของโลกยุคปัจจุบันร่วมกัน) */
export function loadTowerWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([INVITATION, CLIMB, ...TOWER_EVENTS, ...M19_EVENTS], "tower");
  yearHooks.push(towerYear); // M19: จัดทีม + ปิดเดิมพันระยะยาว
}
