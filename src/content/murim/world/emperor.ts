// เมื่อผู้เล่นขึ้นเป็นฮ่องเต้เอง — เดิมระบบยังมองคุณเป็นขุนนาง: ชื่อในราชสำนักใช้แค่ชื่อตัว เรื่องของขุนนาง (หาผู้อุปถัมภ์ ถูกเรียกตัว ถูกฎีกาฟ้องต่อหน้าพระพักตร์) ยังเกิด
// และลูกของคุณไม่เคยเป็นองค์ชาย · ไฟล์นี้: พระนามเต็มของคุณ · ลูกคือองค์ชาย/องค์หญิง และรัชทายาทคือคนที่คุณแต่งตั้ง · เรื่องของคนที่นั่งบัลลังก์จริงๆ
import type { Ctx, GameEvent } from "../../../engine/events";
import { eligibilityFilters } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import type { Life, Person } from "../../../engine/types";
import { clamp, displayName, people, shortName } from "../../../engine/util";
import { calYear } from "../life/world";
import { B, BIG, C, E, G, K, N, P, PAY, ab, nm, withPerson, type Res } from "../story/kit";
import { courtOf } from "./court";
import { castOf, palaceOf, type PNpc } from "./palace";

/** พระนามของผู้เล่นเมื่อครองราชย์ — ใช้ชื่อเต็ม (แซ่+ชื่อ) ให้จำได้ว่าเป็นตัวเรา */
export const emperorTitle = (l: Life) => `ฮ่องเต้${displayName(l)}`;
export const isEmperor = (l: Life) => l.worldId === "murim" && !!l.flags.emperorSelf;
/** ลูกที่ยังมีชีวิต (องค์ชาย/องค์หญิงของคุณ) เรียงจากโตสุด */
export const royalKids = (l: Life) => people(l, "child").filter((p) => p.alive).sort((a, b) => b.age - a.age);
export const crownHeir = (l: Life): Person | undefined => l.people.find((p) => p.id === l.flags.heirId && p.alive);
const princeName = (p: Person) => `${p.gender === "f" ? "องค์หญิง" : "องค์ชาย"}${shortName(p)}`;

/** ให้ราชสำนักตรงกับความจริงว่าคุณคือฮ่องเต้ (เรียกหลังขึ้นครองราชย์ และทุกปี — ซ่อมเซฟเก่าด้วย) */
export function syncThrone(l: Life) {
  if (!isEmperor(l) || !l.mw) return;
  const c = courtOf(l);
  c.emperor.name = emperorTitle(l);
  c.emperor.age = l.age;
  c.emperor.health = 100;
  c.regent = undefined;
  l.flags.courtRank = 6;
  const h = crownHeir(l);
  c.heir = h ? { name: princeName(h), age: h.age, legit: clamp(60 + h.bond / 4, 0, 100), backer: "ministers" } : undefined;
  // องค์ชายของราชวงศ์เก่าไม่ใช่ทายาทของคุณ · ฮองเฮาและสนมของฮ่องเต้องค์ก่อนไม่ใช่คู่ของคุณ (คู่ชีวิตของคุณคือคนในแท็บคน)
  const p = palaceOf(l);
  p.princes = [];
  for (const n of p.cast) if (n.role === "empress" || n.role === "consort" || n.role === "dowager") n.out = true;
}

/** สละราชสมบัติให้รัชทายาท — คุณเป็นไท่ซ่างหวง ลูกครองราชย์ (ถ้าเล่นต่อเป็นลูกคนนี้ จะเป็นฮ่องเต้ทันที) */
export function abdicate(l: Life, h: Person) {
  const c = courtOf(l);
  const yr = calYear(l);
  c.reigns.push({ name: c.emperor.name, from: c.emperor.since, to: yr, how: `สละราชสมบัติให้${princeName(h)} — เป็นไท่ซ่างหวง` });
  c.emperor = { name: `ฮ่องเต้${h.name}`, age: h.age, temper: "wise", health: 90, since: yr };
  c.heir = undefined;
  delete l.flags.emperorSelf;
  l.flags.abdicatedTo = h.id;
  l.flags.abdicatedAt = yr;
  l.flags.retiredEmperor = true;
  l.flags.courtRank = 0;
  l.flags.palaceAccess = true;
  h.tags = [...(h.tags ?? []).filter((t) => t !== "emperor"), "emperor"];
}

