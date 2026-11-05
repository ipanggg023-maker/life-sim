// ความสัมพันธ์รายคนในโลกแฟนตาซี (แท็บผู้คน): ประลอง สอนลูก ส่งลูกเรียน เล่านิทาน ผจญภัยด้วยกัน
// ปาร์ตี้นักผจญภัย: เพื่อนสนิทเข้าร่วมได้สามคน แต่ละคนมีอาชีพ ช่วยสู้ในงานกิลด์ และอาจแยกทางถ้าห่างเหิน
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { clamp, log, shortName } from "../../engine/util";
import { personActionHooks, type PersonAction } from "../murim/life/kinship";
import { B, BIG, C, G, K, N, P, PAY, SCENE } from "./kit";
import { canCast, fightOdds } from "./power";
import { SCHOOLS } from "./places";

import { dataOf, fl, worldOfLife } from "./state";

export const PARTY_CLASSES: Record<string, string> = { warrior: "นักรบ", mage: "จอมเวท", cleric: "นักบวช", archer: "นักธนู", rogue: "นักย่อง" };
export const PARTY_MAX = 3;
const classOf = (p: Person) => p.tags?.find((t) => t.startsWith("party:"))?.slice(6);
export const partyOf = (l: Life) => l.people.filter((p) => p.alive && !!classOf(p));
export const partyLabel = (p: Person) => (classOf(p) ? PARTY_CLASSES[classOf(p)!] : undefined);

const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const tag = (p: Person, t: string) => { if (!p.tags?.includes(t)) p.tags = [...(p.tags ?? []), t]; };
const count = (p: Person, k: string) => Number(p.tags?.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1) ?? 0);
const bumpTag = (p: Person, k: string) => { const n = count(p, k) + 1; p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith(`${k}:`)), `${k}:${n}`]; return n; };
const bond = (d: number): ((l: Life, c: Ctx) => void) => (l, c) => { const p = who(l, c); if (p) p.bond = clamp(p.bond + d, 0, 100); };
const both = (...fs: ((l: Life, c: Ctx) => void)[]) => (l: Life, c: Ctx) => { for (const f of fs) f(l, c); };

/** ฝีมือโดยประมาณของคนรู้จัก: คู่ปรับโรงเรียนใช้พลังจริง คนอื่นตามวัยและอาชีพในปาร์ตี้ */
function powerOf(l: Life, p: Person) {
  if (p.id === fl(l).rivalId) return fl(l).rivalPower ?? 20;
  const trained = count(p, "taught_body") * 6 + count(p, "taught_magic") * 6;
  const party = classOf(p) ? 18 + count(p, "quests") * 3 : 0;
  return clamp(6 + Math.min(p.age, 40) * 0.6 + trained + party, 4, 90);
}

