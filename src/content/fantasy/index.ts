// โลกแฟนตาซี · แผนอยู่ที่ design/FANTASY_PLAN.md
import { activityFilters, timeBudget } from "../../engine/activities";
import { eligibilityFilters, registerEvents } from "../../engine/events";
import { lifespanHooks, yearHooks } from "../../engine/game";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { registerWorld } from "../../engine/worldModule";
import { CIVIC_EVENTS, civicYear, loadCivic } from "./civic";
import { DRAGON_EVENTS, dragonYear, loadDragons } from "./dragons";
import { MYSTERY_EVENTS, loadMysteries } from "./mysteries";
import { PEOPLE_EVENTS } from "./peoples";
import { REALM_EVENTS, loadRealm, realmYear } from "./realm";
import { LEGEND_EVENTS, loadLegends } from "./legends";
import { GOLD } from "./kit";
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
  loadCivic();
  loadDragons();
  loadMysteries();
  loadRealm();
  registerEvents([...PLACE_EVENTS, ...LEGEND_EVENTS, ...STORY_EVENTS, ...MAGIC_EVENTS, ...SCHOOL_EVENTS, ...CIVIC_EVENTS, ...DRAGON_EVENTS, ...PEOPLE_EVENTS, ...MYSTERY_EVENTS, ...REALM_EVENTS], "fantasy");
  const before = timeBudget.fn;
  timeBudget.fn = (l) => (l.worldId === "fantasy" ? (l.age < 10 ? 2 : l.age < 16 ? 3 : 5) : before?.(l));
  lifespanHooks.push((l) => (on(l) ? younger(l) + (fl(l).dragonblood ? 30 : 0) : 0));
  yearHooks.push((l) => {
    if (!on(l) || !l.alive) return;
    const w = worldOfLife(l);
    w.year = l.birthYear + l.age;
    tickWorld(w, l);
    civicYear(l);
    dragonYear(l);
    realmYear(l);
    if (!l.flags.seenRuler) l.flags.seenRuler = homeKingdom(l).ruler;
  });
  registerWorld({
    id: "fantasy",
    traits: { body: true, npcLife: true, hiddenTalents: true, repeatActs: true, surnameFirst: false, classicKinTerms: true },
    birthplace: (l, fallback) => (l.ft ? `ดินแดนของ${homeKingdom(l).name}` : fallback),
    livingCost: (l, kids, income) => {
      const k = homeKingdom(l), rich = (k.prosperity ?? 100) / 100;
      // เมืองรุ่งเรืองของแพงแต่คนเหลือเงินมากกว่า · ภาษีสงครามเพิ่มทั้งก้อน
      const tax = k.laws?.includes("heavyTax") ? 1.25 : 1;
      return Math.round((3_000 + kids * 700) * rich * tax + Math.max(0, income) * clamp(0.25 - (rich - 1) / 4, 0.1, 0.4) * tax);
    },
    inheritance: (l) => ({ poor: 15, middle: 120, rich: 900, elite: 5_000 })[l.wealth] * GOLD,
    onCreate: setupLife,
    onNewBirth: (l, s) => attachWorld(l, s),
    bodyYounger: younger,
    npcYounger: (l, p) => (["father", "mother", "sibling", "child"].includes(p.relation) ? younger(l) : 0),
  });
}
