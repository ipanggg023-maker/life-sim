// เฟส B — ดราม่าความรัก (ROADMAP: คำตัดสินของผู้เล่น)
// รักต้องห้ามกับคนต่างสำนัก/ลูกศัตรู · นอกใจ มือที่สาม หึงหวง (ทั้งเราและคู่ของเรา) · คลุมถุงชน/แต่งงานทางการเมือง
// ความรักเพศเดียวกัน — มีได้ เป็นได้ แต่ยุคนั้นไม่ยอมรับอย่างเปิดเผย: พิธีลับ คำครหา แรงกดดันเรื่องทายาท และการรับเลี้ยงลูก
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { feel, relOf, remember } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { createPerson, people, shortName } from "../../../engine/util";
import { B, BIG, C, E, FIGHT, G, K, N, near, type Res } from "../story/kit";
import { plantSeed } from "./seedStore";

const alive = (p?: Person) => !!p && p.alive;
const spouse = (l: Life) => people(l, "spouse").find((p) => p.alive);
const partner = (l: Life) => people(l, "partner").find((p) => p.alive);
const mate = (l: Life) => spouse(l) ?? partner(l);
const tags = (p: Person) => (p.tags ??= []);
const tag = (p: Person, t: string) => { if (!tags(p).includes(t)) tags(p).push(t); };
const untag = (p: Person, t: string) => { p.tags = tags(p).filter((x) => x !== t); };
const byTag = (l: Life, t: string) => l.people.find((p) => p.alive && p.tags?.includes(t));
const P_ = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
/** คนในฉาก — ถ้าฉากถูกเปิดโดยไม่มีคน (เช่น ทดสอบ/เซฟเก่า) ให้สร้างคนที่เหมาะกับเรื่องขึ้นมา */
const ensure = (l: Life, c: Ctx): Person => { let p = P_(l, c); if (!p) { p = createPerson(l, "friend", { gender: loveGender(l), age: l.age + randInt(l, -3, 3), bond: 45 }); c.pid = p.id; } return p; };
const nm = (l: Life, c: Ctx) => { const p = P_(l, c); return p ? shortName(p) : "เขา"; };
const sameSex = (l: Life, p?: Person) => !!p && p.gender === l.gender;
const other = (l: Life) => (l.gender === "m" ? "f" : "m");
/** คนที่ผู้เล่นมักจะชอบ (เคยรักเพศเดียวกัน = มีโอกาสพบคนเพศเดียวกันมากขึ้น) */
const loveGender = (l: Life) => (l.flags.lovesSameSex && chance(l, 0.7) ? l.gender : other(l));
const parentsAlive = (l: Life) => people(l, "father").some((p) => p.alive) || people(l, "mother").some((p) => p.alive);

/** ผลลัพธ์ที่ทำอะไรบางอย่างกับคนในฉากก่อน */
const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign((l: Life, c: Ctx) => { f(l, c); return r(l, c); }, { fx: r.fx });
/** เลิก/หย่า */
function part(l: Life, p: Person, why: string) {
  p.relation = "friend";
  p.bond = Math.min(p.bond, 15);
  tag(p, "ex");
  feel(p, { love: -40, grudge: 25 });
  remember(l, p, "left_me", why, 3, {}, true);
}
/** แต่งงาน (เพศเดียวกัน = พิธีลับ ไม่มีใครรับรอง) */
export function wed(l: Life, p: Person) {
  p.relation = "spouse";
  p.bond = Math.min(100, p.bond + 15);
  if (sameSex(l, p)) { tag(p, "secret_union"); l.flags.lovesSameSex = true; }
}

// ───────── ทุกปี: ความลับเรื่องนอกใจถูกเปิดโปง · คู่ของเรานอกใจ · แรงกดดันต่อคู่เพศเดียวกัน ─────────
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || l.age < 16) return;
  const lover = byTag(l, "secret_lover");
  const sp = spouse(l);
  if (lover && sp && !l.flags.affairFound && chance(l, 0.18)) l.flags.affairFound = lover.id;
  if (sp && !l.flags.spouseAffair && !sp.tags?.includes("secret_union")) {
    const r = relOf(sp);
    const cold = r.love < 35 || r.trust < 25;
    if (chance(l, cold ? 0.05 : 0.008)) l.flags.spouseAffair = sp.id;
  }
  if (!lover && sp && l.age >= 22 && l.age <= 60 && !l.flags.temptedAge) l.flags.temptedAge = l.age + randInt(l, 2, 12);
});

