import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { mySectFaction } from "../content/murim/world/factions";
import { allEvents, eligibilityFilters, getEvent, visibleChoices } from "./events";
import { choiceChance, choiceFactors, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";
import { createPerson } from "./util";

loadMurimWorld();
loadSharedEvents();

function base(seed: number, age = 30): Life {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.money = 500_000; l.queue = [];
  return l;
}
function inSect(l: Life) {
  l.power = { rank: 2, hunterClass: "m_sword", level: 10, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [], guild: "cloud" } as never;
  expect(mySectFaction(l), "ต้องมีสำนัก").toBeTruthy();
}
const labelOf = (l: Life, i: number) => { const ch = visibleChoices(l, l.queue[0]).find((o) => o.index === i)?.c; const lb = ch?.label; return typeof lb === "function" ? lb(l, l.queue[0].ctx) : lb ?? ""; };
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]).find((x) => labelOf(l, x.index).startsWith(start));
  expect(o, `ไม่มี "${start}"`).toBeTruthy();
  resolveChoice(l, o!.index);
}

describe("แตกโอกาสของตัวเลือก", () => {
  it("แจกแจงปัจจัยจริง รวมแล้วเท่าโอกาสที่แสดง และไม่แตะค่าสถานะ", () => {
    const l = base(1, 16);
    l.stats.smarts = 90; l.stats.luck = 20;
    runEvent(l, "wf.disguise_found", { pid: "x" });
    const q = l.queue[0];
    const i = visibleChoices(l, q).findIndex((o) => labelOf(l, o.index).startsWith("ไปสารภาพ"));
    const idx = visibleChoices(l, q)[i].index;
    const before = { ...l.stats };
    const rows = choiceFactors(l, q, idx)!;
    expect(l.stats).toEqual(before);
    expect(rows.find((r) => r.label === "สติปัญญา")!.delta).toBeGreaterThan(0);
    expect(rows.reduce((s, r) => s + r.delta, 0)).toBeCloseTo(choiceChance(l, q, idx)!, 1);
  });
});

describe("จดหมายจากบ้าน", () => {
  const filter = (l: Life, id: string) => eligibilityFilters.every((f) => f(l, getEvent(id)!));

  it("อยู่สำนักแล้วเรื่องที่พ่อแม่พี่น้องเดินมาหาไม่เกิด แต่จดหมายเกิด · อยู่บ้านเกิดตามปกติ", () => {
    const l = base(2);
    const fam = allEvents().find((e) => !e.id.startsWith("hl.") && (e.prepare as { rels?: string[] } | undefined)?.rels?.every((r) => ["father", "mother", "sibling"].includes(r)))!;
    expect(fam).toBeTruthy();
    expect(filter(l, fam.id)).toBe(true);
    inSect(l);
    expect(filter(l, fam.id)).toBe(false);
    expect(filter(l, "hl.letter")).toBe(true);
  });

  it("ไม่ไปงานแต่งพี่น้อง: คนนั้นจำได้และมาทวงในอีกสามปี · ขอโทษแล้วจบ", () => {
    const l = base(3);
    inSect(l);
    const sib = createPerson(l, "sibling", { age: 28, gender: "f", bond: 60 });
    runEvent(l, "hl.sibling_wed", { pid: sib.id });
    choose(l, "ไม่ไป");
    expect(l.flags.hlSnub).toBe(sib.id);
    expect(getEvent("hl.snubbed")!.when!(l)).toBe(false);
    l.age += 3;
    expect(getEvent("hl.snubbed")!.when!(l)).toBe(true);
    runEvent(l, "hl.snubbed");
    choose(l, "คุกเข่า");
    expect(l.flags.hlSnub).toBeUndefined();
  });

  it("ญาติตายตอนอยู่สำนัก → จดหมายงานศพ · ไม่ยอมกลับดูใจ พ่อแม่ตายจริงและไม่ถามงานศพซ้ำ", () => {
    const l = base(4);
    inSect(l);
    const p = l.people.find((x) => x.relation === "mother" || x.relation === "father") ?? createPerson(l, "mother", { age: 60, gender: "f", bond: 60 });
    p.alive = true; p.age = 70;
    runEvent(l, "hl.parent_sick", { pid: p.id });
    choose(l, "อยู่ที่นี่ต่อ");
    expect(p.alive).toBe(false);
    expect(l.flags.hlFuneral).toBeUndefined();

    const s = createPerson(l, "sibling", { age: 40, gender: "m", bond: 50 });
    l.flags.hlFuneral = s.id;
    expect(getEvent("hl.funeral")!.when!(l)).toBe(true);
    runEvent(l, "hl.funeral");
    expect(getEvent("hl.funeral")!.when!(l)).toBe(true);
    choose(l, "กลับไปร่วมงาน");
    expect(l.flags.hlFuneral).toBeUndefined();
  });
});
