// ทางสู่บัลลังก์และการปกครอง: แต่งงานกับกษัตริย์ รัฐประหาร เลือกตั้ง ก่อตั้งแผ่นดิน · ราชวงศ์สืบต่อไปถึงทายาท · ก่อตั้งภาคีของตัวเอง
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { chance } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, clamp, createPerson, displayName, log } from "../../engine/util";
import { recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, GOLD, K, N, P, SCENE, type Res } from "./kit";
import { fightOdds } from "./power";
import { declareWar, MAX_KINGDOMS, newKingdom, weakestFoe } from "./empire";
import { addStanding, dataOf, deed, fl, homeKingdom, LAWS, standingOf, worldOfLife, type Kingdom, type LawId } from "./state";
import { newRuler } from "./world";

export const ELECTION_EVERY = 8;
const FOUND_GOLD = 500;
const ORDER_GOLD = 300;
const W = (l: Life) => worldOfLife(l);
export const throneOf = (l: Life): Kingdom | undefined => dataOf(l).kingdoms.find((k) => k.id === fl(l).throne);
const ruling = (l: Life) => !!throneOf(l);
const here = (l: Life) => homeKingdom(l);
const overlordOf = (l: Life) => { const k = throneOf(l); return k?.overlord ? dataOf(l).kingdoms.find((x) => x.id === k.overlord) : undefined; };

/** ขึ้นครองแผ่นดิน · ใช้ร่วมกันทุกเส้นทาง */
export function crown(l: Life, k: Kingdom, how: string) {
  const old = k.ruler;
  k.ruler = displayName(l); k.rulerAge = l.age; k.playerRuled = true; k.dynasty = l.lastName; k.consortHeir = undefined;
  const f = fl(l);
  f.throne = k.id; f.kingdom = k.id; f.consort = undefined;
  deed(l, `ครองบัลลังก์${k.name}`);
  recordChronicle(W(l), `${displayName(l)}${how}${old && old !== k.ruler ? ` แทน${old}` : ""} และขึ้นครอง${k.name}`);
}
/** สละหรือเสียบัลลังก์ · แผ่นดินได้ผู้ครองคนใหม่ทันที */
export function uncrown(l: Life, why: string) {
  const k = throneOf(l);
  if (!k) return;
  k.playerRuled = false; k.ruler = newRuler(dataOf(l), l); k.rulerAge = 30 + Math.floor(l.age / 10);
  fl(l).throne = undefined;
  recordChronicle(W(l), `${displayName(l)}${why} ${k.ruler}ขึ้นครอง${k.name}แทน`);
}

const take = (how: string): Res => BIG((l) => `มงกุฎของ${here(l).name}ถูกวางบนศีรษะคุณ`, { fame: 30, joy: 15 }, (l) => crown(l, here(l), how));
const coupReady = (l: Life) => standingOf(l) >= 40 && (fl(l).fRank >= 2 || fl(l).bodyRank >= 3 || fl(l).magicRank >= 3) && here(l).stability < 45 && !here(l).playerRuled && !here(l).overlord;
const FOUND_FAME = 50;
const foundReady = (l: Life) => l.fame >= FOUND_FAME && l.money >= FOUND_GOLD * GOLD && (!!fl(l).mount || !!fl(l).relic || fl(l).fRank === 3) && dataOf(l).kingdoms.length < MAX_KINGDOMS;
const electionDue = (l: Life) => !!here(l).elective && W(l).year >= (here(l).nextElection ?? 0);