// ── ฉากจากปุ่มรายคน ──
const SCENES: GameEvent[] = [
  SCENE("ft.p.spar", "ประลองฝีมือ", (l, c) => `${nm(l, c)}ยืนตั้งท่ารออยู่กลางลาน${who(l, c)?.id === fl(l).rivalId ? " สายตาบอกว่าครั้งนี้ไม่ยอมแพ้แน่" : ""}`, [
    P("สู้เต็มที่", (l, c) => fightOdds(l, powerOf(l, who(l, c)!)), G((l, c) => `คุณปัดดาบของ${nm(l, c)}หลุดมือ ทั้งคู่หัวเราะหอบ`, { body: 8, fame: 1 }, both(bond(4), (l, c) => { if (who(l, c)?.id === fl(l).rivalId) fl(l).rivalPower = Math.max(5, (fl(l).rivalPower ?? 20) - 1); })), N((l, c) => `${nm(l, c)}วางปลายดาบที่คอคุณ แล้วยื่นมือดึงคุณลุก`, { body: 4, hp: -3 }, bond(2))),
    C("ซ้อมเบาๆ แลกเคล็ดกัน", G((l, c) => `${nm(l, c)}สอนท่าหลบที่คุณไม่เคยเห็น คุณสอนท่าฟันกลับไป`, { body: 5 }, bond(6))),
  ]),
  SCENE("ft.p.teach", "สอนลูก", (l, c) => `${nm(l, c)}อายุ ${who(l, c)?.age ?? ""} ปี ยืนรอฟังคุณด้วยตาเป็นประกาย`, [
    C("สอนดาบ", G((l, c) => `${nm(l, c)}จับดาบไม้ถูกท่าเป็นครั้งแรก แล้วหันมามองว่าคุณเห็นไหม`, { joy: 3 }, both(bond(6), (l, c) => { const p = who(l, c); if (p && bumpTag(p, "taught_body") >= 3) p.job = "นักดาบฝึกหัด"; })), { show: (l) => fl(l).bodyRank >= 1 }),
    C("สอนเวท", G((l, c) => `ปลายนิ้วของ${nm(l, c)}เรืองแสงจางๆ เด็กกรี๊ดจนแม่ต้องวิ่งมาดู`, { joy: 3 }, both(bond(6), (l, c) => { const p = who(l, c); if (p && bumpTag(p, "taught_magic") >= 3) p.job = "ศิษย์เวท"; })), { show: (l) => canCast(l) && fl(l).magicRank >= 1 }),
    C("สอนอ่านเขียนและเรื่องของโลก", G((l, c) => `${nm(l, c)}ท่องชื่ออาณาจักรทั้งหมดได้ก่อนเข้านอน`, { joy: 2 }, both(bond(5), (l, c) => { const p = who(l, c); if (p) bumpTag(p, "taught_mind"); }))),
    C("พาไปเล่นที่ลำธาร", G((l, c) => `คุณกับ${nm(l, c)}จับปลาไม่ได้สักตัว แล้วกลับบ้านเปียกทั้งคู่`, { joy: 5 }, bond(8))),
    C("พาไปดูงานของคุณ", G((l, c) => `${nm(l, c)}ช่วยคุณทำงานทั้งวัน แล้วถามคำถามที่ลูกมือของคุณไม่เคยถาม`, { joy: 2 }, both(bond(4), (l, c) => { const p = who(l, c); if (p) bumpTag(p, "taught_trade"); })), { show: (l, c) => !!l.job && (who(l, c)?.age ?? 0) >= 12, mark: "สอนครบสามครั้ง ถ้าเขารับช่วงต่อจะเริ่มงานนี้ที่ขั้นสอง" }),
  ]),
  SCENE("ft.p.tale", "นิทานก่อนนอน", (l, c) => `${nm(l, c)}ดึงผ้าห่มขึ้นถึงคาง "เล่าเรื่องหน่อย"`, [
    C("เรื่องมังกรที่บินอยู่เหนือแผ่นดิน", G((l, c) => { const d = dataOf(l).dragons.find((x) => x.alive); return `คุณเล่าเรื่อง${d ? `${d.name} ${d.title}` : "มังกรตัวสุดท้าย"} ${nm(l, c)}หลับไปพร้อมรอยยิ้ม`; }, { joy: 3 }, bond(5))),
    C("เรื่องอาวุธตำนานที่หายไป", G((l, c) => { const r = dataOf(l).relics.find((x) => x.holder === "lost"); return `${nm(l, c)}ถามว่า${r?.name ?? "ดาบเล่มนั้น"}อยู่ที่ไหน คุณบอกว่าบางทีวันหนึ่งเขาอาจเป็นคนเจอ`; }, { joy: 3 }, bond(5))),
    C("เรื่องที่พ่อแม่เคยทำ", G((l, c) => `คุณเล่าเรื่องจริงที่เคยผ่านมา ${nm(l, c)}ฟังจนลืมง่วง แล้วขอฟังซ้ำทุกคืน`, { joy: 4 }, bond(7)), { show: (l) => fl(l).deeds.length > 0 }),
    C("เรื่องตำนานของคนรุ่นก่อน", G((l, c) => { const g = pick(l, worldOfLife(l).legends); return `${g ? `${g.name}ผู้${g.deed}` : "วีรบุรุษไร้ชื่อ"} — ${nm(l, c)}สัญญาว่าโตขึ้นจะเป็นแบบนั้น`; }, { joy: 3 }, bond(5)), { show: (l) => worldOfLife(l).legends.length > 0 }),
  ]),
  SCENE("ft.p.school", "ส่งลูกเข้าโรงเรียน", (l, c) => `${nm(l, c)}โตพอจะเข้าโรงเรียนแล้ว คุณจะส่งไปที่ไหน`, [
    ...SCHOOLS.map((s) => PAY(`${s.name} · ${s.focus}`, s.fee, G((l, c) => `${nm(l, c)}โบกมือลาจากหน้าต่างรถม้า กระเป๋าใบใหญ่กว่าตัว`, { joy: 2 }, both(bond(5), (l, c) => { const p = who(l, c); if (p) { p.job = `นักเรียน${s.name}`; tag(p, "ft_school"); bumpTag(p, s.magic > s.body ? "taught_magic" : "taught_body"); } })))),
    C("ยังไม่ส่งปีนี้", N("ลูกยังอยู่บ้านอีกปี")),
  ]),
  SCENE("ft.p.quest", "ผจญภัยด้วยกัน", (l, c) => `${nm(l, c)}กางแผนที่บนโต๊ะโรงเตี๊ยม "ถ้ำทางเหนือ ได้ยินว่ามีของดี ไปด้วยกันไหม"`, [
    P("ไปด้วยกัน", (l, c) => fightOdds(l, 22 - powerOf(l, who(l, c)!) * 0.25), G((l, c) => `คุณกับ${nm(l, c)}ออกจากถ้ำพร้อมถุงเหรียญเก่า และเรื่องเล่าที่จะพูดถึงไปอีกสิบปี`, { gold: 18, body: 5 }, both(bond(10), (l, c) => { const p = who(l, c); if (p && classOf(p)) bumpTag(p, "quests"); })), B((l, c) => `ถ้ำนั้นมีเจ้าของ คุณกับ${nm(l, c)}หนีออกมาคนละทาง`, { hp: -8 }, bond(-2))),
    C("ชวนไปตกปลาแทน", G((l, c) => `${nm(l, c)}บ่นว่าน่าเบื่อ แต่ตกได้มากกว่าคุณสองเท่า`, { joy: 4 }, bond(5))),
  ]),
  SCENE("ft.p.party", "ชวนเข้าปาร์ตี้", (l, c) => `คุณถามว่า${nm(l, c)}อยากออกเดินทางด้วยกันไหม ไม่ใช่แค่ครั้งเดียว แต่เป็นปาร์ตี้`, [
    ...Object.entries(PARTY_CLASSES).map(([id, name]) => K(`ให้เป็น${name}ของปาร์ตี้`, "looks", 40, BIG((l, c) => `${nm(l, c)}ยื่นมือมาจับมือคุณแน่น ปาร์ตี้ของคุณมี${name}แล้ว`, { joy: 5 }, (l, c) => { const p = who(l, c); if (!p) return; p.relation = "ally"; p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith("party:")), `party:${id}`]; p.job = `${name}ในปาร์ตี้ของคุณ`; p.bond = clamp(p.bond + 8, 0, 100); }), N((l, c) => `${nm(l, c)}ยิ้มแห้ง "ขอคิดดูก่อนนะ"`))),
    C("ไว้วันหลัง", N("คุณเปลี่ยนเรื่องคุย")),
  ]),
  SCENE("ft.p.date", "ไปเที่ยวด้วยกัน", (l, c) => `วันนี้คุณกับ${nm(l, c)}ว่างทั้งวัน`, [
    PAY("งานเทศกาลดอกไม้ไฟเวท", 4, G((l, c) => `มังกรแสงบินวนเหนือหัวคุณกับ${nm(l, c)} ทั้งสองจับมือกันแน่นโดยไม่รู้ตัว`, { joy: 6 }, bond(9))),
    C("ล่องเรือในทะเลสาบ", G((l, c) => `${nm(l, c)}หลับบนตักคุณ ขณะที่เรือลอยไปเองตามลม`, { joy: 5 }, bond(7))),
    K("ทำอาหารให้กินเอง", "smarts", 45, G((l, c) => `${nm(l, c)}ขอเติมจานที่สอง`, { joy: 4 }, bond(8)), N((l, c) => `ครัวไหม้ไปครึ่งห้อง ${nm(l, c)}หัวเราะจนน้ำตาไหล`, { joy: 2 }, bond(4))),
  ]),
  SCENE("ft.p.lore", "เรื่องเล่าของตระกูล", (l, c) => `${nm(l, c)}เปิดหีบไม้เก่าที่ไม่เคยให้ใครดู`, [
    C("ฟังเรื่องบรรพบุรุษ", G((l, c) => `${nm(l, c)}เล่าว่าทวดของคุณเคย${pick(l, ["ขี่ม้าข้ามภูเขาน้ำแข็งในคืนเดียว", "ซื้อขนมปังด้วยเกล็ดมังกร", "ช่วยราชินีจากเรือที่กำลังจม", "ตีระฆังเตือนเมืองก่อนน้ำท่วม", "หนีจากคุกใต้ดินด้วยช้อนอันเดียว"])}`, { joy: 3, iq: 1 }, bond(5))),
    K("ขอดูของในหีบ", "luck", 55, G((l, c) => { const r = dataOf(l).relics.find((x) => x.holder === "lost"); if (r) fl(l).clues[r.id] = (fl(l).clues[r.id] ?? 0) + 1; return `ในหีบมีแผนที่ที่วาดด้วยมือ${r ? ` ชี้ไปยังที่ซ่อนของ${r.name}` : ""} ${nm(l, c)}บอกว่าถึงเวลาที่มันเป็นของคุณแล้ว`; }, { iq: 2 }, bond(4)), N("ในหีบมีแต่จดหมายรักเก่ากับกระดุม", { joy: 2 }, bond(3))),
  ]),
  SCENE("ft.p.duel", "ดวลชิงเกียรติ", (l, c) => `${nm(l, c)}ขว้างถุงมือลงพื้นต่อหน้าทุกคน`, [
    P("รับคำท้า", (l, c) => fightOdds(l, powerOf(l, who(l, c)!) + 6), BIG((l, c) => `คุณชนะ${nm(l, c)}ต่อหน้าฝูงชน เขาก้มหัวให้คุณเป็นครั้งแรก`, { fame: 5, body: 6 }, (l, c) => { const p = who(l, c); if (!p) return; if (bumpTag(p, "duel_won") >= 2 && p.relation === "rival") { p.relation = "friend"; p.bond = 60; log(l, `${shortName(p)}เลิกเป็นคู่ปรับ เขาบอกว่ามีแต่คุณที่เข้าใจเขา`, "good"); } }), B((l, c) => `${nm(l, c)}ชนะ และเยาะเย้ยคุณไปทั่วเมือง`, { fame: -2, hp: -6 })),
    C("ปฏิเสธ", N("ฝูงชนผิวปากไล่ แต่คุณเดินจากไปโดยไม่หันกลับ", { fame: -1 })),
  ]),
];

