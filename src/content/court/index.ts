import { registerEvents } from "../../engine/events";
import { COURT_EVENTS } from "./events";
import { ACADEMY_EVENTS } from "./academy";
import { COURT_MORE } from "./more";
import { COURT_QUEST } from "./quest";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของราชสำนัก

let loaded = false;

export function loadCourtWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...COURT_EVENTS, ...COURT_MORE, ...ACADEMY_EVENTS, COURT_QUEST], "court");
}