const ACTS: Activity[] = [
  { id: "ft_rule", emoji: "", name: "ออกว่าราชการ", desc: "ภาษี สิ่งก่อสร้าง กองทัพ สงคราม และกฎหมาย", minAge: 14, world: "fantasy", group: "บัลลังก์", available: ruling, run: (l) => { runEvent(l, "ft.k.court"); return { text: "" }; } },
  { id: "ft_decree", emoji: "", name: "ออกพระราชโองการ", desc: "เปลี่ยนกฎหมายได้ทันที แต่บ้านเมืองสั่นคลอน", minAge: 14, time: 0, world: "fantasy", group: "บัลลังก์", available: ruling, run: (l) => { runEvent(l, "ft.k.decree"); return { text: "" }; } },
  { id: "ft_coup", emoji: "", name: "ก่อรัฐประหาร", desc: "ต้องมีคนนับถือ มีกำลัง และบ้านเมืองต้องปั่นป่วน", minAge: 20, time: 2, world: "fantasy", group: "บัลลังก์", available: (l) => !ruling(l) && coupReady(l), run: (l) => { runEvent(l, "ft.k.coup"); return { text: "" }; } },
  { id: "ft_election", emoji: "", name: "ลงเลือกตั้งเป็นผู้นำสภา", desc: `เฉพาะแผ่นดินที่เลือกผู้นำ · ทุก ${ELECTION_EVERY} ปี`, minAge: 25, time: 2, world: "fantasy", group: "บัลลังก์", available: (l) => !ruling(l) && electionDue(l) && standingOf(l) >= 30, run: (l) => { runEvent(l, "ft.k.election"); return { text: "" }; } },
  { id: "ft_found", emoji: "", name: "ก่อตั้งแผ่นดินใหม่", desc: `ต้องมีชื่อเสียง ${FOUND_GOLD} เหรียญทอง และมังกร อาวุธตำนาน หรือภาคีของตัวเอง`, minAge: 25, time: 2, world: "fantasy", group: "บัลลังก์", available: (l) => !ruling(l) && foundReady(l), run: (l) => { runEvent(l, "ft.k.found"); return { text: "" }; } },
  { id: "ft_order", emoji: "", name: "ก่อตั้งภาคีของตัวเอง", desc: `ต้องมีชื่อเสียงและ ${ORDER_GOLD} เหรียญทอง · ภาคีอยู่ต่อหลังคุณตาย`, minAge: 25, time: 2, world: "fantasy", group: "ฝ่ายอำนาจ", available: (l) => l.fame >= 40 && l.money >= ORDER_GOLD * GOLD && !(fl(l).faction && fl(l).fRank === 3) && dataOf(l).factions.length < 9, run: (l) => { runEvent(l, "ft.k.order"); return { text: "" }; } },
];

const decree = (id: LawId): Choice => C((l) => `${throneOf(l)?.laws?.includes(id) ? "ยกเลิก" : "ประกาศใช้"}${LAWS[id].name}`, G("ประกาศถูกติดไว้ทุกประตูเมือง", {}, (l) => { const k = throneOf(l)!; const on = !k.laws?.includes(id); k.laws = on ? [...(k.laws ?? []), id] : (k.laws ?? []).filter((x) => x !== id); k.stability = clamp(k.stability - 3, 5, 95); recordChronicle(W(l), `${displayName(l)}${on ? "ประกาศใช้" : "ยกเลิก"}${LAWS[id].name}ใน${k.name}`); }));
const shift = (stab: number, power: number, prosp: number): ((l: Life) => void) => (l) => { const k = throneOf(l)!; k.stability = clamp(k.stability + stab, 5, 95); k.power = clamp(k.power + power, 15, 95); k.prosperity = clamp((k.prosperity ?? 100) + prosp, 40, 140); };

export const ORDER_KIND = { silver: "อัศวินผู้พิทักษ์", conclave: "ผู้เก็บความรู้เวทมนตร์", league: "พ่อค้าผู้มั่งคั่ง", night: "ผู้รู้ความลับ", dawn: "ผู้รักษาและเยียวยา" } as const;

