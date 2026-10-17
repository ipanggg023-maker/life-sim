import { registerEvents } from "../../engine/events";
import { COURT_EVENTS } from "./events";
import { ACADEMY_EVENTS } from "./academy";
import { COURT_MORE } from "./more";
import { COURT_QUEST } from "./quest";
import { M18_EVENTS } from "./m18";
import { COURT23_EVENTS } from "./m23";
import { COURT23B_EVENTS } from "./m23b";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของราชสำนัก

let loaded = false;

export function loadCourtWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...COURT_EVENTS, ...COURT_MORE, ...ACADEMY_EVENTS, COURT_QUEST, ...M18_EVENTS, ...COURT23_EVENTS, ...COURT23B_EVENTS], "court");
}
