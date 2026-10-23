// ทำเนียบยอดฝีมือ (เขียนใหม่) — ใช้ระบบอันดับใน m17core: ท้าขึ้น ถูกท้า ฉายา ตัวปลอม บนสุด และวันวางมือ
// % ทุกตัวมาจาก masterOdds = ฝีมือจริงของคุณเทียบกับยอดฝีมือคนนั้น
import type { Choice, Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, money } from "../../../engine/util";
import { DUEL_END, myPower, startDuel } from "../life/duel";
import { YOUNG_SIZE, myYoungPlace, youngDrop, youngList, youngTake } from "./jianghu";
import { gainExp } from "../../hunter/power";
import {
  EPITHETS, RANK_SIZE, TOP_TEN, type Master, challengeTarget, dropPlace, givePill, hurt, masterAt, masterLabel, masterOdds, masterSurvival, masters, myPlace, npcName, rankOf, shiftAlign, takePlace,
} from "../m17core";

const ranked = (l: Life) => myPlace(l) > 0;
const tgt = (l: Life, c: Ctx): Master => masters(l).find((m) => m.id === c.id) ?? { id: String(c.id), n: String(c.n), e: String(c.e), a: Number(c.a), cp: Number(c.cp) };
const ctxOf = (m: Master, extra: Ctx = {}): Ctx => ({ id: m.id, n: m.n, e: m.e, a: m.a, cp: m.cp, label: masterLabel(m), ...extra });
const place = (p: number) => (p ? `อันดับ ${p} ของทำเนียบ` : "นอกทำเนียบ");
const ok = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