export const REALM_EVENTS: GameEvent[] = [
  SCENE("ft.k.court", "ท้องพระโรง", (l) => { const k = throneOf(l)!, o = overlordOf(l); return `${k.name} · มั่นคง ${k.stability} · กำลังทัพ ${k.power} · เศรษฐกิจ ${k.prosperity ?? 100}${k.war ? " · กำลังมีสงคราม" : ""}${o ? ` · เป็นเมืองขึ้นของ${o.name}` : ""}`; }, [
    C("ขึ้นภาษีเข้าท้องพระคลัง", G("เหรียญไหลเข้าคลัง เสียงบ่นไหลออกทุกตลาด", { gold: 60 }, (l) => { shift(-7, 0, -2)(l); addStanding(l, -4); })),
    C("จัดงานเฉลิมฉลองทั่วแผ่นดิน (40 เหรียญทอง)", G("ประชาชนเต้นรำจนรุ่งเช้า และตะโกนชื่อคุณ", { gold: -40, joy: 4 }, (l) => { shift(9, 0, 0)(l); addStanding(l, 6); }), { req: (l) => (l.money < 40 * GOLD ? "ต้องมี 40 เหรียญทอง" : undefined) }),
    C("สร้างถนนและท่าเรือ (80 เหรียญทอง)", G("กองคาราวานวิ่งเร็วขึ้นครึ่งหนึ่ง", { gold: -80 }, shift(1, 0, 9)), { req: (l) => (l.money < 80 * GOLD ? "ต้องมี 80 เหรียญทอง" : undefined) }),
    C("เกณฑ์และฝึกกองทัพ (60 เหรียญทอง)", G("เสียงกลองซ้อมรบดังทุกเช้า", { gold: -60 }, shift(-2, 9, 0)), { req: (l) => (l.money < 60 * GOLD ? "ต้องมี 60 เหรียญทอง" : undefined) }),
    C((l) => `ประกาศสงครามกับ${weakestFoe(dataOf(l), throneOf(l)!)?.name}`, B("กองทัพเดินทัพออกจากเมืองหลวง", {}, (l) => { const k = throneOf(l)!, foe = weakestFoe(dataOf(l), k)!; declareWar(W(l), dataOf(l), k, foe, l); }), { show: (l) => !throneOf(l)!.war && !throneOf(l)!.overlord && !!weakestFoe(dataOf(l), throneOf(l)!) }),
    K("ส่งทูตเจรจาสันติภาพ", "looks", 50, G("สนธิสัญญาถูกลงนามบนโต๊ะไม้โอ๊ก", { fame: 2 }, (l) => { const k = throneOf(l)!, foe = dataOf(l).kingdoms.find((x) => x.id === k.war); if (foe?.war === k.id) foe.war = undefined; k.war = undefined; }), N("ทูตของคุณถูกส่งกลับมาพร้อมคำดูถูก"), { show: (l) => !!throneOf(l)!.war }),
    P("ประกาศอิสรภาพจากเจ้าอาณานิคม", (l) => throneOf(l)!.power / (throneOf(l)!.power + (overlordOf(l)?.power ?? 1)), BIG("ธงของเจ้าอาณานิคมถูกเผากลางจัตุรัส แผ่นดินเป็นของประชาชนอีกครั้ง", { fame: 15 }, (l) => { const k = throneOf(l)!; recordChronicle(W(l), `${k.name}ประกาศอิสรภาพจาก${overlordOf(l)!.name}`); k.overlord = undefined; }), B("กองทัพเจ้าอาณานิคมบุกถึงประตูเมือง", { hp: -12 }, shift(-15, -8, 0)), { show: (l) => !!overlordOf(l) }),
  ]),
  SCENE("ft.k.decree", "พระราชโองการ", "ปากกาขนนกรออยู่บนโต๊ะ ทุกคำที่คุณเขียนคือกฎหมาย", [...(Object.keys(LAWS) as LawId[]).map(decree), C("ยังไม่แก้อะไร", N("คุณวางปากกาลง"))]),
  E("ft.k.revolt", [14, 400], (l) => `ฝูงชนถือคบเพลิงล้อมพระราชวัง${throneOf(l)!.name} พวกเขาต้องการหัวของคุณ`, [
    P("นำทหารองครักษ์ปราบ", (l) => fightOdds(l, 50), G("ความสงบกลับมา แต่ราคานั้นจะถูกจดจำ", { fame: -3 }, shift(15, -4, 0)), (l, c) => (chance(l, 0.5) ? B("ประตูวังพังลง", { die: "ถูกปลงพระชนม์ในการปฏิวัติ" })(l, c) : B("คุณหนีออกทางอุโมงค์ลับ เหลือแต่ชีวิต", { hp: -15 }, (x) => uncrown(x, "ถูกโค่นในการปฏิวัติ"))(l, c))),
    C("สละราชสมบัติ", N("คุณถอดมงกุฎวางบนบันไดวัง แล้วเดินออกไปเป็นสามัญชน", { joy: -10 }, (l) => uncrown(l, "สละราชสมบัติ"))),
    K("ออกไปพูดกับฝูงชนด้วยตัวเอง", "looks", 65, BIG("ฝูงชนวางคบเพลิงลงทีละคน และร้องเพลงสรรเสริญคุณแทน", { fame: 10 }, shift(25, 0, 0)), B("ก้อนหินลอยมากระทบขมับ", { hp: -20 }, shift(-5, 0, 0))),
  ], { when: (l) => ruling(l) && throneOf(l)!.stability < 15, weight: 40, maxTimes: 0, title: "ปฏิวัติ" }),
  E("ft.k.reelect", [20, 400], (l) => `ครบวาระแล้ว สภาของ${throneOf(l)!.name}เปิดให้ลงคะแนนอีกครั้ง`, [
    P("หาเสียงด้วยผลงาน", (l) => clamp(0.35 + standingOf(l) / 150 + ((throneOf(l)!.prosperity ?? 100) - 100) / 100, 0.1, 0.92), G("สภาเลือกคุณต่ออีกสมัย", { fame: 3 }, elected), N("สภาเลือกคนอื่น คุณกลับไปเป็นพ่อค้าธรรมดา", { joy: -6 }, (l) => uncrown(l, "แพ้การเลือกตั้ง"))),
    C("ลงจากตำแหน่งอย่างสง่างาม", N("สภาลุกขึ้นปรบมือส่งคุณ", { fame: 4 }, (l) => uncrown(l, "ลงจากตำแหน่งเมื่อครบวาระ"))),
  ], { when: (l) => ruling(l) && !!throneOf(l)!.elective && W(l).year >= (throneOf(l)!.nextElection ?? 0), forced: true, maxTimes: 0, title: "ครบวาระ" }),
  E("ft.k.assassin", [14, 400], "พ่อครัวในวังมือสั่นขณะยกถ้วยไวน์มาให้คุณ", [
    K("สั่งให้เขาดื่มก่อน", "smarts", 45, G("เขาหน้าซีด แล้วสารภาพชื่อคนที่จ้างมา", { iq: 1 }, shift(4, 0, 0)), B("คุณดื่มไปแล้วครึ่งถ้วยก่อนจะรู้ตัว", { hp: -25 })),
    C("ดื่มตามปกติ", (l, c) => (chance(l, 0.35) ? B("ไวน์ถ้วยนั้นขมผิดปกติ", { die: "ถูกวางยาในวัง" })(l, c) : N("ไวน์ธรรมดา พ่อครัวแค่ตื่นเต้นที่ได้รับใช้")(l, c))),
  ], { when: ruling, weight: 5, maxTimes: 0, title: "ถ้วยไวน์" }),
  E("ft.k.battle", [16, 400], (l) => `กองทัพของ${throneOf(l)!.name}ตั้งค่ายเผชิญหน้าศัตรู แม่ทัพทูลถามว่าคุณจะนำทัพเองหรือไม่`, [
    P("นำทัพด้วยตัวเอง", (l) => fightOdds(l, 45), G("ทหารเห็นธงของคุณอยู่แนวหน้า และบุกไปไม่ยอมถอย", { fame: 8, body: 6 }, shift(6, 10, 0)), (l, c) => (chance(l, 0.25) ? B("ลูกธนูดอกหนึ่งหาทางผ่านเกราะจนได้", { die: "สิ้นพระชนม์ในสนามรบ" })(l, c) : B("ทัพแตก คุณถูกหามกลับวัง", { hp: -20 }, shift(-8, -6, 0))(l, c))),
    C("ให้แม่ทัพรับผิดชอบ", N("คุณรอข่าวจากวังด้วยใจที่ไม่สงบ")),
  ], { when: (l) => ruling(l) && !!throneOf(l)!.war, weight: 14, maxTimes: 0, title: "ศึกชายแดน" }),

  E("ft.k.proposal", [18, 50], (l) => { const k = suitor(l)!; return `${k.ruler}ผู้ครอง${k.name}ได้ยินชื่อเสียงของคุณ และส่งทูตมาพร้อมแหวนวงหนึ่ง`; }, [
    C("รับคำขอแต่งงาน", BIG((l) => `ระฆังดังทั่ว${suitor(l)!.name} คุณกลายเป็นคู่ครองของผู้ครองแผ่นดิน`, { joy: 15, fame: 15 }, (l) => {
      const k = suitor(l)!, f = fl(l);
      const p = createPerson(l, "spouse", { gender: l.gender === "m" ? "f" : "m", age: Math.max(18, k.rulerAge), bond: 60 });
      p.name = k.ruler; p.short = k.ruler; p.job = `ผู้ครอง${k.name}`; p.tags = [...(p.tags ?? []), "royal"];
      f.consort = k.id; f.kingdom = k.id; k.consortHeir = displayName(l);
      recordChronicle(W(l), `${k.ruler}อภิเษกกับ${displayName(l)}`);
    })),
    C("ปฏิเสธอย่างนุ่มนวล", N("ทูตกลับไปพร้อมแหวน และข่าวลือว่าคุณหยิ่ง", { fame: 2 })),
  ], { when: (l) => !!suitor(l), weight: 6, maxTimes: 1, title: "ทูตจากวัง" }),

  SCENE("ft.k.coup", "รัฐประหาร", (l) => `${here(l).ruler}อ่อนแอ บ้านเมืองปั่นป่วน และคนจำนวนมากพร้อมเดินตามคุณ`, [
    P("บุกพระราชวังตอนรุ่งสาง", (l) => fightOdds(l, 60), take("ยึดอำนาจด้วยกำลัง"), (l, c) => (chance(l, 0.4) ? B("ทหารองครักษ์รู้แผนล่วงหน้า", { die: "ถูกประหารฐานกบฏ" })(l, c) : B("รัฐประหารล้มเหลว คุณถูกขังในหอคอย", { hp: -15 }, (x) => { x.flags.jailUntil = x.age + 5; addStanding(x, -60); })(l, c)), { tone: "danger" }),
    K("ปลุกระดมประชาชนให้ลุกฮือ", "looks", 65, take("ได้รับการสนับสนุนจากประชาชน"), B("ฝูงชนแตกกระเจิงเมื่อทหารม้ามาถึง", { hp: -10 }, (l) => addStanding(l, -20)), { show: (l) => standingOf(l) >= 60 }),
    C("ล้มเลิกแผน", N("คุณเผาจดหมายลับทุกฉบับ")),
  ]),
  SCENE("ft.k.election", "การเลือกตั้ง", (l) => `สภาของ${here(l).name}กำลังเลือกผู้นำคนใหม่`, [
    { label: "ซื้อเสียงสมาชิกสภา (300 เหรียญทอง)", odds: (l) => clamp(0.45 + standingOf(l) / 200, 0.1, 0.9), req: (l) => (l.money < 300 * GOLD ? "ต้องมี 300 เหรียญทอง" : undefined), run: (l, c, ok) => { addMoney(l, -300 * GOLD); elected(l); return ok ? take("ชนะการเลือกตั้ง")(l, c) : N("คู่แข่งจ่ายมากกว่าคุณ")(l, c); } },
    K("ปราศรัยกลางจัตุรัส", "looks", 60, (l, c) => { elected(l); return take("ชนะการเลือกตั้ง")(l, c); }, (l, c) => { elected(l); return N("เสียงปรบมือดัง แต่คะแนนไม่พอ")(l, c); }),
    P("ขอแรงหนุนจากสมาคมทองคำ", () => 0.85, (l, c) => { elected(l); return take("ชนะการเลือกตั้งด้วยแรงหนุนของสมาคมทองคำ")(l, c); }, (l, c) => { elected(l); return N("สมาคมเปลี่ยนใจในนาทีสุดท้าย")(l, c); }, { show: (l) => fl(l).faction === "league" && fl(l).fRank >= 2 }),
  ]),
  SCENE("ft.k.found", "ดินแดนรกร้าง", "ทุ่งกว้างไร้เจ้าของทอดยาวสุดสายตา ผู้คนที่ศรัทธาคุณรอฟังคำสั่ง", [
    C("ปักธงก่อตั้งแผ่นดินใหม่", BIG((l) => `เมืองหลวงแห่งแรกของราชรัฐ${l.lastName}ถูกวางศิลาฤกษ์`, { fame: 25, joy: 15, gold: -FOUND_GOLD }, (l) => { const d = dataOf(l); const k = newKingdom(`p${W(l).year}`, `ราชรัฐ${l.lastName}`, displayName(l), l.age, W(l).year); d.kingdoms.push(k); crown(l, k, "ก่อตั้งแผ่นดินใหม่"); })),
    C("ยังไม่พร้อม", N("คุณมองทุ่งนั้นนานจนพระอาทิตย์ตก")),
  ]),
  SCENE("ft.k.order", "ก่อตั้งภาคี", "คุณจะให้ภาคีของคุณยืนหยัดเพื่ออะไร", [
    ...(["silver", "conclave", "league", "night", "dawn"] as const).map((kind) => C(`ภาคีแบบ${ORDER_KIND[kind]}`, BIG((l) => `ภาคี${l.lastName}เปิดประตูรับสมาชิกคนแรก`, { fame: 10, gold: -ORDER_GOLD }, (l) => {
      const d = dataOf(l), f = fl(l), id = `o${W(l).year}${l.lastName}`;
      if (f.faction) { const x = d.factions.find((y) => y.id === f.faction); if (x?.playerLed) { x.playerLed = false; x.leader = ""; } }
      d.factions.push({ id, kind, name: `ภาคี${l.lastName}`, creed: ORDER_KIND[kind], power: 25, leader: displayName(l), playerLed: true });
      f.faction = id; f.fRank = 3; f.fMerit = 0;
      deed(l, `ผู้ก่อตั้งภาคี${l.lastName}`);
      recordChronicle(W(l), `${displayName(l)}ก่อตั้งภาคี${l.lastName}`);
    }))),
    C("ยังไม่ถึงเวลา", N("คุณเก็บร่างกฎของภาคีไว้ในลิ้นชัก")),
  ]),
];

