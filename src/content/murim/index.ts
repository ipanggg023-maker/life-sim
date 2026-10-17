import { registerEvents } from "../../engine/events";
import { MURIM_EVENTS } from "./events";
import { MURIM_MORE } from "./more";
import { MURIM_QUEST } from "./quest";
import { M17_EVENTS } from "./m17";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของยุทธภพ

let loaded = false;

export function loadMurimWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...MURIM_EVENTS, ...MURIM_MORE, MURIM_QUEST, ...M17_EVENTS], "murim");
}
