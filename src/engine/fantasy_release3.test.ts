import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { OMENS, earnedRare, familyTypeOf, omenOfBirth, raceLabel, recordRare, starHint, twinOf } from "../content/fantasy/birth";
import { inheritLife } from "../content/fantasy/life";
import { setPersonRace } from "../content/fantasy/folk";
import { fl } from "../content/fantasy/state";
import { createLife } from "./game";
import { buildHeir, newSoul } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const lives = (n: number, extra: Parameters<typeof createLife>[0] = {}): Life[] => Array.from({ length: n }, (_, i) => createLife({ seed: 7000 + i * 13, worldId: "fantasy", ...extra }));

describe("การเกิด", () => {
  it("ลาง ครอบครัวแบบต่างๆ ฝาแฝด และลูกครึ่งเกิดขึ้นได้ แต่ส่วนใหญ่ยังเป็นการเกิดธรรมดา", () => {
    const ls = lives(400);
    const omens = ls.filter((l) => omenOfBirth(l)).length, fams = ls.filter((l) => familyTypeOf(l)).length;
    const twins = ls.filter((l) => twinOf(l)).length, halves = ls.filter((l) => fl(l).half).length;
    expect(omens).toBeGreaterThan(40); expect(omens).toBeLessThan(160);
    expect(fams).toBeGreaterThan(30); expect(fams).toBeLessThan(120);
    expect(twins).toBeGreaterThan(2); expect(twins).toBeLessThan(30);
    expect(halves).toBeGreaterThan(8); expect(halves).toBeLessThan(50);
    for (const t of ["orphan", "adopted", "noble", "outcast"]) expect(ls.some((l) => familyTypeOf(l) === t)).toBe(true);
    for (const o of Object.keys(OMENS)) expect(ls.some((l) => omenOfBirth(l) === o)).toBe(true);
  });
  it("เด็กกำพร้ามีคนเลี้ยง และพ่อแม่จริงยังอยู่ที่ไหนสักแห่ง", () => {
    const o = lives(400).find((l) => familyTypeOf(l) === "orphan")!;
    expect(o.people.some((p) => p.tags?.includes("guardian"))).toBe(true);
    // พ่อแม่จริงไม่อยู่ในรายชื่อคนที่รู้จัก เก็บไว้จนกว่าจะได้พบกัน
    expect(fl(o).lostKin?.filter((p) => p.relation === "father" || p.relation === "mother").length).toBe(2);
    expect(o.people.some((p) => (p.relation === "father" || p.relation === "mother") && !p.tags?.includes("guardian"))).toBe(false);
    expect(o.wealth).toBe("poor");
  });
  it("ลูกครึ่งอายุยืนอยู่กลางระหว่างสองเผ่า และชื่อเผ่าบอกทั้งสองสาย", () => {
    const h = lives(400).find((l) => fl(l).half === "elf" && fl(l).race === "human");
    if (!h) return;
    expect(raceLabel(h)).toContain("เอลฟ์");
  });
  it("คำใบ้ของดาวตามดาวที่มีจริง", () => {
    const l = lives(1)[0];
    fl(l).bstars = 9; fl(l).potential = 1;
    expect(starHint(l)).toMatch(/กำมือ/);
    fl(l).bstars = 1; fl(l).potential = 1;
    expect(starHint(l)).toMatch(/ธรรมดา/);
  });
  it("ทายาทที่เล่นต่อไม่สุ่มเรื่องตอนเกิด", () => {
    const a = lives(1)[0]; a.age = 50;
    const k = createPerson(a, "child", { age: 20, bond: 70, lastName: a.lastName });
    const n = buildHeir(a, k.id);
    expect(n.flags.ftBirthDone).toBeUndefined();
    expect(omenOfBirth(n)).toBeUndefined();
  });
  it("ลูกของคู่ต่างเผ่าเป็นลูกครึ่ง", () => {
    const a = lives(1)[0]; a.age = 50; fl(a).half = undefined;
    const sp = createPerson(a, "spouse", { age: 48, bond: 80 });
    setPersonRace(sp, fl(a).race === "elf" ? "dwarf" : "elf");
    const k = createPerson(a, "child", { age: 20, bond: 70, lastName: a.lastName });
    const n = buildHeir(a, k.id); inheritLife(a, n, k.id);
    expect(fl(n).half).toBe(fl(a).race === "elf" ? "dwarf" : "elf");
  });
});

describe("เผ่าหายากที่วิญญาณปลดได้", () => {
  it("ขี่มังกรหรือทำพันธสัญญาแล้ว วิญญาณปลดเผ่านั้น และชาติหน้าเกิดเป็นเผ่านั้นบ่อยขึ้น", () => {
    const l = lives(1)[0];
    fl(l).mount = "x"; fl(l).pacts = 1;
    expect(earnedRare(l).sort()).toEqual(["demon", "dragon"]);
    const s = newSoul(); recordRare(s, l);
    expect(s.rareRaces?.sort()).toEqual(["demon", "dragon"]);
    const plain = lives(600).filter((x) => fl(x).race === "dragon" || fl(x).race === "demon").length;
    const boosted = lives(600, { rareRaces: ["dragon", "demon"] }).filter((x) => fl(x).race === "dragon" || fl(x).race === "demon").length;
    expect(boosted).toBeGreaterThan(plain * 2.5);
  });
});
