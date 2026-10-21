// Phase 5 — ครัวเรือน (MURIM_PLAN §5, §18.4 · MURIM_EXPANSION §5)
// ฮูหยินใหญ่/ฮูหยินรอง แต่ละคนมีความยินยอม เป้าหมาย ความสัมพันธ์กับคู่สมรสคนอื่น และครอบครัวเดิมของนาง — ไม่ใช่ระบบสะสมโบนัส
// ลูกมีบุคลิก/ความถนัด/เป้าหมาย อาจปฏิเสธตำแหน่งทายาท · ความลำเอียงสร้างความขัดแย้ง · อาจารย์–ศิษย์ · ความกตัญญู
import type { GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { feel, goalOf, hasTrait, relOf, remember, traitsOf } from "../../../engine/npc";
import { pick, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { createPerson, people, shortName } from "../../../engine/util";
import { addQi, artInfo, artsOf, learn } from "../martial/arts";
import { B, BIG, C, E, G, K, N, PAY, flagged, nm, rich, who, withPerson } from "../story/kit";

// ───────── ฮูหยินใหญ่ / ฮูหยินรอง ─────────

export const spouses = (l: Life) => people(l, "spouse").filter((p) => p.alive);
export const isMain = (p: Person) => !p.tags?.includes("secondary");
export const mainWife = (l: Life) => spouses(l).find(isMain);
const secondaries = (l: Life) => spouses(l).filter((p) => !isMain(p));
const tag = (p: Person, t: string) => { p.tags = [...(p.tags ?? []).filter((x) => x !== t), t]; };

/** ปีนี้ใช้เวลากับใครมากที่สุด (ปุ่ม "ใช้เวลาด้วยกัน") — ใช้คิดความลำเอียง */
const favored = (l: Life) => spouses(l).filter((p) => l.doneThisYear.includes(`time:${p.id}`));

/** ทุกปี: ความหึงหวงระหว่างคู่สมรส · คนที่ถูกละเลยเริ่มน้อยใจ */
function tickHousehold(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  const sp = spouses(l);
  if (sp.length < 2) return;
  const fav = favored(l);
  for (const p of sp) {
    if (fav.length && !fav.includes(p)) feel(p, { love: -3, jealousy: hasTrait(p, "envious") ? 8 : 4 });
    if (fav.includes(p) && !isMain(p)) { const m = mainWife(l); if (m) feel(m, { jealousy: 3, respect: -1 }); }
  }
}

/** ชาย: รับฮูหยินรอง (การแต่งงานเพื่อพันธมิตร / ความรัก / หน้าที่สืบสกุล) */
const MAN_MORE: GameEvent[] = [
  E("hh.second_wife_offer", [22, 60], (l) => `${pick(l, ["ตระกูลพ่อค้าเกลือรายใหญ่", "ขุนนางท้องถิ่น", "หัวหน้าสำนักคุ้มภัยเพื่อนเก่า"])}ส่งแม่สื่อมาเสนอยกบุตรสาวให้เป็นฮูหยินรองของคุณ — สินสอดที่พวกเขาจะมอบให้ มากพอซื้อนาทั้งหุบเขา และพวกเขาจะกลายเป็นพันธมิตรของตระกูลคุณ`, [
    C("ปรึกษาฮูหยินใหญ่ก่อน", (l, c) => {
      const m = mainWife(l)!;
      const ok = relOf(m).love >= 60 && !hasTrait(m, "envious") ? true : relOf(m).trust >= 55;
      c.pid = m.id;
      return ok
        ? G(`${nm(l, c)}เงียบไปนาน แล้วพยักหน้า "ท่านพี่ตัดสินใจเถิด ขอเพียงอย่าลืมว่าใครอยู่ข้างท่านมาก่อน"`, { feel: { trust: 6, respect: 4 }, flag: "wifeConsented" })(l, c)
        : B(`${nm(l, c)}วางถ้วยชาลงแรงจนชาหก "ถ้าท่านพี่รับนางเข้ามา ข้าจะกลับบ้านเดิม"`, { feel: { trust: -4, jealousy: 15 } })(l, c);
    }, { pros: "ฮูหยินใหญ่รู้สึกว่าถูกให้เกียรติ", cons: "นางอาจไม่ยินยอม" }),
    C("รับเลย ไม่ต้องถาม", (l) => {
      const np = createPerson(l, "spouse", { gender: "f", age: l.age - randInt(l, 5, 14), bond: 45 });
      tag(np, "secondary");
      remember(l, np, "married", "แต่งเข้าตระกูลเป็นฮูหยินรอง", 3, { loyalty: 20 });
      const m = mainWife(l);
      if (m) remember(l, m, "second_wife", "รับฮูหยินรองเข้าบ้านโดยไม่ถาม", 3, { trust: -20, jealousy: 25, love: -10 });
      l.money += 300_000;
      l.flags.allianceMarriage = true;
      return { text: `เกี้ยวสีแดงเข้าประตูข้าง — ${shortName(np)}กลายเป็นฮูหยินรองของคุณ ตระกูลนางส่งสินสอดสามร้อยตำลึงมาพร้อมคำมั่นเป็นพันธมิตร (ฮูหยินใหญ่ไม่ยอมออกมาต้อนรับ)`, kind: "milestone" };
    }, { pros: "สินสอด 300 ตำลึง และพันธมิตรตระกูลใหญ่", cons: "ฮูหยินใหญ่จะเจ็บใจลึก" }),
    C("ปฏิเสธอย่างสุภาพ", G("แม่สื่อกลับไปพร้อมคำว่า 'บ้านนี้มีฮูหยินคนเดียวก็พอ' — ข่าวนี้ไปถึงหูฮูหยินใหญ่ก่อนค่ำ", { joy: 2 }), { pros: "บ้านสงบ ฮูหยินใหญ่ซึ้งใจ", cons: "เสียโอกาสพันธมิตร" }),
  ], { when: (l) => l.gender === "m" && spouses(l).length === 1 && secondaries(l).length === 0, weight: (l) => (rich(l) ? 5 : 2), title: "ข้อเสนอจากแม่สื่อ" }),
  E("hh.second_wife_consent", [22, 61], "ฮูหยินใหญ่ยินยอมแล้ว แม่สื่อรอคำตอบสุดท้ายอยู่ที่ห้องรับแขก", [
    C("รับนางเข้าบ้าน", (l) => {
      l.flags.wifeConsented = false;
      const np = createPerson(l, "spouse", { gender: "f", age: l.age - randInt(l, 5, 14), bond: 50 });
      tag(np, "secondary");
      remember(l, np, "married", "แต่งเข้าตระกูลเป็นฮูหยินรอง", 3, { loyalty: 25 });
      const m = mainWife(l);
      if (m) remember(l, m, "consulted", "ได้รับการปรึกษาก่อนรับฮูหยินรอง", 2, { trust: 6 });
      l.money += 300_000;
      l.flags.allianceMarriage = true;
      return { text: `${shortName(np)}คำนับฮูหยินใหญ่ก่อนคำนับคุณ — บ้านนี้มีระเบียบตั้งแต่วันแรก`, kind: "milestone" };
    }),
    C("เปลี่ยนใจ ไม่รับ", G("ฮูหยินใหญ่ไม่พูดอะไร แต่คืนนั้นนางต้มซุปที่คุณชอบที่สุดให้", { joy: 3 })),
  ], { when: (l) => !!l.flags.wifeConsented && l.gender === "m" && secondaries(l).length === 0, forced: true, title: "คำตอบสุดท้าย" }),
];

/** หญิง: สามีจะรับอนุ */
const WOMAN_SIDE: GameEvent[] = [
  E("hh.husband_concubine", [20, 55], (l, c) => `${nm(l, c)} สามีของคุณ บอกว่าแม่ของเขาอยากได้หลานชาย และมีหญิงสาวจากตระกูลพ่อค้าที่เต็มใจเข้ามาเป็นอนุ`, [
    K("ยืนยันว่าไม่ยอม", "looks", 50, G("เขามองคุณนาน แล้วไปบอกแม่ว่าเรื่องนี้จบแล้ว — แม่สามีไม่พูดกับคุณไปทั้งปี", { feel: { respect: 10 }, joy: 2 }), B("เขารับนางเข้าบ้านอยู่ดี และคุณต้องยิ้มต้อนรับต่อหน้าญาติทั้งตระกูล", { feel: { trust: -15 }, joy: -10, flag: "husbandConcubine" }), { pros: "รักษาบ้านไว้ได้", cons: "อาจไม่สำเร็จ และแม่สามีเกลียดคุณ" }),
    C("ยอมรับ แต่ขอให้นางอยู่ใต้การดูแลของคุณ", N("คุณกลายเป็นคนกำหนดทุกอย่างในเรือนหลัง — อนุคนนั้นต้องมาคำนับคุณทุกเช้า", { flag: ["husbandConcubine", "ruleInnerHouse"], feel: { respect: 6 } }), { pros: "อำนาจในเรือนหลังเป็นของคุณ", cons: "ความรักไม่เหมือนเดิม" }),
    C("กลับบ้านเดิม", B("คุณเก็บของกลับบ้านพ่อแม่ — ทั้งเมืองซุบซิบ แต่สามีมาตามคุณกลับในสามวันพร้อมคำสัญญา", { fame: -2, feel: { love: 4, respect: 8 } })),
  ], { ...withPerson(["spouse"], (p) => p.gender === "m"), when: (l) => l.gender === "f" && spouses(l).length > 0, weight: 3, title: "อนุภรรยา" }),
];

const HOUSE_DRAMA: GameEvent[] = [
  E("hh.quarrel", [22, 90], (l) => { const m = mainWife(l), s = secondaries(l)[0]; return `${m ? shortName(m) : "ฮูหยินใหญ่"}กับ${s ? shortName(s) : "ฮูหยินรอง"}ทะเลาะกันกลางลานเรือนเรื่อง${pick(l, ["ผ้าไหมที่คุณซื้อมาให้คนหนึ่งสวยกว่า", "ใครควรได้ห้องฝั่งตะวันออก", "การเลี้ยงลูก", "เงินใช้จ่ายรายเดือน"])} บ่าวไพร่ทั้งเรือนแอบฟัง`; }, [
    C("เข้าข้างฮูหยินใหญ่ตามธรรมเนียม", (l, c) => { const m = mainWife(l), s = secondaries(l)[0]; if (m) feel(m, { respect: 6, loyalty: 4 }); if (s) remember(l, s, "sided_against", "ถูกตัดสินให้แพ้ต่อหน้าบ่าว", 2, { love: -8, grudge: 10 }); void c; return N("ระเบียบในเรือนกลับมา แต่ฮูหยินรองร้องไห้ทั้งคืน")(l, c); }),
    C("เข้าข้างฮูหยินรอง", (l, c) => { const m = mainWife(l), s = secondaries(l)[0]; if (s) feel(s, { love: 8 }); if (m) remember(l, m, "shamed", "ถูกหักหน้าต่อหน้าบ่าว", 3, { trust: -15, grudge: 20, respect: -10 }); return B("บ่าวทั้งเรือนเห็นฮูหยินใหญ่เสียหน้า — คุณเพิ่งสร้างศัตรูในบ้านตัวเอง")(l, c); }),
    K("ตัดสินอย่างเป็นกลาง ให้ทั้งคู่ขอโทษกัน", "smarts", 55, G("ทั้งคู่ไม่พอใจ แต่ยอมรับว่ายุติธรรม — บ้านสงบไปอีกพัก", { joy: 2 }), B("ทั้งคู่คิดว่าคุณเข้าข้างอีกฝ่าย", { joy: -4 })),
  ], { when: (l) => spouses(l).length >= 2, weight: 6, maxTimes: 4, title: "เรือนหลังวุ่นวาย" }),
  E("hh.poison_plot", [25, 90], (l) => `บ่าวคนสนิทกระซิบว่าเห็น${(() => { const s = spouses(l).sort((a, b) => relOf(b).jealousy - relOf(a).jealousy)[0]; return s ? shortName(s) : "ใครบางคน"; })()}แอบใส่อะไรบางอย่างลงในยาบำรุงครรภ์ของอีกคน`, [
    K("สืบสวนอย่างเงียบๆ", "smarts", 60, BIG("หลักฐานชัดเจน — ยาพิษแท้งลูกจากร้านยาในตลาดมืด คุณต้องตัดสินใจว่าจะลงโทษอย่างไร", { flag: "poisonProven" }), B("หลักฐานหายไปหมด บ่าวคนที่บอกคุณถูกพบลอยน้ำในอีกสามวัน", { joy: -8 }), { pros: "รู้ความจริง", cons: "คนร้ายอาจรู้ตัวก่อน" }),
    C("เรียกทุกคนมาซักต่อหน้า", B("ทั้งสองฝ่ายร้องไห้ปฏิเสธ กล่าวหากันไปมา บ้านแตกเป็นสองฝ่าย", { joy: -6 })),
    C("ไม่เชื่อบ่าว", N("ปลายปีนั้นมีข่าวเศร้า — เด็กในครรภ์ไม่รอด และคุณจะไม่มีวันรู้ว่าทำไม", { joy: -12 })),
  ], { when: (l) => spouses(l).length >= 2 && spouses(l).some((p) => relOf(p).jealousy >= 40), weight: 4, title: "ยาบำรุงครรภ์" }),
  E("hh.poison_verdict", [25, 91], "หลักฐานอยู่ตรงหน้า — คนในบ้านของคุณพยายามฆ่าลูกในท้องของอีกคน", [
    C("หย่าและส่งกลับบ้านเดิม", (l, c) => { const s = spouses(l).sort((a, b) => relOf(b).jealousy - relOf(a).jealousy)[0]; if (s) { s.relation = "rival"; remember(l, s, "divorced", "ถูกหย่าด้วยความอัปยศ", 3, { grudge: 50 }); } l.flags.poisonProven = false; void c; return B("เกี้ยวสีขาวพานางออกจากบ้าน ตระกูลเดิมของนางประกาศตัดขาดกับตระกูลคุณ")(l, c); }),
    C("ให้อภัย แต่ยึดอำนาจในเรือนหลัง", (l, c) => { const s = spouses(l).sort((a, b) => relOf(b).jealousy - relOf(a).jealousy)[0]; if (s) remember(l, s, "forgiven_plot", "ถูกให้อภัยหลังวางยา", 3, { debt: 30, fear: 30 }); l.flags.poisonProven = false; void c; return N("นางคุกเข่าขอบคุณ ส่วนคนที่ถูกวางยาไม่มองหน้าคุณเหมือนเดิมอีกเลย")(l, c); }),
  ], { when: flagged("poisonProven"), forced: true, title: "ตัดสินในเรือน" }),
];

// ───────── ลูก ทายาท ─────────

const child = withPerson(["child"], (p) => p.age >= 6 && p.age <= 15);

const CHILDREN: GameEvent[] = [
  E("hh.child_path", [24, 75], (l, c) => `${nm(l, c)}อายุ ${who(l, c)!.age} แล้ว ถึงเวลาตัดสินใจว่าจะให้ร่ำเรียนอะไร — เด็กคนนี้${traitsOf(who(l, c)!).includes("ambitious") ? "หัวไวและอยากเก่งกว่าใคร" : traitsOf(who(l, c)!).includes("gentle") ? "อ่อนโยน ชอบดูแลสัตว์" : "ซนแต่ฉลาด"}`, [
    C("ส่งขึ้นเขาเข้าสำนัก", (l, c) => { const p = who(l, c)!; tag(p, "path:sect"); feel(p, { respect: 4 }); return G(`${nm(l, c)}โบกมือลาจากหลังม้าของผู้อาวุโส — อีกหลายปีกว่าจะได้เห็นหน้ากันอีก`)(l, c); }, { pros: "ลูกอาจเป็นยอดฝีมือ", cons: "ห่างบ้านหลายปี" }),
    PAY("จ้างซินแสสอนเตรียมสอบขุนนาง", 30, (l, c) => { const p = who(l, c)!; tag(p, "path:scholar"); feel(p, { love: 3 }); return G(`${nm(l, c)}เริ่มท่องตำราทุกเช้า — วันหนึ่งอาจได้สวมชุดขุนนาง`)(l, c); }, { pros: "ทางรับราชการ", cons: "ค่าเล่าเรียนแพง" }),
    C("ให้ช่วยกิจการของบ้าน", (l, c) => { const p = who(l, c)!; tag(p, "path:family"); feel(p, { loyalty: 6 }); return N(`${nm(l, c)}ตามคุณไปทุกที่ เรียนรู้ทุกอย่างจากการลงมือทำ`)(l, c); }, { pros: "ลูกอยู่ใกล้ เป็นกำลังของบ้าน", cons: "อาจไม่ได้เห็นโลกกว้าง" }),
    C("ถามลูกว่าอยากเป็นอะไร", (l, c) => { const p = who(l, c)!; tag(p, "path:own"); feel(p, { love: 8, trust: 8 }); return G(`${nm(l, c)}ตอบทันทีว่า "${goalOf(p)}" — คุณหัวเราะ แล้วสัญญาว่าจะช่วย`)(l, c); }, { pros: "ลูกรักและไว้ใจคุณ", cons: "เส้นทางอาจไม่ใช่สิ่งที่ตระกูลต้องการ" }),
  ], { ...child, when: (l) => child.when(l) && people(l, "child").some((p) => p.alive && p.age >= 6 && p.age <= 15 && !p.tags?.some((t) => t.startsWith("path:"))), prepare: (l) => ({ pid: people(l, "child").find((p) => p.alive && p.age >= 6 && p.age <= 15 && !p.tags?.some((t) => t.startsWith("path:")))!.id }), maxTimes: 6, weight: 10, title: "อนาคตของลูก" }),
  E("hh.heir", [40, 90], "ถึงเวลาประกาศทายาทของตระกูล — ทุกคนในบ้านรู้ว่าวันนี้จะมีคนผิดหวัง", [
    ...[0, 1, 2].map((i) => C(
      (l: Life) => { const k = people(l, "child").filter((p) => p.alive && p.age >= 16)[i]; return k ? `เลือก${shortName(k)} (${k.age} ปี${k.tags?.includes("path:sect") ? " · ศิษย์สำนัก" : ""}${i === 0 ? " · ลูกคนโต" : ""})` : "—"; },
      (l, c) => {
        const ks = people(l, "child").filter((p) => p.alive && p.age >= 16);
        const k = ks[i];
        l.flags.heirId = k.id;
        remember(l, k, "named_heir", "ถูกเลือกเป็นทายาทของตระกูล", 3, { loyalty: 20, love: 8 });
        for (const o of ks) if (o !== k) remember(l, o, "passed_over", `ไม่ได้รับเลือกเป็นทายาท (${shortName(k)} ได้แทน)`, 3, { jealousy: 25, grudge: o.age > k.age ? 20 : 8 });
        void c;
        return BIG(`${shortName(k)}คุกเข่ารับป้ายประจำตระกูล — คุณเห็นแววตาของลูกคนอื่นๆ แล้วรู้ว่าเรื่องนี้ยังไม่จบ`)(l, c);
      },
      { show: (l: Life) => people(l, "child").filter((p) => p.alive && p.age >= 16).length > i, pros: i === 0 ? "ตามธรรมเนียม — คนส่วนใหญ่ยอมรับ" : "อาจเลือกคนที่เหมาะที่สุด", cons: i === 0 ? "ลูกคนโตอาจไม่ใช่คนที่เก่งที่สุด" : "ผิดธรรมเนียม — ลูกคนโตจะแค้นเคือง" },
    )),
  ], { when: (l) => people(l, "child").filter((p) => p.alive && p.age >= 16).length >= 2 && !l.flags.heirId, weight: 8, title: "ทายาท" }),
  E("hh.heir_refuse", [40, 95], (l) => { const k = l.people.find((p) => p.id === l.flags.heirId); return `${k ? shortName(k) : "ทายาท"}มาคุกเข่าตรงหน้า "ข้าไม่อยากสืบทอดตระกูล ข้ามีทางของข้า" — ${k ? goalOf(k) : ""}`; }, [
    C("ยอมปล่อยให้ไปตามทาง", (l, c) => { const k = l.people.find((p) => p.id === l.flags.heirId); if (k) remember(l, k, "let_go", "ได้รับอนุญาตให้เลือกทางชีวิตเอง", 3, { love: 15, debt: 30 }); l.flags.heirId = ""; return G("ลูกร้องไห้ขอบคุณ — ตระกูลต้องหาทายาทใหม่ แต่คุณได้ลูกคืนมาทั้งหัวใจ")(l, c); }),
    C("สั่งให้ทำหน้าที่", (l, c) => { const k = l.people.find((p) => p.id === l.flags.heirId); if (k) remember(l, k, "forced_heir", "ถูกบังคับให้เป็นทายาท", 3, { love: -15, grudge: 20, loyalty: 10 }); return N("ลูกรับหน้าที่ — แต่ไม่ยิ้มอีกเลยตั้งแต่วันนั้น")(l, c); }),
  ], { when: (l) => { const k = l.people.find((p) => p.id === l.flags.heirId && p.alive); return !!k && (hasTrait(k, "ambitious") || k.tags?.includes("path:own") === true) && relOf(k).love < 70; }, weight: 4, title: "ทายาทที่ไม่อยากเป็น" }),
  E("hh.sibling_war", [50, 95], "ลูกๆ ทะเลาะกันเรื่องมรดกตั้งแต่คุณยังมีชีวิต — ลูกคนหนึ่งแอบขายที่นาของตระกูลไปครึ่งแปลง อีกคนพกมีดมาที่บ้าน", [
    K("เรียกทุกคนมาตัดสินต่อหน้าหอบรรพชน", "looks", 55, G("ทุกคนคุกเข่าต่อหน้าป้ายบรรพบุรุษ — ความเงียบนั้นทำให้ลูกๆ ยอมถอย", { joy: 3 }), B("ลูกคนหนึ่งเดินออกจากหอบรรพชนกลางพิธี — ตระกูลแตกเป็นสองฝ่าย", { joy: -12, flag: "familySplit" })),
    C("แบ่งมรดกให้เสร็จตั้งแต่ตอนนี้", N("ทุกคนได้ส่วนของตัวเองไปก่อน คุณเหลือแค่บ้านหลังเล็กกับสวนท้อ — แต่บ้านก็สงบลง", { tael: -100 })),
  ], { when: (l) => people(l, "child").filter((p) => p.alive && p.age >= 20 && relOf(p).jealousy >= 30).length >= 1 && people(l, "child").filter((p) => p.alive).length >= 2, weight: 4, title: "พี่น้องแย่งมรดก" }),
];

// ───────── อาจารย์ — ศิษย์ ─────────

const masterP = withPerson(["ally"], (p) => !!p.tags?.includes("master"));
const discipleP = withPerson(["ally"], (p) => !!p.tags?.includes("disciple"));

const MASTER_DISCIPLE: GameEvent[] = [
  E("md.master_gift", [14, 60], (l, c) => `${nm(l, c)} อาจารย์ของคุณ เรียกไปพบกลางดึก "ข้าแก่แล้ว — วิชาที่ข้าเก็บไว้ ข้าจะถ่ายทอดให้เจ้าคนเดียว"`, [
    C("คุกเข่ารับ", (l, c) => { const art = pick(l, ["x_taiji", "x_yijin", "x_dragon_palm", "x_alliance_seal"]); const s = learn(l, art, "อาจารย์", true); addQi(l, 3); feel(who(l, c)!, { love: 6 }); return BIG(`อาจารย์จับข้อมือคุณ ส่งลมปราณผ่านเส้นชีพจรทีละเส้นจนถึงรุ่งเช้า${s}`)(l, c); }),
  ], { ...masterP, weight: 5, title: "วิชาของอาจารย์" }),
  E("md.master_expel", [14, 70], (l, c) => `${nm(l, c)} อาจารย์ของคุณได้ยินเรื่องที่คุณทำ — "ศิษย์ของข้าไม่ทำแบบนี้" เขาวางป้ายศิษย์ไว้บนโต๊ะตรงหน้าคุณ`, [
    C("คุกเข่าขอโทษ สาบานว่าจะไม่ทำอีก", (l, c) => (relOf(who(l, c)!).love >= 50 ? G("อาจารย์ถอนหายใจยาว แล้วเก็บป้ายคืนเข้าแขนเสื้อ \"ครั้งเดียว — ไม่มีครั้งที่สอง\"", { feel: { trust: -10 } }) : B("อาจารย์หันหลังให้ \"ข้าไม่มีศิษย์ชื่อนี้\" — คุณถูกขับออกจากสำนัก", { feel: { love: -30 }, flag: "expelled" }))(l, c)),
    C("รับป้ายคืน แล้วจากไปอย่างสงบ", B("คุณคำนับเก้าครั้งเป็นครั้งสุดท้าย แล้วเดินลงเขา", { flag: "expelled", feel: { respect: 10 } })),
  ], { ...masterP, when: (l) => masterP.when(l) && Number(l.flags.m17Align ?? 0) <= -40, weight: 6, title: "ถูกขับไล่" }),
  E("md.master_dies", [16, 90], (l, c) => `${nm(l, c)} อาจารย์ของคุณสิ้นลมในห้องปิดด่าน ข้างกายมีจดหมายถึงคุณฉบับเดียว`, [
    C("อ่านจดหมาย", (l, c) => { const p = who(l, c)!; p.alive = false; const best = artsOf(l).sort((a, b) => b.m - a.m)[0]; if (best) best.m = Math.min(100, best.m + 10); return BIG(`"วิชาไม่ได้อยู่ในคัมภีร์ แต่อยู่ในใจคนที่ฝึก — จงฝึกต่อไป" น้ำตาคุณหยดลงบนตัวอักษร${best ? ` (ความเข้าใจใน「${artInfo(best).name}」ลึกซึ้งขึ้น)` : ""}`, { joy: -12, flag: "mourningMaster" })(l, c); }),
  ], { ...withPerson(["ally"], (p) => !!p.tags?.includes("master") && p.age >= 65), weight: 6, title: "อาจารย์จากไป" }),
  E("md.teach", [30, 90], (l, c) => `${nm(l, c)} ศิษย์ของคุณฝึกมาหลายปีแล้ว ถึงเวลาตัดสินใจว่าจะถ่ายทอดวิชาไหนให้`, [
    ...[0, 1, 2].map((i) => C(
      (l: Life) => { const k = artsOf(l)[i]; return k ? `ถ่ายทอด「${artInfo(k).name}」` : "—"; },
      (l, c) => { const p = who(l, c)!; const k = artsOf(l)[i]; p.tags = [...(p.tags ?? []), `art:${k.id}`]; remember(l, p, "taught", `ได้เรียน「${artInfo(k).name}」จากอาจารย์`, 3, { loyalty: 15, respect: 10, debt: 25 }); return G(`${nm(l, c)}คุกเข่ารับคัมภีร์ด้วยมือสั่น — วิชานี้จะมีชีวิตต่อไปหลังคุณ`)(l, c); },
      { show: (l: Life) => artsOf(l).length > i, pros: "วิชาจะไม่สูญหาย ศิษย์ภักดีขึ้น", cons: "ถ้าศิษย์ทรยศ ศัตรูจะรู้วิชาของคุณ" },
    )),
    C("ยังไม่ถ่ายทอดตอนนี้", N("ศิษย์ก้มหน้ารับ — แต่คุณเห็นความผิดหวังในแววตา", { feel: { love: -4 } })),
  ], { ...withPerson(["ally"], (p) => !!p.tags?.includes("disciple") && p.age >= 15), when: (l) => artsOf(l).length > 0 && withPerson(["ally"], (p) => !!p.tags?.includes("disciple") && p.age >= 15).when(l), weight: 6, maxTimes: 3, title: "ถ่ายทอดวิชา" }),
  E("md.disciple_betray", [35, 90], (l, c) => `${nm(l, c)} ศิษย์ที่คุณเลี้ยงมากับมือ หายไปพร้อมคัมภีร์ของสำนัก — ข่าวว่าไปเข้ากับสำนักคู่แข่งที่สัญญาตำแหน่งเจ้าสำนักให้`, [
    C("ตามไปทวงคืน", (l, c) => { l.flags.discipleTraitor = who(l, c)?.id ?? ""; return N("คุณออกตามรอยศิษย์ทรยศ — การเผชิญหน้าครั้งนี้จะไม่มีใครเดินจากไปเหมือนเดิม", { goal: ["revenge", "ทวงคืนคัมภีร์จากศิษย์ทรยศ"] })(l, c); }),
    C("ปล่อยไป", B("คุณนั่งมองที่ว่างบนชั้นคัมภีร์ทั้งคืน — บางทีความผิดอาจอยู่ที่อาจารย์ที่สอนแต่วิชา ไม่ได้สอนใจ", { joy: -10 })),
  ], { ...discipleP, when: (l) => discipleP.when(l) && l.people.some((p) => p.alive && p.tags?.includes("disciple") && (hasTrait(p, "ambitious") || hasTrait(p, "greedy")) && relOf(p).loyalty < 40), weight: 3, title: "ศิษย์ทรยศ" }),
];

// ───────── กตัญญู ─────────

const FILIAL: GameEvent[] = [
  E("hh.support_parents", [22, 60], (l, c) => `${nm(l, c)}อายุมากขึ้นทุกปี ทำงานไม่ไหวแล้ว — ญาติๆ จับตาดูว่าคุณจะเลี้ยงดูอย่างไร`, [
    PAY("ส่งเงินเลี้ยงดูทุกปีอย่างดี", 20, G("ญาติทั้งตระกูลชมว่าคุณเป็นลูกกตัญญู — ท่านยิ้มทุกครั้งที่มีคนพูดถึงคุณ", { fame: 2, feel: { love: 8 } }), { pros: "ชื่อเสียงเรื่องความกตัญญู", cons: "ใช้เงินมาก" }),
    C("รับมาอยู่ด้วยกัน", G("บ้านแออัดขึ้น เสียงบ่นมากขึ้น แต่ทุกเย็นมีคนรอกินข้าวด้วยกัน", { feel: { love: 10 }, joy: 2, tael: -5 })),
    C("ให้พี่น้องคนอื่นดูแล", N("พี่น้องคนอื่นรับไปดูแล — และจะพูดถึงเรื่องนี้ในงานรวมญาติไปอีกหลายปี", { fame: -2, feel: { love: -6 } })),
  ], { ...withPerson(["father", "mother"], (p) => p.age >= 60), weight: 5, maxTimes: 2, title: "เลี้ยงดูพ่อแม่" }),
];

yearHooks.push(tickHousehold);

export const HOUSEHOLD_EVENTS: GameEvent[] = [...MAN_MORE, ...WOMAN_SIDE, ...HOUSE_DRAMA, ...CHILDREN, ...MASTER_DISCIPLE, ...FILIAL];
