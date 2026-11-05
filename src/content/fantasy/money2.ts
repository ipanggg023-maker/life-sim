// เงิน 2 (Release 12): ลงทุนในกิจการและคน ภาษีตามแผ่นดิน ติดพนัน ที่ดินที่มีคนอยู่ ความจน ปล่อยกู้ ขโมยขึ้นบ้าน
// ทำบุญ ใช้ชีวิตแบบไหน เศรษฐกิจรุ่งและร่วง และเส้นทางค้าขายที่ไปต่อได้ตราบที่ยังได้กำไร
import { ACTIVITIES, activityFilters, type Activity } from "../../engine/activities";
import { getEvent, type Ctx, type GameEvent } from "../../engine/events";
import { choiceHooks, runEvent, salaryHooks, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, shortName } from "../../engine/util";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY, SCENE } from "./kit";
import { addStanding, deed, fl, homeKingdom, kingdomsOf, type Kingdom } from "./state";
import { lean } from "./persona";
import { staffOf } from "./people3";
import { nextUp } from "./danger";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const yearly = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const gold = (l: Life) => Math.floor(l.money / GOLD);
const jailed = (l: Life) => Number(l.flags.jailUntil ?? -1) > l.age;
const after = (e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent => ({ ...e, choices: e.choices?.map((ch) => ({ ...ch, run: (l, c, ok) => { fn(l, c); return ch.run(l, c, ok); } })) });

// ───────────── เศรษฐกิจรุ่งและร่วง ─────────────
export const BOOMS: Record<NonNullable<Kingdom["boom"]>["kind"], { name: string; news: string }> = {
  harvest: { name: "ปีข้าวล้นยุ้ง", news: "ข้าวออกรวงเต็มทุกทุ่ง ราคาธัญพืชตกฮวบ" },
  goldrush: { name: "ตื่นทอง", news: "มีคนเจอสายแร่ทองในภูเขา ค่าแรงขึ้นทั้งแผ่นดิน ของก็แพงตาม" },
  embargo: { name: "ปิดด่านการค้า", news: "แผ่นดินเพื่อนบ้านปิดด่าน กองคาราวานติดอยู่ที่ชายแดน ของนำเข้าแพงขึ้น" },
  bust: { name: "เศรษฐกิจตกต่ำ", news: "ห้างใหญ่สามแห่งล้มพร้อมกัน คนตกงานเต็มเมือง" },
};
export const BOOM_CHANCE = 0.05;
export const boomOf = (l: Life) => { const b = homeKingdom(l).boom; return b && b.left > 0 ? b.kind : undefined; };
/** ราคาสินค้าตามช่วงเศรษฐกิจ (society.ts priceOf) */
export const boomPrice = (k: Kingdom, good: string) => {
  const b = k.boom && k.boom.left > 0 ? k.boom.kind : undefined;
  return b === "harvest" && good === "grain" ? -0.3 : b === "goldrush" ? 0.15 : b === "embargo" ? 0.25 : b === "bust" ? -0.15 : 0;
};
/** ค่าครองชีพตามช่วงเศรษฐกิจและวิธีใช้ชีวิต (economy.ts ftLiving) */
export const LIFESTYLE: Record<"frugal" | "comfortable" | "lavish", { name: string; cost: number; desc: string }> = {
  frugal: { name: "ประหยัด", cost: 0.7, desc: "เก็บเงินได้ แต่ความสุขและหน้าตาในสังคมลดลง" },
  comfortable: { name: "พอดี", cost: 1, desc: "ใช้ชีวิตตามปกติ" },
  lavish: { name: "หรูหรา", cost: 1.6, desc: "จ่ายแพง สุขมากขึ้น คนนับหน้าถือตา และมีคนประจบเข้ามา" },
};
export const livingMul = (l: Life) => LIFESTYLE[fl(l).lifestyle ?? "comfortable"].cost * (boomOf(l) === "goldrush" ? 1.15 : boomOf(l) === "bust" ? 0.9 : 1);

// ───────────── ลงทุน ─────────────
export const VENTURES: Record<string, { name: string; years: [number, number]; win: number; lose: number; mul: number; story: string }> = {
  voyage: { name: "เรือสินค้าไปทะเลใต้", years: [2, 3], win: 0.4, lose: 0.3, mul: 2.2, story: "เรือกลับมาพร้อมกัปตันที่เล่าว่าเจอเกาะที่ไม่มีบนแผนที่" },
  expedition: { name: "คณะสำรวจหาซากเมืองเก่า", years: [3, 4], win: 0.3, lose: 0.4, mul: 3, story: "คณะสำรวจกลับมาพร้อมแผนที่ครึ่งแผ่นที่ชี้ไปยังห้องสมบัติ" },
  mine: { name: "เหมืองแร่เงินที่เพิ่งเปิด", years: [2, 4], win: 0.45, lose: 0.25, mul: 1.8, story: "คนงานเหมืองเจอถ้ำที่มีผลึกร้องเพลงอยู่ลึกลงไป" },
};
export const FRIEND_SHOP = { years: [2, 3] as [number, number], win: 0.45, lose: 0.3, mul: 1.6 };
const shopFriend = (l: Life) => l.people.find((p) => p.alive && (p.relation === "friend" || p.relation === "sibling") && p.bond >= 50 && p.age >= 18 && !fl(l).invests?.some((x) => x.pid === p.id));
const INVEST = SCENE("ft.m2.invest", "ลงทุน", (l) => `คุณมีเงิน ${gold(l)} เหรียญทอง จะลงทุนกับอะไร (ได้ผลในอีกไม่กี่ปี บางอย่างอาจหายไปทั้งก้อน)`, [
  ...Object.entries(VENTURES).flatMap(([k, v]) => [20, 60].map((g) => PAY(`${v.name}`, g, N(`คุณลงชื่อในสัญญากับ${v.name} อีก ${v.years[0]}–${v.years[1]} ปีจะรู้ผล`, {}, (l) => { fl(l).invests = [...(fl(l).invests ?? []), { kind: k, gold: g, due: l.age + randInt(l, v.years[0], v.years[1]) }]; })))),
  PAY("ร้านของเพื่อนที่กำลังจะเปิด", 30, N((l) => `${shortName(shopFriend(l)!)}กอดคุณแน่น "ข้าจะไม่ทำให้เจ้าผิดหวัง"`, {}, (l) => { const p = shopFriend(l)!; fl(l).invests = [...(fl(l).invests ?? []), { kind: "friend", gold: 30, due: l.age + randInt(l, 2, 3), pid: p.id }]; p.bond = clamp(p.bond + 8, 0, 100); }), { show: (l) => !!shopFriend(l) }),
  C("ยังไม่ลงทุน", N("คุณเก็บเงินไว้ในหีบเหมือนเดิม")),
]);
function settleInvest(l: Life, x: NonNullable<ReturnType<typeof fl>["invests"]>[number]): string {
  const v = x.kind === "friend" ? FRIEND_SHOP : VENTURES[x.kind];
  const p = x.pid ? l.people.find((q) => q.id === x.pid) : undefined;
  const name = x.kind === "friend" ? `ร้านของ${p ? shortName(p) : "เพื่อน"}` : VENTURES[x.kind].name;
  const roll = chance(l, v.win) ? "win" : chance(l, v.lose / (1 - v.win)) ? "lose" : "even";
  if (roll === "win") { const g = Math.round(x.gold * v.mul); addMoney(l, g * GOLD); if (p) p.bond = clamp(p.bond + 10, 0, 100); return `${name}ได้กำไร คุณได้เงินคืน ${g} เหรียญทอง${x.kind !== "friend" && chance(l, 0.3) ? ` · ${VENTURES[x.kind].story}` : ""}`; }
  if (roll === "lose") { if (p) { p.bond = clamp(p.bond - 15, 0, 100); return `${name}ล้มละลาย เงิน ${x.gold} เหรียญทองหายไปหมด ${shortName(p)}ไม่กล้าสบตาคุณอีกนาน`; } return `${name}ล้มเหลว เงิน ${x.gold} เหรียญทองหายไปหมด`; }
  addMoney(l, x.gold * GOLD);
  return `${name}ไม่ได้กำไรแต่ก็ไม่ขาดทุน คุณได้เงินต้นคืน ${x.gold} เหรียญทอง`;
}

// ───────────── ปล่อยกู้ ─────────────
export const LOAN_RATE = 0.25;
const BORROWERS = ["ชาวนาที่ยุ้งฉางไฟไหม้", "พ่อค้าเร่ที่เกวียนพัง", "หญิงม่ายที่ต้องจ่ายค่าหมอให้ลูก", "ช่างไม้ที่อยากเปิดร้าน"];
const borrowFriend = (l: Life) => l.people.find((p) => p.alive && p.relation === "friend" && p.bond >= 40 && p.age >= 18 && !fl(l).loans?.some((x) => x.pid === p.id));
const LEND = SCENE("ft.m2.lend", "ปล่อยกู้", (l) => `มีคนมาขอยืมเงิน ดอกเบี้ย ${Math.round(LOAN_RATE * 100)}% · คืนในสามปี${borrowFriend(l) ? ` (${shortName(borrowFriend(l)!)}ก็มาขอด้วย)` : ""}`, [
  ...[20, 50].map((g) => PAY(`ให้${BORROWERS[g === 20 ? 0 : 3]}ยืม`, g, N("เขาก้มหัวจนหน้าผากแทบติดพื้น และสัญญาว่าจะคืนครบ", {}, (l) => { fl(l).loans = [...(fl(l).loans ?? []), { name: BORROWERS[g === 20 ? 0 : 3], gold: g, due: l.age + 3 }]; }))),
  PAY("ให้เพื่อนยืม", 30, N((l) => `${shortName(borrowFriend(l)!)}รับเงินไปพร้อมรอยยิ้มที่เกร็ง`, {}, (l) => { const p = borrowFriend(l)!; fl(l).loans = [...(fl(l).loans ?? []), { name: shortName(p), gold: 30, due: l.age + 3, pid: p.id }]; }), { show: (l) => !!borrowFriend(l) }),
  C("ไม่ให้ใครยืม", N("คุณปิดประตูแล้วนับเงินอีกรอบ")),
]);
const loanCtx = (l: Life, c: Ctx) => fl(l).loans?.find((x) => x.name === c.n && x.gold === Number(c.g));
const LOAN_DUE = SCENE("ft.m2.loan_due", "ถึงเวลาทวงหนี้", (l, c) => `${loanCtx(l, c)?.name}มาหาคุณมือเปล่า "ขอเวลาอีกสักปี ปีนี้ไม่มีจริงๆ" (ติดคุณอยู่ ${loanCtx(l, c)?.gold} เหรียญทอง)`, [
  C("ให้เวลาอีกปี", N("เขาร้องไห้ขอบคุณ และสาบานว่าปีหน้าจะคืนครบ", {}, (l, c) => { const x = loanCtx(l, c); if (x) x.due = l.age + 1; lean(l, { m: 3 }); })),
  C("ยกหนี้ให้", G("เขาจ้องคุณอยู่นาน แล้วบอกว่าจะไม่มีวันลืม", { joy: 3 }, (l, c) => { const x = loanCtx(l, c); fl(l).loans = fl(l).loans?.filter((y) => y !== x); addStanding(l, 3); lean(l, { m: 6 }); const p = x?.pid && l.people.find((q) => q.id === x.pid); if (p) p.bond = clamp(p.bond + 20, 0, 100); })),
  K("ยึดของมาใช้หนี้", "health", 45, (l, c) => { const x = loanCtx(l, c); if (!x) return { text: "หนี้ก้อนนั้นถูกชำระไปแล้ว" }; addMoney(l, Math.round(x.gold * 0.8) * GOLD); fl(l).loans = fl(l).loans?.filter((y) => y !== x); lean(l, { m: -6 }); addStanding(l, -3); const p = x.pid && l.people.find((q) => q.id === x.pid); if (p) { p.bond = clamp(p.bond - 30, 0, 100); p.relation = "rival"; } return { text: `คุณได้คืนมา ${Math.round(x.gold * 0.8)} เหรียญทอง และศัตรูอีกหนึ่งคน`, kind: "good" }; }, N("เขาซ่อนของมีค่าไว้หมดแล้ว คุณกลับบ้านมือเปล่า")),
]);

// ───────────── ที่ดินและผู้เช่า ─────────────
export const LANDS = { farm: { name: "ไร่", price: 60, rent: 4 }, village: { name: "หมู่บ้าน", price: 160, rent: 10 }, mine: { name: "เหมือง", price: 120, rent: 9 } } as const;
type LandKind = keyof typeof LANDS;
const land = (l: Life) => fl(l).land ?? { farm: 0, village: 0, mine: 0, mood: 60 };
export const landCount = (l: Life) => { const x = fl(l).land; return x ? x.farm + x.village + x.mine : 0; };
const LAND = SCENE("ft.m2.land", "ที่ดิน", (l) => { const x = land(l); return `ที่ดินของคุณ: ${LANDS.farm.name} ${x.farm} · ${LANDS.village.name} ${x.village} · ${LANDS.mine.name} ${x.mine}${landCount(l) ? ` · ใจของผู้เช่า ${x.mood}/100 · เก็บค่าเช่าแบบ${x.squeeze ? "รีดเต็มที่" : "เป็นธรรม"}` : ""}`; }, [
  ...(Object.keys(LANDS) as LandKind[]).map((k) => PAY(`ซื้อ${LANDS[k].name}`, LANDS[k].price, G(`โฉนด${LANDS[k].name}แผ่นใหม่มีชื่อคุณอยู่บรรทัดแรก ค่าเช่าปีละราว ${LANDS[k].rent} เหรียญทอง`, {}, (l) => { const x = { ...land(l) }; x[k]++; fl(l).land = x; }), { req: (l) => (k === "village" && land(l).farm < 2 ? "ต้องมีไร่อย่างน้อยสองแปลงก่อน" : l.money < LANDS[k].price * GOLD ? `ต้องมี ${LANDS[k].price} เหรียญทอง` : undefined) })),
  C((l) => (land(l).squeeze ? "เก็บค่าเช่าให้เป็นธรรม" : "ขึ้นค่าเช่ารีดเต็มที่"), (l) => { const x = { ...land(l), squeeze: !land(l).squeeze }; fl(l).land = x; lean(l, { m: x.squeeze ? -4 : 3 }); return { text: x.squeeze ? "ผู้เช่าก้มหน้ารับประกาศค่าเช่าใหม่ ไม่มีใครพูดอะไร" : "ผู้เช่าทั้งหมู่บ้านออกมายืนดูคุณขี่ม้าผ่าน บางคนยิ้มให้" }; }, { show: (l) => landCount(l) > 0 }),
  C("ไว้ก่อน", N("คุณม้วนแผนที่ที่ดินเก็บ")),
]);
const TENANT = after(E("ft.m2.tenant", [18, 900], "น้ำป่าพัดยุ้งฉางของผู้เช่าไปครึ่งหมู่บ้าน พวกเขามายืนรอหน้าบ้านคุณ", [
  PAY("ยกค่าเช่าปีนี้และช่วยซ่อมยุ้ง", 20, G("หัวหน้าหมู่บ้านคุกเข่าขอบคุณ และเด็กๆ ตั้งชื่อลูกวัวตามชื่อคุณ", {}, (l) => { fl(l).land = { ...land(l), mood: clamp(land(l).mood + 20, 0, 100) }; lean(l, { m: 4 }); addStanding(l, 2); })),
  C("ให้เลื่อนจ่ายไปปีหน้า", N("พวกเขาพยักหน้า บางคนรู้สึกว่าคุณใจดี บางคนรู้สึกว่าไม่พอ", {}, (l) => { fl(l).land = { ...land(l), mood: clamp(land(l).mood + 5, 0, 100) }; })),
  C("ค่าเช่าคือค่าเช่า", N("พวกเขากลับไปโดยไม่พูดอะไร คืนนั้นมีคนเขียนคำด่าไว้บนรั้วบ้านคุณ", {}, (l) => { fl(l).land = { ...land(l), mood: clamp(land(l).mood - 20, 0, 100) }; lean(l, { m: -4 }); })),
], { title: "ผู้เช่าเดือดร้อน", when: (l) => on(l) && landCount(l) > 0, weight: 10, maxTimes: 0 }), (l) => { l.flags.ftTenantAt = l.age; });
const REVOLT = after(E("ft.m2.revolt", [18, 900], "ผู้เช่าลุกฮือ เผาบ้านคนเก็บค่าเช่าของคุณ และประกาศว่าจะไม่จ่ายอีกแล้ว", [
  C("ยอมลดค่าเช่าและเจรจา", N("ไฟดับลง ค่าเช่าลดลง แต่ที่ดินยังเป็นของคุณ", {}, (l) => { fl(l).land = { ...land(l), mood: 45, squeeze: false }; })),
  C("ส่งคนไปปราบ", (l) => { lean(l, { m: -8 }); addStanding(l, -6); const x = { ...land(l), mood: 30 }; if (chance(l, 0.5) && x.village > 0) { x.village--; fl(l).land = x; return { text: "หมู่บ้านหนึ่งแตกกระจายหนีเข้าป่า ที่ดินตรงนั้นร้างไปทั้งแปลง", kind: "bad" }; } fl(l).land = x; return { text: "พวกเขากลับไปทำงาน ด้วยสายตาที่คุณจะจำได้", kind: "bad" }; }),
  C("ขายที่ดินทิ้ง", N("คุณขายทุกแปลงให้ขุนนางคนอื่นในราคาครึ่งเดียว", {}, (l) => { const x = land(l); addMoney(l, Math.round((x.farm * LANDS.farm.price + x.village * LANDS.village.price + x.mine * LANDS.mine.price) / 2) * GOLD); fl(l).land = undefined; })),
], { title: "ผู้เช่าลุกฮือ", when: (l) => on(l) && landCount(l) > 0 && land(l).mood < 15, forced: true, maxTimes: 0 }), () => {});

// ───────────── ความจน ─────────────
export const POOR = 3;
const poor = (l: Life) => on(l) && l.age >= 12 && gold(l) < POOR && !l.job && !jailed(l);
const KINDNESS = E("ft.m2.kindness", [12, 900], "คุณนั่งหลบฝนอยู่ใต้ชายคาร้านขนมปัง ประตูเปิดออก หญิงเจ้าของร้านยื่นขนมปังอุ่นๆ ให้", [
  C("รับไว้แล้วขอบคุณ", G("ขนมปังก้อนนั้นอร่อยที่สุดในชีวิต และเธอบอกว่าพรุ่งนี้มาช่วยนวดแป้งได้", { joy: 4, gold: 2 }, (l) => { const p = createPerson(l, "friend", { age: Math.max(30, l.age + 15), bond: 50 }); p.job = "เจ้าของร้านขนมปังที่ใจดีกับคุณ"; })),
  C("ปฏิเสธเพราะศักดิ์ศรี", N("ท้องคุณร้องดังกว่าคำปฏิเสธ แต่คุณเดินจากไป", { joy: -2 }, (l) => lean(l, { c: 2 }))),
], { title: "น้ำใจคนแปลกหน้า", when: poor, weight: 20, maxTimes: 2 });
const PULL = E("ft.m2.pull", [12, 900], "ชายใส่แหวนทองเต็มนิ้วยื่นถุงเงินให้ \"แค่ส่งห่อนี้ไปท่าเรือ ไม่ต้องถามว่าข้างในมีอะไร\"", [
  P("รับงาน", (l) => clamp(0.6 + (l.stats.luck - 50) / 200, 0.2, 0.9), G("ห่อถึงมือคนรับ คุณได้เงินที่ไม่เคยเห็นมาก่อน", { gold: 12 }, (l) => lean(l, { h: -3 })), (l) => { nextUp(l, "ft.l.arrest", { sev: 1 }); return { text: "ยามเปิดห่อต่อหน้าคุณ", kind: "bad" }; }),
  C("ปฏิเสธ", N("เขาหัวเราะแล้วโยนเหรียญหนึ่งเหรียญลงบนพื้นตรงหน้าคุณ", { gold: 1 }, (l) => lean(l, { h: 3 }))),
], { title: "ทางลัดของคนจน", when: poor, weight: 14, maxTimes: 2 });
const WAY_UP = E("ft.m2.wayup", [12, 900], "ช่างไม้เฒ่าเห็นคุณช่วยยกไม้ให้คนแปลกหน้าทุกวัน วันนี้เขาเดินมาหา \"อยากเรียนวิชาไหม ข้าไม่มีลูกจะสืบต่อ\"", [
  C("รับคำทันที", BIG("คุณได้ที่นอน อาหาร และวิชาติดตัว ชีวิตเริ่มเดินไปข้างหน้าอีกครั้ง", { joy: 8, gold: 5 }, (l) => { addStat(l, "health", 3); const p = createPerson(l, "ally", { age: Math.max(55, l.age + 30), bond: 60 }); p.job = "ช่างไม้เฒ่าที่รับคุณเป็นศิษย์"; })),
  C("ขอบคุณแต่ขอเดินทางของตัวเอง", N("เขาพยักหน้า \"ประตูข้าเปิดอยู่เสมอ\"")),
], { title: "ทางขึ้น", when: poor, weight: 12, maxTimes: 1 });

// ───────────── ภาษี ─────────────
/** ภาษีทรัพย์สินของแต่ละแผ่นดิน · ปีสงครามเพิ่ม */
export const taxRate = (k: Kingdom) => { let h = 0; for (const ch of k.id) h = (h * 31 + ch.charCodeAt(0)) % 997; return 0.03 + (h % 5) / 100 + (k.war ? 0.04 : 0); };
export const TAX_FLOOR = 80, TAX_GAP = 3;
const taxDue = (l: Life) => Math.round(gold(l) * taxRate(homeKingdom(l)));
const TAX = after(E("ft.m2.tax", [18, 900], (l) => `เจ้าพนักงานภาษีของ${homeKingdom(l).name}ประเมินทรัพย์สินของคุณ ภาษีปีนี้ ${taxDue(l)} เหรียญทอง (${Math.round(taxRate(homeKingdom(l)) * 100)}%${homeKingdom(l).war ? " รวมภาษีสงคราม" : ""})`, [
  C("จ่ายครบ", N((l) => `คุณจ่าย ${taxDue(l)} เหรียญทอง และได้ใบเสร็จที่มีตราแผ่นดิน`, {}, (l) => { addMoney(l, -taxDue(l) * GOLD); addStanding(l, 1); })),
  K("ซ่อนทรัพย์สินบางส่วน", "smarts", 75, G("บัญชีของคุณอ่านยากโดยเจตนา คุณจ่ายแค่หนึ่งในสาม", {}, (l) => { addMoney(l, -Math.round(taxDue(l) / 3) * GOLD); lean(l, { h: -3 }); }), B("เจ้าพนักงานเจอหีบที่ซ่อนไว้ คุณถูกปรับสองเท่า", {}, (l) => { addMoney(l, -taxDue(l) * 2 * GOLD); addStanding(l, -5); })),
  C((l) => `ติดสินบนเจ้าพนักงาน (${Math.round(taxDue(l) / 2)} เหรียญทอง)`, N("เจ้าพนักงานแก้ตัวเลขในสมุดโดยไม่เงยหน้า", {}, (l) => { addMoney(l, -Math.round(taxDue(l) / 2) * GOLD); lean(l, { h: -2 }); if (chance(l, 0.15)) { addStanding(l, -6); log(l, "เรื่องสินบนรั่วออกไป ทั้งเมืองรู้", "bad"); } })),
  C("ย้ายไปแผ่นดินที่ภาษีถูกกว่า", (l) => { const best = [...kingdomsOf(l)].filter((k) => k.id !== homeKingdom(l).id).sort((a, b) => taxRate(a) - taxRate(b))[0]; if (best) { fl(l).kingdom = best.id; } return { text: `คุณเก็บของย้ายไป${best?.name ?? "แผ่นดินอื่น"} ภาษีที่นั่น ${best ? Math.round(taxRate(best) * 100) : "?"}%`, kind: "good" }; }),
], { title: "ภาษีประจำปี", when: (l) => on(l) && !jailed(l) && gold(l) >= TAX_FLOOR && l.age - Number(l.flags.ftTaxAt ?? -9) >= TAX_GAP, forced: true, maxTimes: 0 }), (l) => { l.flags.ftTaxAt = l.age; });

// ───────────── ติดพนัน ─────────────
export const HABIT = 5;
const URGE = E("ft.m2.urge", [16, 900], "เสียงลูกเต๋ากระทบโต๊ะดังมาจากโรงเตี๊ยม มือคุณสั่นตั้งแต่เช้า คืนนี้เงินเก็บทั้งหมดอยู่ในกระเป๋า", [
  C("เข้าไปเล่นอีกตา", (l) => { const lose = Math.max(5, Math.round(gold(l) * 0.3)); addMoney(l, -lose * GOLD); fl(l).gambling = (fl(l).gambling ?? 0) + 1; for (const p of l.people) if (p.alive && ["spouse", "partner", "child"].includes(p.relation)) p.bond = clamp(p.bond - 6, 0, 100); lean(l, { h: -2 }); return { text: `คุณเสีย ${lose} เหรียญทองก่อนรุ่งสาง และโกหกคนที่บ้านว่าไปไหนมา`, kind: "bad" }; }),
  K("เดินผ่านไปโดยไม่หันมอง", "happiness", 55, G("คืนนั้นยาวที่สุดในชีวิต แต่เช้ามาคุณยังมีเงินเก็บครบ", { joy: 3 }, (l) => { fl(l).gambling = Math.max(0, (fl(l).gambling ?? 0) - 2); }), B("ขาของคุณพาเข้าไปเองโดยไม่รู้ตัว", { gold: -8 }, (l) => { fl(l).gambling = (fl(l).gambling ?? 0) + 1; })),
  C("ไปขอให้นักบวชช่วย", G("นักบวชนั่งกับคุณทุกคืนจนอาการสงบลง", { joy: 2 }, (l) => { fl(l).gambling = 0; lean(l, { f: 3 }); })),
], { title: "เสียงลูกเต๋า", when: (l) => on(l) && (fl(l).gambling ?? 0) >= HABIT, weight: 40, maxTimes: 0 });

// ───────────── ขโมยขึ้นบ้าน ─────────────
export const THEFT_AT = 200, THEFT_CHANCE = 0.1, VAULT_PRICE = 40;
const guarded = (l: Life) => !!fl(l).vault || !!staffOf(l, "guard") || !!staffOf(l, "steward");

// ───────────── ทำบุญ ─────────────
export const GIFTS: Record<string, { name: string; gold: number; standing: number }> = {
  temple: { name: "วิหารประจำหมู่บ้าน", gold: 50, standing: 6 },
  orphanage: { name: "บ้านเด็กกำพร้า", gold: 80, standing: 8 },
  bridge: { name: "สะพานหินข้ามแม่น้ำ", gold: 120, standing: 10 },
};
const CHARITY = SCENE("ft.m2.charity", "ทำบุญ", "สภาเมืองมีรายชื่อสิ่งที่ยังไม่มีใครออกทุนสร้าง", [
  ...Object.entries(GIFTS).map(([k, g]) => PAY(`สร้าง${g.name}`, g.gold, BIG(`${g.name}สร้างเสร็จพร้อมแผ่นหินสลักชื่อคุณ`, { joy: 6 }, (l) => { fl(l).charity = [...(fl(l).charity ?? []), k]; addStanding(l, g.standing); addFame(l, 3); deed(l, `ผู้สร้าง${g.name}แห่ง${homeKingdom(l).name}`); lean(l, { m: 5 }); }), { show: (l) => !fl(l).charity?.includes(k) })),
  PAY("บริจาคให้โรงทาน", 10, G("แถวหน้าโรงทานสั้นลงหนึ่งฤดู", { joy: 2 }, (l) => { addStanding(l, 1); lean(l, { m: 2 }); })),
  C("ไว้ทีหลัง", N("คุณพับรายชื่อเก็บใส่อกเสื้อ")),
]);
const ORPHAN_HELP = after(E("ft.m2.orphan", [30, 900], "เด็กจากบ้านเด็กกำพร้าที่คุณสร้างโตเป็นหมอแล้ว เขามาเคาะประตูเมื่อรู้ว่าคุณป่วย", [
  C("ให้เขาดูแล", G("เขาดูแลคุณทั้งเดือนโดยไม่ยอมรับเงินสักเหรียญ \"ข้ามีวันนี้ได้เพราะท่าน\"", { hp: 15, joy: 6 })),
], { title: "บุญที่กลับมา", when: (l) => on(l) && !!fl(l).charity?.includes("orphanage") && l.stats.health < 40 && !l.flags.ftOrphanHelped, forced: true, maxTimes: 1 }), (l) => { l.flags.ftOrphanHelped = true; });

// ───────────── เส้นทางการค้าที่ไปต่อได้ ─────────────
export const ROUTE_LEGS = 3;
const ROUTE = SCENE("ft.m2.route", "เส้นทางการค้า", (_l, c) => `กองคาราวานยังมีแรง และมีเมืองถัดไปที่ของคุณขายได้ราคา (เที่ยวที่ ${Number(c.leg) + 1}/${ROUTE_LEGS})`, [
  P((_l, c) => `ไปต่ออีกเมือง · กำไรราว ${Math.round(Number(c.gain) * 1.2)} เหรียญทอง`, (l, c) => clamp(0.75 - Number(c.leg) * 0.12 + (l.stats.luck - 50) / 300 - (boomOf(l) === "embargo" ? 0.15 : 0), 0.15, 0.9), (l, c) => {
    const g = Math.round(Number(c.gain) * 1.2); addMoney(l, g * GOLD);
    if (Number(c.leg) + 1 < ROUTE_LEGS) nextUp(l, "ft.m2.route", { leg: Number(c.leg) + 1, gain: g });
    else deed(l, "ผู้เปิดเส้นทางการค้าสามเมือง");
    return { text: `เมืองถัดไปรับซื้อทั้งเกวียน กำไรอีก ${g} เหรียญทอง`, kind: "good" };
  }, (l, c) => { const loss = Math.round(Number(c.gain) * 0.8); addMoney(l, -loss * GOLD); return { text: `โจรภูเขาซุ่มที่ทางแยก คุณเสียกำไรของเที่ยวก่อนไป ${loss} เหรียญทอง`, kind: "bad" }; }),
  C("กลับบ้านพร้อมกำไร", N("คุณหันหัวเกวียนกลับ กำไรที่ได้อยู่ในกระเป๋าครบ")),
]);

// ───────────── กิจกรรม ─────────────
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const ACTS: Activity[] = [
  M({ group: "เงิน", id: "ft_invest", name: "ลงทุน", desc: "เรือสินค้า คณะสำรวจ เหมือง หรือร้านของเพื่อน · ได้ผลในอีกไม่กี่ปี", minAge: 18, time: 0, available: (l) => on(l) && gold(l) >= 20 && yearly("ftInvestAt")(l), run: (l) => { l.flags.ftInvestAt = l.age; runEvent(l, "ft.m2.invest"); return { text: "" }; } }),
  M({ group: "เงิน", id: "ft_lend", name: "ปล่อยกู้", desc: `ดอกเบี้ย ${Math.round(LOAN_RATE * 100)}% ในสามปี · บางคนไม่คืน`, minAge: 18, time: 0, available: (l) => on(l) && gold(l) >= 20 && yearly("ftLendAt")(l), run: (l) => { l.flags.ftLendAt = l.age; runEvent(l, "ft.m2.lend"); return { text: "" }; } }),
  M({ group: "เงิน", id: "ft_land", name: "ที่ดินและผู้เช่า", desc: "ไร่ หมู่บ้าน เหมือง · ผู้เช่ามีใจ ดูแลดีหรือรีดเต็มที่", minAge: 18, time: 0, available: (l) => on(l) && (gold(l) >= LANDS.farm.price || landCount(l) > 0), run: (l) => { runEvent(l, "ft.m2.land"); return { text: "" }; } }),
  M({ group: "เงิน", id: "ft_charity", name: "ทำบุญ", desc: "วิหาร บ้านเด็กกำพร้า สะพาน หรือโรงทาน · ชื่อเสียงในแผ่นดิน", minAge: 16, time: 0, available: (l) => on(l) && gold(l) >= 10, run: (l) => { runEvent(l, "ft.m2.charity"); return { text: "" }; } }),
  M({ group: "เงิน", id: "ft_vault", name: "สร้างห้องนิรภัย", desc: "กันขโมยขึ้นบ้าน", minAge: 18, time: 0, cost: VAULT_PRICE * GOLD, available: (l) => on(l) && !fl(l).vault && gold(l) >= VAULT_PRICE, run: (l) => { addMoney(l, -VAULT_PRICE * GOLD); fl(l).vault = true; const t = "ช่างหินสร้างห้องนิรภัยใต้บ้าน ประตูเหล็กหนาเท่าฝ่ามือ"; log(l, t, "good"); return { text: t, kind: "good" }; } }),
  ...(Object.keys(LIFESTYLE) as (keyof typeof LIFESTYLE)[]).map((k) => M({ group: "เงิน", id: `ft_life_${k}`, name: `ใช้ชีวิตแบบ${LIFESTYLE[k].name}`, desc: LIFESTYLE[k].desc, minAge: 18, time: 0, available: (l) => on(l) && (fl(l).lifestyle ?? "comfortable") !== k, run: (l) => { fl(l).lifestyle = k; const t = `ตั้งแต่ปีนี้คุณใช้ชีวิตแบบ${LIFESTYLE[k].name}`; log(l, t); return { text: t }; } })),
  M({ group: "ชีวิตลำบาก", id: "ft_beg", name: "ขอทาน", desc: "ได้เงินเล็กน้อย · ชื่อเสียงในแผ่นดินลดลง", minAge: 8, available: poor, run: (l) => { const g = randInt(l, 1, 3); addMoney(l, g * GOLD); addStanding(l, -1); addStat(l, "happiness", -2); return { text: `คุณนั่งหน้าวิหารทั้งวัน ได้ ${g} เหรียญทอง` }; } }),
  M({ group: "ชีวิตลำบาก", id: "ft_oddjob", name: "รับจ้างรายวัน", desc: "แบกของ ขุดคู ล้างจาน · เหนื่อยแต่ได้เงิน", minAge: 10, available: poor, run: (l) => { const g = randInt(l, 3, 5); addMoney(l, g * GOLD); addStat(l, "health", -1); return { text: `คุณแบกกระสอบที่ท่าเรือจนไหล่ระบม ได้ ${g} เหรียญทอง`, kind: "good" }; } }),
];

// ───────────── ทุกปี ─────────────
function moneyYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const f = fl(l), k = homeKingdom(l);
  // เศรษฐกิจรุ่งและร่วง: บางปีเริ่มช่วงใหม่ อยู่สองถึงสี่ปี
  if (k.boom && k.boom.left > 0) { k.boom.left--; if (!k.boom.left) { log(l, `${BOOMS[k.boom.kind].name}ใน${k.name}ผ่านไปแล้ว ราคากลับมาเป็นปกติ`); k.boom = undefined; } }
  else if (chance(l, BOOM_CHANCE)) {
    const kind = pick(l, Object.keys(BOOMS) as (keyof typeof BOOMS)[]);
    k.boom = { kind, left: randInt(l, 2, 4) };
    log(l, `ข่าวจาก${k.name}: ${BOOMS[kind].name} · ${BOOMS[kind].news}`, "milestone");
  }
  if (boomOf(l) === "bust" && l.job && chance(l, 0.1)) { l.job.performance = clamp(l.job.performance - 15, 0, 100); log(l, "ห้างที่คุณทำงานให้ลดคนครึ่งหนึ่ง คุณรอดมาได้แต่งานหนักขึ้นเท่าตัว", "bad"); }
  if (jailed(l)) return;
  // การลงทุนครบกำหนด
  if (f.invests?.length) {
    const due = f.invests.filter((x) => x.due <= l.age);
    f.invests = f.invests.filter((x) => x.due > l.age);
    for (const x of due) log(l, settleInvest(l, x), "good");
  }
  // เงินกู้ครบกำหนด: คืนพร้อมดอก ขอเลื่อน หรือหนีไป
  for (const x of f.loans ?? []) {
    if (x.due > l.age) continue;
    const r = chance(l, 0.55) ? "pay" : chance(l, 0.6) ? "beg" : "flee";
    if (r === "pay") { const g = Math.round(x.gold * (1 + LOAN_RATE)); addMoney(l, g * GOLD); log(l, `${x.name}คืนเงิน ${g} เหรียญทองพร้อมดอกเบี้ย`, "good"); x.due = -1; }
    else if (r === "beg" && !l.queue.some((q) => q.eventId === "ft.m2.loan_due")) { runEvent(l, "ft.m2.loan_due", { n: x.name, g: x.gold }); }
    else if (r === "flee") { log(l, `${x.name}หนีหนี้ไปตอนกลางคืน เงิน ${x.gold} เหรียญทองหายไปกับเขา`, "bad"); x.due = -1; const p = x.pid && l.people.find((q) => q.id === x.pid); if (p) p.bond = clamp(p.bond - 25, 0, 100); }
  }
  if (f.loans) f.loans = f.loans.filter((x) => x.due !== -1);
  // ที่ดิน: ค่าเช่าตามใจผู้เช่า · รีดเต็มที่ได้มากแต่ใจผู้เช่าตกทุกปี · เป็นเจ้าที่ดินเมื่อมีครบ
  const ld = f.land;
  if (ld && landCount(l)) {
    const base = ld.farm * LANDS.farm.rent + ld.village * LANDS.village.rent + ld.mine * LANDS.mine.rent;
    const rent = Math.round(base * (ld.squeeze ? 1.5 : 1) * (0.5 + ld.mood / 100) * (boomOf(l) === "harvest" ? 0.8 : boomOf(l) === "bust" ? 0.8 : 1));
    addMoney(l, rent * GOLD);
    ld.mood = clamp(ld.mood + (ld.squeeze ? -8 : 2), 0, 100);
    if (ld.village >= 1 && ld.farm >= 3 && ld.mood >= 60 && !l.flags.ftLord) { l.flags.ftLord = true; deed(l, `เจ้าที่ดินแห่ง${k.name}`); addStanding(l, 6); log(l, `ผู้เช่าทุกหมู่บ้านเรียกคุณว่าท่านเจ้าที่ดิน ชื่อคุณอยู่ในทะเบียนขุนนางแห่ง${k.name}`, "milestone"); }
  }
  // วิธีใช้ชีวิต
  const ls = f.lifestyle ?? "comfortable";
  if (ls === "frugal") { addStat(l, "happiness", -2); if (chance(l, 0.3)) addStanding(l, -1); }
  if (ls === "lavish") { addStat(l, "happiness", 3); if (chance(l, 0.4)) addStanding(l, 1); if (chance(l, 0.12)) { const p = createPerson(l, "friend", { age: Math.max(18, l.age + randInt(l, -10, 5)), bond: 35 }); p.job = "คนที่ชอบมางานเลี้ยงของคุณ"; p.tags = [...(p.tags ?? []), "flatterer"]; } }
  // ขโมยขึ้นบ้าน: คนรวยที่ไม่มีห้องนิรภัยหรือคนเฝ้า
  if (gold(l) >= THEFT_AT && !guarded(l) && chance(l, THEFT_CHANCE)) {
    const lost = Math.round(gold(l) * (0.15 + randInt(l, 0, 15) / 100));
    addMoney(l, -lost * GOLD);
    log(l, `ขโมยงัดบ้านตอนคุณไม่อยู่ เงิน ${lost} เหรียญทองหายไป · ห้องนิรภัย คนเฝ้าบ้าน หรือพ่อบ้านช่วยกันได้`, "bad");
  }
  // ความอยากเล่นพนันจางลงเองช้าๆ
  if ((f.gambling ?? 0) > 0 && chance(l, 0.3)) f.gambling = (f.gambling ?? 0) - 1;
}

