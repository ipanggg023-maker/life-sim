import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { DUEL_END } from "../content/murim/life/duel";
import { worldOfLife } from "../content/murim/life/world";
import { RANK_SIZE, initRanking, masters, myPlace } from "../content/murim/m17core";
import { YOUNG_SIZE, myYoungPlace, youngList } from "../content/murim/world/jianghu";
import { ACTIVITIES } from "./activities";
import { labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

function fighter(seed: number, age: number, rank: number) {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.stats.health = 95;
  l.power = { rank, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 10, items: [] };
  l.queue = [];
  return l;
}
const labels = (l: Life) => visibleChoices(l, l.queue[0]).map((x) => String(labelOf(x.c, l, l.queue[0].ctx)));
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]);
  const i = o.findIndex((x) => String(labelOf(x.c, l, l.queue[0].ctx)).startsWith(start));
  expect(i, `${start} ใน ${labels(l).join(" | ")}`).toBeGreaterThanOrEqual(0);
  resolveChoice(l, o[i].index);
}
/** เล่นฉากต่อสู้จนจบ (โจมตีทุกยก) */
function fight(l: Life) {
  let g = 0;
  while (l.queue.length && g++ < 30) {
    const o = visibleChoices(l, l.queue[0]);
    const i = o.findIndex((x) => /โจมตี|บุก|ฟัน|ตอบโต้/.test(String(labelOf(x.c, l, l.queue[0].ctx))));
    resolveChoice(l, o[i >= 0 ? i : 0].index);
  }
}

describe("ทำเนียบมังกรและทำเนียบยอดฝีมือ: ติดง่ายขึ้น ท้าประลองชิงอันดับได้", () => {
  it("ทำเนียบมังกรมียี่สิบอันดับ ทำเนียบยอดฝีมือมียี่สิบอันดับ และมีผู้หญิงด้วย", () => {
    const l = fighter(3, 20, 2);
    initRanking(l);
    expect(youngList(l).length).toBe(YOUNG_SIZE);
    expect(masters(l).length).toBe(RANK_SIZE);
    const women = [...youngList(l), ...masters(l)].filter((x) => x.g === "f").length;
    expect(women).toBeGreaterThan(5);
    // สิบอันดับแรกแข็งกว่าอันดับ 11–20 ชัดเจน
    expect(masters(l)[9].cp).toBeGreaterThan(masters(l)[10].cp);
  });

  it("เซฟเก่าที่มีสิบอันดับ ถูกเติมเป็นยี่สิบ", () => {
    const l = fighter(4, 20, 2);
    initRanking(l);
    l.flags.m17Rank = JSON.stringify(masters(l).slice(0, 10));
    l.flags.mwYoung = JSON.stringify(youngList(l).slice(0, 10).map(({ g: _g, ...y }) => y));
    ageUp(l);
    expect(masters(l).length).toBe(RANK_SIZE);
    expect(youngList(l).length).toBe(YOUNG_SIZE);
  });

  it("ท้าคนท้ายทำเนียบมังกรแล้วชนะ = ชื่อขึ้น · ท้าต่อขึ้นไปได้เรื่อยๆ · ชนะสามอันดับข้ามได้", () => {
    const l = fighter(7, 18, 2);
    youngList(l);
    expect(myYoungPlace(l)).toBe(0);
    const act = ACTIVITIES.find((a) => a.id === "mw_rank_young")!;
    expect(act.available!(l)).toBe(true);
    act.run(l);
    expect(l.queue[0].eventId).toBe("rk.y_menu");
    choose(l, "ท้า");
    expect(l.queue[0].eventId).toBe("duel");
    expect(act.available!(l)).toBe(false);
    // ชนะการประลอง
    l.queue = [];
    const msg = DUEL_END.rankY(l, "win", { x_pl: 19 });
    expect(myYoungPlace(l)).toBe(19);
    expect(msg).toContain("อันดับ 19");
    DUEL_END.rankY(l, "win", { x_pl: 16 });
    expect(myYoungPlace(l)).toBe(16);
    DUEL_END.rankY(l, "lose", {});
    expect(myYoungPlace(l)).toBe(16);
    // ปีต่อไป อันดับคงอยู่ (ไม่ถูกจัดเรียงใหม่ตามฝีมือ)
    ageUp(l);
    expect(myYoungPlace(l)).toBeGreaterThan(0);
    expect(validateLife(l)).toEqual([]);
  });

  it("ทำเนียบยอดฝีมือ: เลือกคู่ เลือกวิธีสู้ ชนะขึ้นอันดับ · ท้าถึงตายแล้วแพ้ตกอันดับ", () => {
    const l = fighter(11, 35, 5);
    initRanking(l);
    ACTIVITIES.find((a) => a.id === "mw_rank_master")!.run(l);
    choose(l, "ท้า");
    expect(labels(l).some((x) => x.startsWith("ประลองแตะแล้วหยุด"))).toBe(true);
    choose(l, "ประลองแตะแล้วหยุด");
    expect(l.queue[0].eventId).toBe("duel");
    l.queue = [];
    const target = masters(l)[17];
    DUEL_END.rankM(l, "win", { x_tid: target.id, x_pl: 18 });
    expect(myPlace(l)).toBe(18);
    DUEL_END.rankM(l, "lose", { x_lethal: true });
    expect(myPlace(l)).toBe(19);
  });

  it("ชีวิตจริง: ใช้การท้าประลองแล้วติดทำเนียบได้บ่อย · มีคนมาท้ากลับ · มีงานประลอง ไม่มีฉากตัน", () => {
    let young = 0, main = 0, defended = 0, tourney = 0;
    for (let s = 1; s <= 40; s++) {
      const l = fighter(500 + s * 17, 14, 1);
      const r = { rng: s };
      for (let y = 0; y < 30 && l.alive; y++) {
        l.stats.health = Math.max(l.stats.health, 70);
        if (y % 2 === 0 && l.power) l.power.rank = Math.min(6, l.power.rank + (y % 6 === 0 ? 1 : 0));
        let g0 = 0;
        while (l.queue.length && g0++ < 60) { const o = visibleChoices(l, l.queue[0]); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
        if (!l.alive) break;
        const yAct = ACTIVITIES.find((a) => a.id === "mw_rank_young")!;
        const mAct = ACTIVITIES.find((a) => a.id === "mw_rank_master")!;
        if (yAct.available!(l)) { yAct.run(l); if (labels(l).some((x) => x.startsWith("ท้า"))) { choose(l, "ท้า"); fight(l); } else choose(l, "ยังไม่ท้า"); }
        if (l.age >= 25 && mAct.available!(l)) { mAct.run(l); if (labels(l).some((x) => x.startsWith("ท้า"))) { choose(l, "ท้า"); choose(l, "ประลองแตะแล้วหยุด"); fight(l); } else choose(l, "ยังไม่ท้า"); }
        let g = 0;
        while (l.queue.length && g++ < 60) { const o = visibleChoices(l, l.queue[0]); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
        if (!l.alive) break;
        ageUp(l);
        if (myYoungPlace(l)) young++;
        if (myPlace(l)) main++;
        expect(validateLife(l)).toEqual([]);
      }
      if (l.seen["rk.y_defend"]) defended++;
      if (l.seen["rk.y_tourney"]) tourney++;
    }
    console.log("SIM ranking challenges", { young, main, defended, tourney });
    expect(young).toBeGreaterThan(100);
    expect(main).toBeGreaterThan(20);
    expect(defended).toBeGreaterThan(3);
    expect(tourney).toBeGreaterThan(15);
  });
});
