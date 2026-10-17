import { registerEvents } from "../../engine/events";
import { ADULT_EVENTS } from "./events/adult";
import { CHILDHOOD_EVENTS } from "./events/childhood";
import { AWAKENING, GATE_RAID } from "./events/gates";
import { HUNTER_LIFE_EVENTS } from "./events/hunterLife";
import { LEGACY_EVENTS, MEMORY_EVENTS } from "./events/memory";
import { SCHOOL_EVENTS } from "./events/school";
import { WORLD_EVENTS } from "./events/world";
import { M16_EVENTS } from "./events/m16";
import "./m16"; // M16: ตลาดคอร์ · กิลด์ของตัวเอง · Gate Break (yearHook)

let loaded = false;

export function loadHunterWorld() {
  if (loaded) return;
  loaded = true;
  // ชีวิตประจำวันใช้ได้ทุกโลกยุคปัจจุบัน (event ที่พูดถึง Hunter ระบุ world: "hunter" ไว้เอง)
  registerEvents([...CHILDHOOD_EVENTS, ...SCHOOL_EVENTS, ...ADULT_EVENTS], "modern");
  registerEvents([
    ...WORLD_EVENTS,
    AWAKENING,
    GATE_RAID,
    ...HUNTER_LIFE_EVENTS,
    ...MEMORY_EVENTS,
    ...LEGACY_EVENTS,
  ], "hunter");
  registerEvents(M16_EVENTS, "hunter");
}