// ขุนนางมีเรื่องของขุนนาง — ฮ่องเต้ไม่ต้องหาผู้อุปถัมภ์ ไม่ถูกเรียกตัว ไม่ถูกฎีกาฟ้องต่อ "พระพักตร์" ตัวเอง
const SUBJECT_ONLY = /^ct\.(?!e_|s_assassin)/;
eligibilityFilters.push((l, e) => !isEmperor(l) || !SUBJECT_ONLY.test(e.id));

// ราชวงศ์ใหม่ค่อยๆ ตั้งมั่น: สิบปีแรกขุนนางและราษฎรค่อยยอมรับ (ถ้าไม่ทำอะไรพัง) — ไม่ได้กันล่ม แค่ไม่ล่มเองโดยไม่มีเหตุ
yearHooks.push((l) => {
  if (!isEmperor(l) || !l.mw || !l.alive) return;
  syncThrone(l);
  const years = calYear(l) - courtOf(l).emperor.since;
  const settle = years < 10 ? 3 : 1;
  legit(l, settle);
  unrest(l, -settle);
});

// ───────── เรื่องของคนบนบัลลังก์ ─────────
const legit = (l: Life, d: number) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + d, 0, 100); };
const unrest = (l: Life, d: number) => { if (l.mw) l.mw.unrest = clamp(l.mw.unrest + d, 0, 100); };
const treasury = (l: Life, d: number) => { const p = palaceOf(l); p.treasury = clamp(p.treasury + d, 0, 100); };
const after = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign((l: Life, c: Ctx) => { const o = r(l, c); f(l, c); return o; }, { fx: r.fx });
const with_ = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign((l: Life, c: Ctx) => { f(l, c); return r(l, c); }, { fx: r.fx });
/** คนในวังที่ทะเยอทะยานที่สุด (ขุนนาง/ขันที/แม่ทัพ) */
const schemer = (l: Life) => castOf(l).filter((n) => n.role === "minister" || n.role === "eunuch" || n.role === "general").sort((a, b) => b.amb + b.inf - (a.amb + a.inf))[0];
const npc = (l: Life, c: Ctx): PNpc | undefined => castOf(l).find((n) => n.id === c.nid);
const kid = (i: number) => (l: Life) => royalKids(l).filter((p) => p.age >= 6)[i];
const appoint = (i: number) => C(
  (l: Life) => { const k = kid(i)(l); return k ? `แต่งตั้ง${princeName(k)} (${k.age} ปี)` : "—"; },
  with_(BIG((l) => `ราชโองการประกาศทั่วแผ่นดิน — ${princeName(crownHeir(l)!)}คือรัชทายาท วันที่คุณสิ้นลม บัลลังก์นี้จะเป็นของลูก`, { fame: 3 }), (l) => { const k = kid(i)(l)!; l.flags.heirId = k.id; syncThrone(l); legit(l, 4); }),
  { show: (l) => !!kid(i)(l) },
);