function elected(l: Life) { here(l).nextElection = W(l).year + ELECTION_EVERY; }
/** ผู้ครองที่อาจขอแต่งงาน: ยังโสด อายุไม่ห่างเกินไป และคุณมีชื่อเสียงพอ */
const suitor = (l: Life) => (l.fame >= 30 || standingOf(l) >= 40) && !ruling(l) && !fl(l).consort && !l.people.some((p) => p.alive && (p.relation === "spouse" || p.relation === "partner"))
  ? dataOf(l).kingdoms.find((k) => !k.playerRuled && !k.elective && !k.consortHeir && Math.abs(k.rulerAge - l.age) <= 15)
  : undefined;

/** ทุกปีของผู้ปกครอง: รายได้ คู่ครองขึ้นครองเมื่อกษัตริย์สวรรคต และเสียบัลลังก์ถ้าแผ่นดินถูกยุบ */
export function realmYear(l: Life) {
  const f = fl(l), d = dataOf(l);
  if (f.consort) {
    const k = d.kingdoms.find((x) => x.id === f.consort);
    if (!k || k.consortHeir !== displayName(l) && !k.playerRuled) f.consort = undefined;
    else if (k.playerRuled) {
      for (const p of l.people) if (p.alive && p.tags?.includes("royal")) { p.alive = false; log(l, `${p.name}สวรรคต คุณสืบราชบัลลังก์ต่อ`, "milestone"); }
      f.throne = k.id; f.consort = undefined; k.ruler = displayName(l); k.dynasty = l.lastName;
      deed(l, `ครองบัลลังก์${k.name}`);
    }
  }
  const k = throneOf(l);
  if (!k) return;
  k.rulerAge = l.age;
  addMoney(l, Math.round(40 + (k.prosperity ?? 100) / 2 + k.power / 4) * GOLD);
}

/** ราชวงศ์: ตอนตาย แผ่นดินได้ผู้ครองจากสกุลเดิม ทายาทที่เล่นต่อจะได้บัลลังก์คืน */
export function passThrone(l: Life) {
  for (const x of dataOf(l).kingdoms) if (x.consortHeir === displayName(l)) x.consortHeir = undefined;
  const k = throneOf(l);
  if (!k) return;
  k.playerRuled = false;
  k.ruler = `${newRuler(dataOf(l), l)} ${l.lastName}`;
  k.rulerAge = 30;
  recordChronicle(W(l), `${k.ruler}แห่งราชวงศ์${l.lastName}สืบบัลลังก์${k.name}`);
}
export function inheritThrone(dead: Life, next: Life) {
  const id = fl(dead).throne;
  const k = id ? dataOf(next).kingdoms.find((x) => x.id === id) : undefined;
  if (!k) return;
  fl(next).throne = k.id; fl(next).kingdom = k.id;
  k.playerRuled = true; k.ruler = displayName(next); k.rulerAge = next.age; k.dynasty = next.lastName;
}

export const loadRealm = () => { ACTIVITIES.push(...ACTS); };
