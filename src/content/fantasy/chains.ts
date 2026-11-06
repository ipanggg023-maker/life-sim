// เส้นเรื่องที่ต่อกันหลายตอน (คู่ปรับในโรงเรียน ราชสำนัก สมาคม): ตอนต่อไปมาหลังช่วงเว้นที่สุ่ม
// บางตอนไม่มาเลย และบางตอนไปอีกทางตามชีวิตที่เปลี่ยนไป (ดีกันแล้ว เปลี่ยนงาน ย้ายแผ่นดิน)
import type { GameEvent } from "../../engine/events";
import { eligibilityFilters, lifeHash } from "../../engine/events";
import { choiceHooks } from "../../engine/game";
import type { Life } from "../../engine/types";
import { clamp, shortName } from "../../engine/util";
import { B, C, E, G, K, N } from "./kit";
import { leftPath as leftThePath, madePeace as rivalMadePeace, rivalOf } from "./schoollife";
import { fl } from "./state";

/** กลุ่มของเส้นเรื่อง: ตอนในกลุ่มเดียวกันไม่มาติดกันทุกปี */
export const CHAINS: Record<string, RegExp> = {
  school: /^ft\.s\.(rival_talk|rival_return|rival_friend|rival_letter|secret)$/,
  court: /^ft\.so\.(plot|regent|secret|secret_job|secret_plot|rebel|rebel_job|uprising|sneer|heresy|holywar)$/,
  trade: /^ft\.c2\.(biz_rival|guildrule|apprentice|turn|patron_feud|bossfall)$/,
};
/** ช่วงเว้นระหว่างตอน 1–4 ปี (สุ่มต่อชีวิตและต่อตอน) · หนึ่งในห้าของตอนต่อไม่มาเลยในชีวิตนั้น */
export const CHAIN_GAP: [number, number] = [1, 4];
export const CHAIN_SKIP_ONE_IN = 5;
const groupOf = (id: string) => Object.keys(CHAINS).find((g) => CHAINS[g].test(id));
const lastKey = (g: string) => `ftChain_${g}`;
export const chainGap = (l: Life, g: string) => CHAIN_GAP[0] + (lifeHash(l, `chain.${g}.${Number(l.flags[`ftChainN_${g}`] ?? 0)}`) % (CHAIN_GAP[1] - CHAIN_GAP[0] + 1));
/** ตอนนี้มาได้ไหมปีนี้ */
export function chainOpen(l: Life, e: GameEvent): boolean {
  const g = groupOf(e.id);
  if (!g) return true;
  // ตอนที่ข้ามไปในชีวิตนี้ (ไม่ใช่ตอนแรกที่เคยเจอแล้ว)
  if ((l.seen[e.id] ?? 0) === 0 && lifeHash(l, `skip.${e.id}`) % CHAIN_SKIP_ONE_IN === 0) return false;
  const last = l.flags[lastKey(g)];
  return last === undefined || l.age - Number(last) >= chainGap(l, g);
}

// ───────────── คู่ปรับสมัยเรียนกลับมาในแบบที่ชีวิตพาไป ─────────────
const rivalName = (l: Life) => { const r = rivalOf(l); return r ? shortName(r) : "คู่ปรับ"; };
const grad = (l: Life) => !!fl(l).graduated && !!rivalOf(l)?.alive;
const bump = (l: Life, n: number) => { const r = rivalOf(l); if (r) r.bond = clamp(r.bond + n, 0, 100); };

export const CHAIN_EVENTS: GameEvent[] = [
  E("ft.s.rival_friend", [24, 80], (l) => `${rivalName(l)} คู่ปรับที่กลายเป็นเพื่อนตั้งแต่คืนบนหลังคาหอพัก เขียนจดหมายมา เขากำลังจะเปิดสำนักของตัวเอง และอยากให้ชื่อคุณอยู่บนป้ายด้วย`, [
    C("ไปร่วมเปิดสำนักกับเขา", G((l) => `ป้ายสำนักมีชื่อคุณกับ${rivalName(l)}เคียงกัน ศิษย์รุ่นแรกเรียกคุณว่าอาจารย์ทั้งที่คุณยังไม่ได้สอนอะไร`, { fame: 5, joy: 5 }, (l) => bump(l, 10)), { cons: "ชื่อเสียงเพิ่ม" }),
    K("ช่วยเขาวางแผนการเงินของสำนักแทน", "smarts", 50, G("ตัวเลขของคุณทำให้สำนักอยู่รอดผ่านปีแรก เขาส่งส่วนแบ่งเล็กๆ มาให้ทุกปี", { gold: 25 }, (l) => bump(l, 6)), B("แผนของคุณผิดไปหนึ่งหลัก สำนักขาดทุนปีแรก และเขาไม่พูดถึงมันอีก", { joy: -3 })),
    C("ขอบคุณแต่บอกว่าทางของคุณอยู่ที่อื่น", N((l) => `${rivalName(l)}ตอบกลับสั้นๆ ว่าเข้าใจ ป้ายสำนักมีแต่ชื่อเขาคนเดียว`, {})),
  ], { when: (l) => grad(l) && rivalMadePeace(l) && !leftThePath(l), weight: 10, maxTimes: 1, title: "เพื่อนจากโรงเรียน" }),
  E("ft.s.rival_letter", [24, 80], (l) => `${rivalName(l)} คู่ปรับสมัยเรียน ผ่านมาที่ร้านของคุณ เขาจำคุณได้ทั้งที่คุณไม่ได้จับดาบหรือไม้คทามาหลายปี "ข้าเคยคิดว่าเจ้าจะเป็นคนเดียวที่ข้าเอาชนะไม่ได้"`, [
    C("หัวเราะแล้วชวนเขานั่งลง", G((l) => `${rivalName(l)}นั่งดูคุณทำงานทั้งบ่าย แล้วบอกว่าอิจฉาชีวิตแบบนี้มากกว่าที่คิด`, { joy: 6 }, (l) => bump(l, 12))),
    K("ท้าเขาด้วยงานของคุณแทนการประลอง", "smarts", 45, G("เขาทำตามที่คุณสอนไม่ได้แม้แต่ครึ่ง แล้วยอมรับแพ้เป็นครั้งแรกในชีวิต", { fame: 3, joy: 4 }, (l) => bump(l, 6)), B("เขาทำได้ดีกว่าที่คิด และหัวเราะใส่คุณเหมือนสมัยเรียน", { joy: -2 })),
    C("บอกว่าไม่อยากพูดถึงสมัยนั้นอีก", N("เขาพยักหน้า แล้วซื้อของชิ้นเล็กๆ ก่อนจากไปโดยไม่พูดอะไรอีก", {})),
  ], { when: (l) => grad(l) && leftThePath(l), weight: 10, maxTimes: 1, title: "คู่ปรับที่ร้าน" }),
];

export function loadChains() {
  eligibilityFilters.push((l, e) => l.worldId !== "fantasy" || chainOpen(l, e));
  // จำปีของตอนล่าสุดในแต่ละกลุ่ม
  choiceHooks.push((l, _c, _ctx, _ok, id) => {
    if (l.worldId !== "fantasy" || !id) return;
    const g = groupOf(id);
    if (!g || l.flags[lastKey(g)] === l.age) return;
    l.flags[lastKey(g)] = l.age;
    l.flags[`ftChainN_${g}`] = Number(l.flags[`ftChainN_${g}`] ?? 0) + 1;
  });
}