export const RANKING_EVENTS: GameEvent[] = [
  {
    id: "rk.news",
    minAge: 8,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: (l) => !!l.flags.m17News || (!!l.power && rankOf(l) >= 3 && l.age % 4 === 0),
    text: (l) => {
      const top = masters(l).slice(0, 3).map((m, i) => `${i + 1}. ${m.me ? "คุณ" : masterLabel(m)}`).join(" · ");
      const news = String(l.flags.m17News ?? "").split("|").filter(Boolean);
      return `📜 หอบันทึกยุทธภพติดประกาศทำเนียบยอดฝีมือใต้หล้า — ${top}${news.length ? ` | ${news.join(" · ")}` : ""}${myPlace(l) ? ` | ชื่อคุณอยู่${place(myPlace(l))}` : ""}`;
    },
    auto: (l) => { delete l.flags.m17News; return "normal"; },
  },
  {
    id: "rk.glimpse",
    minAge: 6,
    maxAge: 14,
    weight: 5,
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 1, 6)) ?? masters(l)[0]),
    title: "คนดังในร้านน้ำชา",
    text: (_l, c) => `ชายวัยกลางคนสวมงอบนั่งจิบชาอยู่มุมร้าน ผู้ใหญ่ทั้งร้านกระซิบกันว่านั่นคือ ${c.label} หนึ่งในสิบยอดฝีมือใต้หล้า — เขาดูธรรมดามาก เหมือนลุงข้างบ้าน`,
    choices: [
      { label: "ยกกาน้ำชาไปเติมให้", run: (l, c) => { l.flags.m17Idol = String(c.label); addStat(l, "happiness", 5); return ok(`${c.n}มองมือคุณแล้วพูดว่า "มือนิ่งดี" — คุณไม่ล้างมือไปสามวัน`); } },
      { label: "แอบตามไปดูเขาฝึก", check: { stat: "luck", dc: 50 }, run: (l, c, s) => { if (s) { l.flags.m17Idol = String(c.label); addStat(l, "smarts", 2); l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 1; return ok("ริมลำธาร ใบไผ่ทั้งกอร่วงลงพร้อมกันโดยไม่มีลม — ภาพนั้นติดตาคุณทั้งชีวิต"); } return meh(`${c.n}หันมาตอนคุณเหยียบกิ่งไม้ "กลับบ้านไปกินข้าว" — สายตาเดียวทำขาคุณอ่อน`); } },
    ],
  },
  {
    id: "rk.challenge",
    minAge: 16,
    maxAge: 90,
    maxTimes: 0,
    weight: (l) => (!!l.power && challengeTarget(l) && myPower(l) >= challengeTarget(l)!.cp - 20 && Number(l.flags.m17LastChallenge ?? -9) < l.age - 1 ? 8 : 0),
    prepare: (l) => ctxOf(challengeTarget(l)!, { pl: masters(l).findIndex((m) => m.id === challengeTarget(l)!.id) + 1 }),
    title: "ขั้นถัดไปของทำเนียบ",
    text: (l, c) => `${myPlace(l) ? `ตอนนี้คุณอยู่${place(myPlace(l))}` : "ชื่อคุณยังไม่อยู่ในทำเนียบ"} — คนถัดไปคือ ${c.label} อายุ ${c.a} ปี อันดับ ${c.pl} ใครชนะคนนั้น ได้ที่นั่งนั้นไป`,
    choices: [
      {
        label: "ส่งสาส์นท้าบนยอดเขา ถึงตายไม่ว่า", skill: ["combat"],
        tone: "danger",
        odds: (l, c) => masterOdds(l, tgt(l, c)),
        survival: (l, c) => masterSurvival(l, tgt(l, c), 0.1),
        run: (l, c, s) => {
          l.flags.m17LastChallenge = l.age;
          if (s) { const p = takePlace(l, String(c.id)); addFame(l, p <= 3 ? 12 : 6); gainExp(l, 200); return { text: `ปลายอาวุธของคุณหยุดห่างคอ${c.n}เพียงเส้นผม — เขาวางอาวุธลง ชื่อคุณขึ้นเป็น${place(p)}${p <= 3 ? givePill(l, 6) : ""}`, kind: "milestone" }; }
          if (!chance(l, masterSurvival(l, tgt(l, c), 0.1))) { kill(l, `พ่ายต่อ${c.label}บนยอดเขา`); return no(`${c.n}ไม่ยั้งมือ — บนยอดเขานั้น การประลองไม่ใช่เกม`); }
          const to = myPlace(l) ? dropPlace(l, 1) : 0;
          gainExp(l, 120);
          return no(`คุณแพ้ต่อหน้าคนนับพัน${to ? ` ตกไปอยู่อันดับ ${to}` : ""}` + hurt(l, 12, 28, `บาดเจ็บจากการท้า${c.label}`));
        },
      },
      {
        label: "ขอประลองแบบแตะแล้วหยุด", skill: ["combat"],
        odds: (l, c) => masterOdds(l, tgt(l, c), -0.08),
        run: (l, c, s) => {
          l.flags.m17LastChallenge = l.age;
          if (s) { const p = takePlace(l, String(c.id)); addFame(l, 5); gainExp(l, 150); return ok(`ปลายกระบี่ของคุณแตะไหล่${c.n}ก่อน — เขาหัวเราะแล้วคารวะ ชื่อคุณขึ้นเป็น${place(p)}`); }
          gainExp(l, 100);
          return no(`${c.n}แตะหน้าผากคุณสามครั้งก่อนคุณจะแตะเขาได้ครั้งเดียว — แพ้อย่างสะอาด แต่เจ็บใจ`);
        },
      },
      { label: "ยังไม่ถึงเวลา", run: (l) => { gainExp(l, 40); return meh("คุณกลับไปฝึกต่อ — ทำเนียบไม่หนีไปไหน"); } },
    ],
  },
  {
    id: "rk.defend",
    minAge: 18,
    maxAge: 100,
    maxTimes: 0,
    weight: (l) => (ranked(l) ? 5 : 0),
    prepare: (l) => {
      const list = masters(l);
      const me = list.findIndex((m) => m.me);
      return ctxOf(list[me + 1] ?? { id: "outsider", n: npcName(l), e: pick(l, EPITHETS), a: randInt(l, 22, 40), cp: list[me].cp - randInt(l, 0, 12) });
    },
    title: "คำท้าถึงหน้าบ้าน",
    text: (l, c) => `ลูกดอกพร้อมสาส์นปักลงบนประตูบ้าน — ${c.label} ขอชิง${place(myPlace(l))}ของคุณภายในเดือนนี้`,
    choices: [
      {
        label: "รับคำท้า", skill: ["combat"],
        tone: "danger",
        odds: (l, c) => masterOdds(l, tgt(l, c), 0.05),
        survival: (l, c) => masterSurvival(l, tgt(l, c), 0.15),
        run: (l, c, s) => {
          if (s) { addFame(l, 5); gainExp(l, 150); return ok(`คุณปัดกระบวนท่าทั้งหมดของ${c.n}ออกไปได้ — เขาคุกเข่า "ข้ายังไม่ถึง" คุณรักษา${place(myPlace(l))}ไว้ได้`); }
          if (!chance(l, masterSurvival(l, tgt(l, c), 0.15))) { kill(l, `ถูก${c.label}ชิงอันดับ`); return no("ฝ่ามือสุดท้ายหนักเกินกว่าที่ร่างกายจะรับไหว…"); }
          const to = dropPlace(l, 1);
          return no(`${c.n}ชนะ — ${to ? `คุณตกไปอยู่อันดับ ${to}` : "ชื่อคุณหลุดจากทำเนียบ"}` + hurt(l, 8, 20, "บาดเจ็บจากการป้องกันอันดับ"));
        },
      },
      { label: "ไม่รับ — ทำเนียบไม่ใช่ทั้งชีวิต", run: (l) => { const to = dropPlace(l, 1); addFame(l, -4); addStat(l, "happiness", 3); return meh(`ข่าวว่าคุณ "หนี" แพร่ไปทั่ว${to ? ` อันดับตกเป็น ${to}` : " ชื่อหลุดจากทำเนียบ"} — แต่คืนนั้นคุณนอนหลับสบาย`); } },
      { label: "เชิญมาดื่มสุราแล้วตัดสินด้วยหมากล้อม", check: { stat: "smarts", dc: 60 }, run: (l, c, s) => { if (s) { addFame(l, 3); return ok(`คุณชนะหมากล้อมเจ็ดสิบสามตา ${c.n}หัวเราะจนสุรากระเด็น แล้วถอนคำท้า`); } const to = dropPlace(l, 1); return meh(`${c.n}ชนะหมากล้อม และยืนยันว่ามันนับ — หอบันทึกยุทธภพก็เห็นด้วย${to ? ` (อันดับ ${to})` : " (หลุดทำเนียบ)"}`); } },
    ],
  },
  {
    id: "rk.epithet",
    minAge: 16,
    maxAge: 90,
    weight: (l) => (ranked(l) && !!l.flags.m17Epithet ? 10 : 0),
    title: "ฉายา",
    text: (l) => `นักกวีเร่ร่อนแต่งเพลงถึงคุณ ร้องกันในโรงเตี๊ยมทั่วแผ่นดิน — ทุกคนเรียกคุณว่า【${l.flags.m17Epithet}】`,
    choices: [
      { label: "รับไว้", run: (l) => { addStat(l, "happiness", 5); addFame(l, 3); return ok("คุณเลี้ยงสุรานักกวีหนึ่งไห เขาแต่งเพิ่มอีกสามท่อน"); } },
      { label: "ขอให้เรียกว่า【กระบี่ข้าวต้มปลา】แทน", run: (l) => { l.flags.m17Epithet = "กระบี่ข้าวต้มปลา"; addStat(l, "happiness", 8); return meh("ยุทธภพหัวเราะไปครึ่งปี แล้วก็…ติด ร้านข้าวต้มปลาทุกร้านแขวนรูปคุณ"); } },
      { label: "ขอให้เรียกว่า【มารไร้ปรานี】", run: (l) => { l.flags.m17Epithet = "มารไร้ปรานี"; addFame(l, -3); return meh(`โจรภูเขาแตกทัพเมื่อได้ยินชื่อ — แม่ค้าในตลาดก็เริ่มไม่ทอนเงินให้คุณ${shiftAlign(l, -4)}`); } },
    ],
  },
  {
    id: "rk.impostor",
    minAge: 20,
    maxAge: 90,
    weight: (l) => (ranked(l) ? 4 : 0),
    title: "ตัวปลอม",
    text: (l) => `มีคนอ้างตัวเป็น【${l.flags.m17Epithet ?? "คุณ"}】เก็บค่าคุ้มครองจากหมู่บ้านละสิบตำลึง — และใช้ท่าของคุณผิดทุกท่า`,
    choices: [
      { label: "ไปเปิดโปงต่อหน้าชาวบ้าน", check: { stat: "smarts", dc: 50 }, run: (l, _c, s) => { if (s) { addFame(l, 4); return ok("คุณขอให้เขาร่ายท่าที่ 'ตัวเอง' คิด — ผิดตั้งแต่ท่าแรก ชาวบ้านไล่ตีจนตกน้ำ"); } return meh("เขาหนีไปก่อนคุณมาถึง — แต่ก็ไม่กล้ากลับมาอีก"); } },
      { label: "รับเป็นตัวแทน แบ่งเงินครึ่งหนึ่ง", run: (l) => { addMoney(l, 120_000); addFame(l, -6); return meh(`ธุรกิจไปได้สองปี จนตัวปลอมแพ้โจรกระจอก ชื่อคุณพังตาม (ได้ ${money(l, 120_000)})${shiftAlign(l, -5)}`); } },
      { label: "ปล่อยไป", run: (l) => { addStat(l, "happiness", 2); return meh("ปีต่อมามีคนมาขอดูหน้าคุณ แล้วบอกว่า 'ตัวจริงดูสูงกว่านี้'"); } },
    ],
  },
  {
    id: "rk.summit",
    minAge: 30,
    maxAge: 100,
    weight: (l) => (myPlace(l) === 1 ? 6 : 0),
    title: "หนึ่งเดียวใต้หล้า",
    text: () => "คุณอยู่บนสุดของทำเนียบมาหนึ่งปีเต็ม ไม่มีใครกล้าท้า ทุกเช้าคุณฝึกคนเดียวบนยอดเขา — และเริ่มสงสัยว่าเหนือขึ้นไปกว่านี้มีอะไร",
    choices: [
      { label: "ลงจากเขาไปสอนคนรุ่นใหม่", run: (l) => { addFame(l, 4); addStat(l, "happiness", 6); return ok("ที่ลานวัดเล็กๆ มีเด็กสิบคนตั้งท่าม้าตามคุณ — ความเหงาบนยอดเขาหายไปในเสียงหัวเราะ"); } },
      { label: "ตามหาคู่ต่อสู้นอกแผ่นดิน", odds: (l) => Math.min(0.9, 0.4 + rankOf(l) * 0.06), run: (l, _c, s) => { if (s) { gainExp(l, 1500); return { text: "สามปีข้ามทะเลทรายและภูเขาหิมะ — คุณกลับมาพร้อมวิชาที่ไม่มีใครในแผ่นดินเคยเห็น", kind: "milestone" }; } return no("ทะเลทรายไม่เคารพทำเนียบ — คุณกลับมาครึ่งตาย" + hurt(l, 15, 25, "การเดินทางนอกแผ่นดิน")); } },
      { label: "ปิดประตูฝึกจนกว่าจะพบทาง", run: (l) => { gainExp(l, 800); addStat(l, "happiness", -4); return meh("ปีนั้นคุณไม่ได้คุยกับใครเลย — แต่ลมปราณลึกขึ้นอีกชั้น"); } },
    ],
  },
  {
    id: "rk.betting",
    minAge: 18,
    maxAge: 80,
    weight: (l) => (ranked(l) ? 3 : 0),
    title: "บ่อนพนันทำเนียบ",
    text: () => "บ่อนใหญ่ในเมืองหลวงเปิดรับพนันผลการประลองทำเนียบ — เจ้าของบ่อนส่งคนมาเสนอเงินก้อนใหญ่ ถ้าคุณยอม 'แพ้' ในการประลองครั้งหน้า",
    choices: [
      { label: "รับเงิน แล้วแพ้ตามนัด", run: (l) => { addMoney(l, 300_000); const to = dropPlace(l, 2); addFame(l, -5); return meh(`เงินเต็มหีบ — ชื่อคุณตกไป${to ? `อยู่อันดับ ${to}` : "จนหลุดทำเนียบ"} และคนในยุทธภพเริ่มกระซิบ${shiftAlign(l, -6)}`); } },
      { label: "ปฏิเสธ แล้วชนะให้ดู", run: (l) => { addFame(l, 3); return ok(`เจ้าของบ่อนขาดทุนหนัก — และจำชื่อคุณได้${shiftAlign(l, 3)}`); } },
    ],
  },
  {
    id: "rk.retire",
    minAge: 55,
    maxAge: 110,
    weight: (l) => (ranked(l) ? 5 : 0),
    title: "วางมือ",
    text: (l) => `คุณอยู่ในทำเนียบมาหลายปี ร่างกายเริ่มบอกว่าพอแล้ว — คนรุ่นใหม่ที่${place(myPlace(l) + 1)}รออยู่ทุกวัน`,
    choices: [
      { label: "ประกาศวางมือ มอบที่ให้คนรุ่นใหม่", run: (l) => { const to = dropPlace(l, 10); addFame(l, 6); addStat(l, "happiness", 8); l.flags.m17Retired = true; return { text: `คุณถอดชื่อออกจากทำเนียบด้วยตัวเอง${to ? "" : ""} — ยุทธภพจดจำคุณในฐานะคนที่รู้ว่าเมื่อไรควรหยุด`, kind: "milestone" }; } },
      { label: "ยังไม่ถึงเวลา", run: () => meh("คุณตื่นมาฝึกเหมือนทุกเช้า เข่าลั่นดังกว่าเดิม") },
    ],
  },
];

