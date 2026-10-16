import { registerEvents } from "../../engine/events";
import { APOCALYPSE_EVENTS } from "./events";
import { DOOM, MAIN_SCENARIO, SIDE_SCENARIO } from "./scenario";
import "./careers"; // อาชีพและกิจกรรมของโลกวันสิ้นโลก

let loaded = false;

/** โลกวันสิ้นโลก — ต้องโหลดโลก Hunter ก่อน (ใช้ชีวิตประจำวันของโลกยุคปัจจุบันร่วมกันจนถึงวันที่โลกพัง) */
export function loadApocalypseWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([DOOM, MAIN_SCENARIO, SIDE_SCENARIO, ...APOCALYPSE_EVENTS], "apocalypse");
}
