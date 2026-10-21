// ตรวจทุก event ทุกตัวเลือกผ่าน engine จริง: ไม่พัง · มีข้อความ · ค่าสถานะ/เงินไม่เพี้ยน · ฉากถัดไปมีอยู่จริง
import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { startScenario } from "../content/apocalypse/scenario";
import { loadCourtWorld } from "../content/court";
import { startCourtQuest } from "../content/court/quest";
import { loadHunterWorld } from "../content/hunter";
import { startGate } from "../content/hunter/events/gates";
import { loadMurimWorld } from "../content/murim";
import { startQuest } from "../content/murim/quest";
import { loadOrdinaryWorld } from "../content/ordinary";
import { startChallenge } from "../content/ordinary/system";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { startClimb } from "../content/tower/climb";
import { worldMatches } from "../content/worlds";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { allEvents, currentScene, getEvent, labelOf, visibleChoices, type GameEvent } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life, WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const WORLDS: WorldId[] = ["hunter", "murim", "court", "tower", "apocalypse", "ordinary"];
const QJ: Record<WorldId, string> = { hunter: "hunter", murim: "wanderer", court: "adventurer", tower: "climber", apocalypse: "survivor", ordinary: "store" };

/** ปัญหาที่เจอ (รวมไว้แล้วรายงานทีเดียว) */
const problems: string[] = [];
const bad = (msg: string) => problems.length < 200 && problems.push(msg);

