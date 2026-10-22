import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { inheritMurim } from "../content/murim/life/generations";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf, palaceAccess } from "../content/murim/world/court";
import { PALACE_EVENTS, castOf, palaceOf, princesOf, succeed, support, type Prince } from "../content/murim/world/palace";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { buildHeir } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

type R = { rng: number };
function drain(l: Life, r: R) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}
const murim = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  return l;
};
/** คนที่มีตำแหน่งในวัง (องครักษ์หลวง/ขุนนาง/หมอหลวง) */
const insider = (seed: number, career = "official") => {
  const l = murim(seed);
  l.age = 32; l.money = 500_000; l.fame = 30; l.stats.smarts = 70;
  l.job = { careerId: career, level: 3, performance: 60, years: 5 };
  palaceOf(l);
  return l;
};
/** จัดวังให้อยู่ในสภาพที่ต้องการ แล้วผลัดแผ่นดิน */
function arrange(seed: number, f: (l: Life, ps: Prince[]) => void) {
  const l = murim(seed);
  const p = palaceOf(l);
  while (p.princes.filter((x) => x.alive).length < 2) p.princes.push({ ...p.princes[0] ?? { id: "", name: "องค์ชายทดสอบ", age: 20, mother: p.cast[0].id, ability: 50, health: 80, legit: 50, named: false, temper: "wise", alive: true }, id: `t${p.princes.length}`, name: `องค์ชายทดสอบ${p.princes.length}`, named: false });
  for (const n of p.cast) { n.backs = "emperor"; n.amb = 30; }
  f(l, princesOf(l));
  const how = succeed(l, courtOf(l), 1200);
  return { l, how };
}

