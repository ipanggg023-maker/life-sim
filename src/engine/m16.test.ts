import { describe, expect, it } from "vitest";
import { worldMatches } from "../content/worlds";
import { loadHunterWorld } from "../content/hunter";
import { CAREERS } from "../content/hunter/careers";
import { canEnterGate, enterGate, train } from "../content/hunter/events/gates";
import { CORE_TIERS, canFound, canRecruit, coresOf, foundGuild, guildLv, marketIndex, myGuild, recruit, roster, sellCores, totalCores } from "../content/hunter/m16";
import { loadMurimWorld } from "../content/murim";
import { loadCourtWorld } from "../content/court";
import { loadTowerWorld } from "../content/tower";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { allEvents, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

function drain(life: Life, r: { rng: number }, seen: Set<string>) {
  let guard = 0;
  while (life.queue.length && guard++ < 50) {
    const q = life.queue[0];
    if (q.eventId.startsWith("h16.")) seen.add(q.eventId);
    const opts = visibleChoices(life, q);
    expect(opts.length, `ไม่มีตัวเลือกใน ${q.eventId}/${q.scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(life, opts[Math.floor(nextFloat(r) * opts.length)].index);
  }
}

/** บอท Hunter สายฟาร์ม: บุก Gate ทุกปี ก่อตั้งกิลด์เมื่อทำได้ ขายคอร์ตอนราคาดี */
function play(seed: number, seen: Set<string>): Life {
  const life = createLife({ seed, worldId: "hunter" });
  const r = { rng: seed ^ 0x5bd1e995 };
  let guard = 0;
  while (life.alive && guard++ < 200) {
    drain(life, r, seen);
    if (!life.alive) break;
    for (const a of ACTIVITIES) if (!a.id.startsWith("free_") && !activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
    if (life.power && life.job?.careerId !== "hunter") applyJob(life, "hunter");
    const careers = CAREERS.filter((c) => worldMatches(c.world, life.worldId));
    if (!life.job && life.age >= 16) applyJob(life, careers[Math.floor(nextFloat(r) * careers.length)].id);
    if (life.power) train(life);
    for (let i = 0; i < 3 && life.alive; i++) {
      const gr = Math.max(0, (life.power?.rank ?? 0) - (nextFloat(r) < 0.7 ? 1 : 0));
      if (canEnterGate(life, gr)) break;
      enterGate(life, gr);
      drain(life, r, seen);
    }
    if (!life.alive) break;
    // ปุ่มใน UI: ก่อตั้งกิลด์ / รับสมาชิก / ขายคอร์
    if (!canFound(life)) foundGuild(life, `กิลด์บอท${seed % 100}`);
    if (!canRecruit(life) && nextFloat(r) < 0.6) recruit(life);
    if (marketIndex(life) >= 120 || nextFloat(r) < 0.1) for (let t = 0; t < CORE_TIERS.length; t++) if (coresOf(life, t)) sellCores(life, t, 99, nextFloat(r) < 0.1);
    ageUp(life);
  }
  return life;
}

describe("M16 โลก Hunter: ตลาดคอร์ · กิลด์ · Gate Break", () => {
  it("มี event ใหม่ h16. อย่างน้อย 150 อัน", () => {
    const ids = allEvents().filter((e) => e.id.startsWith("h16."));
    console.log("SIM M16 จำนวน event ใหม่", ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(150);
    for (const e of ids) expect(e.world).toBe("hunter");
  });

  it("บอทเล่นจนจบ 200 ชีวิต และระบบประจำโลกทำงาน", () => {
    const seen = new Set<string>();
    let hunters = 0, sss = 0, founded = 0, lvMax = 0, members = 0, breaks = 0, heroes = 0, dropped = 0, earned = 0, held = 0;
    const idx: number[] = [];
    for (let s = 1; s <= 200; s++) {
      const l = play(s * 104729, seen);
      expect(l.alive).toBe(false);
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
      idx.push(marketIndex(l));
      breaks += Number(l.flags.breaks ?? 0);
      if (l.flags.breakHero) heroes++;
      dropped += Number(l.flags.coreDrops ?? 0);
      earned += Number(l.flags.coreEarned ?? 0);
      held += totalCores(l);
      if (l.flags.gFounded !== undefined || l.flags.soldGuild || l.flags.guildLegacy) founded++;
      lvMax = Math.max(lvMax, Number(l.flags.gPeakLv ?? 0), guildLv(l));
      if (myGuild(l)) members += roster(l).length;
      if (!l.power) continue;
      hunters++;
      if (l.power.rank >= 8) sss++;
    }
    idx.sort((a, b) => a - b);
    console.log(
      "SIM M16 Hunter", hunters, "| SSS", sss, `(${((sss / Math.max(1, hunters)) * 100).toFixed(1)}%)`,
      "| Gate Break/ชีวิต", (breaks / 200).toFixed(2), "| ฮีโร่ Gate Break", heroes,
      "| คอร์ดรอป/ชีวิต", (dropped / 200).toFixed(1), "| รายได้จากการขายคอร์รวม", earned, "| คอร์ค้างมือตอนตาย", held,
      "| ดัชนีตลาด p10/p50/p90", idx[20], idx[100], idx[180],
    );
    console.log("SIM M16 ก่อตั้งกิลด์", founded, "/ 200 | เลเวลกิลด์สูงสุด", lvMax, "| สมาชิกรวมตอนตาย", members, "| event h16 ที่เจอ", seen.size);
    expect(hunters).toBeGreaterThan(150);
    expect(breaks).toBeGreaterThan(100);
    expect(dropped).toBeGreaterThan(200);
    expect(founded).toBeGreaterThan(10);
    expect(lvMax).toBeGreaterThanOrEqual(2);
    expect(seen.size).toBeGreaterThan(80);
    // สมดุลยังใกล้เดิม (เดิม ~8% ของบอทสายฟาร์ม)
    expect(sss / hunters).toBeLessThan(0.14);
  }, 180_000);

  it("ขายตลาดสมาคมได้ราคาตามดัชนี", () => {
    const l = createLife({ seed: 7, worldId: "hunter" });
    l.flags.core1 = 3;
    l.flags.coreMkt = 150;
    const before = l.money;
    sellCores(l, 1, 2);
    expect(l.money - before).toBe(Math.round((CORE_TIERS[1].base * 150) / 100 / 1000) * 1000 * 2);
    expect(coresOf(l, 1)).toBe(1);
  });
});
