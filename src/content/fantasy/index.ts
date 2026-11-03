// โลกแฟนตาซี · แผนอยู่ที่ design/FANTASY_PLAN.md
import { activityFilters, timeBudget } from "../../engine/activities";
import { eligibilityFilters, registerEvents } from "../../engine/events";
import { lifespanHooks, yearHooks } from "../../engine/game";
import type { Life } from "../../engine/types";
import { registerWorld } from "../../engine/worldModule";
import { LEGEND_EVENTS, loadLegends } from "./legends";
import { RACES, attachWorld, setupLife } from "./life";
import { MAGIC_EVENTS, loadMagic } from "./magic";
import { PLACE_EVENTS, loadPlaces } from "./places";
import { SCHOOL_EVENTS } from "./schoollife";
import { fl, homeKingdom, worldOfLife } from "./state";
import { STORY_EVENTS } from "./story";
import { FANTASY_TALENTS } from "./talents";
import { tickWorld } from "./world";
import { TALENTS } from "../talents";

export { newFantasyWorld } from "./state";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const younger = (l: Life) => RACES[fl(l).race].younger;

let loaded = false;
export function loadFantasyWorld() {
  if (loaded) return;
  loaded = true;
  // โลกนี้ใช้เนื้อหาของตัวเองเท่านั้น ไม่รับเหตุการณ์และกิจกรรมชุดเก่า
  eligibilityFilters.push((l, e) => l.worldId !== "fantasy" || e.world === "fantasy");
  activityFilters.push((l, a) => l.worldId !== "fantasy" || a.world === "fantasy");
  TALENTS.push(...FANTASY_TALENTS);
  loadPlaces();
  loadLegends();
  loadMagic();
  registerEvents([...PLACE_EVENTS, ...LEGEND_EVENTS, ...STORY_EVENTS, ...MAGIC_EVENTS, ...SCHOOL_EVENTS], "fantasy");
  const before = timeBudget.fn;
  timeBudget.fn = (l) => (l.worldId === "fantasy" ? (l.age < 10 ? 2 : l.age < 16 ? 3 : 5) : before?.(l));
  lifespanHooks.push((l) => (on(l) ? younger(l) : 0));
  yearHooks.push((l) => {
    if (!on(l) || !l.alive) return;
    const w = worldOfLife(l);
    w.year = l.birthYear + l.age;
    tickWorld(w, l);
    if (!l.flags.seenRuler) l.flags.seenRuler = homeKingdom(l).ruler;
  });
  registerWorld({
    id: "fantasy",
    traits: { body: true, npcLife: true, hiddenTalents: true, repeatActs: true, surnameFirst: false, classicKinTerms: true },
    birthplace: (l, fallback) => (l.ft ? `ดินแดนของ${homeKingdom(l).name}` : fallback),
    livingCost: (_l, kids, income) => 3_000 + kids * 700 + Math.round(income * 0.25),
    onCreate: setupLife,
    onNewBirth: (l, s) => attachWorld(l, s),
    bodyYounger: younger,
    npcYounger: (l, p) => (["father", "mother", "sibling", "child"].includes(p.relation) ? younger(l) : 0),
  });
}