// ───────────────────────── ท้าประลองชิงอันดับ (คำขอของผู้เล่น: ติดทำเนียบยากเกินไป อยากท้าสู้แย่งตำแหน่งได้) ─────────────────────────
// ทั้งทำเนียบมังกรและทำเนียบยอดฝีมือ: เลือกคนที่จะท้าเอง (หนึ่ง สอง หรือสามอันดับเหนือคุณ) แล้วสู้กันจริงในฉากต่อสู้
// ชนะ = ขึ้นไปแทนที่ · แพ้ในการประลองแตะแล้วหยุดไม่เสียอันดับ · ท้าถึงตายแล้วแพ้ = ตกอันดับ (ถ้ารอด)
// คนข้างล่างท้าคุณกลับได้ · ทุกสามปีมีงานประลองชิงทำเนียบมังกร
const sym = (g?: "m" | "f") => (g === "f" ? "♀" : g === "m" ? "♂" : "");
const foeRank = (cp: number) => Math.max(0, (cp - 10) / 12);
const vsOdds = (l: Life, cp: number) => clamp(0.5 + (myPower(l) - cp) / 40, 0.05, 0.95);

/** เป้าหมายในทำเนียบมังกร: k อันดับเหนือคุณ (ยังไม่ติด = ท้ายตาราง) */
function youngTarget(l: Life, k: number) {
  const list = youngList(l);
  const me = myYoungPlace(l);
  const place = me ? me - k : YOUNG_SIZE + 2 - k * 2;
  if (place < 1 || place > list.length) return undefined;
  const y = list[place - 1];
  return y && !y.me ? { y, place } : undefined;
}
function masterTarget(l: Life, k: number) {
  const list = masters(l);
  const me = myPlace(l);
  const place = me ? me - k : RANK_SIZE + 2 - k * 2;
  if (place < 1 || place > list.length) return undefined;
  const m = list[place - 1];
  return m && !m.me ? { m, place } : undefined;
}
const yLabel = (l: Life, k: number) => { const t = youngTarget(l, k); return t ? `ท้า【${t.y.e}】${t.y.n} ${sym(t.y.g)} อันดับ ${t.place} · ${t.y.a} ปี (โอกาส ~${Math.round(vsOdds(l, t.y.cp) * 100)}%)` : "—"; };
const mLabel = (l: Life, k: number) => { const t = masterTarget(l, k); return t ? `ท้า${masterLabel(t.m)} ${sym(t.m.g)} อันดับ ${t.place}${t.place <= TOP_TEN ? " (สิบยอดฝีมือ)" : ""} (โอกาส ~${Math.round(vsOdds(l, t.m.cp) * 100)}%)` : "—"; };