export const ROMANCE_EVENTS: GameEvent[] = [
  // ───────── รักต้องห้าม ─────────
  E("lv.enemy_meet", [16, 45], (l, c) => `กลางงานเทศกาลโคมไฟ คุณช่วยดับไฟที่ลุกติดแขนเสื้อของ${nm(l, c)} — ตอนรู้ว่าเขา/เธอเป็นศิษย์สายตรงของสำนักที่เป็นศัตรูกับฝ่ายของคุณมาสามชั่วคน หัวใจคุณก็ไม่ยอมเต้นช้าลงแล้ว`, [
    C("แอบนัดพบกันอีก", act(G("พวกคุณพบกันใต้สะพานหินทุกคืนเดือนเพ็ญ — ไม่มีใครรู้ ยกเว้นดวงจันทร์", { joy: 8 }), (l, c) => { const p = ensure(l, c); p.relation = "partner"; p.bond = 70; tag(p, "forbidden"); feel(p, { love: 40, trust: 20 }); if (sameSex(l, p)) l.flags.lovesSameSex = true; })),
    C("เดินจากไป — โลกของเราไม่ใช่โลกเดียวกัน", N("คุณไม่หันกลับไปมอง — แต่ใบหน้าใต้แสงโคมนั้นตามคุณไปหลายปี", { joy: -2 })),
  ], { prepare: (l) => { const p = createPerson(l, "friend", { gender: loveGender(l), age: l.age + randInt(l, -3, 3), bond: 45 }); tag(p, "enemy_sect"); return { pid: p.id }; }, when: (l) => !mate(l) && !!l.power, weight: 6, maxTimes: 1, title: "โคมไฟกับศัตรู" }),
  E("lv.forbidden_found", [16, 70], (l, c) => `อาจารย์ของคุณวางจดหมายรักที่คุณเขียนถึง${nm(l, c)}ลงบนโต๊ะ — ทั้งสำนักรู้แล้ว "เลือกมา จะเลิก หรือจะออกจากสำนักไปเป็นคนทรยศ"`, [
    C("ยอมเลิก", act(B("คุณเผาจดหมายต่อหน้าอาจารย์ — คืนนั้นคุณนั่งอยู่ใต้สะพานหินคนเดียวจนฟ้าสาง", { joy: -12 }), (l, c) => { const p = P_(l, c); if (p) part(l, p, "เลิกกันเพราะคำสั่งของสำนัก"); })),
    C("หนีไปด้วยกัน", act(BIG("คุณกับคนรักหายไปในคืนเดียวกัน — ทั้งสองสำนักประกาศตามล่า แต่คุณมีกันและกัน", { joy: 10, fame: -6, flag: "eloped" }), (l, c) => { const p = P_(l, c); if (p) wed(l, p); if (l.power) delete l.power.guild; if (l.job?.careerId === "disciple") l.job = undefined; plantSeed(l, "betrayed", "สำนักที่คุณทิ้งไป"); })),
    K("ไปขอความเห็นใจจากเจ้าสำนักทั้งสองฝ่าย", "looks", 65, act(BIG("ใช้เวลาหนึ่งปีเต็ม — งานแต่งของคุณกลายเป็นงานแรกในรอบร้อยปีที่ทั้งสองสำนักนั่งโต๊ะเดียวกัน", { fame: 8, joy: 10 }), (l, c) => { const p = P_(l, c); if (p) wed(l, p); }), act(B("เจ้าสำนักฝ่ายนั้นถือว่าเป็นการดูหมิ่น — คนรักของคุณถูกขังในสำนักของตัวเอง", { joy: -10 }), (l, c) => { const p = P_(l, c); if (p) part(l, p, "ถูกขังเพราะความรักที่ไม่มีใครยอมรับ"); })),
  ], { prepare: (l) => ({ pid: byTag(l, "forbidden")?.id ?? "" }), when: (l) => !!byTag(l, "forbidden") && byTag(l, "forbidden")!.relation === "partner", weight: 9, maxTimes: 1, title: "จดหมายบนโต๊ะอาจารย์" }),
  E("lv.foe_child", [16, 60], (l, c) => `${nm(l, c)}ลูกของคนที่คุณแค้นที่สุด มาหาคุณกลางดึกด้วยตาแดงก่ำ "ข้าไม่ใช่พ่อข้า — ข้ามาเพราะทนเห็นท่านสองคนฆ่ากันไม่ได้อีกแล้ว"`, [
    C("รับความรู้สึกของเขา/เธอ", act(G("ความแค้นสิบปีกับความรักหนึ่งคืน — คุณไม่รู้ว่าอันไหนหนักกว่า", { joy: 6 }), (l, c) => { const p = ensure(l, c); p.relation = "partner"; p.bond = 65; tag(p, "forbidden"); feel(p, { love: 40 }); })),
    C("ใช้เขา/เธอเป็นเครื่องมือล้างแค้น", act(B("คุณยิ้มรับ แล้ววางแผนในใจ — เขา/เธอไม่เคยรู้ว่ารักครั้งแรกของตัวเองคือกับดัก", { align: -8 }), (l, c) => { const p = ensure(l, c); p.relation = "partner"; tag(p, "used_for_revenge"); l.flags.revengeBait = p.id; })),
    C("ส่งกลับไป", N("ประตูปิดลงเบาๆ — คุณไม่ได้นอนอีกเลยคืนนั้น")),
  ], { prepare: (l) => { const p = createPerson(l, "friend", { gender: loveGender(l), age: l.age + randInt(l, -4, 2), bond: 40 }); tag(p, "foe_child"); return { pid: p.id }; }, when: (l) => !mate(l) && l.people.some((p) => p.alive && relOf(p).grudge >= 60), weight: 5, maxTimes: 1, title: "ลูกของศัตรู" }),

  // ───────── นอกใจ มือที่สาม หึงหวง ─────────
  E("lv.temptation", [20, 65], (l, c) => `${nm(l, c)}ที่เพิ่งย้ายมาอยู่ข้างบ้าน ยิ้มให้คุณทุกเช้า — วันนี้ยื่นห่อขนมให้พร้อมกระดาษพับเล็กๆ "คืนนี้ข้าอยู่คนเดียว"`, [
    C("ไปตามนัด", act(N("คืนนั้นคุณกลับบ้านตอนตีสาม — ความลับแรกที่คุณมีต่อคู่ชีวิต", { joy: 6, align: -3 }), (l, c) => { const p = ensure(l, c); p.relation = "friend"; tag(p, "secret_lover"); feel(p, { love: 35 }); if (sameSex(l, p)) l.flags.lovesSameSex = true; })),
    C("ทิ้งกระดาษลงเตาไฟ", G("คุณกลับไปกินข้าวกับคู่ชีวิตตามปกติ — ห่อขนมยังวางอยู่บนโต๊ะ ไม่มีใครแตะ", { align: 2 })),
    C("เล่าให้คู่ชีวิตฟังตรงๆ", act(G("คู่ของคุณหัวเราะก่อน แล้วก็หึง แล้วก็กอดคุณแน่นกว่าทุกคืน", { joy: 4 }), (l) => { const s = spouse(l); if (s) feel(s, { trust: 15, love: 8 }); })),
  ], { prepare: (l) => { const p = createPerson(l, "friend", { gender: loveGender(l), age: l.age + randInt(l, -8, 2), bond: 45 }); return { pid: p.id }; }, when: (l) => !!spouse(l) && !byTag(l, "secret_lover") && Number(l.flags.temptedAge ?? 999) <= l.age, weight: 8, maxTimes: 2, title: "ห่อขนมกับกระดาษพับ" }),
  E("lv.affair_found", [20, 90], (l, c) => `${spouse(l) ? shortName(spouse(l)!) : "คู่ชีวิต"}โยนผ้าเช็ดหน้าที่ปักชื่อ${nm(l, c)}ลงตรงหน้าคุณ — มือสั่น เสียงไม่สั่น "บอกความจริงมา"`, [
    K("คุกเข่าขอโทษ สาบานจะเลิก", "looks", 55, act(G("คู่ของคุณร้องไห้ทั้งคืน แล้วให้โอกาสอีกครั้ง — บ้านนั้นไม่เหมือนเดิม แต่ยังเป็นบ้าน", { joy: -4 }), (l, c) => { const lv = P_(l, c); if (lv) { untag(lv, "secret_lover"); feel(lv, { grudge: 30, love: -20 }); } const s = spouse(l); if (s) feel(s, { trust: -25, love: -10 }); }), act(B("คู่ของคุณเก็บของกลับบ้านพ่อแม่ในคืนนั้น", { joy: -12 }), (l) => { const s = spouse(l); if (s) part(l, s, "ทิ้งคุณไปเพราะคุณนอกใจ"); })),
    C("เลือกคนรักลับ หย่ากับคู่ชีวิต", act(BIG((l, c) => `คุณเดินออกจากบ้านไปหา${nm(l, c)} — ทั้งหมู่บ้านนินทาไปอีกสามปี`, { fame: -5, joy: 2 }), (l, c) => { const s = spouse(l); if (s) part(l, s, "ถูกทิ้งเพื่อคนอื่น"); const lv = P_(l, c); if (lv) { untag(lv, "secret_lover"); wed(l, lv); } })),
    C("ปฏิเสธทุกอย่าง", act(B("คู่ของคุณมองหน้าคุณนาน แล้วเงียบ — ความเงียบนั้นอยู่ในบ้านไปอีกหลายปี", { joy: -6, align: -2 }), (l) => { const s = spouse(l); if (s) feel(s, { trust: -40, grudge: 30 }); })),
  ], { prepare: (l) => ({ pid: String(l.flags.affairFound ?? "") }), when: (l) => !!l.flags.affairFound && alive(l.people.find((p) => p.id === l.flags.affairFound)) && !!spouse(l), forced: true, weight: 50, maxTimes: 0, title: "ผ้าเช็ดหน้าปักชื่อ" }),
  E("lv.spouse_cheats", [20, 90], (l, c) => `คุณกลับบ้านเร็วกว่ากำหนด — ได้ยินเสียงหัวเราะของ${nm(l, c)}จากในห้อง กับเสียงของอีกคนที่คุณไม่รู้จัก`, [
    FIGHT("พังประตูเข้าไป", "ชู้รักของคู่ชีวิต", near(0), { lethal: false, intro: "เขากระโดดออกทางหน้าต่าง แต่คุณตามทัน" }),
    C("หย่า", act(N("คุณเขียนหนังสือหย่าในคืนนั้นด้วยมือที่นิ่งกว่าที่คิด", { joy: -10 }), (l, c) => { const p = P_(l, c); if (p) part(l, p, "ถูกจับได้ว่านอกใจ"); })),
    C("ทำเป็นไม่รู้ แต่หาทางแก้แค้นเงียบๆ", act(N("คุณยิ้มตอนกินข้าวเย็น — ทั้งบ้านไม่รู้ว่าพายุกำลังก่อตัว", { align: -3 }), (l, c) => { const p = P_(l, c); if (p) feel(p, { fear: 10 }); l.flags.temptedAge = l.age; })),
    K("นั่งคุยกันตรงๆ ว่าเกิดอะไรขึ้นกับเรา", "smarts", 55, act(G("คุณได้ยินเรื่องที่ไม่เคยฟังมาตลอดสิบปี — ทั้งคู่ร้องไห้ และเริ่มต้นใหม่ช้าๆ", { joy: 2 }), (l, c) => { const p = P_(l, c); if (p) feel(p, { love: 15, trust: 10 }); }), act(B("การคุยจบด้วยถ้วยชาที่แตก", { joy: -6 }), (l, c) => { const p = P_(l, c); if (p) part(l, p, "ทะเลาะกันจนแตกหัก"); })),
  ], { prepare: (l) => ({ pid: String(l.flags.spouseAffair ?? "") }), when: (l) => !!l.flags.spouseAffair && alive(l.people.find((p) => p.id === l.flags.spouseAffair && p.relation === "spouse")), forced: true, weight: 50, maxTimes: 0, title: "เสียงในห้อง" }),
  E("lv.love_rival", [16, 50], (l, c) => `จอมยุทธ์มีชื่อคนหนึ่งมาสู่ขอ${nm(l, c)}คนรักของคุณต่อหน้าครอบครัวเขา/เธอ — แล้วหันมาท้าคุณ "ถ้ารักจริง ก็ชนะข้าให้ได้"`, [
    FIGHT("รับคำท้า", "คู่แข่งหัวใจ", near(1), { intro: "ครอบครัวของคนรักยืนดูอยู่ทั้งบ้าน" }),
    C("ให้คนรักเป็นคนเลือก", act(Object.assign((l: Life, c: Ctx) => (chance(l, Math.min(0.9, (P_(l, c)?.bond ?? 50) / 100)) ? G("คนรักจับมือคุณต่อหน้าทุกคน — คู่แข่งเดินจากไปเงียบๆ", { joy: 8 })(l, c) : B("คนรักก้มหน้า แล้วก้าวไปยืนข้างเขา", { joy: -12 })(l, c)), { fx: {} }), (l, c) => { const p = P_(l, c); if (p) feel(p, { trust: 10 }); })),
    C("ถอยให้ — เขามีอนาคตมากกว่า", act(B("คุณยิ้มอวยพรทั้งที่ข้างในแตกเป็นเสี่ยง", { joy: -10, align: 2 }), (l, c) => { const p = P_(l, c); if (p) part(l, p, "คุณถอยให้คนอื่น"); })),
  ], { prepare: (l) => ({ pid: partner(l)?.id ?? "" }), when: (l) => !!partner(l) && !sameSex(l, partner(l)), weight: 5, maxTimes: 1, title: "คู่แข่งหัวใจ" }),
  E("lv.jealous", [18, 70], (l, c) => `${nm(l, c)}เห็นคุณคุยหัวเราะกับเพื่อนต่างเพศนานเกินไปในตลาด — คืนนั้นจานข้าวถูกวางลงแรงกว่าปกติ`, [
    C("อธิบายทีละเรื่องจนเขา/เธอสบายใจ", act(G("คุณเล่าทั้งหมด — คนรักของคุณหัวเราะออกมาในที่สุด แต่บอกว่าจะไปตลาดด้วยทุกครั้งต่อจากนี้", {}), (l, c) => { const p = P_(l, c); if (p) feel(p, { trust: 8 }); })),
    C("โกรธกลับว่าไม่ไว้ใจกัน", act(B("สองคนไม่พูดกันสามวัน", { joy: -5 }), (l, c) => { const p = P_(l, c); if (p) feel(p, { love: -6, trust: -6 }); })),
    C("เลิกคุยกับเพื่อนคนนั้น", act(N("เพื่อนคนนั้นงงว่าทำไมคุณเดินเลี่ยง — บ้านสงบขึ้น โลกของคุณเล็กลง", {}), (l, c) => { const p = P_(l, c); if (p) feel(p, { trust: 12 }); })),
  ], { prepare: (l) => ({ pid: mate(l)?.id ?? "" }), when: (l) => !!mate(l), weight: 5, maxTimes: 3, title: "จานข้าวที่วางแรง" }),

  // ───────── คลุมถุงชน / แต่งงานทางการเมือง ─────────
  E("lv.arranged", [16, 26], (l) => `${people(l, "father").some((p) => p.alive) ? "ท่านพ่อ" : "ท่านแม่"}ประกาศกลางโต๊ะอาหารว่าตกลงกับตระกูล${pick(l, ["หลิว", "เฉิน", "ซุน", "หวัง", "โจว"])}ไว้แล้ว — ให้คุณแต่งงานกับลูกของเขาในฤดูใบไม้ผลิ${partner(l) ? ` ทั้งที่ทุกคนรู้ว่าคุณมี${shortName(partner(l)!)}อยู่แล้ว` : ""}`, [
    C("ทำตามที่พ่อแม่ตกลง", act(N("งานแต่งใหญ่โต แขกสามร้อยคน — คุณเห็นหน้าคู่แต่งงานชัดๆ ครั้งแรกตอนเปิดผ้าคลุมหน้า", { joy: -4, tael: 20 }), (l) => { const p = partner(l); if (p) part(l, p, "คุณแต่งกับคนที่พ่อแม่เลือก"); const s = createPerson(l, "spouse", { gender: other(l), age: l.age + randInt(l, -3, 3), bond: 35 }); tag(s, "arranged"); for (const pa of [...people(l, "father"), ...people(l, "mother")]) pa.bond = Math.min(100, pa.bond + 10); })),
    C("ปฏิเสธต่อหน้าทุกคน", act(B("ท่านพ่อตบโต๊ะจนชามกระเด็น — สองตระกูลเสียหน้า คุณถูกตัดเงินช่วยเหลือจากบ้าน", { joy: -6, fame: -2 }), (l) => { for (const pa of [...people(l, "father"), ...people(l, "mother")]) pa.bond = Math.max(0, pa.bond - 25); })),
    C("หนีไปกับคนรัก", act(BIG("คืนก่อนวันส่งตัว คุณกับคนรักหนีขึ้นเรือข้ามฟาก — ทั้งสองตระกูลประกาศว่าไม่มีลูกคนนี้อีกแล้ว", { joy: 6, fame: -4, flag: ["eloped", "disowned"] }), (l) => { const p = partner(l); if (p) wed(l, p); for (const pa of [...people(l, "father"), ...people(l, "mother")]) pa.bond = 5; }), { show: (l) => !!partner(l) }),
  ], { when: (l) => !spouse(l) && parentsAlive(l) && l.wealth !== "poor", weight: 6, maxTimes: 1, title: "คลุมถุงชน" }),
  E("lv.arranged_heart", [17, 60], (l, c) => `${nm(l, c)}คู่ที่ผู้ใหญ่จัดให้ ไม่เคยพูดกับคุณเกินสามประโยคต่อวันมาตั้งแต่แต่ง — คืนนี้ฝนตกหนัก เขา/เธอนั่งซ่อมหลังคาที่รั่วเหนือเตียงของคุณอยู่คนเดียว`, [
    C("ขึ้นไปช่วย", act(G("พวกคุณเปียกโชกทั้งคู่ — แล้วหัวเราะออกมาพร้อมกันเป็นครั้งแรก", { joy: 6 }), (l, c) => { const p = P_(l, c); if (p) { feel(p, { love: 25, trust: 15 }); p.bond = Math.min(100, p.bond + 20); } })),
    C("ปล่อยให้ทำไป", act(N("หลังคาหยุดรั่ว — ช่องว่างระหว่างพวกคุณไม่หยุด", {}), (l, c) => { const p = P_(l, c); if (p) feel(p, { love: -5 }); })),
  ], { prepare: (l) => ({ pid: l.people.find((p) => p.alive && p.relation === "spouse" && p.tags?.includes("arranged"))?.id ?? "" }), when: (l) => l.people.some((p) => p.alive && p.relation === "spouse" && p.tags?.includes("arranged")), weight: 5, maxTimes: 1, title: "หลังคารั่ว" }),
  E("lv.political", [20, 70], (l) => `${pick(l, ["เจ้าสำนักกระบี่เมฆา", "ประมุขตระกูลถัง", "แม่ทัพชายแดน", "เสนาบดีคลัง"])}ส่งแม่สื่อมาเสนอให้คุณแต่งกับลูกของเขา — ไม่ใช่เพราะรัก แต่เพราะชื่อของคุณมีราคาในยุทธภพแล้ว`, [
    C("ตกลง เพื่ออำนาจและพันธมิตร", act(BIG("งานแต่งที่ทั้งยุทธภพจับตา — คุณได้พันธมิตรที่ทรงพลัง และคู่ชีวิตที่ยังเป็นคนแปลกหน้า", { fame: 8, tael: 60 }), (l) => { const s = spouse(l); const np = createPerson(l, "spouse", { gender: other(l), age: l.age + randInt(l, -6, 2), bond: 30 }); tag(np, "arranged"); tag(np, "political"); if (s) { tag(np, "secondary"); } })),
    C("ปฏิเสธอย่างสุภาพ", N("แม่สื่อกลับไปพร้อมสีหน้าเรียบเฉย — คุณเพิ่งได้ศัตรูทางการเมืองหนึ่งคน", { fame: -1 })),
    K("ต่อรองให้เป็นการผูกมิตรโดยไม่ต้องแต่งงาน", "smarts", 62, G("คุณเสนอให้ลูกของทั้งสองฝ่ายเป็นพี่น้องร่วมสาบานแทน — ฝ่ายนั้นพอใจยิ่งกว่า", { fame: 4 }), B("ฝ่ายนั้นถือว่าคุณดูถูก", { fame: -3 })),
  ], { when: (l) => l.fame >= 45 && l.age >= 20, weight: 5, maxTimes: 1, title: "แต่งงานทางการเมือง" }),

  // ───────── ความรักเพศเดียวกัน ─────────
  E("lv.ss_confide", [16, 50], (l, c) => `${nm(l, c)}เพื่อนที่สนิทที่สุดของคุณ นั่งข้างคุณริมแม่น้ำจนดึก แล้วพูดเสียงสั่น "ข้ารู้ว่าไม่ควร… แต่ข้ารักเจ้ามานานแล้ว ไม่ใช่แบบเพื่อน"`, [
    C("รับความรู้สึกนั้น", act(G("คุณจับมือเขา/เธอไว้ — แม่น้ำไหลไปเงียบๆ ไม่มีใครรู้เรื่องนี้นอกจากคุณสองคน", { joy: 8 }), (l, c) => { const p = ensure(l, c); p.relation = "partner"; p.bond = Math.max(p.bond, 75); feel(p, { love: 40, trust: 20 }); l.flags.lovesSameSex = true; })),
    C("บอกว่ารักแบบเพื่อนเท่านั้น", act(N("เขา/เธอพยักหน้าแล้วยิ้ม — มิตรภาพยังอยู่ แต่ไม่เหมือนเดิมไปอีกนาน", {}), (l, c) => { const p = P_(l, c); if (p) feel(p, { love: -10 }); })),
    C("โกรธ และตัดขาด", act(B("คุณลุกเดินจากไปโดยไม่หันกลับ — เขา/เธอหายไปจากเมืองในเดือนนั้น", { joy: -4, align: -2 }), (l, c) => { const p = P_(l, c); if (p) { p.relation = "friend"; p.bond = 5; feel(p, { love: -30, grudge: 20 }); } })),
  ], { prepare: (l) => ({ pid: l.people.filter((p) => p.alive && p.relation === "friend" && p.gender === l.gender && p.bond >= 55 && Math.abs(p.age - l.age) <= 8).sort((a, b) => b.bond - a.bond)[0]?.id ?? "" }), when: (l) => !mate(l) && l.people.some((p) => p.alive && p.relation === "friend" && p.gender === l.gender && p.bond >= 55 && Math.abs(p.age - l.age) <= 8), weight: 5, maxTimes: 1, title: "ริมแม่น้ำ" }),
  E("lv.ss_union", [18, 80], (l, c) => `คุณกับ${nm(l, c)}อยู่ด้วยกันมาหลายปี — กฎหมายไม่มีทางให้คนเพศเดียวกันแต่งงาน แต่มีหลวงจีนชราที่วัดร้างนอกเมืองยอมจุดธูปให้คนสองคนสาบานต่อฟ้าดิน`, [
    C("สาบานต่อฟ้าดินที่วัดร้าง", act(BIG("ธูปสามดอก สุราสองจอก พยานคนเดียวคือหลวงจีนตาบอด — ไม่มีโลกไหนรับรอง แต่ฟ้าดินรับรู้", { joy: 12 }), (l, c) => { const p = P_(l, c); if (p) wed(l, p); })),
    C("สาบานเป็นพี่น้องร่วมสาบานแทน ให้สังคมยอมรับ", act(G("ทุกคนเรียกคุณสองคนว่าพี่น้องร่วมสาบาน — อยู่บ้านเดียวกันได้โดยไม่มีใครถาม", { joy: 6 }), (l, c) => { const p = P_(l, c); if (p) { p.relation = "spouse"; tag(p, "secret_union"); tag(p, "sworn_cover"); } })),
    C("แยกทางเพื่อให้อีกฝ่ายมีชีวิตปกติ", act(B("คุณบอกเขา/เธอให้ไปแต่งงานกับคนที่ครอบครัวเลือก — แล้วไปยืนดูขบวนแห่จากหลังฝูงชน", { joy: -12 }), (l, c) => { const p = P_(l, c); if (p) part(l, p, "แยกทางเพราะโลกไม่ยอมรับ"); })),
  ], { prepare: (l) => ({ pid: partner(l)?.id ?? "" }), when: (l) => sameSex(l, partner(l)) && l.age >= 18, weight: 6, maxTimes: 1, title: "สาบานต่อฟ้าดิน" }),
  E("lv.ss_pressure", [20, 70], (l, c) => `${pick(l, ["ญาติผู้ใหญ่ในงานไหว้บรรพบุรุษ", "แม่สื่อประจำตำบล", "ศิษย์พี่ในสำนัก"])}พูดเสียงดังต่อหน้าทุกคนว่า "อายุป่านนี้แล้วยังไม่มีทายาท อยู่กับ${nm(l, c)}แบบนั้น ไม่อายบรรพบุรุษหรือ"`, [
    C("ยืนยันต่อหน้าทุกคนว่าคนนี้คือคนรักของข้า", act(BIG("ทั้งงานเงียบกริบ — บางคนเดินหนี บางคนกลับมาจับมือคุณหลังงานเลิก", { fame: -4, joy: 4, align: 2 }), (l, c) => { const p = P_(l, c); if (p) { feel(p, { love: 20, trust: 25 }); untag(p, "sworn_cover"); } l.flags.openSameSex = true; })),
    C("ยิ้ม แล้วเปลี่ยนเรื่อง", N("ทุกคนหัวเราะแล้วลืมไป — ยกเว้นคนรักของคุณที่เดินกลับบ้านเงียบๆ", { joy: -3 })),
    C("รับเลี้ยงเด็กกำพร้าเป็นทายาท", act(G("เด็กชายกำพร้าจากวัดมาอยู่บ้านคุณในเดือนนั้น — ญาติผู้ใหญ่เงียบปาก และบ้านก็มีเสียงหัวเราะเพิ่มขึ้น", { joy: 8 }), (l) => { createPerson(l, "child", { age: randInt(l, 2, 8), bond: 70, lastName: l.lastName }).tags = ["adopted"]; })),
  ], { prepare: (l) => ({ pid: mate(l)?.id ?? "" }), when: (l) => sameSex(l, mate(l)) && l.age >= 20, weight: 4, maxTimes: 3, title: "คำครหา" }),
];

// ฉากถูกจับได้ (ทั้งสองทาง): เลือกแล้วเรื่องนี้จบ — ล้างธง
for (const id of ["lv.affair_found", "lv.spouse_cheats"]) {
  const flag = id === "lv.affair_found" ? "affairFound" : "spouseAffair";
  for (const ch of ROMANCE_EVENTS.find((e) => e.id === id)!.choices!) {
    const run = ch.run;
    ch.run = (l, c, ok) => { delete l.flags[flag]; return run(l, c, ok); };
  }
}
yearHooks.push((l) => {
  if (l.worldId !== "murim") return;
  if (l.flags.affairFound && !l.people.some((p) => p.id === l.flags.affairFound && p.alive && p.tags?.includes("secret_lover"))) delete l.flags.affairFound;
  if (l.flags.spouseAffair && !l.people.some((p) => p.id === l.flags.spouseAffair && p.alive && p.relation === "spouse")) delete l.flags.spouseAffair;
});
