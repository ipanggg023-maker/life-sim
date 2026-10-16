import { registerEvents } from "../../engine/events";
import { MURIM_EVENTS } from "./events";
import { MURIM_MORE } from "./more";
import { MURIM_QUEST } from "./quest";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของยุทธภพ

let loaded = false;

export function loadMurimWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...MURIM_EVENTS, ...MURIM_MORE, MURIM_QUEST], "murim");
}