const youngPick = (k: number): Choice => ({
  label: (l) => yLabel(l, k),
  show: (l) => !!youngTarget(l, k),
  skill: [],
  run: (l) => {
    const t = youngTarget(l, k)!;
    l.flags.rkYAt = l.age;
    startDuel(l, { foe: `【${t.y.e}】${t.y.n}`, rank: foeRank(t.y.cp), spar: true, on: "rankY", extra: { pl: t.place } });
    return { text: `คุณส่งสาส์นท้าประลองถึง【${t.y.e}】${t.y.n} — ลานประลองหน้าศาลเจ้าเต็มไปด้วยคนรุ่นเดียวกันที่มาดู` };
  },
});
const masterPick = (k: number): Choice => ({
  label: (l) => mLabel(l, k),
  show: (l) => !!masterTarget(l, k),
  skill: [],
  run: (l, c) => { const t = masterTarget(l, k)!; c.tid = t.m.id; c.pl = t.place; c.cp = t.m.cp; c.foe = masterLabel(t.m); return { text: `คุณเลือก${masterLabel(t.m)} — เหลือแค่ตัดสินใจว่าจะสู้แบบไหน`, next: "how" }; },
});
const masterFight = (lethal: boolean): Choice => ({
  label: lethal ? "ท้าถึงตายบนยอดเขา — ชนะได้ชื่อเสียงมากกว่า" : "ประลองแตะแล้วหยุด — แพ้ก็ไม่เสียอันดับ",
  tone: lethal ? "danger" : undefined,
  skill: [],
  run: (l, c) => {
    l.flags.rkMAt = l.age;
    startDuel(l, { foe: String(c.foe), rank: foeRank(Number(c.cp)), lethal, spar: !lethal, on: "rankM", extra: { tid: String(c.tid), pl: Number(c.pl), lethal } });
    return { text: lethal ? `สาส์นท้าถึงตายถูกส่งถึง${c.foe} — ยุทธภพทั้งแผ่นดินรอฟังผล` : `${c.foe}รับคำท้าด้วยรอยยิ้ม "แตะแล้วหยุด ใครแตะก่อนสามครั้งชนะ"` };
  },
});

