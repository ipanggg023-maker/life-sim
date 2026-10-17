// M19 — ทีมของคุณเอง: ตั้งทีม รับคน เลเวลอัป ตาย ทรยศ ย้ายไปทีมใหญ่ ตกหลุมรัก
import type { Ctx, GameEvent } from "../../engine/events";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, people, shortName } from "../../engine/util";
import { fightOdds, gainExp, survivalOdds } from "../hunter/power";
import { BEHIND, ROLES, TEAM_MAX, addMate, hasRole, rosterOf, team, teamName, teamSize, updateMate, type RoleId } from "./m19sys";
import { bad, big, byId, climbing, floor, foe, good, hurt, killMate, leaveTeam, makeMate, meh, prepMember, prepStranger } from "./m19util";

const canRecruit = (l: Life) => climbing(l) && teamSize(l) < TEAM_MAX;
const hasTeam = (l: Life, n = 1) => climbing(l) && teamSize(l) >= n;
const missing = (l: Life, role: RoleId) => canRecruit(l) && !hasRole(l, role);

/** ตัวเลือกรับสมาชิกใหม่ที่ใช้ซ้ำ */
function recruitChoices(role: RoleId, arch: string, joined: (name: string) => string, lv = 1) {
  return [
    {
      label: `รับเข้าทีมเป็น${ROLES[role].emoji}${ROLES[role].name}`,
      run: (l: Life, c: Ctx) => {
        const p = makeMate(l, c, role, arch, lv);
        addStat(l, "happiness", 3);
        return good(`${joined(shortName(p))} — ทีม${teamName(l) ? `「${teamName(l)}」` : "ของคุณ"}มี ${teamSize(l)} คนแล้ว`);
      },
    },
    { label: "ปฏิเสธอย่างสุภาพ", run: () => meh("เขาพยักหน้า แล้วไปนั่งรอทีมอื่นที่มุมห้อง") },
  ];
}

const NAMES = ["ชมรมคนไม่อยากตาย", "หมาป่าชั้นสาม", "ข้าวมันไก่ไร้พ่าย", "เงาแห่งยอดหอคอย", "ทีมยังไม่ได้ตั้งชื่อ", "ดาวตกขึ้น", "โคมไฟหลังเที่ยงคืน", "ผู้ไม่ทิ้งกัน"];