function sane(l: Life, where: string) {
  for (const [k, v] of Object.entries(l.stats)) if (!Number.isFinite(v) || v < 0 || v > 100) bad(`${where}: ค่า ${k} = ${v}`);
  for (const k of ["money", "debt", "fame"] as const) if (!Number.isFinite(l[k])) bad(`${where}: ${k} = ${l[k]}`);
  if (l.power) for (const k of ["level", "exp", "rank"] as const) if (!Number.isFinite(l.power[k])) bad(`${where}: power.${k} = ${l.power[k]}`);
  for (const e of l.log.slice(-6)) if (/undefined|NaN|\[object/.test(e.text)) bad(`${where}: ข้อความเพี้ยน "${e.text.slice(0, 80)}"`);
}

/** เล่นฉากที่อยู่ในคิวจนจบ: ฉากแรกเลือกตัวที่ i แล้วฉากต่อๆ ไปเลือกแบบสุ่ม */
function runQueue(l: Life, first: number, r: { rng: number }, where: string) {
  let guard = 0;
  let idx: number | undefined = first;
  while (l.queue.length && l.alive && guard++ < 40) {
    const q = l.queue[0];
    const scene = currentScene(q, l);
    if (!scene) { bad(`${where}: ไม่มีฉาก "${q.scene}" ใน ${q.eventId}`); l.queue.shift(); continue; }
    const text = scene.text(l, q.ctx);
    if (!text || /undefined|NaN/.test(text)) bad(`${where}: ข้อความฉาก ${q.eventId}/${q.scene ?? "start"} = "${String(text).slice(0, 60)}"`);
    const vis = visibleChoices(l, q);
    if (!vis.length) { bad(`${where}: ${q.eventId}/${q.scene ?? "start"} ไม่มีตัวเลือก`); l.queue.shift(); continue; }
    for (const v of vis) {
      const lab = labelOf(v.c, l, q.ctx);
      if (!lab || /undefined|NaN/.test(lab)) bad(`${where}: ป้ายตัวเลือก ${q.eventId} = "${lab}"`);
    }
    const pick = idx !== undefined && idx < vis.length ? vis[idx] : vis[Math.floor(nextFloat(r) * vis.length)];
    idx = undefined;
    const out = resolveChoice(l, pick.index);
    if (!out) bad(`${where}: resolveChoice คืนค่าว่าง`);
    else if (!out.text && !out.next) bad(`${where}: ${q.eventId} ตัวเลือก "${labelOf(pick.c, l, q.ctx)}" ไม่มีข้อความผลลัพธ์`);
  }
  if (guard >= 40) bad(`${where}: ฉากวนไม่จบ`);
}

/** สร้างชีวิตตัวอย่างในหลายช่วงวัย (บอทเล่นจนถึงอายุนั้น) */
function snapshots(world: WorldId): Life[] {
  const out: Life[] = [];
  for (let s = 1; s <= 40; s++) {
    const l = createLife({ seed: s * 2654435761 + world.length * 977, worldId: world });
    const r = { rng: s * 31 + 7 };
    const marks = s <= 10 ? [2, 6, 10, 14, 17, 22, 28, 35, 42, 50, 58, 66, 75, 85] : [s % 4 + 4, 12 + (s % 5), 18 + (s % 7), 25 + (s % 10), 36 + (s % 12), 48 + (s % 15), 62 + (s % 18)];
    while (l.alive && l.age < 90) {
      while (l.queue.length) {
        const o = visibleChoices(l, l.queue[0]);
        resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
      }
      if (!l.alive) break;
      for (const a of ACTIVITIES) if ((s > 30 || !a.id.startsWith("free_")) && !activityLocked(l, a) && nextFloat(r) < 0.3) doActivity(l, a.id);
      if (l.power && l.job?.careerId !== QJ[world]) applyJob(l, QJ[world]);
      if (marks.includes(l.age)) out.push(structuredClone(l));
      ageUp(l);
    }
  }
  return out;
}

function eligibleOn(l: Life, e: GameEvent): boolean {
  if (e.world && !worldMatches(e.world, l.worldId)) return false;
  if (l.age < e.minAge || l.age > e.maxAge) return false;
  if (e.world === "modern" && l.flags.doomed && !l.flags.rebuilt) return false;
  try {
    if (e.when && !e.when(l)) return false;
    const w = typeof e.weight === "function" ? e.weight(l) : (e.weight ?? 10);
    return w > 0 || !!e.forced;
  } catch (err) {
    bad(`${e.id}: when() พัง ${(err as Error).message}`);
    return false;
  }
}

describe("ตรวจทุก event", () => {
  it("ทุกตัวเลือกของทุก event เล่นได้จริง", () => {
    const snaps = Object.fromEntries(WORLDS.map((w) => [w, snapshots(w)])) as Record<WorldId, Life[]>;
    const events = allEvents();
    let tested = 0, choices = 0;
    const untested: string[] = [];
    const r = { rng: 12345 };
    for (const e of events) {
      if (e.manual && !e.id.startsWith("free.")) continue; // ภารกิจที่ต้องมี ctx — ตรวจแยกด้านล่าง
      const bases = WORLDS.flatMap((w) => snaps[w]).filter((l) => (e.manual ? !e.world || worldMatches(e.world, l.worldId) : eligibleOn(l, e)));
      if (!bases.length) { untested.push(e.id); continue; }
      tested++;
      // ใช้ตัวอย่างสูงสุด 3 ชีวิต (ต่างโลก/ต่างวัย) — ทุกตัวเลือก
      const pickBases = [bases[0], bases[Math.floor(bases.length / 2)], bases[bases.length - 1]];
      for (const base of pickBases) {
        if (!e.choices?.length) {
          const l = structuredClone(base);
          try {
            const ctx = e.prepare?.(l) ?? {};
            const kind = e.auto?.(l, ctx);
            const t = e.text(l, ctx);
            if (!t || /undefined|NaN/.test(t)) bad(`${e.id}: ข้อความ auto = "${t}"`);
            void kind;
            sane(l, e.id);
          } catch (err) {
            bad(`${e.id} (auto, ${base.worldId} อายุ ${base.age}): พัง ${(err as Error).message}`);
          }
          continue;
        }
        const probe = structuredClone(base);
        let ctx0;
        try {
          ctx0 = e.prepare?.(probe) ?? {};
        } catch (err) {
          bad(`${e.id} (${base.worldId} อายุ ${base.age}): prepare พัง ${(err as Error).message}`);
          continue;
        }
        probe.queue = [{ eventId: e.id, ctx: ctx0 }];
        const n = visibleChoices(probe, probe.queue[0]).length;
        if (!n) { bad(`${e.id} (${base.worldId} อายุ ${base.age}): ไม่มีตัวเลือกที่แสดงได้`); continue; }
        for (let i = 0; i < n; i++) {
          for (let rep = 0; rep < 2; rep++) {
            const l = structuredClone(base);
            l.queue = [{ eventId: e.id, ctx: structuredClone(ctx0) }];
            l.rng = (l.rng + i * 7919 + rep * 104729) >>> 0;
            const where = `${e.id}#${i} (${base.worldId} อายุ ${base.age})`;
            try {
              runQueue(l, i, r, where);
              sane(l, where);
              choices++;
            } catch (err) {
              bad(`${where}: พัง ${(err as Error).message}`);
            }
          }
        }
      }
    }
    // ภารกิจ/Gate/หอคอย/ฉากย่อย/ภารกิจระบบ ที่เปิดจากปุ่ม
    const starters: Array<[WorldId, (l: Life) => void]> = [
      ["hunter", (l) => startGate(l, Math.max(0, l.power?.rank ?? 0))],
      ["murim", (l) => startQuest(l, Math.max(0, l.power?.rank ?? 0))],
      ["court", (l) => startCourtQuest(l, Math.max(0, l.power?.rank ?? 0))],
      ["apocalypse", (l) => startScenario(l, Math.max(0, l.power?.rank ?? 0))],
      ["tower", (l) => startClimb(l, Math.max(0, l.power?.rank ?? 0))],
      ["ordinary", (l) => startChallenge(l)],
    ];
    for (const [w, start] of starters) {
      const bases = snaps[w].filter((l) => l.power || l.sys);
      for (const base of bases.slice(0, 12)) {
        for (let k = 0; k < 6; k++) {
          const l = structuredClone(base);
          l.rng = (l.rng + k * 7777) >>> 0;
          const where = `ภารกิจ ${w} (อายุ ${base.age})`;
          try {
            start(l);
            if (!l.queue.length) continue;
            runQueue(l, k % 3, r, where);
            sane(l, where);
          } catch (err) {
            bad(`${where}: พัง ${(err as Error).message}`);
          }
        }
      }
    }
    // ปุ่มกิจกรรมทุกปุ่มในทุกโลก
    for (const w of WORLDS) {
      for (const base of snaps[w].filter((l) => l.age >= 18).slice(0, 6)) {
        for (const a of ACTIVITIES) {
          const l = structuredClone(base);
          l.money = Math.max(l.money, 5_000_000);
          if (activityLocked(l, a)) continue;
          const where = `กิจกรรม ${a.id} (${w} อายุ ${l.age})`;
          try {
            doActivity(l, a.id);
            runQueue(l, 0, r, where);
            sane(l, where);
          } catch (err) {
            bad(`${where}: พัง ${(err as Error).message}`);
          }
        }
      }
    }
    // รอบบังคับ: event ที่ไม่มีชีวิตตัวอย่างเข้าเงื่อนไข — ข้ามเงื่อนไขแล้วเล่นดูว่าพังไหม (แจ้งเตือนเท่านั้น)
    const forced: string[] = [];
    for (const id of untested) {
      const e = getEvent(id)!;
      if (!e.choices?.length) continue;
      const base = WORLDS.flatMap((w) => snaps[w]).find((l) => (!e.world || worldMatches(e.world, l.worldId)) && l.age >= e.minAge && l.age <= e.maxAge);
      if (!base) continue;
      for (let i = 0; i < e.choices.length; i++) {
        const l = structuredClone(base);
        try {
          l.queue = [{ eventId: id, ctx: e.prepare?.(l) ?? {} }];
          runQueue(l, i, r, `บังคับ ${id}#${i}`);
        } catch (err) {
          forced.push(`${id}#${i}: ${(err as Error).message}`);
        }
      }
    }
    console.log("AUDIT รอบบังคับ พัง", forced.length, "\n" + forced.join("\n"));
    console.log("AUDIT รอบบังคับ ปัญหาอื่น", problems.filter((p) => p.startsWith("บังคับ")).join("\n"));
    console.log("AUDIT event ทั้งหมด", events.length, "| ตรวจได้", tested, "| ตัวเลือกที่เล่น", choices, "| ไม่มีชีวิตตัวอย่างที่เข้าเงื่อนไข", untested.length);
    console.log("AUDIT ไม่ได้ตรวจ:", untested.join(" "));
    console.log("AUDIT ปัญหา", problems.length, "\n" + problems.join("\n"));
    expect(getEvent("free.gamble")).toBeTruthy();
    expect(problems.filter((p) => !p.startsWith("บังคับ"))).toEqual([]);
  }, 400_000);
});

describe("ตรวจการเกิดใหม่ทุกแบบ", () => {
  it("ลูก · ย้อนเวลา · ยุคถัดไป · ข้ามโลก ทำงานต่อเนื่องและวิญญาณจำของได้", async () => {
    const { applySoul, buildHeir, buildRegression, claimAward, heirsOf, newSoul, nextEraOptions } = await import("./soul");
    const { pastSelfOf } = await import("./game");
    const { foundThisLife } = await import("../content/shared/collection");
    const soul = newSoul();
    const r = { rng: 999 };
    const live = (l: Life, years = 800) => {
      let n = 0;
      while (l.alive && n++ < years) {
        while (l.queue.length) {
          const o = visibleChoices(l, l.queue[0]);
          expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}`).toBeGreaterThan(0);
          resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
        }
        if (!l.alive) break;
        for (const a of ACTIVITIES) if (!activityLocked(l, a) && nextFloat(r) < 0.15) doActivity(l, a.id);
        ageUp(l);
      }
    };
    let kinds = { heir: 0, regress: 0, era: 0, cross: 0 };
    for (let s = 1; s <= 24; s++) {
      let l = createLife({ seed: s * 7331, worldId: WORLDS[s % 6] });
      applySoul(l, soul, true);
      for (let gen = 0; gen < 4; gen++) {
        live(l);
        expect(l.alive).toBe(false);
        const items = foundThisLife(l);
        claimAward(soul, l, gen % 4 === 1);
        for (const id of items) expect(soul.collection).toContain(id);
        const heirs = heirsOf(l);
        const mode = gen % 4;
        if (mode === 0 && heirs.length) { l = buildHeir(l, heirs[0].id); applySoul(l, soul, true); kinds.heir++; }
        else if (mode === 1) { l = buildRegression(l, undefined, false); applySoul(l, soul, false); kinds.regress++; }
        else if (mode === 2) { l = createLife({ ...nextEraOptions(l), worldId: l.worldId }); applySoul(l, soul, true); kinds.era++; }
        else { l = createLife({ worldId: WORLDS[(s + gen) % 6], pastLife: pastSelfOf(l) }); applySoul(l, soul, true); kinds.cross++; }
        expect(l.alive).toBe(true);
        expect(l.pastSeen?.length ?? 0).toBeGreaterThan(0);
        expect(JSON.parse(JSON.stringify(l))).toEqual(l);
      }
    }
    console.log("AUDIT เกิดใหม่", JSON.stringify(kinds), "| วิญญาณจำเรื่อง", soul.seenEver?.length, "| ตู้สะสม", soul.collection?.length);
    expect(kinds.regress + kinds.era + kinds.cross).toBeGreaterThan(40);
  });
});