DUEL_END.rankY = (l, r, c) => {
  if (r === "win") {
    const to = youngTake(l, Number(c.x_pl));
    addFame(l, to <= 3 ? 6 : 3);
    gainExp(l, 150);
    return `🐉 ชื่อของคุณขึ้นเป็นอันดับ ${to} ของทำเนียบมังกร${to === 1 ? " — บนสุดของคนรุ่นเดียวกันทั้งแผ่นดิน" : ""}`;
  }
  if (r === "lose" || r === "yield") { gainExp(l, 60); return "แพ้อย่างสะอาด — อันดับของคุณไม่เปลี่ยน แต่ทุกคนจำได้ว่าคุณกล้าท้า"; }
  return "";
};
DUEL_END.rankYDef = (l, r) => {
  if (r === "win") { addFame(l, 2); gainExp(l, 120); return `คุณรักษาอันดับ ${myYoungPlace(l)} ของทำเนียบมังกรไว้ได้`; }
  const to = youngDrop(l, 1);
  return to ? `คุณตกไปอยู่อันดับ ${to} ของทำเนียบมังกร` : "ชื่อของคุณหลุดจากทำเนียบมังกร";
};
DUEL_END.rankM = (l, r, c) => {
  if (r === "win") {
    const p = takePlace(l, String(c.x_tid));
    addFame(l, c.x_lethal ? (p <= 3 ? 14 : 8) : p <= 3 ? 8 : 4);
    gainExp(l, 220);
    return `📜 ชื่อคุณขึ้นเป็นอันดับ ${p} ของทำเนียบยอดฝีมือใต้หล้า${p <= TOP_TEN ? " — หนึ่งในสิบยอดฝีมือ" : ""}${p <= 3 ? givePill(l, 6) : ""}`;
  }
  if ((r === "lose" || r === "yield") && c.x_lethal && myPlace(l)) { const to = dropPlace(l, 1); return to ? `ท้าถึงตายแล้วแพ้ — คุณตกไปอยู่อันดับ ${to}` : "ท้าถึงตายแล้วแพ้ — ชื่อคุณหลุดจากทำเนียบ"; }
  if (r === "lose" || r === "yield") { gainExp(l, 80); return "แพ้ — แต่อันดับไม่เปลี่ยน คนที่กล้าท้ายังได้รับความนับถือ"; }
  return "";
};

