import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { activitiesFor } from "./activities";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function master(seed: number, age = 50): Life {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.fame = 60;
  l.stats.smarts = 100; l.stats.health = 90; l.stats.luck = 100; l.stats.looks = 100;
  l.power = { rank: 6, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] } as never;
  l.queue = [];
  return l;
}
const labelOf = (l: Life, i: number) => { const ch = visibleChoices(l, l.queue[0]).find((o) => o.index === i)?.c; const lb = ch?.label; return typeof lb === "function" ? lb(l, l.queue[0].ctx) : lb ?? ""; };
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]).find((x) => labelOf(l, x.index).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${l.queue[0]?.eventId}/${l.queue[0]?.scene ?? ""}`).toBeTruthy();
  resolveChoice(l, o!.index);
}
const finish = (l: Life) => { let g = 0; while (l.queue.length && g++ < 20) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); };

describe("ฉากแบบหนังจีน: อ่างทองคำ เจ้ายุทธจักร คดีปริศนา ปลอมตัว นัดสิบหกปี", () => {
  it("ล้างมือในอ่างทองคำ: ศัตรูเก่าบุกงาน พูดความจริงแล้ววางมือได้ · ปีต่อมาถูกดึงกลับคืนยุทธภพ", () => {
    const l = master(1);
    expect(activitiesFor(l).some((a) => a.id === "mw_basin")).toBe(true);
    runEvent(l, "wf.basin");
    choose(l, "จุ่มมือลงในอ่าง");
    choose(l, "พูดความจริง");
    finish(l);
    expect(l.flags.goldenBasin).toBe(50);
    expect(getEvent("wf.return")!.when!(l)).toBe(true);
  });

  it("ชุมนุมเลือกเจ้ายุทธจักร: สืบได้ว่าผู้สมัครคนดีที่สุดคือคนวางยา → เปิดโปงแล้วได้เป็นเจ้ายุทธจักร", () => {
    const l = master(2);
    // การสืบเป็นการทอยตามสติปัญญา — ลองจนสืบได้
    for (let i = 0; i < 8 && !l.flags.wulinLeader; i++) {
      l.queue = [];
      runEvent(l, "wf.wulin");
      choose(l, "สืบความจริง");
      if (l.queue[0]?.scene === "expose") choose(l, "ยกหลักฐาน");
      finish(l);
    }
    expect(l.flags.wulinLeader).toBe(50);
  });

  it("คดีห้องลงกลอน: คนร้ายเปลี่ยนไปตามคดี ตรวจศพแล้วชี้ตัวถูก", () => {
    const culprits = new Set<string>();
    for (let s = 1; s <= 12; s++) {
      const l = master(10 + s, 30);
      runEvent(l, "wf.case");
      choose(l, "รับคดี");
      choose(l, "ตรวจศพ");
      const acc = visibleChoices(l, l.queue[0]).map((o) => labelOf(l, o.index))[0];
      culprits.add(acc);
      choose(l, "ชี้ตัว");
      finish(l);
      expect(Number(l.flags.casesSolved)).toBe(1);
    }
    expect(culprits.size).toBeGreaterThan(1);
  });

  it("หญิงปลอมตัวเป็นชายเข้าสำนัก แล้วถูกพบที่ลำธาร · คำสัญญาสิบหกปีพบกันจริง", () => {
    const l = createLife({ seed: 30, worldId: "murim" });
    worldOfLife(l);
    l.gender = "f"; l.age = 14; l.queue = [];
    runEvent(l, "wf.disguise");
    choose(l, "เข้าสำนักในฐานะเด็กชาย");
    finish(l);
    expect(l.flags.disguised).toBe(true);
    expect(getEvent("wf.disguise_found")!.when!(l)).toBe(true);
    const m = master(31, 30);
    m.flags.sixteenYears = 31;
    m.queue = [];
    ageUp(m);
    expect(m.queue.some((q) => q.eventId === "wf.sixteen_meet") || m.log.some((e) => e.text.includes("สิบหกปี"))).toBe(true);
  });
});
