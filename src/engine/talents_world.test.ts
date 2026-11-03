import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, catInWorld } from "../content/achievements";
import { loadFantasyWorld } from "../content/fantasy";
import { FT_PART } from "../content/fantasy/talents";
import { loadMurimWorld } from "../content/murim";
import { TALENTS, talentById } from "../content/talents";
import { createLife } from "./game";
import type { Rarity, WorldId } from "./types";

loadMurimWorld();
loadFantasyWorld();

const RARITIES: Rarity[] = ["common", "rare", "legendary", "divine", "mythic"];

describe("พรสวรรค์แยกตามโลก", () => {
  for (const w of ["murim", "fantasy"] as WorldId[]) {
    it(`${w}: เกิด 400 ครั้ง ได้แต่พรสวรรค์ของโลกนี้`, () => {
      const seen = new Set<string>();
      for (let s = 1; s <= 400; s++) {
        const l = createLife({ seed: s * 13, worldId: w });
        for (const t of l.talents) {
          expect(talentById(t.id)?.world, `${w} ได้ ${t.id}`).toBe(w);
          seen.add(t.id);
        }
      }
      expect(seen.size).toBeGreaterThan(12);
    });
    it(`${w}: มีพรสวรรค์ครบทุกระดับความหายาก`, () => {
      for (const r of RARITIES) expect(TALENTS.some((t) => t.world === w && t.rarity === r && !t.noRoll), `${w} ไม่มี ${r}`).toBe(true);
    });
  }
  it("สองโลกไม่มีพรสวรรค์ซ้ำกัน", () => {
    const ids = (w: WorldId) => new Set(TALENTS.filter((t) => t.world === w).map((t) => t.name));
    const m = ids("murim");
    for (const n of ids("fantasy")) expect(m.has(n), n).toBe(false);
  });
  it("พรสวรรค์แฟนตาซีที่เปิดตอนเกิดให้ผลกับข้อมูลแฟนตาซีจริง", () => {
    let checked = 0;
    for (let s = 1; s <= 600 && checked < 5; s++) {
      const l = createLife({ seed: s * 7, worldId: "fantasy", talents: ["ft_stout"] });
      expect(l.ft!.body).toBeGreaterThanOrEqual(15);
      checked++;
    }
    expect(checked).toBe(5);
    expect(Object.keys(FT_PART).every((id) => talentById(id)?.world === "fantasy")).toBe(true);
  });
});

describe("ความสำเร็จของโลกแฟนตาซี", () => {
  const fa = ACHIEVEMENTS.filter((a) => catInWorld(a.cat, "fantasy"));
  it("มีหมวดของตัวเอง และ id ไม่ซ้ำ", () => {
    expect(fa.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it("ตรวจได้โดยไม่พังทั้งสองโลก และชีวิตยุทธภพไม่ได้ความสำเร็จแฟนตาซี", () => {
    const m = createLife({ seed: 5, worldId: "murim" });
    const f = createLife({ seed: 5, worldId: "fantasy" });
    for (const a of fa) expect(a.check(m), a.id).toBe(false);
    for (const a of fa) expect(() => a.check(f), a.id).not.toThrow();
    f.ft!.bodyRank = 3;
    f.ft!.magicRank = 3;
    const got = fa.filter((a) => a.check(f)).map((a) => a.id);
    expect(got).toEqual(expect.arrayContaining(["fa_body1", "fa_body3", "fa_magic3", "fa_both"]));
  });
});
