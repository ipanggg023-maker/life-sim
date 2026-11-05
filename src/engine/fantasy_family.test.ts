import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { CALLINGS, callingDue, callingOf, callingProg, heirlooms, legacyHeir, stageAge } from "../content/fantasy/family";
import { inheritLife, setRace } from "../content/fantasy/life";
import { fl, worldOfLife } from "../content/fantasy/state";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { buildHeir } from "./soul";
import type { Life, Person } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed = 3, age = 45): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const kid = (l: Life, age: number, bond: number): Person => createPerson(l, "child", { age, bond, lastName: l.lastName });
const choose = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const scene = q.scene && ev.scenes ? ev.scenes[q.scene] : ev;
  const o = visibleChoices(l, q).find((x) => re.test(labelOf(scene.choices![x.index], l, q.ctx)));
  if (!o) throw new Error(`no choice ${re} in ${q.eventId}`);
  resolveChoice(l, o.index);
};
const heirOf = (dead: Life, k: Person) => { const n = buildHeir(dead, k.id); inheritLife(dead, n, k.id); return n; };

describe("อายุตามช่วงชีวิต", () => {
  it("มนุษย์ใช้อายุจริง เผ่าอายุยืนยืดวัยผู้ใหญ่ออก", () => {
    const h = life(3, 70);
    expect(stageAge(h)).toBe(70);
    const e = life(4, 200); setRace(e, "elf");
    expect(stageAge(e)).toBeLessThan(70);
    expect(stageAge(e)).toBeGreaterThan(40);
  });
});

describe("ลูกที่คุณเลี้ยง", () => {
  it("บทเรียนในวัยเด็กติดตัวทายาท และสอนงานครบสามครั้งเริ่มงานเดิมที่ขั้นสอง", () => {
    const a = life(11);
    a.job = { careerId: "ft_merchant", level: 3, performance: 60, years: 5 };
    // ลูกคนเดียวกัน สอนกับไม่สอน: ทายาทคนเดียวกันต่างกันแค่บทเรียน
    const taught = kid(a, 20, 80);
    const p = heirOf(a, taught);
    taught.tags = [...(taught.tags ?? []), "taught_body:4", "taught_mind:3", "taught_trade:3"];
    const t = heirOf(a, taught);
    expect(fl(t).body).toBe(fl(p).body + 60);
    expect(t.stats.smarts).toBeGreaterThan(p.stats.smarts);
    expect(Number(t.flags.ftBest_ft_merchant)).toBe(3);
    expect(p.flags.ftBest_ft_merchant).toBeUndefined();
  });
  it("พ่อแม่ที่เกษียณแล้วก็ยังส่งงานที่เคยทำให้ลูก", () => {
    const a = life(13, 70);
    a.flags.ftBest_ft_smith = 5; a.flags.ftBest_ft_merchant = 2;
    const k = kid(a, 30, 60); k.tags = ["taught_trade:3"];
    expect(Number(heirOf(a, k).flags.ftBest_ft_smith)).toBe(3);
  });
  it("ปุ่มสอนลูกมีบทเรียนงานของคุณเมื่อมีงานทำ", () => {
    const a = life(12);
    a.job = { careerId: "ft_merchant", level: 2, performance: 60, years: 2 };
    const k = kid(a, 13, 50);
    runEvent(a, "ft.p.teach", { pid: k.id });
    choose(a, /ดูงานของคุณ/);
    expect(k.tags).toContain("taught_trade:1");
  });
});