export const M19_TEAM: GameEvent[] = [
  {
    id: "t19.team.found",
    minAge: 10,
    maxAge: 70,
    weight: 30,
    when: (l) => climbing(l) && !teamName(l) && floor(l) >= 2,
    title: "ตั้งทีม",
    prepare: (l) => {
      const pool = [...NAMES];
      const a = pool.splice(randInt(l, 0, pool.length - 1), 1)[0];
      const b = pool.splice(randInt(l, 0, pool.length - 1), 1)[0];
      return { a, b };
    },
    text: () => "เจ้าหน้าที่ลงทะเบียนชั้นปลอดภัยยื่นแบบฟอร์มให้ \"ชั้นต่อจากนี้ ทีมที่ไม่มีชื่อจะถูกจัดเป็น 'ผู้ท้าชิงเร่ร่อน' — ไม่มีสิทธิ์จองห้องพัก ไม่มีสิทธิ์ซื้อของลดราคา\" ช่องชื่อทีมยังว่างอยู่",
    choices: [
      { label: (_l, c) => `ตั้งชื่อ「${c.a}」`, run: (l, c) => { l.flags.t19team = String(c.a); addStat(l, "happiness", 3); return good(`ทีม「${c.a}」ถูกบันทึกในทะเบียนหอคอย — ชื่อจะลอยอยู่เหนือหัวสมาชิกทุกคนตอนเข้าบททดสอบ`); } },
      { label: (_l, c) => `ตั้งชื่อ「${c.b}」`, run: (l, c) => { l.flags.t19team = String(c.b); addStat(l, "happiness", 3); return good(`ทีม「${c.b}」ถูกบันทึกในทะเบียนหอคอย เจ้าหน้าที่หัวเราะเบาๆ ตอนพิมพ์`); } },
      { label: "ใช้นามสกุลตัวเองเป็นชื่อทีม", run: (l) => { l.flags.t19team = `ตระกูล${l.lastName}`; addFame(l, 1); return meh(`ทีม「ตระกูล${l.lastName}」 — ฟังดูยิ่งใหญ่กว่าความเป็นจริงไปหน่อย แต่ใครจะรู้`); } },
    ],
  },
  {
    id: "t19.team.r_lantern",
    minAge: 10,
    maxAge: 70,
    weight: 24,
    when: (l) => missing(l, "lantern"),
    title: "ผู้ถือโคมขี้กลัว",
    prepare: prepStranger,
    text: (_l, c) => `${c.name} ผู้ถือโคมที่ไม่มีทีมไหนเอาเพราะ 'ตกใจง่าย' ยืนสั่นอยู่หน้าห้องพักคุณ "ฉันกลัวทุกอย่าง… เพราะงั้นฉันเห็นกับดักทุกอัน"`,
    choices: recruitChoices("lantern", "ผู้ถือโคมขี้กลัวที่เห็นกับดักทุกอัน", (n) => `${n}ร้องไห้ด้วยความดีใจ แล้วตกใจเสียงตัวเองร้องไห้`),
  },
  {
    id: "t19.team.r_vanguard",
    minAge: 10,
    maxAge: 70,
    weight: 24,
    when: (l) => missing(l, "vanguard"),
    title: "หัวหอกที่ติดชั้นเดิม",
    prepare: (l) => ({ ...prepStranger(l), y: randInt(l, 3, 9) }),
    text: (_l, c) => `${c.name} หัวหอกที่ติดอยู่ชั้นเดิมมา ${c.y} ปี เพราะทีมเก่าทิ้งไป นั่งลับดาบอยู่คนเดียวในโรงอาหาร "ขอแค่ทีมที่ไม่วิ่งหนีตอนผู้คุมชั้นคำราม"`,
    choices: recruitChoices("vanguard", "หัวหอกพูดน้อยที่เคยติดชั้นเดิมหลายปี", (n) => `${n}ลุกขึ้นเก็บดาบโดยไม่พูดสักคำ แล้วเดินไปยืนหน้าสุดของทีมทันที`, 4),
  },
  {
    id: "t19.team.r_lancer",
    minAge: 10,
    maxAge: 70,
    weight: 24,
    when: (l) => missing(l, "lancer"),
    title: "มือขว้างหอกจอมโวยวาย",
    prepare: prepStranger,
    text: (_l, c) => `${c.name} มือขว้างหอกที่ขว้างแม่นที่สุดในรุ่น แต่ถูกไล่ออกจากสามทีมเพราะ 'พูดมาก' ยืนเถียงกับตู้ขายน้ำอยู่ "เอ็งกินเหรียญข้าไปสามเหรียญแล้วนะ!"`,
    choices: recruitChoices("lancer", "มือขว้างหอกจอมโวยวาย", (n) => `${n}ตบไหล่คุณแรงจนเซ "ตัดสินใจถูกที่สุดในชีวิตแล้วเพื่อน!" — แล้วก็พูดต่ออีกสี่สิบนาที`),
  },
  {
    id: "t19.team.r_wave",
    minAge: 10,
    maxAge: 70,
    weight: 24,
    when: (l) => missing(l, "wave"),
    title: "อัจฉริยะควบคุมพลังงาน",
    prepare: prepStranger,
    text: (_l, c) => `${c.name} ผู้ควบคุมพลังงานอายุน้อยที่ทำข้อสอบประเมินได้คะแนนเต็ม แต่ไม่มีใครกล้ารับเพราะเคยทำห้องฝึกระเบิดสองห้อง "ห้องที่สามไม่ใช่ความผิดฉันนะ"`,
    choices: recruitChoices("wave", "อัจฉริยะควบคุมพลังงานที่ทำห้องฝึกระเบิด", (n) => `${n}ยิ้มกว้าง แล้วผมของทุกคนในทีมก็ลุกชี้ขึ้นเพราะไฟฟ้าสถิต`, 2),
  },
  {
    id: "t19.team.r_scout",
    minAge: 10,
    maxAge: 70,
    weight: 24,
    when: (l) => missing(l, "scout"),
    title: "หน่วยสอดแนมที่ยิ้มตลอดเวลา",
    prepare: prepStranger,
    text: (_l, c) => `ระหว่างคุณนอนพัก มีคนวางแผนที่ทางลัดของชั้นถัดไปไว้บนหน้าอก พร้อมโน้ต 'ถ้าชอบ รับฉันเข้าทีมนะ — ${c.name} (หน่วยสอดแนม) ป.ล. ฉันอยู่ข้างหลังคุณ'`,
    choices: recruitChoices("scout", "หน่วยสอดแนมที่ยิ้มตลอดเวลา", (n) => `${n}โผล่มาจากหลังคุณจริงๆ คุณสะดุ้งจนตกเตียง`),
  },
  {
    id: "t19.team.r_noble",
    minAge: 14,
    maxAge: 60,
    weight: 6,
    when: (l) => canRecruit(l) && floor(l) >= 20,
    title: "ลูกตระกูลชั้นบนที่หนีออกจากบ้าน",
    prepare: prepStranger,
    text: (_l, c) => `${c.name} ทายาทตระกูลผู้ปกครองชั้นบนหนีลงมาชั้นล่าง ปลอมตัวด้วยการใส่แว่นกันแดดอันเดียว (ซึ่งใครๆ ก็จำได้) "ข้าอยากปีนด้วยฝีมือตัวเอง — ไม่ใช่นั่งรถลิฟต์ของตระกูล"`,
    choices: [
      {
        label: "รับเข้าทีม (เสี่ยงมีเรื่องกับตระกูล)",
        run: (l, c) => {
          const p = makeMate(l, c, pick(l, ["wave", "lancer"] as RoleId[]), "ลูกตระกูลชั้นบนที่หนีออกจากบ้าน", 6);
          l.flags.t19nobleMate = p.id;
          addMoney(l, 300_000);
          return good(`${shortName(p)}จ่ายค่าเข้าทีมด้วยแหวนวงเดียวที่มีค่ากว่าห้องพักทั้งชั้น — "ถือว่าค่าที่พัก"`);
        },
      },
      { label: "แจ้งตระกูลเพื่อรับรางวัล", run: (l) => { addMoney(l, 2_000_000); addFame(l, -4); return bad("องครักษ์ของตระกูลลากตัวไปภายในหนึ่งชั่วโมง เขามองคุณตลอดทางจนลับตา"); } },
      { label: "ไม่ยุ่ง", run: () => meh("คุณทำเป็นไม่เห็นแว่นกันแดดอันนั้น") },
    ],
  },
  {
    id: "t19.team.behind_return",
    minAge: 10,
    maxAge: 80,
    weight: 16,
    when: (l) => canRecruit(l) && l.people.some((p) => p.alive && p.job === BEHIND),
    title: "คนที่ตามขึ้นมา",
    prepare: (l) => ({ id: pick(l, l.people.filter((p) => p.alive && p.job === BEHIND)).id }),
    text: (l, c) => `${shortName(byId(l, c)!)} เพื่อนร่วมทีมที่ติดอยู่ชั้นล่างตอนกฎ 'ผ่านได้แค่ครึ่งหนึ่ง' ปีนตามขึ้นมาถึงจนได้ แผลเต็มตัว ยืนหอบอยู่หน้าประตูห้องพัก "ยัง… มีที่ว่างให้ฉันไหม"`,
    choices: [
      { label: "กอด แล้วพากลับเข้าทีม", run: (l, c) => { const p = byId(l, c)!; p.relation = "ally"; p.job = "เพื่อนร่วมทีมที่ปีนตามขึ้นมาเอง"; p.bond = clamp(p.bond + 15, 0, 100); addMate(l, p, undefined, 3); addStat(l, "happiness", 8); return good(`ทั้งทีมกรูกันเข้าไปกอด${shortName(p)} — คืนนั้นไม่มีใครนอน`); } },
      { label: "บอกว่าทีมเต็มแล้ว", run: (l, c) => { const p = byId(l, c)!; p.relation = "rival"; p.job = "อดีตเพื่อนร่วมทีมที่ถูกทิ้ง"; addStat(l, "happiness", -6); return bad(`${shortName(p)}พยักหน้าช้าๆ "เข้าใจแล้ว" — เสียงนั้นไม่ได้เข้าใจเลย`); } },
    ],
  },
  {
    id: "t19.team.levelup",
    minAge: 10,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => (hasTeam(l) ? 9 : 0),
    title: "ทะลวงขีดจำกัด",
    prepare: (l) => prepMember(l),
    text: (_l, c) => `ระหว่างซ้อมตอนดึก ${c.name} (${c.role}) จู่ๆ ก็ปล่อยพลังออกมาสว่างไปทั้งห้องฝึก "เดี๋ยว… อันนี้ฉันทำได้ตั้งแต่เมื่อไหร่"`,
    choices: [
      { label: "ช่วยซ้อมต่อจนเช้า", run: (l, c) => { updateMate(l, String(c.id), (m) => { m.lv += 3; }); const p = byId(l, c); if (p) p.bond = clamp(p.bond + 5, 0, 100); addStat(l, "health", -2); gainExp(l, 150); return good(`${c.name}ขึ้นเป็น Lv.${Number(c.lv) + 3}! ตอนเช้าทั้งคู่หลับคาห้องฝึก`); } },
      { label: "จัดปาร์ตี้ฉลองทั้งทีม", run: (l, c) => { updateMate(l, String(c.id), (m) => { m.lv += 2; }); for (const x of team(l)) x.p.bond = clamp(x.p.bond + 3, 0, 100); addMoney(l, -30_000); return good(`หมูกระทะบนชั้นปลอดภัย! ${c.name}ได้ Lv.${Number(c.lv) + 2} และได้ฉายาใหม่จากทีมว่า 'ไฟฉายเดินได้'`); } },
    ],
  },
  {
    id: "t19.team.poached",
    minAge: 10,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => (hasTeam(l) && team(l).some((x) => x.m.lv >= 6) ? 10 : 0),
    title: "ทีมใหญ่มาซื้อตัว",
    prepare: (l) => ({ ...prepMember(l, (x) => x.m.lv >= 6), big: pick(l, ["สมาพันธ์ผู้มุ่งยอดหอคอย", "กิลด์เหยี่ยวเงิน", "ทีมของตระกูลผู้ปกครองชั้นบน"]) }),
    text: (_l, c) => `${c.big}ยื่นข้อเสนอให้ ${c.name} ย้ายทีม — เงินเดือนสิบเท่า ห้องพักชั้นบน และทางลัดสามชั้น ${c.name}ยังไม่ตอบ แค่มองหน้าคุณอยู่`,
    choices: [
      { label: "บอกให้ไป — อนาคตของเขาสำคัญกว่า", run: (l, c) => { const p = byId(l, c)!; leaveTeam(l, p, "friend", `อดีตเพื่อนร่วมทีม (ย้ายไป${c.big})`); p.bond = clamp(p.bond + 10, 0, 100); addFame(l, 2); return meh(`${c.name}กอดคุณนานมาก "ถ้าเจอกันบนยอด ฉันจะรอ" — ทีมคุณเหลือ ${teamSize(l)} คน`); } },
      { label: "สู้ราคา", check: { stat: "smarts", dc: 55 }, skill: ["business"], run: (l, c, ok) => { const p = byId(l, c)!; if (ok) { addMoney(l, -Math.min(Math.max(0, l.money), 1_000_000)); p.bond = clamp(p.bond + 6, 0, 100); return good(`คุณเสนอส่วนแบ่งรางวัลที่มากขึ้นกับตำแหน่งรองหัวหน้าทีม — ${c.name}ฉีกสัญญาของ${c.big}ต่อหน้าทูต`); } leaveTeam(l, p, "friend", `อดีตเพื่อนร่วมทีม (ย้ายไป${c.big})`); return bad(`เงินของคุณไม่ใกล้เคียงเลย ${c.name}ขอโทษแล้วเก็บของออกไปตอนเช้า`); } },
      { label: "ขอให้อยู่เพราะเราเป็นทีม", check: { stat: "looks", dc: 50 }, skill: ["social"], run: (l, c, ok) => { const p = byId(l, c)!; if (ok || p.bond >= 75) { p.bond = clamp(p.bond + 10, 0, 100); return good(`${c.name}หัวเราะ "ตอบไปตั้งแต่เมื่อวานแล้วว่าไม่ไป แค่อยากฟังคุณพูดแบบนี้"`); } leaveTeam(l, p, "rival", `อดีตเพื่อนร่วมทีม (ย้ายไป${c.big})`); return bad(`"ทีมเหรอ? ทีมที่เกือบตายทุกชั้นน่ะเหรอ" — ${c.name}ไปพร้อมคำพูดที่คุณจำได้ทุกคำ`); } },
    ],
  },
  {
    id: "t19.team.traitor",
    minAge: 10,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (hasTeam(l) && team(l).some((x) => x.p.bond < 40) ? 10 : 0),
    title: "หนอนในทีม",
    prepare: (l) => prepMember(l, (x) => x.p.bond < 40),
    text: (_l, c) => `ทีมคู่แข่งรู้เส้นทางลัดของคุณก่อนทุกครั้ง หน่วยสอดแนมแอบเห็น ${c.name} คุยกับคนของทีมนั้นหลังห้องอาบน้ำ`,
    choices: [
      { label: "เผชิญหน้าต่อหน้าทั้งทีม", run: (l, c) => { const p = byId(l, c)!; leaveTeam(l, p, "rival", "อดีตเพื่อนร่วมทีมผู้ทรยศ"); for (const x of team(l)) x.p.bond = clamp(x.p.bond + 4, 0, 100); return bad(`${c.name}ไม่ปฏิเสธ "พวกนั้นจ่ายดีกว่า แล้วก็ไม่เคยลืมชื่อฉันเหมือนพวกแก" — ประโยคสุดท้ายทำทั้งทีมเงียบ`); } },
      { label: "แกล้งปล่อยเส้นทางปลอมให้หลุดไป", check: { stat: "smarts", dc: 55 }, run: (l, c, ok) => { if (ok) { addFame(l, 3); gainExp(l, 300); const p = byId(l, c)!; leaveTeam(l, p, "rival", "อดีตเพื่อนร่วมทีมผู้ทรยศ"); return good(`ทีมคู่แข่งเดินเข้าห้องกับดักทั้งทีม — ${c.name}หายตัวไปก่อนเช้า`); } return bad("ทีมคู่แข่งไม่หลงกล และตอนนี้รู้ว่าคุณรู้แล้ว"); } },
      { label: "คุยกันตัวต่อตัว ถามว่าทำไม", run: (l, c) => { const p = byId(l, c)!; p.bond = clamp(p.bond + 25, 0, 100); return meh(`${c.name}ร้องไห้ — แม่ป่วยหนักบนโลก ค่ารักษาต้องใช้เงินชั้นบน คุณแบ่งรางวัลชั้นถัดไปให้ทั้งหมด เขาไม่เคยทรยศอีกเลย`); } },
    ],
  },
  {
    id: "t19.team.confess",
    minAge: 14,
    maxAge: 70,
    weight: (l) => (hasTeam(l) && team(l).some((x) => x.p.relation === "ally" && (x.m.love ?? 0) >= 1) && !people(l, "spouse").length ? 14 : 0),
    title: "คำสารภาพบนเกาะลอยฟ้า",
    prepare: (l) => prepMember(l, (x) => x.p.relation === "ally" && (x.m.love ?? 0) >= 1),
    text: (_l, c) => `คืนก่อนบททดสอบใหญ่ ${c.name} ชวนคุณไปนั่งริมเกาะลอยฟ้า ดาวของหอคอยอยู่ใกล้จนเอื้อมถึง "ถ้าพรุ่งนี้ใครคนหนึ่งไม่รอด… ฉันไม่อยากเสียใจที่ไม่ได้พูด — ฉันชอบนาย/เธอ"`,
    choices: [
      { label: "ตอบรับ", run: (l, c) => { const p = byId(l, c)!; p.relation = "partner"; p.bond = clamp(p.bond + 15, 0, 100); updateMate(l, p.id, (m) => { m.love = 3; }); addStat(l, "happiness", 12); return { text: `ทีมคุณมีคู่รักหนึ่งคู่แล้ว — สมาชิกที่เหลือพูดพร้อมกันว่า "รู้มานานแล้ว"`, kind: "good" }; } },
      { label: "ขอให้เป็นเพื่อนร่วมทีมต่อไป", run: (l, c) => { const p = byId(l, c)!; updateMate(l, p.id, (m) => { m.love = 0; }); p.bond = clamp(p.bond - 8, 0, 100); return meh(`${c.name}ยิ้ม "โอเค… งั้นพรุ่งนี้ห้ามตายนะ เพื่อนร่วมทีม" — ทั้งคืนไม่มีใครพูดอะไรอีก`); } },
    ],
  },
  {
    id: "t19.team.mates_love",
    minAge: 14,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => (hasTeam(l, 3) ? 6 : 0),
    title: "คู่รักในทีม",
    prepare: (l) => {
      const t = team(l);
      const a = pick(l, t);
      const b = pick(l, t.filter((x) => x.p.id !== a.p.id));
      return { a: shortName(a.p), b: shortName(b.p), ida: a.p.id, idb: b.p.id };
    },
    text: (_l, c) => `${c.a}กับ${c.b}คบกันลับๆ มาสามเดือน (ซึ่งทุกคนรู้ตั้งแต่วันที่สอง) วันนี้ทั้งคู่ทะเลาะกันกลางห้องพักเรื่องใครลืมเก็บผ้า และไม่ยอมเข้าบททดสอบพร้อมกัน`,
    choices: [
      { label: "ขังทั้งคู่ไว้ในห้องเดียวกันจนกว่าจะคืนดี", check: { stat: "looks", dc: 45 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 4, 0, 100); return good("สองชั่วโมงต่อมาทั้งคู่ออกมาจับมือกัน แล้วโกรธคุณแทน — ทีมกลับมาเหมือนเดิม"); } l.flags.t19teamRift = true; return bad("ทั้งคู่เลิกกันในห้องนั้น ทีมแตกเป็นสองฝั่ง (ความเข้าขาลดลงชั่วคราว)"); } },
      { label: "ออกกฎห้ามคบกันในทีม", run: (l, c) => { l.flags.t19teamRift = true; const b = l.people.find((p) => p.id === c.idb); if (b) b.bond = clamp(b.bond - 15, 0, 100); return bad(`ทั้งทีมโหวตคว่ำกฎของคุณสี่ต่อหนึ่ง — ${c.b}ไม่คุยกับคุณไปหนึ่งเดือน`); } },
      { label: "ปล่อยให้เคลียร์กันเอง", run: () => meh("พวกเขาคืนดีกันในสามวัน และทะเลาะกันใหม่ในวันที่สี่ — วงจรชีวิตตามปกติของคู่รักในหอคอย") },
    ],
  },
  {
    id: "t19.team.corridor_ambush",
    minAge: 10,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => (hasTeam(l) ? 4 : 0),
    title: "ซุ่มโจมตีในทางเดิน",
    prepare: (l) => prepMember(l),
    text: (_l, c) => `ทางเดินระหว่างชั้นไม่มีกล้องถ่ายทอด — นักล่าผู้ท้าชิงลากตัว ${c.name} เข้าไปในความมืด เสียงร้องของ${c.name}ดังสะท้อนกลับมา`,
    choices: [
      {
        label: "พุ่งเข้าไปช่วย",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 0), 0.05),
        survival: (l) => survivalOdds(l, foe(l, 0)),
        run: (l, c, ok) => {
          const p = byId(l, c);
          if (ok) { if (p) p.bond = clamp(p.bond + 15, 0, 100); updateMate(l, String(c.id), (m) => { m.love = Math.min(3, (m.love ?? 0) + 1); }); addFame(l, 3); return good(`คุณลากตัว${c.name}ออกมาได้ทั้งที่แขนหัก "…บ้าหรือเปล่า" ${c.name}พูดทั้งน้ำตา`); }
          if (p) killMate(l, p);
          return bad(`คุณไปถึงช้าไปสามวินาที — สามวินาทีที่คุณจะนับไปตลอดชีวิต${hurt(l, 10, 22, "บาดแผลจากนักล่าผู้ท้าชิงในทางเดิน")}`);
        },
      },
      {
        label: "ให้ทั้งทีมบุกพร้อมกัน",
        show: (l) => teamSize(l) >= 3,
        check: { stat: "smarts", dc: 50 },
        run: (l, c, ok) => {
          const p = byId(l, c);
          if (ok) { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 5, 0, 100); return good(`แผนล้อมสามทาง! นักล่าวิ่งหนีทิ้งอาวุธ ${c.name}ได้รับการช่วยเหลือ`); }
          if (p && chance(l, 0.5)) { killMate(l, p); return bad(`ทีมช้ากว่าที่วางแผน — ${c.name}ไม่รอด`); }
          return bad(`${c.name}รอดมาได้แต่บาดเจ็บหนัก ต้องพักทั้งปี`);
        },
      },
      { label: "วิ่งหนีไปตามคนช่วย", run: (l, c) => { const p = byId(l, c); if (p && chance(l, 0.6)) { killMate(l, p); addStat(l, "happiness", -15); return bad(`กว่าผู้ดูแลชั้นจะมาถึง ทางเดินก็เงียบแล้ว`); } if (p) p.bond = clamp(p.bond - 20, 0, 100); return meh(`${c.name}รอด แต่ไม่มองหน้าคุณอีกเลย`); } },
    ],
  },
  {
    id: "t19.team.homesick",
    minAge: 10,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (hasTeam(l) ? 6 : 0),
    prepare: (l) => prepMember(l),
    title: "อยากกลับบ้าน",
    text: (_l, c) => `${c.name}นั่งดูรูปลูกสาวที่เพิ่งหัดเดินบนโลก "ฉันไม่ได้เห็นก้าวแรกของเธอ… ถ้าปีนต่อ ฉันจะไม่ได้เห็นอะไรอีกเลย"`,
    choices: [
      { label: "ให้ลงไปหาครอบครัว", run: (l, c) => { const p = byId(l, c)!; leaveTeam(l, p, "friend", "อดีตเพื่อนร่วมทีม (กลับไปใช้ชีวิตบนโลก)"); p.bond = clamp(p.bond + 15, 0, 100); addStat(l, "happiness", 2); return meh(`ปีต่อมามีวิดีโอส่งมา — ลูกสาวของ${c.name}วิ่งเข้ากล้องแล้วพูดว่า 'ขอบคุณค่ะ'`); } },
      { label: "ขอให้อยู่จนถึงชั้นหน้า", run: (l, c) => { const p = byId(l, c)!; p.bond = clamp(p.bond - 10, 0, 100); return meh(`${c.name}พยักหน้า แต่ทุกคืนยังดูรูปนั้นอยู่`); } },
    ],
  },
  {
    id: "t19.team.captain_vote",
    minAge: 12,
    maxAge: 80,
    weight: (l) => (hasTeam(l, 3) && !l.flags.t19captain ? 8 : 0),
    title: "เลือกหัวหน้าทีม",
    text: () => "ระบบหอคอยบังคับให้ทีมที่ผ่านชั้น 10 ต้องมีหัวหน้าทีมอย่างเป็นทางการ — หัวหน้าทีมได้เสียงโหวตสองเสียงในบททดสอบโหวต และรับผิดชอบทุกศพ",
    choices: [
      { label: "เสนอตัวเอง", run: (l) => { l.flags.t19captain = "you"; addFame(l, 2); return good("ทุกคนยกมือพร้อมกันเร็วจนคุณสงสัยว่าพวกเขาแค่ไม่อยากรับผิดชอบ"); } },
      { label: "เสนอเพื่อนร่วมทีมที่เก่งที่สุด", run: (l) => { const x = team(l).sort((a, b) => b.m.lv - a.m.lv)[0]; l.flags.t19captain = x.p.id; x.p.bond = clamp(x.p.bond + 10, 0, 100); return meh(`${shortName(x.p)}เป็นหัวหน้าทีม — คนแรกที่${shortName(x.p)}ขอบคุณคือคุณ`); } },
      { label: "เสนอให้ไม่มีหัวหน้า หมุนเวียนกันทุกชั้น", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { l.flags.t19captain = "rotate"; if (ok) { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 4, 0, 100); return good("หอคอยยอมรับระบบหมุนเวียน — ทีมแรกในรอบสิบปีที่ทำได้"); } return meh("หอคอยยอมรับ แต่ทุกชั้นจะเสียเวลาเถียงกันว่าเป็นตาใคร"); } },
    ],
  },
  {
    id: "t19.team.cook_war",
    minAge: 10,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (hasTeam(l, 2) ? 5 : 0),
    prepare: (l) => prepMember(l),
    text: (_l, c) => `${c.name}ประกาศว่าจะทำกับข้าวให้ทีมทุกมื้อ "ฉันเคยทำงานร้านข้าวต้มตอนอยู่บนโลก" — สามวันแรกทุกคนท้องเสีย`,
    choices: [
      { label: "สอนทำกับข้าวใหม่ทั้งหมด", check: { stat: "smarts", dc: 40 }, skill: ["cook"], run: (l, c, ok) => { if (ok) { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 4, 0, 100); addStat(l, "health", 3); return good(`ข้าวต้มของ${c.name}กลายเป็นเมนูที่ทีมอื่นมาขอซื้อ`); } return meh("ตอนนี้ท้องเสียกันสองคนครัว"); } },
      { label: "ยอมกินต่อเพื่อน้ำใจ", run: (l, c) => { addStat(l, "health", -3); const p = byId(l, c); if (p) p.bond = clamp(p.bond + 10, 0, 100); return meh(`คุณกินจนหมดจาน ${c.name}ซึ้งใจจนทำให้อีกสองจาน`); } },
    ],
  },
  {
    id: "t19.team.rival_team",
    minAge: 12,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (hasTeam(l, 2) && !!teamName(l) ? 7 : 0),
    title: "ทีมคู่ปรับ",
    text: (l) => `ทีม 'ราชาชั้นกลาง' ประกาศผ่านจอทุกชั้นว่าจะบดขยี้ทีม「${teamName(l)}」ในบททดสอบหน้า ผู้ชมบนโลกตั้งแฮชแท็กสงครามทีมจนติดเทรนด์`,
    choices: [
      { label: "ตอบกลับผ่านจอแบบเท่ๆ", check: { stat: "looks", dc: 50 }, skill: ["perform", "social"], run: (l, _c, ok) => { if (ok) { addFame(l, 5); return good("\"เจอกันที่ชั้นหน้า — ถ้าพวกนายมาถึง\" คลิปนั้นมียอดวิวมากกว่าการปีนของพวกเขาทั้งปี"); } addFame(l, -1); return meh("ไมค์ดับกลางประโยค ทั้งหอคอยได้ยินแค่ 'เจอกันที่—'"); } },
      { label: "ไม่ตอบ ซ้อมหนักขึ้น", run: (l) => { for (const x of team(l)) updateMate(l, x.p.id, (m) => { m.lv += 1; }); gainExp(l, 200); return good("ทั้งทีมซ้อมสองเท่า ทุกคนขึ้นหนึ่งเลเวล"); } },
      { label: "ชวนทีมนั้นกินข้าว", run: (l) => { addStat(l, "happiness", 4); return meh("หัวหน้าทีมนั้นมาจริง และเมาจนร้องไห้ว่าที่จริงเขาแค่อยากมีเพื่อน"); } },
    ],
  },
  {
    id: "t19.team.legacy",
    minAge: 12,
    maxAge: 90,
    weight: (l) => (Number(l.flags.t19fallen ?? 0) >= 1 && climbing(l) ? 6 : 0),
    title: "ชื่อบนกำแพง",
    text: () => "ชั้นปลอดภัยมีกำแพงสลักชื่อผู้ท้าชิงที่ตายในหอคอย คุณมาหยุดหน้าชื่อของเพื่อนร่วมทีมที่จากไป มีคนวางดอกไม้ไว้แล้ว — ไม่ใช่คุณ",
    choices: [
      { label: "สลักชื่อทีมไว้ใต้ชื่อเขา", run: (l) => { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 5, 0, 100); addStat(l, "happiness", 2); return good("ทุกคนในทีมมาสลักนิ้วโป้งลงข้างชื่อ — คนที่ตายไปแล้วยังเป็นสมาชิกทีมเสมอ"); } },
      { label: "สาบานว่าจะพาชื่อนี้ไปถึงยอด", run: (l) => { l.flags.t19vow = true; gainExp(l, 200); return meh("เสียงสาบานเบาๆ ของคุณดังก้องทั้งห้อง คนแปลกหน้าที่ยืนข้างๆ ก้มหัวให้"); } },
    ],
  },
  {
    id: "t19.team.big_merge",
    minAge: 14,
    maxAge: 80,
    weight: (l) => (hasTeam(l, 3) && floor(l) >= 40 ? 5 : 0),
    title: "ข้อเสนอควบรวมทีม",
    text: (l) => `สมาพันธ์ผู้มุ่งยอดหอคอยเสนอควบรวมทีม「${teamName(l) || "ของคุณ"}」เข้าเป็นหน่วยย่อย — ได้ทรัพยากรไม่จำกัด แต่ชื่อทีมจะหายไป และคุณจะไม่ใช่คนตัดสินใจอีก`,
    choices: [
      { label: "ปฏิเสธ — ทีมนี้เป็นของเรา", run: (l) => { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 8, 0, 100); addFame(l, 3); return good("ทั้งทีมเชียร์เสียงดังจนสมาพันธ์ได้ยินถึงชั้นบน"); } },
      { label: "ตอบรับ", run: (l) => { addMoney(l, 10_000_000); for (const x of team(l)) x.p.bond = clamp(x.p.bond - 10, 0, 100); delete l.flags.t19team; return meh("ป้ายชื่อทีมถูกถอดออกจากประตู ห้องพักใหม่หรูกว่าเดิมสิบเท่า แต่เงียบกว่าเดิมเยอะ"); } },
    ],
  },
  {
    id: "t19.team.mate_secret",
    minAge: 12,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (hasTeam(l) ? 4 : 0),
    prepare: (l) => prepMember(l),
    title: "ความลับของเพื่อนร่วมทีม",
    text: (_l, c) => `คุณเห็น ${c.name} คุกเข่าคุยกับผู้ดูแลชั้นตอนดึก ประโยคเดียวที่ได้ยินคือ "อีกสองชั้น… แล้วข้าจะส่งพวกเขาให้"`,
    choices: [
      { label: "แอบตามไปฟังต่อ", check: { stat: "luck", dc: 50 }, run: (l, c, ok) => { if (ok) { updateMate(l, String(c.id), (m) => { m.lv += 2; }); return good(`ที่แท้${c.name}ต่อรองขอให้ผู้ดูแลชั้น 'ส่งพวกเขาขึ้นไปก่อน' ถ้า${c.name}ตาย — แลกด้วยอายุขัยของตัวเอง คุณไม่บอกใคร แต่ทีมคุณจะไม่มีใครตายก่อน${c.name}`); } return bad("ผู้ดูแลชั้นหันมามองตรงที่คุณซ่อน แล้วยิ้ม"); } },
      { label: "ถามตรงๆ ตอนเช้า", run: (l, c) => { const p = byId(l, c); if (p) p.bond = clamp(p.bond + 6, 0, 100); return meh(`${c.name}หัวเราะกลบเกลื่อน "นายฟังผิดแล้ว" — แต่ตาไม่ได้หัวเราะด้วย`); } },
    ],
  },
  {
    id: "t19.team.newbie_mentee",
    minAge: 20,
    maxAge: 80,
    weight: (l) => (canRecruit(l) && floor(l) >= 25 ? 6 : 0),
    title: "เด็กใหม่ที่อยากเข้าทีม",
    prepare: (l) => ({ ...prepStranger(l), role: pick(l, Object.keys(ROLES)) }),
    text: (_l, c) => `${c.name} ผู้ท้าชิงหน้าใหม่อายุสิบแปด ตามคุณมาจากชั้น 1 ด้วยการดูถ่ายทอดสดทุกตอน "ผมจำท่าของพี่ได้ทุกท่า — ขอเป็นเด็กฝึกในทีมได้ไหม"`,
    choices: [
      { label: "รับเป็นศิษย์ในทีม", run: (l, c) => { const p = makeMate(l, c, c.role as RoleId, "เด็กใหม่ที่ตามดูคุณมาตั้งแต่ชั้น 1", 1, 70, -10); l.flags.t19mentee = p.id; addStat(l, "happiness", 4); return good(`${shortName(p)}เลียนแบบทุกอย่างที่คุณทำ รวมถึงนิสัยกินข้าวเร็วเกินไป`); } },
      { label: "บอกว่าให้ไปหาทีมที่เหมาะกับตัวเอง", run: () => meh("เด็กคนนั้นก้มหัวขอบคุณเก้าสิบองศา แล้ววิ่งไปทางทีมอื่นด้วยความมุ่งมั่นเท่าเดิม") },
    ],
  },
  {
    id: "t19.team.anniversary",
    minAge: 12,
    maxAge: 90,
    weight: (l) => (hasTeam(l, 2) && !!teamName(l) ? 4 : 0),
    text: (l) => `ครบรอบการตั้งทีม「${teamName(l)}」 สมาชิกทุกคนเขียนคำอธิษฐานแขวนไว้ที่หน้าต่างห้องพัก ของคุณเขียนว่าอะไร?`,
    choices: [
      { label: "'ขอให้ทุกคนอยู่ครบในปีหน้า'", run: (l) => { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 5, 0, 100); return good("ทุกคนอ่านแล้วเงียบไป แล้วก็เขียนของตัวเองใหม่เป็นประโยคเดียวกัน"); } },
      { label: "'ขอให้ถึงยอดหอคอย'", run: (l) => { gainExp(l, 200); return meh("มีคนเขียนต่อท้ายว่า 'และขอให้หัวหน้าเลิกกรนด้วย'"); } },
      { label: "'ขอหมูกระทะทุกคืน'", run: (l) => { addStat(l, "happiness", 4); return good("คำอธิษฐานของคุณเป็นข้อเดียวที่เป็นจริงในปีนั้น"); } },
    ],
  },
  {
    id: "t19.team.leave_you",
    minAge: 12,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (hasTeam(l) && team(l).some((x) => x.p.bond < 30) ? 8 : 0),
    prepare: (l) => prepMember(l, (x) => x.p.bond < 30),
    title: "จดหมายลาออก",
    text: (_l, c) => `เช้านี้เตียงของ ${c.name} ว่างเปล่า มีจดหมายวางไว้ 'ฉันไม่อยากตายในทีมที่ไม่มีใครเห็นฉัน'`,
    choices: [
      { label: "วิ่งตามไปที่ประตูชั้น", check: { stat: "health", dc: 45 }, run: (l, c, ok) => { const p = byId(l, c); if (ok && p) { p.bond = clamp(p.bond + 25, 0, 100); return good(`คุณไปทันก่อนประตูปิด — ${c.name}ยอมกลับมา เพราะคุณวิ่งมาแบบไม่ได้ใส่รองเท้า`); } if (p) leaveTeam(l, p, "friend", "อดีตเพื่อนร่วมทีม (ลาออก)"); return bad("ประตูปิดลงต่อหน้าคุณพอดี"); } },
      { label: "ปล่อยไป", run: (l, c) => { const p = byId(l, c); if (p) leaveTeam(l, p, "friend", "อดีตเพื่อนร่วมทีม (ลาออก)"); addStat(l, "happiness", -4); return meh("คุณพับจดหมายเก็บ แล้วลองนึกว่าครั้งสุดท้ายที่ถามว่าเขาเป็นยังไงคือเมื่อไหร่ — นึกไม่ออก"); } },
    ],
  },
  {
    id: "t19.team.full_roster",
    minAge: 12,
    maxAge: 80,
    weight: (l) => (climbing(l) && teamSize(l) >= TEAM_MAX && new Set(team(l).map((x) => x.m.role)).size >= 5 && !l.flags.t19fullTeam ? 20 : 0),
    title: "ทีมครบห้าตำแหน่ง",
    text: () => "[หอคอย] ตรวจพบทีมที่มีครบทั้งห้าตำแหน่ง — หัวหอก มือขว้างหอก ผู้ถือโคม ผู้ควบคุมพลังงาน หน่วยสอดแนม ประตูชั้นปลอดภัยเปิดห้องพักพิเศษให้",
    auto: (l) => { l.flags.t19fullTeam = true; for (const x of team(l)) x.p.bond = clamp(x.p.bond + 6, 0, 100); addFame(l, 4); return "milestone"; },
  },
  {
    id: "t19.team.revenge",
    minAge: 12,
    maxAge: 80,
    weight: (l) => (climbing(l) && l.people.some((p) => p.alive && p.job === "อดีตเพื่อนร่วมทีมผู้ทรยศ") ? 5 : 0),
    title: "อดีตเพื่อนร่วมทีม",
    prepare: (l) => ({ id: pick(l, l.people.filter((p) => p.alive && p.job === "อดีตเพื่อนร่วมทีมผู้ทรยศ")).id }),
    text: (l, c) => `${shortName(byId(l, c)!)} คนที่ทรยศทีมคุณ ยืนอยู่ฝั่งตรงข้ามในบททดสอบหนึ่งต่อหนึ่ง "ไม่ต้องออมมือนะ — ฉันก็ไม่ออม"`,
    choices: [
      { label: "สู้เต็มที่", tone: "danger", odds: (l) => fightOdds(l, foe(l, 0)), survival: (l) => survivalOdds(l, foe(l, 0)), run: (l, c, ok) => { const p = byId(l, c)!; if (ok) { addFame(l, 4); gainExp(l, 400); p.job = "อดีตเพื่อนร่วมทีมที่แพ้คุณ"; return good(`${shortName(p)}นอนแผ่บนพื้น หัวเราะทั้งเลือด "ทีมเก่าฉันเลือกหัวหน้าถูกจริงๆ"`); } return bad(`คุณแพ้ — ${shortName(p)}เดินผ่านไปโดยไม่หันมามอง${hurt(l, 10, 20, "แพ้อดีตเพื่อนร่วมทีม")}`); } },
      { label: "วางอาวุธ แล้วชวนคุย", check: { stat: "looks", dc: 55 }, run: (l, c, ok) => { const p = byId(l, c)!; if (ok && teamSize(l) < TEAM_MAX) { p.relation = "ally"; p.job = "อดีตผู้ทรยศที่กลับมา"; p.bond = 50; addMate(l, p, undefined, 5); return good(`${shortName(p)}ทิ้งอาวุธตาม "…ยังเก็บเตียงฉันไว้ไหม" — ทีมรับเขากลับ แต่ไม่ให้ถือกุญแจห้องเสบียง`); } return bad(`${shortName(p)}ใช้จังหวะที่คุณวางอาวุธ โจมตีทันที${hurt(l, 8, 16, "ถูกอดีตเพื่อนร่วมทีมลอบโจมตี")}`); } },
    ],
  },
  {
    id: "t19.team.mate_wedding",
    minAge: 18,
    maxAge: 80,
    weight: (l) => (team(l).some((x) => x.p.relation === "partner" && x.p.bond >= 80) && !people(l, "spouse").length ? 10 : 0),
    title: "งานแต่งในหอคอย",
    prepare: (l) => ({ id: team(l).find((x) => x.p.relation === "partner" && x.p.bond >= 80)!.p.id }),
    text: (l, c) => `${shortName(byId(l, c)!)} คุกเข่าลงกลางห้องฝึก ในมือคือแหวนที่ทำจากเศษอาวุธของผู้คุมชั้นแรกที่คุณสองคนล้มด้วยกัน ทีมทั้งทีมแอบดูอยู่หลังประตู (ไม่เนียนเลย)`,
    choices: [
      { label: "แต่งงาน", run: (l, c) => { const p = byId(l, c)!; p.relation = "spouse"; p.bond = clamp(p.bond + 10, 0, 100); addStat(l, "happiness", 15); for (const x of team(l)) x.p.bond = clamp(x.p.bond + 5, 0, 100); return big("งานแต่งจัดบนเกาะลอยฟ้า แขกคือผู้ท้าชิงสามร้อยคน ผู้ดูแลชั้นหนึ่งคน และดวงดาวที่ส่งดอกไม้ไฟลงมาเต็มฟ้า"); } },
      { label: "ขอรอให้ถึงยอดก่อน", run: (l, c) => { const p = byId(l, c)!; p.bond = clamp(p.bond - 5, 0, 100); return meh(`${shortName(p)}ใส่แหวนให้ตัวเองแทน "งั้นอันนี้ฉันเก็บไว้ก่อน ถึงยอดเมื่อไหร่มาเอาคืน"`); } },
    ],
  },
  {
    id: "t19.team.check_roster",
    minAge: 12,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => (hasTeam(l, 2) ? 3 : 0),
    text: (l) => {
      const r = rosterOf(l);
      const best = team(l).sort((a, b) => r[b.p.id].lv - r[a.p.id].lv)[0];
      return `การจัดอันดับทีมประจำเดือนของหอคอยประกาศออกมา — ${shortName(best.p)}ติดอันดับผู้ท้าชิงน่าจับตาประจำชั้น ทีมของคุณจัดงานฉลองเล็กๆ`;
    },
    auto: (l) => { for (const x of team(l)) x.p.bond = clamp(x.p.bond + 2, 0, 100); return "good"; },
  },
];