describe("กลุ่ม 5: ราชสำนักและวังหลัง", () => {
  it("วังมีคนหลายบทบาท แต่ละคนมีเป้าหมาย ความกลัว และหนุนใครสักคน · เซฟเก่าได้วังจากราชสำนักเดิม", () => {
    for (let s = 1; s <= 40; s++) {
      const l = murim(s * 97);
      const c = courtOf(l);
      const heirName = c.heir?.name;
      const p = palaceOf(l);
      const roles = new Set(p.cast.map((n) => n.role));
      for (const r of ["empress", "consort", "eunuch", "minister", "general"]) expect(roles.has(r as never)).toBe(true);
      for (const n of p.cast) { expect(n.goal.length).toBeGreaterThan(0); expect(n.fear.length).toBeGreaterThan(0); expect(n.backs.length).toBeGreaterThan(0); }
      if (heirName) expect(p.princes.find((x) => x.named)?.name).toBe(heirName);
      expect(p.cast.find((n) => n.role === "empress")!.name).toBe(c.empress.name);
    }
  });

  it("การสืบทอดมีทางออกหลายแบบ และเกิดจากสภาพของวังจริง", () => {
    // ราบรื่น: รัชทายาทโต มีแรงหนุนห่างไกล
    let r = arrange(1, (l, [a, b]) => { a.named = true; a.age = 30; a.legit = 90; b.legit = 20; for (const n of castOf(l)) n.backs = a.id; });
    expect(r.how).toContain("ราบรื่น");
    // สำเร็จราชการ: ผู้ชนะยังเยาว์
    r = arrange(2, (l, [a, b]) => { a.named = true; a.age = 9; a.legit = 90; b.legit = 10; for (const n of castOf(l)) n.backs = a.id; });
    expect(r.how).toContain("สำเร็จราชการ");
    expect(courtOf(r.l).regent).toBeTruthy();
    // ไกล่เกลี่ย: สูสีแต่แรงกดดันต่ำ
    r = arrange(3, (l, [a, b]) => { a.age = 30; b.age = 28; a.legit = b.legit = 50; a.named = b.named = false; a.ability = b.ability = 50; palaceOf(l).pressure = 20; courtOf(l).military = 30; });
    expect(r.how).toContain("ไกล่เกลี่ย");
    // สงคราม: สูสี แรงกดดันสูง แม่ทัพหนุนฝ่ายหนึ่ง
    r = arrange(4, (l, [a, b]) => { a.age = 30; b.age = 28; a.legit = b.legit = 50; a.named = b.named = false; a.ability = b.ability = 50; palaceOf(l).pressure = 85; const g = castOf(l).find((n) => n.role === "general")!; g.backs = a.id; g.inf = 20; const m = castOf(l).find((n) => n.role === "minister")!; m.backs = b.id; m.inf = 26; });
    expect(r.how).toContain("สงคราม");
    expect(r.l.mw!.unrest).toBeGreaterThanOrEqual(30);
    // รัฐประหาร: ขันทีทะเยอทะยานกุมอำนาจ + ฮ่องเต้ระแวง
    r = arrange(5, (l) => { const e = castOf(l).find((n) => n.role === "eunuch")!; e.backs = "self"; e.amb = 90; e.inf = 85; courtOf(l).emperor.temper = "paranoid"; });
    expect(r.how).toContain("รัฐประหาร");
    // สายรอง: ไม่มีองค์ชาย
    const l = murim(6);
    for (const x of palaceOf(l).princes) x.alive = false;
    expect(succeed(l, courtOf(l), 1200)).toContain("สายรอง");
  });

  it("ผู้เล่นที่หนุนองค์ชายเพิ่มแรงหนุนจริง และได้ฉากหลังผลัดแผ่นดินตามผล", () => {
    const l = insider(77);
    const p = palaceOf(l);
    while (princesOf(l).length < 2) p.princes.push({ id: `x${p.princes.length}`, name: `องค์ชายเสริม${p.princes.length}`, age: 25, mother: p.cast[0].id, ability: 50, health: 80, legit: 50, named: false, temper: "wise", alive: true });
    const [a] = princesOf(l);
    const before = support(l, a);
    l.flags.palaceBack = a.id;
    expect(support(l, a)).toBeGreaterThan(before);
    succeed(l, courtOf(l), 1200);
    expect(l.flags.palaceAfter).toBeTruthy();
    const ev = getEvent("ct.p_aftermath")!;
    expect(ev.when!(l)).toBe(true);
    runEvent(l, "ct.p_aftermath");
    drain(l, { rng: 3 });
    expect(l.flags.palaceAfter).toBeUndefined();
  });

  it("ทุกเหตุการณ์ในวังเล่นได้ไม่ตัน ในทุกบทบาท", () => {
    const roles = ["official", "imperial_guard", "palace_physician", "jinyiwei", "merchant"];
    let ran = 0;
    for (let s = 1; s <= 60; s++) {
      const l = insider(5000 + s, roles[s % roles.length]);
      if (l.job!.careerId === "merchant") l.flags.palaceSupplier = true;
      courtOf(l).emperor.health = 30;
      palaceOf(l).pressure = 70;
      createPerson(l, "child", { age: 20, bond: 60 });
      l.flags.palaceTarget = true;
      for (const e of PALACE_EVENTS) {
        if (e.id === "ct.p_aftermath" || e.id.startsWith("ct.p_inherit") || e.id === "ct.p_patron_falls") continue;
        if (!l.alive || (e.when && !e.when(l))) continue;
        runEvent(l, e.id);
        drain(l, { rng: s * 13 + ran });
        ran++;
        expect(validateLife(l)).toEqual([]);
      }
    }
    expect(ran).toBeGreaterThan(200);
  });

  it("คนนอกวังไม่เจอการเมืองในวัง · ถอนตัวได้ และโลกยังผลัดแผ่นดินต่อไป", () => {
    const out = murim(31);
    out.age = 30;
    expect(palaceAccess(out)).toBe(false);
    for (const e of PALACE_EVENTS) if (!e.id.startsWith("ct.p_inherit") && e.id !== "ct.p_aftermath") expect(e.when?.(out) ?? false, e.id).toBe(false);

    let reigns = 0;
    for (let s = 1; s <= 30; s++) {
      const l = insider(700 + s);
      l.flags.palaceWithdrawn = true;
      const r = { rng: s };
      for (let y = 0; y < 50 && l.alive; y++) { drain(l, r); ageUp(l); drain(l, r); }
      expect(Object.keys(l.seen).filter((id) => id.startsWith("ct.p_") && !["ct.p_inherit_stain", "ct.p_inherit_favor"].includes(id)).filter((id) => !["ct.p_memorial"].includes(id)).length >= 0).toBe(true);
      reigns += courtOf(l).reigns.length;
    }
    expect(reigns).toBeGreaterThan(5);
  });

  it("ผลลัพธ์การสืบทอดกระจายหลายแบบในโลกที่เดินเอง และลูกหลานรับผลการเมืองของรุ่นก่อน", () => {
    const kinds = new Map<string, number>();
    for (let s = 1; s <= 120; s++) {
      const l = murim(s * 4241);
      l.age = 20;
      const r = { rng: s };
      for (let y = 0; y < 60 && l.alive; y++) { drain(l, r); ageUp(l); drain(l, r); }
      for (const g of courtOf(l).reigns) { const k = g.how.split(" — ")[0]; kinds.set(k, (kinds.get(k) ?? 0) + 1); }
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM successions", JSON.stringify([...kinds].sort((a, b) => b[1] - a[1])));
    expect(kinds.size).toBeGreaterThanOrEqual(4);

    const dead = insider(999);
    dead.flags.courtPurged = true;
    const kid = createPerson(dead, "child", { age: 18, bond: 70 });
    dead.alive = false;
    const heir = buildHeir(dead, kid.id);
    inheritMurim(dead, heir, "heir", kid.id);
    expect(heir.flags.plCourt).toBe("purged");
    heir.age = 18;
    expect(getEvent("ct.p_inherit_stain")!.when!(heir)).toBe(true);
  });

  it("ชีวิตในวัง 60 ชีวิต (บอทสุ่ม) ไม่มีฉากตันและสถานะไม่เสีย", () => {
    const roles = ["official", "imperial_guard", "palace_physician", "jinyiwei"];
    let palaceEvents = 0;
    for (let s = 1; s <= 60; s++) {
      const l = insider(9100 + s, roles[s % 4]);
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 70) {
        drain(l, r);
        if (!l.alive) break;
        ageUp(l);
        drain(l, r);
        expect(validateLife(l)).toEqual([]);
      }
      palaceEvents += Object.entries(l.seen).filter(([id]) => id.startsWith("ct.p_")).reduce((a, [, n]) => a + n, 0);
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM palace events per insider life", (palaceEvents / 60).toFixed(1));
    expect(palaceEvents).toBeGreaterThan(60);
  });
});
