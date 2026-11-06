import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { NEW_FACE_BOND } from "../content/fantasy/friends";
import { fl } from "../content/fantasy/state";
import { getEvent } from "./events";
import { ageUp, createLife, runEvent } from "./game";
import type { Life } from "./types";
import { createPerson, friendStage, relationLabel } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 20): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.flags.ftStarsSeen = true;
  return l;
};

describe("มิตรภาพต้องใช้เวลา", () => {
  it("คนที่เพิ่งเจอเป็นแค่คนรู้จัก", () => {
    const l = life(1);
    const p = createPerson(l, "friend", { age: 22, bond: 60 });
    expect(p.bond).toBeLessThanOrEqual(NEW_FACE_BOND);
    expect(relationLabel(p, l)).toBe("คนรู้จัก");
  });
  it("สนิทกันขึ้นในปีเดียวยังไม่ใช่เพื่อน ต้องรู้จักกันอย่างน้อยหนึ่งปี", () => {
    const l = life(2);
    const p = createPerson(l, "friend", { age: 22 });
    p.bond = 60;
    expect(friendStage(p, l)).toBe(0);
    l.age += 1;
    expect(relationLabel(p, l)).toBe("เพื่อน");
    p.bond = 80; l.age += 2;
    expect(relationLabel(p, l)).toBe("เพื่อนสนิท");
  });
  it("ความผูกพันพิเศษตั้งแต่แรก (ผู้อุปการะ ญาติ) ไม่ถูกลด", () => {
    const l = life(3);
    expect(createPerson(l, "friend", { age: 50, bond: 75 }).bond).toBe(75);
  });
});

describe("เด็กที่ถูกทิ้ง", () => {
  const orphan = () => {
    for (let s = 1; s < 400; s++) {
      const l = createLife({ seed: s, worldId: "fantasy" });
      if (l.flags.ftFamily === "orphan") return l;
    }
    throw new Error("ไม่เจอเด็กที่ถูกทิ้ง");
  };
  it("ไม่รู้ว่าพ่อแม่แท้ๆ เป็นใคร รู้แค่คนที่รับเลี้ยง", () => {
    const l = orphan();
    const ps = l.people.filter((p) => p.relation === "father" || p.relation === "mother");
    expect(ps).toHaveLength(1);
    expect(ps[0].tags).toContain("guardian");
    expect(relationLabel(ps[0], l)).toMatch(/บุญธรรม/);
    expect(l.people.some((p) => p.relation === "sibling")).toBe(false);
    expect(fl(l).lostKin?.some((p) => p.relation === "father")).toBe(true);
    expect(l.log.some((e) => /^พ่อของคุณคือ/.test(e.text))).toBe(false);
    expect(l.log.some((e) => /บุญธรรมของคุณคือ/.test(e.text))).toBe(true);
  });
  it("พ่อแม่แท้ๆ ปรากฏเมื่อได้พบกันในเรื่องคนที่ทิ้งตะกร้าไว้", () => {
    const l = orphan(); l.age = 20; l.queue = [];
    expect(getEvent("ft.bt.parents_found")!.when!(l)).toBe(true);
    runEvent(l, "ft.bt.parents_found");
    const q = l.queue[0];
    getEvent("ft.bt.parents_found")!.choices![0].run(l, q.ctx, true);
    const real = l.people.filter((p) => p.tags?.includes("birth_parent"));
    expect(real.length).toBeGreaterThan(0);
    expect(relationLabel(real[0], l)).toMatch(/แท้ๆ/);
    expect(fl(l).lostKin).toBeUndefined();
  });
  it("เซฟเก่าที่ยังเห็นพ่อแม่แท้ๆ ถูกแก้ในปีถัดไป", () => {
    const l = orphan(); l.age = 10; l.queue = [];
    const g = l.people.find((p) => p.tags?.includes("guardian"))!; g.relation = "friend";
    l.people.push({ ...fl(l).lostKin![0], tags: ["lost_parent", "away:0"] });
    fl(l).lostKin = undefined;
    ageUp(l);
    expect(l.people.some((p) => p.tags?.includes("lost_parent"))).toBe(false);
    expect(["father", "mother"]).toContain(l.people.find((p) => p.tags?.includes("guardian"))!.relation);
    expect(fl(l).lostKin?.length).toBe(1);
  });
});