/** งานประลองชิงทำเนียบมังกร: คู่ต่อสู้ในแต่ละรอบมีฝีมือเท่าคนในทำเนียบอันดับนั้น */
const tCp = (l: Life, place: number) => youngList(l)[Math.min(youngList(l).length, place) - 1]?.cp ?? 60;
const placeIfBetter = (l: Life, place: number) => { const me = myYoungPlace(l); return !me || place < me ? youngTake(l, place) : me; };

export const RANK_CHALLENGE_EVENTS: GameEvent[] = [
  {
    id: "rk.y_menu",
    minAge: 14,
    maxAge: 30,
    manual: true,
    maxTimes: 0,
    title: "ท้าประลองชิงทำเนียบมังกร",
    text: (l) => `${myYoungPlace(l) ? `คุณอยู่อันดับ ${myYoungPlace(l)} ของทำเนียบมังกร` : "ชื่อคุณยังไม่อยู่ในทำเนียบมังกร — ท้าคนท้ายตารางให้ชนะ แล้วชื่อคุณจะขึ้นแทนเขา"} · ท้าสูงกว่าหนึ่งอันดับได้ ถ้าชนะจะข้ามขึ้นไปทันที`,
    choices: [youngPick(1), youngPick(2), youngPick(3), { label: "ยังไม่ท้า", run: () => meh("คุณกลับไปฝึกต่อ — ทำเนียบไม่หนีไปไหน") }],
  },
  {
    id: "rk.m_menu",
    minAge: 14,
    maxAge: 100,
    manual: true,
    maxTimes: 0,
    title: "ท้าชิงอันดับทำเนียบยอดฝีมือ",
    text: (l) => `${myPlace(l) ? `คุณอยู่อันดับ ${myPlace(l)} ของทำเนียบยอดฝีมือใต้หล้า` : "ชื่อคุณยังไม่อยู่ในทำเนียบยอดฝีมือ — อันดับ 11–20 คือประตูแรก สิบอันดับแรกคือสิบยอดฝีมือใต้หล้า"}`,
    choices: [masterPick(1), masterPick(2), masterPick(3), { label: "ยังไม่ท้า", run: () => meh("คุณเก็บสาส์นท้าไว้ในอกเสื้อ — วันหนึ่งจะส่งมันออกไป") }],
    scenes: {
      how: { text: (_l, c) => `คู่ต่อสู้: ${c.foe} — อันดับ ${c.pl} · จะสู้แบบไหน`, choices: [masterFight(false), masterFight(true)] },
    },
  },
  {
    id: "rk.y_defend",
    minAge: 12,
    maxAge: 30,
    maxTimes: 0,
    weight: (l) => (myYoungPlace(l) > 0 && myYoungPlace(l) < YOUNG_SIZE ? 8 : 0),
    prepare: (l) => { const list = youngList(l); const me = myYoungPlace(l); const y = list[Math.min(list.length - 1, me + randInt(l, 0, 2))]; return { n: y.n, e: y.e, g: y.g ?? "", cp: y.cp, a: y.a }; },
    title: "คำท้าจากคนรุ่นเดียวกัน",
    text: (l, c) => `【${c.e}】${c.n} ${sym(c.g as "m" | "f")} อายุ ${c.a} ปี ส่งสาส์นท้าชิงอันดับ ${myYoungPlace(l)} ของทำเนียบมังกรจากคุณ — "ข้าไม่ได้มาเพื่อแพ้"`,
    choices: [
      { label: "รับคำท้า", skill: [], run: (l, c) => { startDuel(l, { foe: `【${c.e}】${c.n}`, rank: foeRank(Number(c.cp)), spar: true, on: "rankYDef" }); return { text: "ลานหน้าศาลเจ้าแน่นไปด้วยคนรุ่นเดียวกัน — ทุกคนอยากเห็นว่าใครคือมังกรตัวจริง" }; } },
      { label: "ไม่รับ", run: (l) => { const to = youngDrop(l, 1); addFame(l, -2); return meh(`ข่าวว่าคุณหลบคำท้าแพร่ไปทั่ว — ${to ? `อันดับตกเป็น ${to}` : "ชื่อหลุดจากทำเนียบมังกร"}`); } },
    ],
  },
  {
    id: "rk.y_tourney",
    minAge: 14,
    maxAge: 30,
    maxTimes: 0,
    forced: true,
    weight: (l) => (!!l.power && (l.birthYear + l.age) % 3 === 0 && l.flags.rkTourney !== l.birthYear + l.age ? 9 : 0),
    prepare: (l) => { l.flags.rkTourney = l.birthYear + l.age; return {}; },
    title: "งานประลองชิงทำเนียบมังกร",
    text: (l) => `ทุกสามปี สำนักใหญ่ทั้งแผ่นดินร่วมกันจัดงานประลองชิงทำเนียบมังกรที่ภูเขาซงซาน — คนหนุ่มสาวอายุไม่เกินสามสิบกว่าสองร้อยคนมาลงชื่อ${myYoungPlace(l) ? ` (ตอนนี้คุณอยู่อันดับ ${myYoungPlace(l)})` : ""}`,
    choices: [
      { label: "ลงชื่อประลอง", skill: ["combat"], odds: (l) => vsOdds(l, tCp(l, 15)), run: (l, _c, s) => { gainExp(l, 100); return s ? ok("รอบแรกผ่าน — คู่ต่อสู้ของคุณยอมแพ้ในเพลงที่เจ็ด", "r2") : meh("รอบแรกคุณพบคนที่เร็วกว่าที่คิด — ตกรอบอย่างสมศักดิ์ศรี และได้เห็นว่าคนรุ่นเดียวกันไปถึงไหนแล้ว"); } },
      { label: "ไปนั่งดู", run: (l) => { gainExp(l, 60); return meh("สามวันบนอัฒจันทร์ไม้ — คุณจดท่าของคนที่ชนะไว้เต็มสมุด"); } },
    ],
    scenes: {
      r2: { text: () => "รอบแปดคนสุดท้าย — คู่ต่อสู้ของคุณเป็นศิษย์เอกของสำนักใหญ่ที่ทุกคนเชียร์", choices: [
        { label: "สู้ต่อ", skill: ["combat"], odds: (l) => vsOdds(l, tCp(l, 7)), run: (l, _c, s) => { gainExp(l, 150); if (s) return ok("คุณชนะ — เหลืออีกสองคนบนเวทีสุดท้าย", "final"); const p = placeIfBetter(l, 12); addFame(l, 3); return meh(`แพ้ในรอบแปดคน — แต่ผลงานพาชื่อคุณขึ้นทำเนียบมังกรอันดับ ${p}`); } },
      ] },
      final: { text: () => "รอบชิงบนลานหินกลางยอดเขา — คนนับพันเงียบกริบ", choices: [
        { label: "สู้รอบชิง", skill: ["combat"], odds: (l) => vsOdds(l, tCp(l, 2)), run: (l, _c, s) => { gainExp(l, 250); if (s) { youngTake(l, 1); addFame(l, 12); return { text: "🐉 คุณคือแชมป์งานประลองชิงทำเนียบมังกร — ชื่อของคุณขึ้นเป็นอันดับหนึ่ง คนรุ่นเดียวกันทั้งแผ่นดินรู้จักชื่อนี้", kind: "milestone" }; } const p = placeIfBetter(l, 3); addFame(l, 6); return ok(`รองแชมป์ — ทำเนียบมังกรประกาศชื่อคุณเป็นอันดับ ${p}`); } },
      ] },
    },
  },
];