export const MONEY2_EVENTS: GameEvent[] = [INVEST, LEND, LOAN_DUE, LAND, TENANT, REVOLT, KINDNESS, PULL, WAY_UP, TAX, URGE, CHARITY, ORPHAN_HELP, ROUTE];

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadMoney2() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(moneyYear);
  // ตื่นทองขึ้นค่าแรง เศรษฐกิจตกต่ำลดค่าแรง
  salaryHooks.push((l, _c, base) => (!on(l) ? base : boomOf(l) === "goldrush" ? base * 1.15 : boomOf(l) === "bust" ? base * 0.85 : base));
  // เล่นลูกเต๋าทุกครั้งเพิ่มความอยากเล่น · ส่งคาราวานสำเร็จไปต่อเมืองถัดไปได้
  choiceHooks.push((l, _c, _ctx, _ok, id) => {
    if (!on(l)) return;
    if (id === "ft.h.dice" && _c.odds) { fl(l).gambling = (fl(l).gambling ?? 0) + 1; if (fl(l).gambling === HABIT) log(l, "คุณเริ่มนับวันรอคืนที่จะได้กลับไปโต๊ะลูกเต๋า นี่ไม่ใช่การเล่นสนุกแล้ว", "bad"); }
  });
  // ส่งคาราวานสำเร็จแล้วไปต่อเมืองถัดไปได้
  for (const ch of getEvent("ft.e.trade")?.choices ?? []) if (ch.odds) {
    const run = ch.run;
    ch.run = (l, c, ok) => { const out = run(l, c, ok); const gain = Number(out.text.match(/กำไร (\d+)/)?.[1] ?? 0); if (ok && on(l) && gain > 0) nextUp(l, "ft.m2.route", { leg: 0, gain }); return out; };
  }
  // ปุ่มของคนจนขึ้นเฉพาะตอนจน · เลือกวิธีใช้ชีวิตไม่ต้องขึ้นปุ่มที่ใช้อยู่แล้ว
  activityFilters.push((l, a) => !["ft_beg", "ft_oddjob"].includes(a.id) || poor(l));
  activityFilters.push((l, a) => !a.id.startsWith("ft_life_") || (fl(l).lifestyle ?? "comfortable") !== a.id.slice(8));
  activityFilters.push((l, a) => a.id !== "ft_vault" || !fl(l).vault);
}

