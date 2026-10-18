import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { awaken } from "../content/hunter/power";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { startChallenge } from "../content/ordinary/system";
import { initSys } from "../content/ordinary/sys";
import { passivesOf } from "../content/passives";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { seriesOf } from "../content/manhwa";
import { visibleChoices } from "./events";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { ageUp, createLife, resolveChoice, tryForBaby } from "./game";
import { nextFloat } from "./rng";
import { buildHeir, heirsOf } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

function play(life: Life, r: { rng: number }) {
  while (life.alive && life.age < 120) {
    while (life.queue.length) {
      const o = visibleChoices(life, life.queue[0]);
      expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
      resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
    }
    if (!life.alive) break;
    for (const a of ACTIVITIES) if (!a.id.startsWith("free_") && !activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
    if (life.age >= 25 && life.age <= 40 && !life.people.some((p) => p.relation === "spouse")) createPerson(life, "spouse", { age: life.age, bond: 80 });
    const sp = life.people.find((p) => p.relation === "spouse" && p.alive);
    if (sp && life.age <= 40) tryForBaby(life, sp);
    ageUp(life);
  }
}

describe("M14 เล่นอิสระ", () => {
  it("เล่นต่อเป็นลูกได้ทุกโลก: ภาคต่อ มรดก และเล่นจนจบได้", () => {
    const worlds = ["hunter", "murim", "court", "tower", "apocalypse", "ordinary"] as const;
    let continued = 0;
    for (let s = 1; s <= 60; s++) {
      const parent = createLife({ seed: s * 7777, worldId: worlds[s % 6] });
      play(parent, { rng: s });
      const kids = heirsOf(parent);
      if (!kids.length) continue;
      const heir = buildHeir(parent, kids[0].id);
      expect(heir.age).toBe(kids[0].age);
      expect(heir.lastName).toBe(parent.lastName);
      expect(heir.flags.generation).toBe(2);
      expect(seriesOf(heir).title.endsWith("ภาค 2")).toBe(true);
      expect(heir.people.some((p) => (p.relation === "father" || p.relation === "mother") && !p.alive)).toBe(true);
      play(heir, { rng: s + 1000 });
      expect(heir.alive).toBe(false);
      continued++;
    }
    console.log("SIM M14 เล่นต่อเป็นลูกสำเร็จ", continued, "/ 60");
    expect(continued).toBeGreaterThan(30);
  });

  it("ได้สกิลติดตัวจากการใช้ชีวิต", () => {
    let total = 0;
    for (let s = 1; s <= 60; s++) {
      const l = createLife({ seed: s * 31, worldId: "hunter" });
      play(l, { rng: s });
      total += passivesOf(l).length;
    }
    console.log("SIM M14 สกิลติดตัวเฉลี่ย/ชีวิต", (total / 60).toFixed(1));
    expect(total / 60).toBeGreaterThan(1);
  });

  it("สกิลขึ้นเฉพาะฉากที่แท็กตรงกัน", () => {
    // ไอดอล (ระบบชีวิต): สกิลเสน่ห์ขึ้นในภารกิจแสดง แต่สกิลหมัดไม่ขึ้น
    const idol = createLife({ seed: 99, worldId: "ordinary" });
    idol.age = 20;
    initSys(idol);
    idol.flags.sysSkills = "รอยยิ้มพิฆาต,หมัดหนัก";
    idol.job = { careerId: "o_trainee", level: 1, performance: 50, years: 0 };
    startChallenge(idol);
    resolveChoice(idol, 0); // กระดาน: เลือกภารกิจสายอาชีพ
    resolveChoice(idol, 0); // ไปฉากตัดสิน
    const labels = visibleChoices(idol, idol.queue[0]).map(({ c }) => (typeof c.label === "string" ? c.label : c.label(idol, idol.queue[0].ctx)));
    expect(labels.some((x) => x.includes("รอยยิ้มพิฆาต"))).toBe(true);
    expect(labels.some((x) => x.includes("หมัดหนัก"))).toBe(false);

    // ฮีลเลอร์: สกิลรักษาไม่ขึ้นในฉากสู้บอส
    const healer = createLife({ seed: 98, worldId: "hunter" });
    healer.age = 20;
    awaken(healer, 3, "healer");
    healer.queue.push({ eventId: "party.sacrifice", ctx: { id: "x", name: "เพื่อน" } });
    const h = visibleChoices(healer, healer.queue[0]).map(({ c }) => String(c.label));
    expect(h.some((x) => x.includes("แสงเยียวยา"))).toBe(false);
  });
});