describe("พินัยกรรมและมรดก", () => {
  it("ลูกที่ระบุในพินัยกรรมได้ของใหญ่ พี่น้องที่ถูกข้ามจำได้", () => {
    const a = life(21, 60);
    fl(a).estates = { tower: 0 }; fl(a).weapon = { name: "ดาบตระกูล", quality: 5, enchant: true }; a.flags.ftHall = 1; a.flags.ftHome = 3;
    const older = kid(a, 30, 90), younger = kid(a, 24, 40);
    expect(legacyHeir(a)!.id).toBe(older.id);
    runEvent(a, "ft.fm.will");
    choose(a, new RegExp(`ยกให้${younger.name.split(" ")[0]}`));
    expect(a.flags.ftWill).toBe(younger.id);
    expect(older.mem?.some((m) => m.k === "will")).toBe(true);
    expect(heirlooms(a).length).toBeGreaterThanOrEqual(4);
    const y = heirOf(a, younger);
    expect(fl(y).estates?.tower).toBe(0);
    expect(fl(y).weapon?.name).toBe("ดาบตระกูล");
    expect(y.flags.ftHall).toBe(1);
    expect(y.flags.ftHome).toBe(3);
    const o = heirOf(a, older);
    expect(fl(o).weapon).toBeUndefined();
    expect(o.flags.ftHall).toBeUndefined();
  });
  it("ศิษย์ของพ่อแม่ตามมาเป็นพวกของทายาท", () => {
    const a = life(22, 60);
    const s = createPerson(a, "ally", { age: 30, bond: 80 }); s.tags = ["apprentice"];
    const k = kid(a, 25, 70);
    const n = heirOf(a, k);
    expect(n.people.some((p) => p.id === s.id && p.relation === "ally")).toBe(true);
  });
});

describe("บทต่อไปของชีวิต", () => {
  it("อายุหกสิบได้เลือกงานของบั้นปลาย และเลือกใหม่ได้ทุกสี่สิบปี", () => {
    const a = life(31, 59);
    expect(callingDue(a)).toBe(false);
    a.age = 60;
    expect(callingDue(a)).toBe(true);
    runEvent(a, "ft.el.calling");
    choose(a, /เขียนเรื่องชีวิต/);
    expect(callingOf(a)).toBe("memoir");
    expect(callingDue(a)).toBe(false);
    a.age = 100;
    expect(callingDue(a)).toBe(true);
  });
  it("บันทึกชีวิตครบห้าบทตีพิมพ์เป็นตำนาน แล้วได้เลือกงานใหม่", () => {
    const a = life(32, 62);
    runEvent(a, "ft.el.calling"); choose(a, /เขียนเรื่องชีวิต/);
    for (let i = 0; i < CALLINGS.memoir.need; i++) { runEvent(a, "ft.el.w.chapter"); choose(a, /ตามจริง/); }
    expect(callingProg(a)).toBe(5);
    runEvent(a, "ft.el.w.publish"); choose(a, /ตีพิมพ์/);
    expect(fl(a).deeds).toContain("เขียนบันทึกชีวิตจนจบเล่ม");
    expect(worldOfLife(a).legends.some((g) => g.lifeId === a.id)).toBe(true);
    expect(callingDue(a)).toBe(true);
  });
  it("ครูรับศิษย์ สอนจนพร้อม และศิษย์ที่ส่งออกไปนับเป็นผลงาน", () => {
    const a = life(33, 61);
    runEvent(a, "ft.el.calling"); choose(a, /สอนคนรุ่นใหม่/);
    runEvent(a, "ft.el.m.arrive"); choose(a, /รับเป็นศิษย์/);
    const s = a.people.find((p) => p.tags?.includes("el_student"))!;
    expect(s).toBeTruthy();
    s.tags = [...s.tags!.filter((t) => !t.startsWith("el_skill:")), "el_skill:6"];
    runEvent(a, "ft.el.m.graduate", { pid: s.id }); choose(a, /สร้างชื่อ/);
    expect(s.tags).toContain("el_grad");
    expect(callingProg(a)).toBe(1);
  });
  it("ปีที่ผ่านไปในบั้นปลายมีเรื่องของงานที่เลือก", () => {
    const a = life(34, 60);
    runEvent(a, "ft.el.calling"); choose(a, /ออกเดินทาง/);
    let trips = 0;
    for (let i = 0; i < 12 && a.alive; i++) {
      ageUp(a);
      while (a.queue.length) { const q = a.queue[0]; if (q.eventId.startsWith("ft.el.j.")) { trips++; choose(a, /คนเดียว/); } else resolveChoice(a, visibleChoices(a, q)[0].index); }
    }
    expect(trips).toBeGreaterThanOrEqual(3);
  });
});
