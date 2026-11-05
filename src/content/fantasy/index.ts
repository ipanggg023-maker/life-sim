// โลกแฟนตาซี · แผนอยู่ที่ design/FANTASY_PLAN.md
import { activityFilters, timeBudget } from "../../engine/activities";
import { eligibilityFilters, registerEvents } from "../../engine/events";
/** เรื่องเล็กที่เกิดซ้ำได้ต้องห่างกันกี่ปี */
export const REPEAT_GAP = 15;
/** หน้าที่ของตำแหน่ง (งาน ราชสำนัก สงคราม) วนกลับมาตามบทบาท ห่างกันน้อยกว่า */
export const ROLE_GAP = 5;
const ROLE_EVENT = /^ft\.(wk|wd|wr)\./;
import { lifespanHooks, yearHooks } from "../../engine/game";
import type { Life } from "../../engine/types";
import { registerWorld } from "../../engine/worldModule";
import { CIVIC_EVENTS, civicYear, loadCivic } from "./civic";
import { DRAGON_EVENTS, dragonYear, loadDragons } from "./dragons";
import { MYSTERY_EVENTS, loadMysteries } from "./mysteries";
import { PEOPLE_EVENTS } from "./peoples";
import { REALM_EVENTS, loadRealm, realmYear } from "./realm";
import { RARE_EVENTS, REALM_TRAVEL_EVENTS, loadRealms, transform } from "./realms";
import { LEGEND_EVENTS, loadLegends } from "./legends";
import { GOLD } from "./kit";
import { RACES, attachWorld, setRace, setupLife } from "./life";
import { MAGIC_EVENTS, loadMagic } from "./magic";
import { PLACE_EVENTS, loadPlaces } from "./places";
import { SCHOOL_EVENTS } from "./schoollife";
import { fl, homeKingdom, worldOfLife } from "./state";
import { STORY_EVENTS } from "./story";
import { FANTASY_TALENTS } from "./talents";
import "./achievements";
import { ageElders, loadFolk, raceOf } from "./folk";
import { CAREER_EVENTS, loadCareers } from "./careers";
import { BOND_EVENTS, loadBonds } from "./bonds";
import { STYLE_EVENTS } from "./styles";
import { CITY_SCENES, cityOf, loadCities } from "./cities";
import { HOBBY_EVENTS, loadHobbies } from "./hobbies";
import { TALENT_EVO_EVENTS, loadTalentEvo } from "./talentEvo";
import { SAGA_EVENTS, loadSagas } from "./sagas";
import { DRAGON_PLEA, DRAGON_SCENES, DRAGON_TALES, loadDragonTales } from "./dragonTales";
import { MSCHOOL_EVENTS, loadMSchools } from "./mschools";
import { ARC_EVENTS } from "./arcs";
import { WORLD2_EVENTS, loadWorld2 } from "./world2";
import { tickWorld } from "./world";
import { STAR_EVENTS, migrateStars, starLife, starYear } from "./stars";
import { applyTags, loadConseq } from "./conseq";
import "./tags";
import { ECHOES_1 } from "./echoes";
import { ECHOES_2 } from "./echoes2";
import { PERSONA_EVENTS, personaYear } from "./persona";
import { RUMOR_EVENTS, loadRumors, rumorYear } from "./rumors";
import { PEOPLE2_EVENTS, loadPeople2 } from "./people2";
import { addExclusive } from "./exclusive";
import { loadDoings } from "./doings";
import { MOMENT_EVENTS } from "./moments";
import { WORK_ECHOES, WORK_EVENTS, loadWorklife } from "./worklife";
import { AFTERMATH, COURT_EVENTS, WAR_EVENTS, WORLD_ECHOES, loadWorldmark } from "./worldmark";
import { POWER_EVENTS, loadPowerplus } from "./powerplus";
import { loadLifestory } from "./lifestory";
import { loadYear } from "./year";
import { HEADLINE_EVENTS } from "./headlines";
import { ECONOMY_EVENTS, ftLiving, loadEconomy } from "./economy";
import { CAREER_PATH_EVENTS, loadCareerPath } from "./careerpath";
import { ARENA_EVENTS, loadArena } from "./arena";
import { FAMILY_EVENTS, loadFamily } from "./family";
import { STORY_GEN_EVENTS, loadStoryGen } from "./storygen";
import { verdict } from "./persona";
import { verdictHook } from "../../engine/game";
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
  // เรื่องที่เกิดซ้ำได้: ต้องห่างกันอย่างน้อย REPEAT_GAP ปี
  eligibilityFilters.push((l, e) => l.worldId !== "fantasy" || e.forced || e.maxTimes === 1 || e.maxTimes === undefined || l.age - (l.seenAt?.[e.id] ?? -999) >= (ROLE_EVENT.test(e.id) ? ROLE_GAP : REPEAT_GAP));
  activityFilters.push((l, a) => l.worldId !== "fantasy" || a.world === "fantasy");
  TALENTS.push(...FANTASY_TALENTS);
  loadTalentEvo();
  loadFolk();
  loadPlaces();
  loadCareers();
  loadBonds();
  loadPeople2();
  loadRumors();
  loadConseq();
  loadDoings();
  loadWorklife();
  loadCareerPath();
  loadArena();
  loadFamily();
  loadStoryGen();
  loadWorldmark();
  loadCities();
  loadEconomy();
  loadHobbies();
  loadSagas();
  loadDragonTales();
  loadMSchools();
  loadWorld2();
  loadLegends();
  loadMagic();
  loadCivic();
  loadDragons();
  loadMysteries();
  loadRealm();
  loadRealms();
  transform.fn = setRace;
  registerEvents([...PLACE_EVENTS, ...LEGEND_EVENTS, ...STORY_EVENTS, ...MAGIC_EVENTS, ...SCHOOL_EVENTS, ...CIVIC_EVENTS, ...DRAGON_EVENTS, ...PEOPLE_EVENTS, ...MYSTERY_EVENTS, ...REALM_EVENTS, ...REALM_TRAVEL_EVENTS, ...RARE_EVENTS, ...CAREER_EVENTS, ...BOND_EVENTS, ...STYLE_EVENTS, ...CITY_SCENES, ...HOBBY_EVENTS, ...TALENT_EVO_EVENTS, ...SAGA_EVENTS, ...DRAGON_TALES, ...DRAGON_SCENES, DRAGON_PLEA, ...MSCHOOL_EVENTS, ...ARC_EVENTS, ...WORLD2_EVENTS, ...STAR_EVENTS, ...ECHOES_1, ...ECHOES_2, ...PERSONA_EVENTS, ...RUMOR_EVENTS, ...PEOPLE2_EVENTS, ...MOMENT_EVENTS, ...WORK_EVENTS, ...WORK_ECHOES, ...COURT_EVENTS, ...WAR_EVENTS, AFTERMATH, ...WORLD_ECHOES, ...POWER_EVENTS, ...HEADLINE_EVENTS, ...ECONOMY_EVENTS, ...CAREER_PATH_EVENTS, ...ARENA_EVENTS, ...FAMILY_EVENTS, ...STORY_GEN_EVENTS], "fantasy");
  addExclusive();
  loadPowerplus();
  loadLifestory();
  loadYear();
  verdictHook.fn = verdict;
  applyTags();
  const before = timeBudget.fn;
  timeBudget.fn = (l) => (l.worldId === "fantasy" ? (l.age < 10 ? 2 : l.age < 16 ? 3 : 5) : before?.(l));
  lifespanHooks.push((l) => (on(l) ? younger(l) + (fl(l).dragonblood ? 30 : 0) + (fl(l).lifeBonus ?? 0) + starLife(l) - (fl(l).pacts ?? 0) * 10 : 0));
  yearHooks.push((l) => {
    if (!on(l) || !l.alive) return;
    ageElders(l);
    const w = worldOfLife(l);
    w.year = l.birthYear + l.age;
    tickWorld(w, l);
    civicYear(l);
    dragonYear(l);
    realmYear(l);
    starYear(l);
    personaYear(l);
    rumorYear(l);
    if (!l.flags.seenRuler) l.flags.seenRuler = homeKingdom(l).ruler;
  });
  registerWorld({
    id: "fantasy",
    traits: { body: true, npcLife: true, hiddenTalents: true, repeatActs: true, surnameFirst: false, classicKinTerms: true },
    birthplace: (l, fallback) => (l.ft ? `${cityOf(l).name}แห่ง${homeKingdom(l).name}` : fallback),
    livingCost: ftLiving,
    inheritance: (l) => ({ poor: 15, middle: 120, rich: 900, elite: 5_000 })[l.wealth] * GOLD,
    onCreate: setupLife,
    migrate: migrateStars,
    onNewBirth: (l, s) => attachWorld(l, s),
    bodyYounger: younger,
    npcYounger: (l, p) => { const r = raceOf(p); return r ? RACES[r].younger : ["father", "mother", "sibling", "child"].includes(p.relation) ? younger(l) : 0; },
  });
}
