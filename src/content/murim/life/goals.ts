// Phase 2 — เป้าหมายชีวิต: แรงผลักที่ทำให้แต่ละชีวิตมีเรื่องราว (MURIM_PLAN §18.1)
// เป้าหมายหลัก 1 ข้อ (+ รองได้อีก 2) · มีขั้นตอนที่มองเห็น · จบได้หลายแบบ · เปลี่ยนได้เมื่อมีเหตุการณ์สำคัญ ไม่ใช่สุ่มเปลี่ยน
import type { GameEvent, Outcome } from "../../../engine/events";
import { feel, relOf } from "../../../engine/npc";
import { pick, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { addFame, addStat, createPerson, log, people, shortName } from "../../../engine/util";
import { DUEL_END, startDuel } from "./duel";
import { ACTIVITIES } from "../../../engine/activities";
import { runEvent } from "../../../engine/game";
import { alignment, myPlace, mySect, shiftAlign } from "../m17core";
import { artsOf } from "../martial/arts";

export interface LifeGoal {
  id: string;
  /** ขั้นที่ผ่านแล้ว (0 = เพิ่งตั้งเป้า) */
  step: number;
  /** อายุตอนตั้งเป้า */
  since: number;
  /** จบแล้ว: สำเร็จ / ล้มเหลว / เปลี่ยนใจ */
  end?: "won" | "lost" | "changed";
  /** คนที่เกี่ยวข้อง (เช่น ศัตรูที่ต้องล้างแค้น) */
  pid?: string;
  /** ทำไมถึงตั้งเป้านี้ (แสดงในบันทึก) */
  why?: string;
  /** เป้าหมายรอง (ไม่เกิน 2) — เดินคู่กับเป้าหมายหลัก */
  side?: boolean;
  /** อายุตอนเป้าหมายจบ */
  until?: number;
}

interface GoalDef {
  id: string;
  emoji: string;
  name: string;
  /** ชื่อขั้นแต่ละขั้น — ผ่านครบ = สำเร็จ */
  steps: string[];
  /** ตรวจทุกปีว่าผ่านขั้นถัดไปหรือยัง */
  passed: (l: Life, step: number, g: LifeGoal) => boolean;
  won: string;
  /** รางวัลตอนสำเร็จ */
  reward?: (l: Life) => void;
}

const kids = (l: Life) => people(l, "child").filter((c) => c.alive);
const rank = (l: Life) => l.power?.rank ?? -1;
/** อันดับดีที่สุดในทำเนียบยุทธภพที่เคยได้ (0 = ไม่เคยติด) */
const bestPlace = (l: Life) => { const now = myPlace(l); const b = Number(l.flags.bestPlace ?? 0); return now > 0 && (b === 0 || now < b) ? now : b; };
const closeFriends = (l: Life) => l.people.filter((p) => p.alive && ["friend", "ally"].includes(p.relation) && p.bond >= 70).length;
const spouse = (l: Life) => people(l, "spouse").find((p) => p.alive);
const anyCombo = (l: Life) => Object.keys(l.flags).some((k) => k.startsWith("combo:") && l.flags[k]);

export const GOALS: GoalDef[] = [
  {
    id: "peak", emoji: "⚔️", name: "เป็นยอดฝีมือแห่งยุค",
    steps: ["ทะลวงเส้นชีพจร เริ่มฝึกวิชา", "ก้าวสู่ยอดฝีมือขั้นสอง", "ก้าวสู่ยอดฝีมือขั้นหนึ่ง", "แตะจุดสูงสุดของวิชา"],
    passed: (l, s) => [!!l.power, rank(l) >= 2, rank(l) >= 4, rank(l) >= 6][s],
    won: "ชื่อของคุณถูกเอ่ยถึงในทุกโรงน้ำชา — เด็กๆ เล่นเป็นคุณตอนเล่นจอมยุทธ์",
    reward: (l) => addFame(l, 15),
  },
  {
    id: "wealth", emoji: "💰", name: "ร่ำรวยและเป็นอิสระ",
    steps: ["มีเงินเก็บสองร้อยตำลึง", "มีเงินเก็บสองพันตำลึง", "มีเงินเก็บสองหมื่นตำลึง"],
    passed: (l, s) => l.money - l.debt >= [200_000, 2_000_000, 20_000_000][s],
    won: "คุณไม่ต้องก้มหัวให้ใครอีกแล้ว — คนที่เคยดูถูกคุณ ตอนนี้ต้องมาขอยืมเงิน",
    reward: (l) => addStat(l, "happiness", 15),
  },
  {
    id: "family", emoji: "🏡", name: "มีครอบครัวที่อบอุ่น",
    steps: ["แต่งงานกับคนที่รัก", "มีลูกคนแรก", "เลี้ยงลูกจนโตเป็นผู้ใหญ่", "ครอบครัวพร้อมหน้าในวันตรุษ"],
    passed: (l, s) => [people(l, "spouse").length > 0, kids(l).length > 0, kids(l).some((c) => c.age >= 16), kids(l).length >= 2 && people(l, "spouse").length > 0][s],
    won: "เย็นวันตรุษ บ้านคุณเสียงดังที่สุดในซอย — คุณมองทุกคนแล้วรู้ว่าชีวิตนี้ไม่เสียเปล่า",
    reward: (l) => addStat(l, "happiness", 20),
  },
  {
    id: "healer", emoji: "🌿", name: "เป็นหมอที่ช่วยชีวิตคน",
    steps: ["เป็นลูกมือร้านยา หรือช่วยหมอเฒ่าจนรู้จักสมุนไพร", "ได้เป็นหมอยา (หรือรักษาเองมาสามปี · ปัญญา 50)", "เป็นหมอที่มีชื่อเสียง (ชื่อเสียง 15)"],
    // ทางร้านยา (อาชีพหมอยา/หมอหลวง) หรือทางเรียนรู้เองจากการช่วยหมอเฒ่า
    passed: (l, s, g) => { const j = ["herbalist", "palace_physician"].includes(l.job?.careerId ?? "") ? l.job!.level : 0; const self = !!l.flags.medicKnow; return [j >= 1 || self, j >= 2 || (self && l.age - g.since >= 3 && l.stats.smarts >= 50), (j >= 3 || self) && l.fame >= 15][s]; },
    won: "ชาวบ้านสามอำเภอรู้จักชื่อคุณ คนที่คุณรักษาหายส่งไก่กับไข่มาให้ไม่ขาด",
    reward: (l) => addFame(l, 10),
  },
  {
    id: "official", emoji: "📯", name: "รับราชการเป็นขุนนาง",
    steps: ["ร่ำเรียนจนแตกฉาน", "ได้ตำแหน่งในที่ว่าการ", "ได้เป็นเจ้าเมือง"],
    passed: (l, s) => { const j = l.job?.careerId === "official" ? l.job.level : 0; return [l.stats.smarts >= 60, j >= 1, j >= 3][s]; },
    won: "ขบวนแห่ต้อนรับเจ้าเมืองคนใหม่ผ่านหน้าบ้านเก่าของคุณ — พ่อแม่ร้องไห้ด้วยความภูมิใจ",
    reward: (l) => addFame(l, 12),
  },
  {
    id: "wander", emoji: "🗺️", name: "ท่องให้ทั่วแผ่นดิน",
    steps: ["ออกจากบ้านเกิด", "เดินทางครบห้าปี", "มีสหายทั่วยุทธภพ"],
    passed: (l, s) => { const y = Number(l.flags.mwWanderYears ?? 0); return [y >= 1, y >= 5, people(l, "friend").length >= 4][s]; },
    won: "คุณเคยเห็นทะเลทราย ทะเลสาบ และหิมะบนยอดเขา — ที่ไหนก็มีคนเรียกคุณว่าสหาย",
    reward: (l) => addStat(l, "happiness", 15),
  },
  {
    id: "quiet", emoji: "🍵", name: "ใช้ชีวิตสงบสุข",
    steps: ["มีบ้านและครอบครัวของตัวเอง", "อยู่อย่างสงบสิบปี", "แก่ตัวอย่างมีความสุข"],
    passed: (l, s, g) => [people(l, "spouse").length > 0 || l.age >= 30, l.age - g.since >= 10 && l.stats.happiness >= 50, l.age >= 60 && l.stats.happiness >= 60][s],
    won: "คุณนั่งจิบชาใต้ต้นท้อหลังบ้าน ยุทธภพจะวุ่นวายแค่ไหน ก็ไม่ใช่เรื่องของคุณอีกแล้ว",
    reward: (l) => addStat(l, "health", 10),
  },
  {
    id: "revenge", emoji: "🩸", name: "ล้างแค้น",
    steps: ["สืบหาตัวคนที่ทำ", "ฝึกจนแข็งแกร่งพอ", "เผชิญหน้าศัตรู"],
    passed: (l, s, g) => {
      const foe = l.people.find((p) => p.id === g.pid);
      if (!foe || !foe.alive) return s === 2; // ศัตรูตายไปเองแล้ว
      return [l.age - g.since >= 2 && (l.stats.smarts >= 45 || Number(l.flags.mwWanderYears ?? 0) >= 1), rank(l) >= Math.max(1, Number(foe.tags?.find((t) => t.startsWith("rank:"))?.slice(5) ?? 2)), false][s];
    },
    won: "ความแค้นที่แบกมาหลายปีจบลงแล้ว — คุณรู้สึกเบา หรืออาจจะว่างเปล่า",
  },
  {
    id: "sect", emoji: "🏯", name: "ก่อตั้งหรือกอบกู้สำนัก",
    steps: ["ฝีมือถึงขั้นที่คนยอมฝากตัว", "มีสำนักเป็นของตัวเอง", "สำนักมีศิษย์ครบสามสิบคน"],
    passed: (l, s) => { const sect = mySect(l); return [rank(l) >= 4 || (l.job?.careerId === "disciple" && l.job.level >= 4), !!sect || (l.job?.careerId === "disciple" && l.job.level >= 5), (sect?.d ?? 0) >= 30 || (l.job?.careerId === "disciple" && l.job.level >= 5 && l.fame >= 40)][s]; },
    won: "ป้ายชื่อสำนักแขวนเด่นเหนือประตู — ศิษย์สามสิบคนตั้งแถวคารวะทุกเช้า ชื่อนี้จะอยู่หลังคุณจากไป",
    reward: (l) => addFame(l, 12),
  },
  {
    id: "birth", emoji: "🔍", name: "ค้นหาความจริงเรื่องชาติกำเนิด",
    steps: ["พบเบาะแสแรก", "ตามรอยจนถึงต้นทาง", "รู้ความจริง"],
    passed: (l, s) => [!!l.flags.birthClue1, !!l.flags.birthClue2, !!l.flags.birthTruth][s],
    won: "ความจริงไม่ได้สวยงามอย่างที่ฝัน — แต่ตอนนี้คุณรู้แล้วว่าตัวเองมาจากไหน และเลือกได้ว่าจะเป็นใคร",
    reward: (l) => addStat(l, "happiness", 10),
  },
  {
    id: "oath", emoji: "🤝", name: "รักษาคำสัตย์",
    steps: ["ยืนข้างเขาในวันที่ลำบาก", "ยอมเสียสละเพื่อคำสาบาน", "รักษาคำสัตย์ครบแปดปี"],
    passed: (l, s, g) => { const n = Number(l.flags.oathKept ?? 0); const gone = !l.people.find((p) => p.id === g.pid)?.alive; /* เขาตายไปแล้ว: คำสัตย์ยังอยู่ — ดูแลครอบครัวเขาแทน */ return [n >= 1 || gone, n >= 2 || gone, l.age - g.since >= 8][s]; },
    won: "แปดปีที่ไม่เคยผิดคำ — ในยุทธภพที่คนทรยศกันเป็นเรื่องปกติ คุณกลายเป็นคนที่ทุกคนอยากได้เป็นพี่น้อง",
    reward: (l) => { addFame(l, 8); shiftAlign(l, 4); },
  },
  {
    id: "atone", emoji: "🕯️", name: "ชดใช้บาป วางดาบ",
    steps: ["ไม่ฆ่าใครอีกสองปีเต็ม", "ใช้ชีวิตจนใจกลับมาเป็นกลาง", "ช่วยชีวิตคนจนใจสว่าง"],
    passed: (l, s, g) => [l.age - Math.max(g.since, Number(l.flags.mwKillAge ?? -99)) >= 2, alignment(l) >= 0, alignment(l) >= 30][s],
    won: "คืนหนึ่งคุณนอนหลับได้ทั้งคืนโดยไม่ฝันถึงใบหน้าเหล่านั้น — บาปไม่ได้หายไป แต่คุณไม่ได้แบกมันคนเดียวอีกแล้ว",
    reward: (l) => addStat(l, "happiness", 15),
  },
  {
    id: "teach", emoji: "📚", name: "ถ่ายทอดวิชาให้คนรุ่นหลัง",
    steps: ["รับศิษย์คนแรก", "ถ่ายทอดวิชาที่ดีที่สุดให้ศิษย์", "ทิ้งคัมภีร์หรือศิษย์สามคนไว้ในโลก"],
    passed: (l, s) => { const pupils = l.people.filter((p) => p.alive && p.tags?.includes("disciple")); return [pupils.length >= 1, l.people.some((p) => p.tags?.some((t) => t.startsWith("art:"))), !!l.flags.wroteManual || pupils.length >= 3][s]; },
    won: "สิ่งที่คุณใช้ทั้งชีวิตค้นพบ จะไม่ตายไปพร้อมคุณ — มีมือคู่ใหม่รับมันไว้แล้ว",
    reward: (l) => addFame(l, 8),
  },
  {
    id: "leader", emoji: "👑", name: "ขึ้นเป็นผู้นำ",
    steps: ["มีชื่อเสียงจนคนเชื่อฟัง", "มีกำลังพอจะชิงตำแหน่ง", "ได้ตำแหน่งสูงสุด"],
    passed: (l, s) => {
      const path = String(l.flags.leaderPath ?? "sect");
      const top = path === "throne" ? !!l.flags.foundedDynasty : path === "demon" ? !!l.flags.heavenlyDemon : !!mySect(l) || (l.job?.careerId === "disciple" && l.job.level >= 5);
      return [l.fame >= 25, rank(l) >= 4 || l.fame >= 50, top][s];
    },
    won: "คนที่เคยไม่มีใครรู้จัก ตอนนี้นั่งอยู่บนเก้าอี้ที่ทุกคนต้องก้มหัวให้ — และเพิ่งรู้ว่าเก้าอี้ตัวนี้หนักกว่าที่คิด",
    reward: (l) => addFame(l, 15),
  },
  {
    id: "ascend", emoji: "☁️", name: "บรรลุเซียน",
    steps: ["ก้าวสู่ขั้นลึกล้ำ", "ข้ามพ้นความเป็นความตาย", "ผ่านทัณฑ์สวรรค์"],
    passed: (l, s) => [rank(l) >= 7, rank(l) >= 8, !!l.flags.ascended][s],
    won: "เมฆเปิดทาง — สิ่งที่มนุษย์ร้อยล้านคนใฝ่ฝัน คุณทำได้สำเร็จ",
  },
  // ───── ชุดใหม่: เป้าหมายที่ไปถึงได้ด้วยระบบในเกม ─────
  {
    id: "ranked", emoji: "📜", name: "จารึกชื่อในทำเนียบยุทธภพ",
    steps: ["ติดทำเนียบมังกรหรือทำเนียบยุทธภพ", "ขึ้นถึงยี่สิบอันดับแรกของทำเนียบยุทธภพ", "ขึ้นเป็นหนึ่งในสิบยอดฝีมือ"],
    passed: (l, s) => { const b = bestPlace(l); return [!!l.flags.youngListed || b > 0, b > 0 && b <= 20, b > 0 && b <= 10][s]; },
    won: "นักเล่านิทานทุกโรงน้ำชาต้องท่องชื่อสิบยอดฝีมือให้ได้ — และชื่อของคุณอยู่ในนั้น",
    reward: (l) => addFame(l, 12),
  },
  {
    id: "throne", emoji: "🐉", name: "ชิงบัลลังก์มังกร",
    steps: ["เข้าถึงราชสำนักหรือมีกองกำลังของตัวเอง", "มีชื่อเสียงและคนหนุนหลังมากพอ", "ขึ้นครองราชย์"],
    passed: (l, s) => [!!l.flags.palaceAccess || Number(l.flags.courtRank ?? 0) >= 1 || !!l.flags.isLord || !!l.flags.kingServe || !!l.flags.mwRebel || rank(l) >= 4, l.fame >= 35 || Number(l.flags.courtRank ?? 0) >= 3 || !!l.flags.isLord, !!l.flags.emperorSelf || !!l.flags.foundedDynasty][s],
    won: "เสียงกลองดังเก้าครั้งจากหอกลองหน้าวัง — ทั้งแผ่นดินคุกเข่าพร้อมกัน และทุกคนเรียกชื่อคุณว่าโอรสสวรรค์",
    reward: (l) => addFame(l, 15),
  },
  {
    id: "arts", emoji: "📖", name: "ร้อยวิชาในกายเดียว",
    steps: ["รู้วิชายุทธ์สามวิชา", "รู้วิชายุทธ์หกวิชา", "รู้สิบวิชา หรือคิดค้นวิชาของตัวเอง"],
    passed: (l, s) => { const n = artsOf(l).length; return [n >= 3, n >= 6, n >= 10 || !!l.flags.createdArt][s]; },
    won: "กระบวนท่าจากสิบสำนักไหลรวมเป็นหนึ่งในกายของคุณ — คนที่เห็นคุณสู้บอกไม่ได้ว่าคุณเป็นศิษย์ใคร",
    reward: (l) => addStat(l, "smarts", 5),
  },
  {
    id: "love", emoji: "💞", name: "หารักแท้สักครั้งในชีวิต",
    steps: ["แต่งงานกับคนที่รัก", "ผูกพันกันจนใจตรงกัน", "อยู่เคียงข้างกันมาสิบปี"],
    passed: (l, s, g) => { const sp = spouse(l); return [!!sp, !!sp && sp.bond >= 80, !!sp && sp.bond >= 70 && l.age - g.since >= 10][s]; },
    won: "ผมของทั้งคู่เริ่มขาว แต่เขายังรินชาให้คุณก่อนตัวเองทุกเช้า — ยุทธภพมีตำนานความรักหลายเรื่อง และนี่คือเรื่องของคุณ",
    reward: (l) => addStat(l, "happiness", 20),
  },
  {
    id: "fame", emoji: "📣", name: "ชื่อขจรไปทั่วแผ่นดิน",
    steps: ["คนในเมืองรู้จักชื่อ (ชื่อเสียง 20)", "คนทั้งแคว้นรู้จัก (ชื่อเสียง 45)", "ทั่วแผ่นดินรู้จัก (ชื่อเสียง 70)"],
    passed: (l, s) => l.fame >= [20, 45, 70][s],
    won: "เด็กในหมู่บ้านไกลสุดขอบแผ่นดินยังเล่นเป็นคุณ — คนแปลกหน้าโค้งให้เมื่อได้ยินชื่อ",
    reward: (l) => addStat(l, "happiness", 10),
  },
  {
    id: "long", emoji: "🐢", name: "อายุยืนเหมือนเต่าพันปี",
    steps: ["ถึงอายุหกสิบโดยร่างกายยังแข็งแรง", "ถึงอายุเจ็ดสิบห้า", "ถึงอายุเก้าสิบ"],
    passed: (l, s) => [l.age >= 60 && l.stats.health >= 40, l.age >= 75, l.age >= 90][s],
    won: "ลูกหลานจัดงานวันเกิดเก้าสิบ — คุณจำชื่อคนในงานได้ไม่ครบ แต่ทุกคนจำคุณได้",
    reward: (l) => addStat(l, "happiness", 15),
  },
  {
    id: "clan", emoji: "🏮", name: "สร้างตระกูลให้ยิ่งใหญ่",
    steps: ["มีลูกสามคน", "ลูกสองคนเติบโตเป็นผู้ใหญ่", "ตระกูลมีทรัพย์สินสองพันตำลึงและชื่อเสียง"],
    passed: (l, s) => [people(l, "child", false).length >= 3, kids(l).filter((c) => c.age >= 18).length >= 2, l.money - l.debt >= 2_000_000 && l.fame >= 20][s],
    won: "ป้ายชื่อตระกูลแขวนเหนือประตูบ้านหลังใหญ่ — ลูกหลานจะเอ่ยชื่อคุณในพิธีไหว้บรรพบุรุษอีกร้อยปี",
    reward: (l) => addFame(l, 8),
  },
  {
    id: "hero", emoji: "🛡️", name: "จอมยุทธ์ผู้ทรงธรรม",
    steps: ["ยืนข้างความถูกต้อง (ธรรมะ 20)", "ช่วยคนจนมีชื่อเสียง (ธรรมะ 45 · ชื่อเสียง 25)", "เป็นที่พึ่งของแผ่นดิน (ธรรมะ 65 · ชื่อเสียง 45 หรือปราบจอมมาร)"],
    passed: (l, s) => [alignment(l) >= 20, alignment(l) >= 45 && l.fame >= 25, (alignment(l) >= 65 && l.fame >= 45) || !!l.flags.slewDemonLord][s],
    won: "ชาวบ้านตั้งศาลเล็กๆ ให้คุณที่ปากทางหมู่บ้าน — คุณขอให้รื้อ พวกเขาไม่ยอม",
    reward: (l) => { addFame(l, 10); shiftAlign(l, 5); },
  },
  {
    id: "demon", emoji: "🩸", name: "ครองยุทธภพด้วยวิถีมาร",
    steps: ["ทิ้งคำสอนของฝ่ายธรรมะ (ธรรมะ -20)", "ฆ่าคนที่ขวางทางห้าคน", "เป็นจอมมารที่ทุกคนหวาดกลัว"],
    passed: (l, s) => [alignment(l) <= -20, Number(l.flags.mwKills ?? 0) >= 5, !!l.flags.heavenlyDemon || !!l.flags.becameDemonLord || (rank(l) >= 5 && alignment(l) <= -55)][s],
    won: "แม่ๆ ทั้งแผ่นดินขู่ลูกที่ไม่ยอมนอนด้วยชื่อของคุณ — และมันได้ผลทุกครั้ง",
    reward: (l) => addFame(l, 12),
  },
  {
    id: "trade", emoji: "🔨", name: "เป็นที่หนึ่งในอาชีพของตัวเอง",
    steps: ["ทำงานเดิมต่อเนื่องสามปี", "ขึ้นถึงขั้นที่สามของอาชีพ", "ขึ้นถึงขั้นสูงสุดหรือมีชื่อเสียงในวงการ"],
    passed: (l, s) => { const j = l.job; return [!!j && j.years >= 3, !!j && j.level >= 3, !!j && (j.level >= 4 || (j.level >= 3 && l.fame >= 20))][s]; },
    won: "คนในวงการเดียวกันเรียกคุณว่า 'อาจารย์' — แม้แต่คนที่อายุมากกว่า",
    reward: (l) => { addFame(l, 6); addStat(l, "happiness", 8); },
  },
  {
    id: "gift", emoji: "✨", name: "ปลุกพรสวรรค์ให้ถึงที่สุด",
    steps: ["ฝึกฝนจนพรสวรรค์เริ่มตอบสนอง (อายุ 18 · ทะลวงเส้นชีพจร)", "พรสวรรค์วิวัฒน์", "ค้นพบพลังที่ซ่อนของพรสวรรค์ หรือวิวัฒน์ครั้งที่สอง"],
    passed: (l, s) => [l.age >= 18 && !!l.power, Number(l.flags.taEvolved ?? 0) >= 1, anyCombo(l) || Number(l.flags.taEvolved ?? 0) >= 2][s],
    won: "สิ่งที่สวรรค์ให้มาตั้งแต่เกิด คุณใช้มันจนสุดทาง — ไม่มีอะไรเหลือให้เสียดาย",
    reward: (l) => addStat(l, "happiness", 10),
  },
  {
    id: "champion", emoji: "🥇", name: "ชนะเลิศงานประลองยุทธ์",
    steps: ["ชนะการประลองครั้งแรก", "ชนะคู่ปรับหรือคนในทำเนียบสามครั้ง", "คว้าแชมป์งานประลองหรือขึ้นอันดับหนึ่งทำเนียบมังกร"],
    passed: (l, s) => { const w = Number(l.flags.rivalW ?? 0) + Number(l.flags.duelWins ?? 0); return [w >= 1, w >= 3, !!l.flags.tourneyChampion || !!l.flags.gatheringChampion || !!l.flags.youngTop || !!l.flags.champion][s]; },
    won: "ป้ายทองแขวนอยู่กลางบ้าน — แขกทุกคนที่มาเยี่ยมต้องหยุดมองมันก่อนจะทักทายคุณ",
    reward: (l) => addFame(l, 10),
  },
  {
    id: "brothers", emoji: "🍶", name: "มีพี่น้องร่วมสาบานที่ตายแทนกันได้",
    steps: ["มีสหายที่ไว้ใจได้หนึ่งคน", "ดื่มเหล้าสาบานเป็นพี่น้อง", "มีสหายใจเดียวกันสามคน"],
    passed: (l, s) => [closeFriends(l) >= 1, l.people.some((p) => p.alive && p.tags?.includes("sworn")) || closeFriends(l) >= 2, closeFriends(l) >= 3][s],
    won: "คืนหนึ่งคุณนั่งรอบกองไฟกับพี่น้องที่ไม่ได้เกิดท้องเดียวกัน — ทุกคนพร้อมจะตายวันเดียวกับคุณ",
    reward: (l) => addStat(l, "happiness", 15),
  },
];

export const goalById = (id: string) => GOALS.find((g) => g.id === id);
export const mainGoal = (l: Life) => l.goals?.find((g) => !g.end && !g.side);
export const sideGoals = (l: Life) => (l.goals ?? []).filter((g) => !g.end && g.side);
export const hasGoal = (l: Life, id: string) => (l.goals ?? []).some((g) => !g.end && g.id === id);

/** เพิ่มเป้าหมายรอง (ไม่เกิน 2 · ไม่ซ้ำกับที่มีอยู่) */
export function addSideGoal(l: Life, id: string, why?: string, pid?: string): boolean {
  if (sideGoals(l).length >= 2 || hasGoal(l, id)) return false;
  (l.goals ??= []).push({ id, step: 0, since: l.age, why, pid, side: true });
  const d = goalById(id)!;
  log(l, `🎯 เป้าหมายรอง: ${d.emoji} ${d.name}${why ? ` — ${why}` : ""}`, "good");
  return true;
}

export function setGoal(l: Life, id: string, why?: string, pid?: string) {
  const cur = mainGoal(l);
  if (cur) { cur.end = "changed"; cur.until = l.age; }
  // เป้าหมายรองที่ตรงกับเป้าหมายหลักใหม่ ถูกยกขึ้นเป็นหลัก (ไม่นับซ้ำ)
  const dup = sideGoals(l).find((g) => g.id === id);
  if (dup) { dup.side = false; dup.why = why ?? dup.why; return; }
  (l.goals ??= []).push({ id, step: 0, since: l.age, why, pid });
  const d = goalById(id)!;
  log(l, `🎯 เป้าหมายชีวิตใหม่: ${d.emoji} ${d.name}${why ? ` — ${why}` : ""}`, "milestone");
}

/** ตรวจความคืบหน้าทุกปี (yearHook) */
export function tickGoals(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  const bp = bestPlace(l);
  if (bp > 0) l.flags.bestPlace = bp;
  for (const g of l.goals ?? []) if (g.end && g.until === undefined) g.until = l.age;
  if (l.flags.plan === "wander") l.flags.mwWanderYears = Number(l.flags.mwWanderYears ?? 0) + 1;
  for (const g of [mainGoal(l), ...sideGoals(l)]) {
    if (!g) continue;
    const d = goalById(g.id);
    if (!d) continue;
    // ผ่านได้ปีละหนึ่งขั้นต่อเป้าหมาย
    if (g.step < d.steps.length && d.passed(l, g.step, g)) {
      g.step++;
      if (g.step >= d.steps.length) {
        g.end = "won";
        g.until = l.age;
        d.reward?.(l);
        l.flags[`goalWon_${g.id}`] = true;
        log(l, `🏆 ${g.side ? "เป้าหมายรอง" : "เป้าหมายชีวิต"}สำเร็จ: ${d.name} — ${d.won}`, "milestone");
      } else {
        log(l, `🎯 ${d.name}: ${d.steps[g.step - 1]} ✓ (ขั้นต่อไป: ${d.steps[g.step]})`, "good");
      }
    }
  }
}

/** ข้อความสั้นสำหรับหน้าจอหลัก */
export function goalLine(l: Life): string | undefined {
  const g = mainGoal(l);
  const d = g && goalById(g.id);
  if (!g || !d) return;
  const extra = sideGoals(l).map((x) => goalById(x.id)?.emoji ?? "").join("");
  return `${d.emoji} ${d.name} (${g.step}/${d.steps.length}) · ถัดไป: ${d.steps[Math.min(g.step, d.steps.length - 1)]}${extra ? ` · รอง ${extra}` : ""}`;
}

const good = (text: string): Outcome => ({ text, kind: "good" });

type Dream = [id: string, label: string, why: string | ((l: Life) => string), text: string, show?: (l: Life) => boolean];
/** ความฝันที่เลือกได้ — แต่ละข้อมีเงื่อนไขของตัวเอง (ซ่อนข้อที่ไม่เข้ากับชีวิตตอนนี้) */
export const DREAMS: Dream[] = [
  ["peak", "⚔️ เป็นยอดฝีมือที่ทั้งยุทธภพต้องจดจำ", "ฝันตั้งแต่เด็กว่าจะยืนอยู่บนจุดสูงสุด", "คุณกำหมัดแน่น ดาวดวงหนึ่งตกพาดฟ้าพอดี"],
  ["wealth", "💰 ร่ำรวย จะไม่ให้ครอบครัวอดอยากอีก", (l) => (l.wealth === "poor" ? "เพราะเคยหิวจนนอนไม่หลับ" : "เพราะเงินคืออิสรภาพ"), "คุณนับเหรียญในกระปุกอีกครั้ง แล้ววางแผนในหัวจนถึงเช้า"],
  ["family", "🏡 มีครอบครัวที่อบอุ่น", "อยากให้ลูกหลานได้สิ่งที่ตัวเองเคยได้ — หรือไม่เคยได้", "คุณยิ้มอยู่คนเดียวบนหลังคา", (l) => l.age <= 50],
  ["love", "💞 หารักแท้สักครั้งในชีวิต", "เพราะยุทธภพเย็นชาเกินกว่าจะอยู่คนเดียว", "คุณนึกถึงใบหน้าหนึ่ง แล้วหัวใจเต้นแรงขึ้นโดยไม่รู้ตัว", (l) => l.age <= 55],
  ["healer", "🌿 เป็นหมอที่ช่วยชีวิตคน", "เพราะเคยเห็นคนตายต่อหน้าเพราะไม่มีหมอ", "คุณนึกถึงกลิ่นสมุนไพรในร้านยาหัวมุมตลาด", (l) => l.age <= 45],
  ["official", "📯 สอบเข้ารับราชการ", "ตระกูลจะได้ไม่ต้องก้มหัวให้ใคร", "คุณหยิบตำราขึ้นมาอ่านต่อใต้แสงจันทร์", (l) => l.stats.smarts >= 45 && l.age <= 50 && !l.flags.emperorSelf],
  ["trade", "🔨 เป็นที่หนึ่งในอาชีพของตัวเอง", "เพราะงานที่ทำทุกวันควรทำให้ดีที่สุด", "คุณมองมือตัวเองที่หยาบกร้านจากงาน — มันยังไปได้อีกไกล", (l) => !!l.job],
  ["wander", "🗺️ ออกไปดูโลกให้ทั่วแผ่นดิน", "หมู่บ้านนี้เล็กเกินไปสำหรับความฝัน", "คุณมองถนนที่ทอดออกไปนอกหมู่บ้าน แล้วตัดสินใจ", (l) => !l.flags.emperorSelf],
  ["brothers", "🍶 มีพี่น้องร่วมสาบานที่ตายแทนกันได้", "เพราะคนเดียวไปได้เร็ว แต่หลายคนไปได้ไกล", "คุณรินเหล้าสามจอกวางไว้บนโต๊ะ — สักวันจะมีคนมานั่งดื่มด้วย"],
  ["fame", "📣 ให้ชื่อของข้าขจรไปทั่วแผ่นดิน", "เพราะไม่อยากตายไปโดยไม่มีใครจำ", "คุณเขียนชื่อตัวเองลงบนกำแพง แล้วยิ้ม"],
  ["champion", "🥇 ชนะเลิศงานประลองยุทธ์", "เพราะอยากรู้ว่าฝีมือตัวเองอยู่ตรงไหน", "คุณฟันลมกลางลานจนเหงื่อโชก", (l) => !!l.power || l.age <= 25],
  ["ranked", "📜 จารึกชื่อในทำเนียบยุทธภพ", "เพราะทำเนียบคือบันทึกของคนที่ยุทธภพยอมรับ", "คุณกางทำเนียบฉบับล่าสุดแล้วนับช่องว่างที่ยังไม่มีชื่อคุณ", (l) => rank(l) >= 1 || !!l.flags.youngListed],
  ["arts", "📖 เรียนวิชายุทธ์ให้ได้ร้อยวิชา", "เพราะวิชาเดียวไม่พอสำหรับยุทธภพ", "คุณจดชื่อวิชาที่อยากเรียนจนเต็มหน้ากระดาษ", (l) => artsOf(l).length >= 1 || !!l.power],
  ["gift", "✨ ปลุกพรสวรรค์ของตัวเองให้ถึงที่สุด", "เพราะรู้สึกมาตลอดว่ามีบางอย่างในตัวที่ยังหลับอยู่", "คุณหลับตา — มีบางอย่างในอกขยับตอบ", (l) => l.age <= 45],
  ["hero", "🛡️ เป็นจอมยุทธ์ผู้ทรงธรรม", "เพราะคนอ่อนแอต้องมีคนยืนข้าง", "คุณช่วยยายแก่ข้างบ้านแบกฟืนกลับบ้านในคืนนั้นเอง", (l) => alignment(l) >= -10],
  ["demon", "🩸 ครองยุทธภพด้วยวิถีมาร", "เพราะธรรมะไม่เคยช่วยใครในวันที่ต้องการ", "คุณมองเงาตัวเองในน้ำ — มันยิ้มก่อนคุณ", (l) => alignment(l) <= 10 && !!l.power],
  ["sect", "🏯 ก่อตั้งสำนักของตัวเอง", "เพราะอยากให้วิชาและชื่อของตัวเองอยู่ต่อ", "คุณวาดแผนผังสำนักลงบนพื้นดินด้วยกิ่งไม้", (l) => rank(l) >= 2],
  ["teach", "📚 ถ่ายทอดวิชาให้คนรุ่นหลัง", "เพราะสิ่งที่รู้ไม่ควรตายไปพร้อมตัว", "คุณนึกถึงอาจารย์คนแรก แล้วอยากเป็นแบบนั้นให้ใครสักคน", (l) => rank(l) >= 2 || l.age >= 40],
  ["clan", "🏮 สร้างตระกูลให้ยิ่งใหญ่", "เพราะอยากให้ลูกหลานเริ่มต้นสูงกว่าตัวเอง", "คุณนึกภาพป้ายชื่อตระกูลแขวนเหนือประตูบ้านหลังใหญ่", (l) => l.age >= 18 && l.age <= 50],
  ["leader", "👑 สักวันจะนั่งบนเก้าอี้ที่สูงที่สุด", "เพราะเบื่อที่ต้องก้มหัวให้คนที่ไม่คู่ควร", "คุณมองไปที่ยอดเขาซึ่งสำนักใหญ่ตั้งอยู่ — สักวันหนึ่ง", (l) => l.stats.smarts >= 50 || l.fame >= 10],
  ["throne", "🐉 ชิงบัลลังก์มังกร", "เพราะแผ่นดินนี้ต้องการเจ้าชีวิตคนใหม่", "คุณมองไปทางเมืองหลวง — กำแพงวังสูง แต่ไม่สูงเกินปีน", (l) => !l.flags.emperorSelf && (l.fame >= 25 || !!l.flags.palaceAccess || !!l.flags.isLord || Number(l.flags.courtRank ?? 0) >= 1)],
  ["long", "🐢 มีชีวิตยืนยาวเหมือนเต่าพันปี", "เพราะยังอยากเห็นโลกอีกนาน", "คุณเริ่มตื่นเช้ามาทำท่ารำไทเก๊กกับคนแก่ในสวน", (l) => l.age >= 40],
  ["ascend", "☁️ บรรลุเซียน", "เพราะความเป็นมนุษย์มีขอบเขตเกินไป", "คุณนั่งสมาธิจนรุ่งสาง ลมหายใจเบาจนแทบไม่มี", (l) => rank(l) >= 6],
  ["quiet", "🍵 ขอแค่ชีวิตสงบสุข", "ยุทธภพวุ่นวายเกินไป", "คุณหลับไปบนหลังคา จนแม่ต้องตะโกนเรียกลงมากินข้าว"],
];
const dreamChoices = () => DREAMS.map(([id, label, why, text, show]) => ({
  label,
  show: (l: Life) => canDream(l, id) && (!show || show(l)),
  run: (l: Life) => { if (id === "leader") l.flags.leaderPath = l.power?.guild === "cult" ? "demon" : l.flags.isLord ? "throne" : "sect"; setGoal(l, id, typeof why === "function" ? why(l) : why); return good(text); },
}));
/** สรุปความคืบหน้าของเป้าหมายทั้งหมด (ฉากทบทวนเป้าหมาย) */
export function goalReport(l: Life): string {
  const line = (g: LifeGoal) => { const d = goalById(g.id); return d ? `${d.emoji} ${d.name} (${g.step}/${d.steps.length})${g.step < d.steps.length ? ` — ขั้นต่อไป: ${d.steps[g.step]}` : ""}` : ""; };
  const cur = [mainGoal(l), ...sideGoals(l)].filter((g): g is LifeGoal => !!g);
  const won = (l.goals ?? []).filter((g) => g.end === "won").map((g) => goalById(g.id)?.emoji + " " + goalById(g.id)?.name);
  return [cur.length ? `ตอนนี้: ${cur.map((g, i) => (i === 0 && !g.side ? "หลัก " : "รอง ") + line(g)).join("\n")}` : "ตอนนี้ยังไม่มีเป้าหมาย", won.length ? `ทำสำเร็จแล้ว: ${won.join(" · ")}` : ""].filter(Boolean).join("\n");
}
/** ความฝันข้อนี้ยังเลือกได้ไหม: ไม่ใช่เป้าที่ทำสำเร็จแล้ว และไม่ใช่เป้าที่ถืออยู่ */
const canDream = (l: Life, id: string) => !l.flags[`goalWon_${id}`] && !hasGoal(l, id);
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

/** ศัตรูที่ต้องล้างแค้น */
const foeOf = (l: Life) => l.people.find((p) => p.id === mainGoal(l)?.pid);

export const GOAL_EVENTS: GameEvent[] = [
  {
    id: "goal.exam",
    minAge: 15,
    maxAge: 50,
    maxTimes: 4,
    weight: (l) => (mainGoal(l)?.id === "official" && !l.flags.xiucai && l.stats.smarts >= 50 ? 14 : 0),
    title: "สนามสอบ",
    text: () => "ประกาศสอบขุนนางระดับอำเภอปีนี้ติดหน้าที่ว่าการ — คุณอ่านตำรามาทั้งปีเพื่อวันนี้",
    choices: [
      { label: "เข้าสอบ", check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => { if (ok) { l.flags.xiucai = true; addFame(l, 3); addStat(l, "happiness", 8); return { text: "ชื่อคุณอยู่ในประกาศผล — คุณเป็นบัณฑิตแล้ว ประตูที่ว่าการเปิดให้", kind: "milestone" }; } addStat(l, "happiness", -4); return { text: "สามวันในห้องสอบ — ชื่อไม่อยู่ในประกาศ ปีหน้ายังมีอีก", kind: "bad" }; } },
      { label: "ปีนี้ยังไม่พร้อม อ่านต่ออีกปี", run: (l) => { addStat(l, "smarts", 2); return { text: "คุณอ่านต่อใต้แสงเทียน — ตัวอักษรเริ่มเข้าใจง่ายขึ้น" }; } },
    ],
  },
  {
    id: "goal.choose",
    minAge: 13,
    maxAge: 90,
    forced: true,
    maxTimes: 0,
    // ครั้งแรกตอนเป็นวัยรุ่น · หลังเป้าหมายเดิมจบ (สำเร็จ ล้มเหลว หรือเปลี่ยนใจ) ปีถัดไปได้ตั้งเป้าใหม่
    when: (l) => !mainGoal(l) && Number(l.flags.goalPause ?? -1) < l.age && (!l.goals?.length || l.goals.every((g) => g.end && (g.until ?? -99) < l.age)),
    title: "ความฝัน",
    text: (l) => {
      const last = (l.goals ?? []).filter((g) => !g.side).at(-1);
      const d = last && goalById(last.id);
      if (d && last.end === "won") return `${d.emoji} ${d.name} — คุณทำสำเร็จแล้ว คืนนั้นคุณนั่งดื่มชาคนเดียว แล้วถามตัวเองว่า ต่อจากนี้ชีวิตจะเดินไปทางไหน`;
      if (d) return `${d.emoji} ${d.name} ไม่ใช่ทางของคุณอีกต่อไปแล้ว — อายุ ${l.age} คุณถามตัวเองว่า ที่เหลือของชีวิตนี้ อยากใช้ไปกับอะไร`;
      return l.age <= 25 ? `คืนนั้นคุณนอนมองดาวบนหลังคาบ้าน${l.flags.beggarMaster ? " นึกถึงคำของขอทานแก่คนนั้น" : ""} แล้วถามตัวเองว่า — ชีวิตนี้อยากเป็นอะไร` : `อายุ ${l.age} แล้ว คืนหนึ่งคุณนั่งอยู่คนเดียวหน้าตะเกียง แล้วถามตัวเองว่า — ที่เหลือของชีวิตนี้ อยากใช้ไปกับอะไร`;
    },
    choices: [
      ...dreamChoices(),
      { label: "ยังไม่รู้ — ใช้ชีวิตไปก่อน", run: (l) => { l.flags.goalPause = l.age + 3; return meh("คุณดับตะเกียงแล้วนอน — บางคำถามต้องให้เวลาตอบ"); } },
    ],
  },
  {
    id: "goal.review",
    minAge: 13,
    maxAge: 120,
    weight: 0,
    maxTimes: 0,
    title: "ทบทวนเป้าหมายชีวิต",
    text: (l) => `คุณนั่งลงหน้าตะเกียง ทบทวนชีวิตที่ผ่านมา\n${goalReport(l)}\n\n${mainGoal(l) ? "จะเดินทางเดิมต่อ หรือเปลี่ยนเป้าหมายหลัก (เป้าหมายเดิมจะถูกทิ้ง)" : "ชีวิตที่เหลือ อยากใช้ไปกับอะไร"}`,
    choices: [
      { label: (l) => (mainGoal(l) ? "เดินทางเดิมต่อไป" : "ยังไม่ตั้งเป้าหมาย"), run: () => meh("คุณพยักหน้าให้ตัวเอง แล้วดับตะเกียง — พรุ่งนี้ยังต้องเดินต่อ") },
      ...dreamChoices(),
    ],
  },
  {
    id: "goal.revenge_offer",
    minAge: 10,
    maxAge: 70,
    forced: true,
    // พ่อหรือแม่ถูกฆ่า (ไม่ใช่ตายตามธรรมชาติ) ปีนี้
    when: (l) => l.flags.mwKinKilled === l.age && mainGoal(l)?.id !== "revenge",
    title: "เลือดต้องล้างด้วยเลือด",
    text: (l) => `คุณยืนหน้าหลุมศพของ${String(l.flags.mwKinKilledName ?? "คนที่คุณรัก")} ชาวบ้านกระซิบว่าเห็นคนลงมือ — ${String(l.flags.mwKillerName ?? "ชายสวมหน้ากาก")}`,
    choices: [
      {
        label: "🩸 สาบานว่าจะล้างแค้น",
        run: (l) => {
          const foe = createPerson(l, "rival", { age: l.age + randInt(l, 10, 25), bond: 0, gender: "m" });
          foe.name = String(l.flags.mwKillerName ?? foe.name);
          foe.tags = ["killer", `rank:${Math.max(1, Math.min(6, (l.power?.rank ?? 0) + randInt(l, 1, 3)))}`];
          feel(foe, { grudge: 30, love: -30 });
          setGoal(l, "revenge", `ให้${String(l.flags.mwKinKilledName ?? "คนในครอบครัว")}ที่ถูกฆ่า`, foe.id);
          return bad("คุณกรีดฝ่ามือให้เลือดหยดลงบนดินหน้าหลุมศพ — เป้าหมายเดิมของชีวิตไม่สำคัญอีกต่อไป");
        },
      },
      { label: "ปล่อยให้ทางการจัดการ แล้วใช้ชีวิตต่อ", run: (l) => { addStat(l, "happiness", -8); return meh("ทางการรับเรื่องไว้ แล้วก็เงียบหายไป คุณพยายามไม่คิดถึงมัน"); } },
    ],
  },
  {
    id: "goal.healer_offer",
    minAge: 12,
    maxAge: 50,
    forced: true,
    when: (l) => l.flags.mwKinSick === l.age && mainGoal(l)?.id !== "healer" && mainGoal(l)?.id !== "revenge",
    title: "ถ้าตอนนั้นมีหมอ",
    text: (l) => `${String(l.flags.mwKinSickName ?? "คนในครอบครัว")}จากไปเพราะโรคที่หมอดีๆ อาจรักษาได้ — แต่หมอดีๆ ไม่เคยมาถึงหมู่บ้านนี้`,
    choices: [
      { label: "🌿 ตั้งใจจะเป็นหมอ ไม่ให้ใครต้องตายแบบนี้อีก", run: (l) => { setGoal(l, "healer", "เพราะไม่อยากให้ใครต้องเสียคนที่รักแบบเดียวกัน"); return good("คุณเดินเข้าร้านยาหัวมุมตลาด ขอเป็นลูกมือโดยไม่เอาค่าจ้าง"); } },
      { label: "ยึดเป้าหมายเดิมต่อไป", run: (l) => { addStat(l, "happiness", -4); return meh("ความเศร้าไม่ได้เปลี่ยนเส้นทางของคุณ — แต่มันจะอยู่กับคุณไปอีกนาน"); } },
    ],
  },
  {
    id: "goal.revenge_confront",
    minAge: 14,
    maxAge: 90,
    forced: true,
    when: (l) => { const g = mainGoal(l); return g?.id === "revenge" && g.step === 2 && !!foeOf(l)?.alive; },
    title: "เผชิญหน้า",
    text: (l) => { const f = foeOf(l)!; return `ในที่สุดคุณก็ตามเจอ${shortName(f)} — เขาแก่ลงมาก${f.tags?.includes("married") ? " มีลูกหลานรายล้อม" : " นั่งดื่มเหล้าอยู่คนเดียว"} เขาจำหน้าคุณได้ทันที`; },
    choices: [
      {
        label: "ท้าสู้จนตายกันไปข้าง",
        tone: "danger",
        pros: "จบความแค้นด้วยมือตัวเอง",
        cons: "สู้ถึงตาย — แพ้อาจไม่รอด หรือเสียอวัยวะ",
        run: (l) => {
          const f = foeOf(l)!;
          startDuel(l, { foe: shortName(f), rank: foeRank(f), lethal: true, pid: f.id, on: "revenge", cruel: true });
          return { text: `${shortName(f)}วางจอกเหล้าลงช้าๆ แล้วลุกขึ้น "ข้ารอวันนี้มานานแล้วเหมือนกัน"` };
        },
      },
      {
        label: "ให้อภัย แล้วเดินจากไป",
        run: (l) => {
          const g = mainGoal(l)!;
          const f = foeOf(l);
          g.end = "changed";
          if (f) feel(f, { debt: 40, grudge: -30 });
          addStat(l, "happiness", 6);
          return { text: "คุณวางกระบี่ลงบนโต๊ะเขาแล้วเดินออกมา ความแค้นไม่ได้หายไป — แต่คุณเลือกที่จะไม่ให้มันเป็นเจ้าของชีวิตอีกต่อไป", kind: "milestone" };
        },
      },
      {
        label: "ลากตัวไปให้ทางการตัดสิน",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => {
          const g = mainGoal(l)!;
          const f = foeOf(l);
          if (ok) { g.step = 3; g.end = "won"; l.flags.goalWon_revenge = true; if (f) f.alive = false; addFame(l, 8); return { text: "พยานสามคนกับหลักฐานที่คุณเก็บมาหลายปีทำให้ศาลตัดสินประหาร คุณยืนดูอยู่ท้ายฝูงชน", kind: "milestone" }; }
          return bad("ศาลยกฟ้องเพราะหลักฐานไม่พอ — เขาเดินออกจากศาลพร้อมยิ้มให้คุณ");
        },
      },
    ],
  },
];

const foeRank = (f: Person) => Number(f.tags?.find((t) => t.startsWith("rank:"))?.slice(5) ?? 2);

// ผลการต่อสู้ล้างแค้น
DUEL_END.revenge = (l, r) => {
  const g = l.goals?.find((x) => x.id === "revenge" && !x.end);
  if (!g) return "";
  if (r === "win") {
    g.step = 3;
    g.end = "won";
    l.flags.goalWon_revenge = true;
    addFame(l, 5);
    return "— ความแค้นที่แบกมาหลายปีจบลงแล้ว";
  }
  if (r === "lose" || r === "yield") return "ศัตรูยังลอยนวลอยู่ — และตอนนี้เขารู้แล้วว่าคุณตามมา";
  return "";
};

/** ตั้งธงเมื่อครอบครัวเสียชีวิต (ใช้กระตุ้นการเปลี่ยนเป้าหมาย) — เรียกจากที่ที่มีการตาย */
ACTIVITIES.push({ id: "mw_goal", world: "murim", group: "ชีวิต", emoji: "🎯", name: "ทบทวนเป้าหมายชีวิต", desc: "ดูความคืบหน้า หรือเปลี่ยนเป้าหมายหลัก", minAge: 13, run: (l) => { runEvent(l, "goal.review"); return { text: "" }; } });

export function noteKinDeath(l: Life, p: Person, violent: boolean, killer?: string) {
  if (!["father", "mother", "sibling", "spouse", "child"].includes(p.relation)) return;
  if (violent) {
    l.flags.mwKinKilled = l.age;
    l.flags.mwKinKilledName = shortName(p);
    l.flags.mwKillerName = killer ?? pick(l, ["ชายหน้าบากจากหุบเขาดำ", "หัวหน้าโจรภูเขาเฮยเฟิง", "นายน้อยตระกูลเหยียน", "มือสังหารไร้นาม"]);
  } else {
    l.flags.mwKinSick = l.age;
    l.flags.mwKinSickName = shortName(p);
  }
  relOf(p);
}