export const EMPEROR_EVENTS: GameEvent[] = [
  E("ct.e_heir", [22, 100], (l) => `ขุนนางทั้งท้องพระโรงคุกเข่าขอให้คุณแต่งตั้งรัชทายาท — ราชวงศ์ที่ไม่มีผู้สืบทอดคือราชวงศ์ที่คนรอวันล่ม ลูกของคุณ: ${royalKids(l).filter((p) => p.age >= 6).map((p) => `${princeName(p)} ${p.age} ปี`).join(" · ")}`, [
    appoint(0), appoint(1), appoint(2),
    C("ยังไม่แต่งตั้ง ให้พวกเขาพิสูจน์ตัวเองก่อน", N("ขุนนางถอยออกไปพร้อมสีหน้ากังวล — คืนนั้นแต่ละฝ่ายเริ่มเลือกข้างลูกคนละคน", { joy: -1 })),
  ], { when: (l) => isEmperor(l) && !crownHeir(l) && royalKids(l).some((p) => p.age >= 6) && l.age - Number(l.flags.heirAskedAt ?? -99) >= 5, prepare: (l) => { l.flags.heirAskedAt = l.age; return {}; }, forced: true, weight: 40, maxTimes: 0, title: "แต่งตั้งรัชทายาท" }),

  E("ct.e_adopt", [35, 100], "คุณยังไม่มีลูกที่จะสืบบัลลังก์ — สภาราชวงศ์เสนอให้รับเด็กชายจากสายตระกูลเดียวกันมาเลี้ยงเป็นโอรสบุญธรรม เด็กอายุแปดขวบ ตาใส และไม่รู้เลยว่ากำลังจะถูกพาเข้าวัง", [
    C("รับเป็นโอรสบุญธรรมและรัชทายาท", after(BIG("เด็กน้อยกราบคุณสามครั้งตามที่ขันทีสอน แล้วเงยหน้าถามว่า \"เสด็จพ่อชอบกินอะไร\" — ท้องพระโรงที่เงียบมาหลายปีมีเสียงหัวเราะ", { joy: 6, meet: { rel: "child", age: 8, gender: "m", bond: 55, tag: "adopted" } }), (l, c) => { if (c.pid) l.flags.heirId = c.pid; syncThrone(l); legit(l, 3); })),
    C("ยังไม่ — ข้ายังมีลูกของตัวเองได้", N("สภาราชวงศ์ถอยกลับไป — แต่ข่าวลือว่าบัลลังก์ไร้ผู้สืบทอดเริ่มลอยออกนอกวัง", { joy: -1 })),
  ], { when: (l) => isEmperor(l) && !crownHeir(l) && !royalKids(l).some((p) => p.age >= 6), weight: 6, title: "โอรสบุญธรรม" }),

  E("ct.e_famine", [20, 100], "ฎีกาด่วนจากหัวเมืองตะวันตก: ฝนไม่ตกสองปี ราษฎรกินเปลือกไม้ บางหมู่บ้านไม่เหลือใคร — ท้องพระคลังเหลือพอแค่ซ่อมพระราชวังฤดูร้อนหรือเปิดยุ้งหลวง อย่างใดอย่างหนึ่ง", [
    C("เปิดยุ้งหลวงแจกข้าวทั้งหมด", with_(G("เกวียนข้าวพันเล่มออกจากเมืองหลวง — ราษฎรตั้งโต๊ะธูปบูชาพระนามคุณริมถนน", { fame: 4, align: 3 }), (l) => { treasury(l, -20); legit(l, 8); unrest(l, -10); })),
    K("ส่งขุนนางมือสะอาดไปคุมการแจกเอง", "smarts", 60, with_(G("ขุนนางที่คุณเลือกตัดหัวนายอำเภอที่โกงข้าวสองคนกลางตลาด — ข้าวถึงมือราษฎรครบทุกเม็ด", { fame: 3, align: 2 }), (l) => { treasury(l, -10); legit(l, 6); unrest(l, -8); }), with_(B("ข้าวครึ่งหนึ่งหายระหว่างทาง — ราษฎรรู้ว่ายุ้งหลวงเปิด แต่ไม่ได้กิน ความแค้นยิ่งหนัก", {}), (l) => { treasury(l, -10); unrest(l, 6); })),
    C("ซ่อมพระราชวังก่อน — หัวเมืองต้องช่วยตัวเอง", with_(B("พระราชวังฤดูร้อนงดงามกว่าเดิม — ทางตะวันตกมีคนตั้งตัวเป็นอ๋องและบอกว่าฟ้าทอดทิ้งคุณแล้ว", { align: -4 }), (l) => { legit(l, -10); unrest(l, 15); })),
  ], { when: isEmperor, weight: 8, maxTimes: 3, title: "ฎีกาจากหัวเมือง" }),

  E("ct.e_plot", [20, 100], (l, c) => { const n = npc(l, c); return `องครักษ์เสื้อแพรนำบัญชีลับมาถวาย — ${n ? `${n.name} (${n.title})` : "ขุนนางกลุ่มหนึ่ง"}ประชุมลับกับขุนนางอีกเจ็ดคนทุกคืนเดือนมืด ในบัญชีมีคำว่า "ฟ้าเปลี่ยนได้ครั้งหนึ่ง ก็เปลี่ยนได้อีก"`; }, [
    P("กวาดล้างทั้งกลุ่มในคืนเดียว", ab(0.55, "smarts"), with_(G("ประตูจวนแปดหลังถูกพังพร้อมกันก่อนรุ่งสาง — วันรุ่งขึ้นท้องพระโรงเงียบจนได้ยินเสียงลมหายใจ", { align: -5 }), (l, c) => { const n = npc(l, c); if (n) n.out = true; legit(l, -2); unrest(l, 4); }), with_(B("ข่าวรั่วก่อนทหารไปถึง — ครึ่งหนึ่งหนีไปหัวเมืองและยกทัพประกาศว่าคุณคือทรราช", { align: -3 }), (l) => { unrest(l, 18); legit(l, -8); }), { tone: "danger" }),
    K("แกล้งเปิดช่องให้ลงมือ แล้วจับคาหนังคาเขา", "smarts", 65, with_(BIG("คืนที่พวกเขาบุกห้องบรรทม คนที่นอนอยู่บนเตียงคือองครักษ์ — ทั้งแผ่นดินรู้ว่าฮ่องเต้องค์นี้หลอกไม่ได้", { fame: 5 }), (l, c) => { const n = npc(l, c); if (n) n.out = true; legit(l, 5); }), with_(B("พวกเขาไม่มาตามนัด — แต่รู้แล้วว่าคุณรู้ และเริ่มระวังตัวกว่าเดิม", {}), (l) => unrest(l, 6))),
    C("เรียกมาพบเป็นการส่วนตัว ให้โอกาสกลับใจ", with_(N("เขาคุกเข่าร้องไห้ สาบานต่อฟ้า — ปีต่อมาเขาเป็นขุนนางที่ซื่อสัตย์ที่สุดในราชสำนัก หรืออย่างน้อยก็แสดงได้เก่งที่สุด", { align: 3 }), (l, c) => { const n = npc(l, c); if (n) { n.you.debt = clamp(n.you.debt + 40, 0, 100); n.amb = clamp(n.amb - 20, 0, 100); } })),
  ], { when: (l) => isEmperor(l) && !!schemer(l), prepare: (l) => ({ nid: schemer(l)!.id }), weight: 7, maxTimes: 0, title: "บัญชีลับ" }),

  E("ct.e_general", [20, 100], (l, c) => `${npc(l, c)?.name ?? "แม่ทัพชายแดน"}ชนะศึกติดกันห้าครั้ง ทหารสามหมื่นเรียกเขาว่า "ท่านพ่อ" มากกว่าเรียกคุณว่าฮ่องเต้ — ขุนนางกระซิบว่าเสือที่อิ่มยังเป็นเสือ`, [
    P("เรียกตัวกลับเมืองหลวง มอบตำแหน่งสูงแต่ไร้ทหาร", ab(0.5, "smarts"), with_(G("เขากลับมาพร้อมทหารคุ้มกันแค่ร้อยคน — รับตำแหน่งอย่างสงบ ทัพชายแดนอยู่ในมือแม่ทัพที่คุณเลือกเอง", {}), (l, c) => { const n = npc(l, c); if (n) n.inf = clamp(n.inf - 30, 0, 100); legit(l, 2); }), with_(B("เขาไม่มา — ส่งจดหมายสั้นๆ ว่าชายแดนยังไม่สงบ ทัพสามหมื่นยังอยู่ในมือเขา และตอนนี้ทุกคนรู้ว่าคุณกลัว", {}), (l) => { unrest(l, 12); legit(l, -4); })),
    C("ผูกดองราชวงศ์กับตระกูลของเขา", with_(G("งานแต่งยิ่งใหญ่ที่สุดในรอบสิบปี — แม่ทัพกลายเป็นพ่อตาของราชวงศ์ เสือตัวนี้เฝ้าประตูให้คุณ", {}), (l, c) => { const n = npc(l, c); if (n) { n.backs = "emperor"; n.you.trust = clamp(n.you.trust + 40, -100, 100); } })),
    P("ส่งขันทีไปพร้อมสุราพระราชทาน", ab(0.45, "smarts"), with_(B("แม่ทัพดื่มสุราหน้าทัพเพื่อแสดงความภักดี — ล้มลงก่อนจอกจะวางลง ทหารสามหมื่นยืนนิ่ง ไม่มีใครกล้ายกดาบ", { align: -8 }), (l, c) => { const n = npc(l, c); if (n) n.alive = false; unrest(l, 5); }), with_(B("แม่ทัพเทสุราลงดิน ดินเดือดเป็นฟอง — ทัพสามหมื่นยกตามธงกบฏมุ่งหน้าเมืองหลวง", { align: -6 }), (l) => { unrest(l, 25); legit(l, -10); }), { tone: "danger" }),
  ], { when: (l) => isEmperor(l) && castOf(l).some((n) => n.role === "general" && n.inf >= 45), prepare: (l) => ({ nid: castOf(l).filter((n) => n.role === "general").sort((a, b) => b.inf - a.inf)[0].id }), weight: 7, maxTimes: 2, title: "เสือชายแดน" }),

  E("ct.e_incognito", [20, 90], "คุณแอบออกนอกวังในชุดพ่อค้าผ้า มีองครักษ์ปลอมตัวตามห่างๆ สองคน — ในโรงน้ำชาริมคลอง คนแก่คนหนึ่งเล่าว่านายอำเภอเมืองนี้เก็บภาษีสามเท่าแล้วอ้างว่าเป็นพระราชโองการของคุณ", [
    K("ไปดูที่ว่าการอำเภอด้วยตาตัวเอง", "smarts", 50, with_(BIG("คุณยืนต่อแถวจ่ายภาษีเหมือนชาวบ้าน — วันรุ่งขึ้นนายอำเภอถูกลากออกมาคุกเข่ากลางตลาด ทั้งเมืองเพิ่งรู้ว่าคนที่ยืนต่อแถวเมื่อวานคือใคร", { fame: 5, align: 3 }), (l) => { legit(l, 6); unrest(l, -5); }), with_(B("ลูกน้องนายอำเภอจำองครักษ์ได้ — คุณต้องหนีกลับวังกลางดึก แต่ได้รู้ว่าหัวเมืองเกลียดชื่อคุณแค่ไหน", { hp: -4 }), (l) => unrest(l, 2))),
    C("ฟังเฉยๆ แล้วจดชื่อไว้", with_(N("คุณดื่มชาจนหมดกา — สามเดือนต่อมานายอำเภอคนนั้นถูกย้ายไปชายแดนโดยไม่มีใครรู้เหตุผล", { iq: 1 }), (l) => legit(l, 2))),
    C("กลับวัง — ฮ่องเต้ไม่ควรเสี่ยง", N("กำแพงวังสูงเหมือนเดิม — ข่าวที่ผ่านกำแพงเข้ามาก็ผ่านปากขุนนางมาแล้วเหมือนเดิม")),
  ], { when: isEmperor, weight: 6, maxTimes: 2, title: "ปลอมตัวออกนอกวัง" }),

  E("ct.e_edict", [20, 100], (l) => `ปีที่ ${calYear(l) - courtOf(l).emperor.since + 1} ของรัชกาล — ขุนนางรอฟังว่าคุณจะออกราชโองการอะไร ความชอบธรรมของราชวงศ์: ${l.mw?.legitimacy ?? 50}/100 · ความไม่สงบ: ${l.mw?.unrest ?? 30}/100`, [
    C("ลดภาษีที่นาลงครึ่งหนึ่งสามปี", with_(G("ราษฎรจุดประทัดทั่วแผ่นดิน — ท้องพระคลังผอมลง แต่ไม่มีใครคิดกบฏในปีที่ท้องอิ่ม", { fame: 2 }), (l) => { treasury(l, -15); legit(l, 6); unrest(l, -10); })),
    C("นิรโทษกรรมทั่วแผ่นดิน", with_(G("นักโทษหมื่นคนได้กลับบ้าน — บางคนกลับไปเป็นโจรเหมือนเดิม บางคนกลับไปไถนา", { align: 2 }), (l) => { courtOf(l).edict = "amnesty"; legit(l, 3); })),
    C("ห้ามสำนักยุทธ์รับศิษย์ — อาวุธต้องขึ้นทะเบียน", with_(B("ยุทธภพเดือดดาล — แต่ทุกสำนักรู้แล้วว่าดาบของพวกเขาอยู่ใต้บัลลังก์", { fame: -3 }), (l) => { courtOf(l).edict = "ban_sects"; unrest(l, 6); legit(l, 2); })),
    C("เกณฑ์แรงงานขุดคลองเชื่อมเหนือใต้", with_(N("คลองสายใหม่จะเลี้ยงแผ่นดินไปร้อยปี — แต่คนสามหมื่นตายระหว่างขุด และลูกหลานพวกเขาไม่ลืม", { fame: 4 }), (l) => { treasury(l, 10); unrest(l, 12); legit(l, -2); })),
  ], { when: isEmperor, weight: 8, maxTimes: 4, title: "ราชโองการ" }),

  E("ct.e_old_friend", [25, 100], (l, c) => `${nm(l, c)}เพื่อนเก่าจากสมัยที่คุณยังไม่มีใครรู้จัก ขอเข้าเฝ้า — คุกเข่าห่างบัลลังก์สามสิบก้าวตามกฎ แล้วขอตำแหน่งนายอำเภอให้ลูกชาย "ท่านจำวันที่เราแบ่งหมั่นโถวกันได้ไหม"`, [
    C("ให้ตำแหน่งตามขอ", with_(N("เพื่อนเก่าร้องไห้ขอบคุณ — ขุนนางในท้องพระโรงจดไว้ว่าตำแหน่งในรัชกาลนี้ซื้อได้ด้วยความหลัง", { feel: { love: 15, debt: 25 } }), (l) => legit(l, -3))),
    K("ให้ลูกเขาสอบเข้ารับราชการเหมือนคนอื่น แต่ส่งครูดีไปสอน", "smarts", 50, G("ลูกชายเขาสอบผ่านด้วยตัวเองในสองปี — เพื่อนเก่ากลับมากราบอีกครั้ง คราวนี้ด้วยความภูมิใจ", { feel: { love: 10, trust: 15 }, align: 2 }), N("ลูกชายเขาสอบตก — เพื่อนเก่าไม่มาเข้าเฝ้าอีก", { feel: { love: -10 } })),
    C("ไล่ออกไป — ฮ่องเต้ไม่มีเพื่อน", B("องครักษ์ลากเขาออกไป — คืนนั้นคุณนั่งอยู่บนบัลลังก์คนเดียวนานกว่าทุกคืน", { joy: -6, feel: { love: -40, grudge: 20 } })),
  ], { ...withPerson(["friend"], (p) => p.age >= 25), when: isEmperor, weight: 6, title: "เพื่อนเก่าขอเข้าเฝ้า" }),

  E("ct.e_omen", [20, 100], "แผ่นดินไหวที่เมืองหลวง เสาท้องพระโรงร้าว — บัณฑิตหอดูดาวยื่นฎีกาว่าฟ้าไม่พอใจรัชกาลนี้ ขุนนางครึ่งหนึ่งก้มหน้า อีกครึ่งเงยหน้าดูว่าคุณจะทำอย่างไร", [
    C("ออกราชโองการโทษตัวเอง งดเครื่องเสวยสามเดือน", with_(G("คำประกาศของคุณถูกอ่านทุกหมู่บ้าน — ราษฎรบอกว่าฮ่องเต้ที่รู้จักผิดยังดีกว่าฮ่องเต้ที่ไม่เคยผิด", { align: 3, hp: -2 }), (l) => { legit(l, 7); unrest(l, -4); })),
    C("โยนความผิดให้มหาเสนาบดี ปลดเขาแทน", with_(N("มหาเสนาบดีถูกปลดกลางท้องพระโรง — ฟ้าสงบลง หรืออย่างน้อยขุนนางก็เงียบลง", { align: -3 }), (l) => { const m = castOf(l).filter((n) => n.role === "minister").sort((a, b) => b.inf - a.inf)[0]; if (m) { m.out = true; } legit(l, 2); })),
    C("จับบัณฑิตที่ยื่นฎีกาเข้าคุก", with_(B("หอดูดาวเงียบไปทั้งหอ — และข่าวว่าฮ่องเต้กลัวฟ้า แพร่ออกไปเร็วกว่าราชโองการใดๆ", { align: -4 }), (l) => { legit(l, -6); unrest(l, 5); })),
  ], { when: isEmperor, weight: 6, maxTimes: 2, title: "ฟ้าไม่พอใจ" }),

  E("ct.e_lonely", [40, 100], "คืนหนึ่งคุณนั่งบนบัลลังก์มังกรคนเดียวหลังขุนนางกลับหมดแล้ว — โคมไฟพันดวงสว่างเท่ากลางวัน แต่ไม่มีใครในวังนี้กล้าเรียกชื่อจริงของคุณอีกแล้ว", [
    C("เรียกลูกมานั่งกินข้าวด้วยกันแบบพ่อลูกธรรมดา", G("ลูกนั่งตัวแข็งในตอนแรก แล้วค่อยๆ เล่าเรื่องครูที่เข้มงวด — คุณหัวเราะออกมาครั้งแรกในรอบหลายเดือน", { joy: 8 }), { show: (l) => royalKids(l).length > 0 }),
    C("เขียนชื่อจริงของตัวเองลงบนกระดาษ แล้วเผาทิ้ง", N("ควันลอยขึ้นไปหาหลังคาทอง — ชื่อนั้นยังเป็นของคุณ แม้จะไม่มีใครเรียกแล้ว", { joy: 2 })),
    PAY("ปลอมตัวไปกินบะหมี่ร้านเก่าที่เคยกินสมัยยังจน", 1, G("เจ้าของร้านแก่ลงมาก จำคุณไม่ได้ — แต่ยังเติมน้ำซุปให้ฟรีเหมือนเดิม", { joy: 6 })),
  ], { when: isEmperor, weight: 5, title: "บัลลังก์ยามดึก" }),
];