/** สรุปสำหรับแท็บอาชีพ */
export function moneyLines(l: Life): string[] {
  const f = fl(l), out: string[] = [];
  out.push(`ใช้ชีวิตแบบ${LIFESTYLE[f.lifestyle ?? "comfortable"].name} · ภาษีทรัพย์สินที่${homeKingdom(l).name} ${Math.round(taxRate(homeKingdom(l)) * 100)}%${boomOf(l) ? ` · ตอนนี้${BOOMS[boomOf(l)!].name}` : ""}`);
  if (f.invests?.length) out.push(`ลงทุนไว้: ${f.invests.map((x) => `${x.kind === "friend" ? "ร้านของเพื่อน" : VENTURES[x.kind].name} ${x.gold} (รู้ผลอายุ ${x.due})`).join(" · ")}`);
  if (f.loans?.length) out.push(`ปล่อยกู้: ${f.loans.map((x) => `${x.name} ${x.gold} (ครบอายุ ${x.due})`).join(" · ")}`);
  if (landCount(l)) { const x = f.land!; out.push(`ที่ดิน: ไร่ ${x.farm} · หมู่บ้าน ${x.village} · เหมือง ${x.mine} · ใจผู้เช่า ${x.mood}/100${x.mood < 25 ? " (ใกล้ลุกฮือ)" : ""}`); }
  if (f.charity?.length) out.push(`ทำบุญไว้: ${f.charity.map((k) => GIFTS[k].name).join(" · ")}`);
  if ((f.gambling ?? 0) >= 3) out.push(f.gambling! >= HABIT ? "ติดพนัน · นักบวชที่วิหารช่วยได้" : "เริ่มอยากเล่นพนันบ่อยขึ้น");
  if (gold(l) >= THEFT_AT && !guarded(l)) out.push("เงินเยอะแต่ไม่มีห้องนิรภัยหรือคนเฝ้า · ขโมยอาจขึ้นบ้าน");
  return out;
}
