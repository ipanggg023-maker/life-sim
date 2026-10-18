import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { startChallenge } from "../content/ordinary/system";
import { loadSharedEvents } from "../content/shared";
import { bizList, propList } from "../content/shared/business";
import { loadTowerWorld } from "../content/tower";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice, runEvent, tryForBaby } from "./game";
import { nextFloat } from "./rng";
import type { Life, WorldId } from "./types";
import { createPerson } from "./util";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const WORLDS: WorldId[] = ["hunter", "murim", "court", "tower", "apocalypse", "ordinary"];

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 50) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("M25 ธุรกิจ ครอบครัว ชมรม กระดานภารกิจ", () => {
  it("เล่นครบทุกระบบใหม่โดยไม่ติด และทุกระบบเกิดผลจริง", () => {
    let clubs = 0, clubTop = 0, tourneys = 0, biz = 0, props = 0, kidStories = 0, talks = 0, legend = 0, boardSide = 0;
    const N = 180;
    for (let s = 1; s <= N; s++) {
      const w = WORLDS[s % 6];
      const l = createLife({ seed: s * 92821, worldId: w });
      const r = { rng: s * 13 };
      let guard = 0;
      while (l.alive && guard++ < 700) {
        drain(l, r);
        if (!l.alive) break;
        for (const a of ACTIVITIES) {
          const want = /^(club_|kid_|biz_)/.test(a.id) ? 0.7 : a.id.startsWith("free_") ? 0.05 : 0.3;
          if (!activityLocked(l, a) && nextFloat(r) < want) { doActivity(l, a.id); drain(l, r); }
        }
        if (l.age >= 25 && l.age <= 40 && !l.people.some((p) => p.relation === "spouse")) createPerson(l, "spouse", { age: l.age, bond: 80 });
        const sp = l.people.find((p) => p.relation === "spouse" && p.alive);
        if (sp && l.age <= 40) tryForBaby(l, sp);
        for (const p of l.people.filter((x) => x.alive).slice(0, 2)) { runEvent(l, "talk.menu", { pid: p.id }); drain(l, r); talks++; }
        if (w === "ordinary" && l.sys && l.age >= 18) {
          if (!l.job) applyJob(l, "store");
          for (let k = 0; k < 2; k++) { startChallenge(l); drain(l, r); }
          l.money += 3_000_000; // ให้บอทมีทุนเปิดกิจการ
        } else if (l.age >= 20) l.money += 1_500_000;
        drain(l, r);
        ageUp(l);
      }
      if (l.flags.clubsJoined) clubs++;
      clubTop = Math.max(clubTop, Number(l.flags.clubBest ?? 0));
      tourneys += Number(l.flags.clubWins ?? 0);
      if (Number(l.flags.bizOpened ?? 0) > 0) biz++;
      if (propList(l).length || bizList(l).length) props++;
      kidStories += l.people.filter((p) => p.tags?.length).length;
      legend = Math.max(legend, Number(l.flags.sysLegend ?? 0));
      boardSide += Number(l.flags.sysSideWins ?? 0);
    }
    console.log("SIM M25 เข้าชมรม", clubs, "/", N, "| ระดับชมรมสูงสุด", clubTop, "| ชนะแข่ง", tourneys, "| เปิดกิจการ", biz, "| มีทรัพย์สินตอนตาย", props, "| ลูกมีเรื่องราว", kidStories, "| คุย", talks, "| ภารกิจระบบข้างทางสำเร็จ", boardSide, "| ภารกิจตำนานสูงสุด ★", legend);
    expect(clubs).toBeGreaterThan(N * 0.6);
    expect(clubTop).toBeGreaterThanOrEqual(4);
    expect(tourneys).toBeGreaterThan(N);
    expect(biz).toBeGreaterThan(N * 0.4);
    expect(kidStories).toBeGreaterThan(N * 0.5);
    expect(boardSide).toBeGreaterThan(30);
    expect(legend).toBeGreaterThanOrEqual(2);
  });
});

describe("เหตุการณ์ธุรกิจทุกตัวเล่นได้", () => {
  it("วิกฤตกิจการ รีวิว พนักงาน ข้อเสนอซื้อ ผู้เช่า ที่ดิน — ทุกตัวเลือกไม่พัง และข้อความคงที่", async () => {
    const { BIZ_EVENTS } = await import("../content/shared/business");
    const { currentScene } = await import("./events");
    for (const w of WORLDS) {
      for (const e of BIZ_EVENTS.filter((x) => !x.manual)) {
        const n = e.choices!.length;
        for (let i = 0; i < n; i++) {
          const l = createLife({ seed: 4242 + i, worldId: w });
          l.age = 40;
          l.money = 100_000_000;
          l.flags.bizData = JSON.stringify([{ t: 3, lv: 3, rep: 50, yrs: 2 }, { t: 0, lv: 1, rep: 40, yrs: 1 }]);
          l.flags.propData = JSON.stringify([{ k: 1, v: 5_000_000 }, { k: 3, v: 8_000_000 }]);
          l.queue = [{ eventId: e.id, ctx: e.prepare?.(l) ?? {} }];
          const s = currentScene(l.queue[0], l)!;
          const t1 = s.text(l, l.queue[0].ctx);
          const t2 = currentScene(l.queue[0], l)!.text(l, l.queue[0].ctx);
          expect(t1, e.id).toBe(t2);
          const vis = visibleChoices(l, l.queue[0]);
          if (i >= vis.length) continue;
          const out = resolveChoice(l, vis[i].index);
          expect(out?.text, `${e.id}#${i}`).toBeTruthy();
          expect(Number.isFinite(l.money)).toBe(true);
        }
      }
    }
  });
});
