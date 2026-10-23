import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { COMBOS, EVOLVED_TALENTS, MURIM_TALENTS, gift } from "../content/murim/life/gifts";
import { worldOfLife } from "../content/murim/life/world";
import { talentById } from "../content/talents";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, revealTalent, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }, prefer?: string) {
  let g = 0;
  while (l.queue.length && g++ < 60) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const i = prefer ? o.findIndex((x) => String(labelOf(x.c, l, l.queue[0].ctx)).startsWith(prefer)) : -1;
    resolveChoice(l, o[i >= 0 ? i : Math.floor(nextFloat(r) * o.length)].index);
  }
}
const withTalent = (id: string, reveal = true, seed = 5) => {
  const l = createLife({ seed, worldId: "murim", talents: [id] });
  worldOfLife(l);
  if (reveal) revealTalent(l, id);
  l.queue = [];
  return l;
};

describe("พรสวรรค์ที่มีชีวิต: ปลุก · ตื่นสู่ร่างใหม่ · ราคา · ประสาน · เรื่องราว", () => {
  it("แคตตาล็อกราวสามสิบ ทุกตัวมีทางตื่นสองทาง และพรสวรรค์ที่ซ่อนมีฉากปลุกของตัวเอง", () => {
    expect(MURIM_TALENTS.length).toBeGreaterThanOrEqual(30);
    for (const t of MURIM_TALENTS) {
      expect(talentById(`${t.id}_l`), `${t.id} ทางสว่าง`).toBeTruthy();
      expect(talentById(`${t.id}_d`), `${t.id} ทางมืด`).toBeTruthy();
      expect(getEvent(`ta.e_${t.id.slice(3)}`), `${t.id} ฉากตื่น`).toBeTruthy();
      if (t.rarity !== "common") expect(getEvent(`ta.r_${t.id.slice(3)}`), `${t.id} ฉากปลุก`).toBeTruthy();
      // มีเรื่องราวของตัวเองอย่างน้อยหนึ่งเรื่อง
      expect(allEvents().some((e) => e.id.startsWith("ta.a_") && e.id.includes(t.id.slice(3, 10))), `${t.id} เรื่องราว`).toBe(true);
    }
    expect(EVOLVED_TALENTS.every((t) => t.noRoll)).toBe(true);
    expect(COMBOS.length).toBeGreaterThanOrEqual(10);
  });

  it("ตอนเกิดเห็นเฉพาะพรสวรรค์ธรรมดา · ของหายากซ่อนอยู่ · ร่างวิวัฒน์ไม่สุ่มตอนเกิด", () => {
    let hiddenRare = 0;
    for (let s = 1; s <= 200; s++) {
      const l = createLife({ seed: s * 37, worldId: "murim" });
      for (const t of l.talents) {
        const info = talentById(t.id)!;
        expect(info.world, t.id).toBe("murim");
        expect(info.noRoll).toBeFalsy();
        if (t.revealed) expect(info.rarity).toBe("common");
        else if (info.rarity !== "common") hiddenRare++;
      }
      expect(l.talents.length).toBeLessThanOrEqual(3);
    }
    expect(hiddenRare).toBeGreaterThan(50);
  });

  it("ฉากปลุกเปิดพรสวรรค์ · ตื่นสู่ร่างใหม่เปลี่ยนพรสวรรค์และผลจริง", () => {
    const l = withTalent("mt_martial_eye", false);
    l.age = 9;
    runEvent(l, "ta.r_martial_eye");
    drain(l, { rng: 1 });
    expect(l.talents.find((t) => t.id === "mt_martial_eye")?.revealed).toBe(true);
    const before = gift(l, "learn");
    l.age = 25;
    l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
    l.mwArts = [{ id: "a_breathing", m: 30 }, { id: "a_sword", m: 30 }, { id: "a_palm", m: 30 }, { id: "a_spear", m: 30 }] as never;
    const e = getEvent("ta.e_martial_eye")!;
    expect(e.when!(l)).toBe(true);
    runEvent(l, "ta.e_martial_eye");
    drain(l, { rng: 1 }, "เรียนรู้จากรากของวิชา");
    expect(l.talents.some((t) => t.id === "mt_martial_eye_l")).toBe(true);
    expect(gift(l, "learn")).toBeGreaterThan(before);
    expect(e.when!(l)).toBe(false);
  });

  it("ราคาของร่างเก้าหยิน: ความเย็นกัดกินทุกปี จนกว่าจะได้หยางมาดุล", () => {
    const l = withTalent("mt_nine_yin");
    l.age = 17; l.stats.health = 90;
    ageUp(l); drain(l, { rng: 2 });
    const h1 = l.stats.health;
    expect(h1).toBeLessThan(90);
    l.flags.yangBalance = true;
    l.stats.health = 80;
    const r = { rng: 3 };
    let dropped = 0;
    for (let y = 0; y < 5; y++) { const h = l.stats.health; ageUp(l); drain(l, r); if (l.stats.health < h - 4) dropped++; l.stats.health = 80; }
    expect(dropped).toBeLessThan(3);
  });

  it("พรสวรรค์ประสาน: มีทั้งคู่แล้วฉากพิเศษเกิด และได้ผลเพิ่ม", () => {
    const l = createLife({ seed: 8, worldId: "murim", talents: ["mt_martial_eye", "mt_born_fighter"] });
    worldOfLife(l);
    revealTalent(l, "mt_martial_eye"); revealTalent(l, "mt_born_fighter");
    l.age = 10;
    l.queue = [];
    const before = gift(l, "fight");
    for (let y = 0; y < 3 && !l.flags["combo:cb_copy"]; y++) { ageUp(l); drain(l, { rng: y }); }
    expect(l.flags["combo:cb_copy"]).toBe(true);
    expect(gift(l, "fight")).toBeGreaterThan(before);
  });

  it("ชีวิตสุ่ม: พรสวรรค์ตื่น เปลี่ยนร่าง และมีเรื่องราว ไม่มีฉากตัน", () => {
    let revealed = 0, evolved = 0, stories = 0, combos = 0;
    for (let s = 1; s <= 60; s++) {
      const l = createLife({ seed: 9000 + s * 13, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s };
      for (let y = 0; y < 70 && l.alive; y++) { drain(l, r); if (!l.alive) break; ageUp(l); expect(validateLife(l)).toEqual([]); }
      drain(l, r);
      revealed += Object.keys(l.seen).filter((k) => k.startsWith("ta.r_")).length;
      evolved += l.talents.filter((t) => /_[ld]$/.test(t.id)).length;
      stories += Object.keys(l.seen).filter((k) => k.startsWith("ta.a_") || k.startsWith("ta.w_")).length;
      combos += Object.keys(l.flags).filter((k) => k.startsWith("combo:")).length;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM talents", { revealed, evolved, stories, combos });
    expect(revealed).toBeGreaterThan(20);
    expect(evolved).toBeGreaterThan(8);
    expect(stories).toBeGreaterThan(50);
  });
});