const yearly = (l: Life, p: Person, id: string) => (l.doneThisYear.includes(`fp:${id}:${p.id}`) ? "ปีนี้ทำไปแล้ว" : undefined);
const open = (l: Life, p: Person, id: string, eventId: string) => {
  l.doneThisYear.push(`fp:${id}:${p.id}`);
  // จดว่าคุยกันล่าสุดเมื่อไร · เดตนับเป็นขั้นของความรัก
  p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith("talked:")), `talked:${l.age}`];
  if (id === "date") { const n = Number(p.tags.find((t) => t.startsWith("dates:"))?.slice(6) ?? 0) + 1; p.tags = [...p.tags.filter((t) => !t.startsWith("dates:") && !t.startsWith("dated:")), `dates:${n}`, `dated:${l.age}`]; }
  runEvent(l, eventId, { pid: p.id });
};
const FIGHTERS = ["friend", "rival", "ally", "sibling", "spouse", "partner"];

export function fantasyPersonActions(l: Life, p: Person): PersonAction[] {
  if (!l.ft || l.age < 6) return [];
  const out: PersonAction[] = [];
  const add = (id: string, label: string, eventId: string, locked?: string) => out.push({ id, label, locked: locked ?? yearly(l, p, id), run: (x) => open(x, p, id, eventId) });
  const busyJail = Number(l.flags.jailUntil ?? -1) > l.age ? "ติดคุกอยู่" : undefined;
  if (FIGHTERS.includes(p.relation) && l.age >= 10 && p.age >= 10) add("spar", "ประลองฝีมือ", "ft.p.spar", busyJail);
  if (p.relation === "rival" && l.age >= 14) add("duel", "ท้าดวล", "ft.p.duel", busyJail);
  if ((p.relation === "child" || p.relation === "grandchild") && p.age >= 6 && p.age <= 17 && l.age >= 18) add("teach", p.relation === "grandchild" ? "สอนหลาน" : "สอนลูก", "ft.p.teach");
  if (p.relation === "child" && p.age >= 3 && p.age <= 10) add("tale", "เล่านิทาน", "ft.p.tale");
  if (p.relation === "child" && p.age >= 11 && p.age <= 15 && !p.tags?.includes("ft_school")) add("school", "ส่งเข้าโรงเรียน", "ft.p.school");
  if (["friend", "ally"].includes(p.relation) && l.age >= 16 && p.age >= 16) add("quest", "ผจญภัยด้วยกัน", "ft.p.quest", busyJail);
  if (p.relation === "friend" && l.age >= 16 && p.age >= 16 && p.bond >= 50) add("party", "ชวนเข้าปาร์ตี้", "ft.p.party", partyOf(l).length >= PARTY_MAX ? `ปาร์ตี้เต็ม ${PARTY_MAX} คนแล้ว` : undefined);
  if (classOf(p)) out.push({ id: "leave", label: "ให้ออกจากปาร์ตี้", run: (x) => { const q = x.people.find((y) => y.id === p.id); if (!q) return; q.tags = q.tags?.filter((t) => !t.startsWith("party:")); q.job = undefined; q.relation = "friend"; q.bond = clamp(q.bond - 10, 0, 100); log(x, `${shortName(q)}เก็บของออกจากปาร์ตี้ "ถ้าต้องการก็เรียกนะ"`); } });
  if ((p.relation === "spouse" || p.relation === "partner") && l.age >= 16) add("date", "ไปเที่ยวด้วยกัน", "ft.p.date");
  if ((p.relation === "father" || p.relation === "mother") && l.age >= 12) add("lore", "ฟังเรื่องตระกูล", "ft.p.lore");
  return out;
}



export { SCENES as BOND_EVENTS };

export function loadBonds() {
  personActionHooks.fantasy = fantasyPersonActions;
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive) return;
    // คนในปาร์ตี้ที่ห่างเหินเกินไปแยกทางเอง
    for (const p of partyOf(l)) {
      if (p.bond < 25 && chance(l, 0.5)) {
        p.tags = p.tags?.filter((t) => !t.startsWith("party:"));
        p.job = undefined;
        p.relation = "friend";
        log(l, `${shortName(p)}ทิ้งจดหมายสั้นๆ ไว้แล้วออกจากปาร์ตี้ไปหาทางของตัวเอง`, "bad");
      }
    }
    // เพื่อนในปาร์ตี้ผูกพันกันมากกว่าเพื่อนทั่วไป: ไม่ห่างเหินเร็ว
    for (const p of partyOf(l)) p.bond = clamp(p.bond + randInt(l, 1, 3), 0, 100);
  });
}
