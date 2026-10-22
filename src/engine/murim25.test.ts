import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { buildDisciple, inheritMurim } from "../content/murim/life/generations";
import { rivalOf, startMartial } from "../content/murim/life/npcMartial";
import { worldOfLife } from "../content/murim/life/world";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { buildHeir } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

const fighter = (seed: number, age = 14) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.stats.health = 90;
  l.power = { rank: 1, hunterClass: "m_sword", level: 10, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  return l;
};
function drain(l: Life, r: { rng: number }, prefer?: string) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const i = prefer ? o.findIndex((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith(prefer)) : -1;
    resolveChoice(l, o[i >= 0 ? i : Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("เฟส C: NPC ฝึกวิชาและคู่ปรับตลอดชีวิต", () => {
  it("NPC ฝึกวิชาเองและเก่งขึ้นตามเวลา — ยอดฝีมือขั้นสูงยังหายาก", () => {
    const ranks: number[] = [];
    let trained = 0, total = 0;
    for (let s = 1; s <= 80; s++) {
      const l = fighter(100 + s, 10);
      for (let i = 0; i < 5; i++) createPerson(l, "friend", { age: 10 + i, bond: 50, job: i === 0 ? "ศิษย์สำนัก" : undefined });
      for (let y = 0; y < 40 && l.alive; y++) { l.stats.health = 90; l.queue = []; ageUp(l); }
      for (const p of l.people.filter((x) => x.relation === "friend")) { total++; if (p.martial) { trained++; ranks.push(p.martial.rank); } }
    }
    const peak = ranks.filter((r) => r >= 4).length / Math.max(1, ranks.length);
    const mid = ranks.filter((r) => r >= 2).length / Math.max(1, ranks.length);
    console.log("SIM npc martial", { trained, total, peak: (peak * 100).toFixed(1) + "%", "≥ชั้นสอง": (mid * 100).toFixed(1) + "%" });
    expect(trained).toBeGreaterThan(total * 0.25);
    expect(mid).toBeGreaterThan(0.2);
    expect(peak).toBeLessThan(0.15);
  });

  it("คู่ปรับ: พบกันตอนเด็ก · ท้าดวลเป็นระยะ จดสถิติแพ้ชนะ · ดวลครั้งสุดท้ายหรือคืนดีตอนแก่ · ตายแล้วเราได้ข่าว", () => {
    const l = fighter(7);
    expect(getEvent("rv.meet")!.when!(l)).toBe(true);
    runEvent(l, "rv.meet");
    drain(l, { rng: 1 }, "\"งั้นก็มาแข่งกันทั้งชีวิต\"");
    const rival = rivalOf(l)!;
    expect(rival).toBeTruthy();
    expect(rival.martial).toBeTruthy();
    expect(getEvent("rv.meet")!.when!(l)).toBe(false);
    // ดวลกัน
    l.age = 20; rival.age = 20;
    expect(getEvent("rv.challenge")!.when!(l)).toBe(true);
    runEvent(l, "rv.challenge");
    drain(l, { rng: 2 }, "รับคำท้า");
    expect(Number(l.flags.rivalW ?? 0) + Number(l.flags.rivalL ?? 0)).toBe(1);
    expect(getEvent("rv.challenge")!.when!(l)).toBe(false); // ต้องรอห้าปี
    // คืนดีตอนแก่
    l.age = 60;
    runEvent(l, "rv.final");
    drain(l, { rng: 3 }, "ไปหาพร้อมไหเหล้า");
    expect(rival.relation).toBe("friend");
    // คู่ปรับคนใหม่ตาย → ได้ข่าว
    const l2 = fighter(8);
    runEvent(l2, "rv.meet");
    drain(l2, { rng: 4 }, "\"งั้นก็มาแข่งกันทั้งชีวิต\"");
    rivalOf(l2)!.alive = false;
    ageUp(l2);
    expect(l2.log.some((e) => e.text.includes("คู่ปรับของคุณจากไปแล้ว"))).toBe(true);
  });

  it("ลูกและศิษย์ที่ฝึกมาแล้ว เริ่มชีวิตถัดไปด้วยขั้นของตัวเอง", () => {
    const dead = fighter(9, 60);
    dead.power!.rank = 5;
    const kid = createPerson(dead, "child", { age: 25, bond: 80 });
    startMartial(dead, kid, 0);
    kid.martial!.rank = 3;
    const pupil = createPerson(dead, "ally", { age: 30, bond: 80 });
    pupil.tags = ["disciple"];
    startMartial(dead, pupil, 0);
    pupil.martial!.rank = 4;
    dead.alive = false;
    const heir = buildHeir(dead, kid.id);
    inheritMurim(dead, heir, "heir", kid.id);
    expect(heir.power?.rank).toBe(3);
    const disc = buildDisciple(dead, pupil.id);
    expect(disc.power?.rank).toBe(4);
  });

  it("ชีวิตสุ่ม 80 ชีวิตพร้อมคู่ปรับ ไม่มีฉากตันและสถานะไม่เสีย", () => {
    let rivals = 0, duels = 0;
    for (let s = 1; s <= 80; s++) {
      const l = createLife({ seed: s * 7331, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 90) { drain(l, r); if (!l.alive) break; ageUp(l); drain(l, r); expect(validateLife(l)).toEqual([]); }
      if (l.flags.rivalEver) rivals++;
      duels += Number(l.flags.rivalW ?? 0) + Number(l.flags.rivalL ?? 0);
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM lives with a rival", rivals, "/ 80 · rival duels", duels);
    expect(rivals).toBeGreaterThan(10);
  });
});
