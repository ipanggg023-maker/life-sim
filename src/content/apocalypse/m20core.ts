// M20 — ตั้งฐาน · ออกสำรวจ · แลกเปลี่ยน · วิกฤตประจำปีของฐาน
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, checkChance, clamp, createPerson } from "../../engine/util";
import { gainExp, gateRewards, markTurn, rankName } from "../hunter/power";
import {
  SITES,
  addResident,
  addRes,
  crisisNow,
  defense,
  foundBase,
  getBase,
  hasBase,
  removeResident,
  roleCount,
  siteById,
  someResident,
  threatRank,
  tierOf,
  withBase,
  type SiteId,
} from "./base";
import { L, R, bad, baseName, big, defend, defendLive, good, hurt, mayDie, meh, who } from "./m20kit";

const offered = (c: Ctx, id: SiteId) => String(c.offer ?? "").split(",").includes(id);
const crisisDone = (l: Life) => withBase(l, (b) => { b.crises++; });
const winDone = (l: Life) => withBase(l, (b) => { b.wins++; b.crises++; });

// ───────────────────────── ตั้งฐาน ─────────────────────────

const FOUND: GameEvent = {
  id: "a20.found",
  minAge: 14,
  maxAge: 200,
  forced: true,
  when: (l) => R(l) && !hasBase(l),
  title: "ที่ที่เรียกว่าบ้าน",
  prepare: (l) => {
    const ids = SITES.map((s) => s.id);
    const pool: SiteId[] = [];
    while (pool.length < 3) {
      const s = pick(l, ids);
      if (!pool.includes(s)) pool.push(s);
    }
    return { offer: pool.join(",") };
  },
  text: (l) =>
    `${l.age < 18 ? "ผู้ใหญ่ในกลุ่มตายไปทีละคน จนเหลือแค่คุณที่มีระบบแข็งพอจะนำ" : "เมืองพังมาพักใหญ่แล้ว ผู้รอดชีวิตที่ซ่อนตัวกระจัดกระจายเริ่มมองหาคนนำ"} — ทุกคนหันมามองคุณ\n"เราต้องมีที่มั่น ที่ที่มีกำแพง มีน้ำ และมีคนเฝ้ายามตอนกลางคืน"`,
  choices: [
    ...SITES.map((s) => ({
      label: `${s.emoji} ยึด${s.name} — ${s.desc}`,
      show: (_l: Life, c: Ctx) => offered(c, s.id),
      run: (l: Life) => {
        markTurn(l);
        return big(foundBase(l, s.id));
      },
    })),
    {
      label: "บุกยึดห้างสรรพสินค้าจากแก๊งที่ยึดอยู่ (ได้ทั้งโกดังและคนของแก๊ง)",
      tone: "danger" as const,
      odds: (l: Life) => defend(0)(l),
      survival: (l: Life) => defendLive(0)(l),
      run: (l: Life, _c: Ctx, ok: boolean) => {
        if (ok) {
          const t = foundBase(l, "mall");
          addRes(l, { food: 20, mat: 15, pop: 6 });
          addFame(l, 5);
          gainExp(l, 300);
          return big(`หัวหน้าแก๊งกระโดดหนีออกทางกระจกชั้นสาม ลูกน้องที่เหลือคุกเข่า — ${t} และลูกน้องแก๊งอีก 6 คนที่ขอเปลี่ยนข้าง`);
        }
        if (mayDie(l, defendLive(0)(l), "ถูกฆ่าตอนบุกยึดห้างจากแก๊งปล้น")) return bad("กระสุนนัดหนึ่งมาจากชั้นลอย…");
        const t = foundBase(l, "subway");
        return bad(`คุณถอยพาคนหนีลงอุโมงค์รถไฟใต้ดินไปตั้งหลักแทน — ${t}${hurt(l, 8, 18, "บาดเจ็บจากการบุกห้าง")}`);
      },
    },
  ],
};

// ───────────────────────── ออกสำรวจ ─────────────────────────

const DEST = [
  { name: "ซูเปอร์มาร์เก็ตที่จมน้ำครึ่งชั้น", res: "food", emoji: "🥫", desc: "ชั้นบนยังมีกระป๋องที่ไม่บุบ — ชั้นล่างมีอะไรว่ายอยู่" },
  { name: "โรงประปาร้าง", res: "water", emoji: "💧", desc: "ถ้าซ่อมปั๊มได้ ฐานจะมีน้ำไปทั้งปี" },
  { name: "ร้านขายยาย่านเมืองเก่า", res: "med", emoji: "💊", desc: "ประตูเหล็กยังล็อกอยู่ แปลว่ายังไม่มีใครเข้าไป" },
  { name: "โกดังวัสดุก่อสร้างริมทางด่วน", res: "mat", emoji: "🧱", desc: "เหล็กเส้น ปูน แผ่นสังกะสี — ทุกอย่างที่กำแพงต้องการ" },
] as const;

export const canExpedition = (l: Life) => L(l) && !l.doneThisYear.includes("a20exp");

export function startExpedition(l: Life, dest?: number) {
  l.doneThisYear.push("a20exp");
  runEvent(l, "a20.exp", { d: dest ?? randInt(l, 0, DEST.length - 1), r: threatRank(l), team: 0, twist: randInt(l, 0, 3) });
}

const loot = (l: Life, c: Ctx, mult: number) => {
  const d = DEST[Number(c.d)];
  const n = Math.round(randInt(l, 14, 26) * mult * (1 + tierOf(getBase(l)!) * 0.15));
  return addRes(l, { [d.res]: n, mat: d.res === "mat" ? 0 : Math.round(n / 4) });
};

const EXPEDITION: GameEvent = {
  id: "a20.exp",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ออกสำรวจ",
  text: (_l, c) => {
    const d = DEST[Number(c.d)];
    return `[ภารกิจสำรวจ ระดับ ${rankName(Number(c.r))}]【${d.name}】${d.emoji}\n${d.desc}`;
  },
  choices: [
    {
      label: "ไปคนเดียว — ได้ของเต็มเป้ แต่ไม่มีใครคุ้มหลัง",
      tone: "danger",
      odds: defend(0),
      survival: defendLive(0),
      run: (l, c, ok) => {
        c.team = 0;
        if (ok) return good("คุณเคลื่อนตัวเงียบๆ จนถึงจุดหมาย", "twist");
        return bad("สัตว์อสูรได้กลิ่นคุณตั้งแต่ปากซอย" + hurt(l, 8, 16, "ตายระหว่างออกสำรวจคนเดียว"), "twist");
      },
    },
    {
      label: "พาหน่วยสำรวจห้าคน — ปลอดภัยกว่า แต่อาจมีคนไม่ได้กลับ",
      odds: (l) => clamp(defend(0)(l) + 0.2, 0.05, 0.97),
      run: (l, c, ok) => {
        c.team = 1;
        if (ok) return good("หน่วยของคุณเคลื่อนเป็นรูปขบวนแบบที่ซ้อมกันมา", "twist");
        const lost = randInt(l, 1, 2);
        return bad(`ถูกซุ่มโจมตีกลางทาง — เสียคนไป ${lost} คน${addRes(l, { pop: -lost, morale: -4 })}`, "twist");
      },
    },
    {
      label: "ส่งหน่วยไปโดยที่คุณเฝ้าฐาน",
      check: { stat: "smarts", dc: 50, bonus: (l) => roleCount(getBase(l)!, "soldier") * 0.08 },
      run: (l, _c, ok) => {
        if (ok) return good(`หน่วยกลับมาครบ พร้อมของเต็มรถเข็น${loot(l, _c, 0.6)}`);
        const lost = randInt(l, 1, 3);
        return bad(`วิทยุเงียบไปสองวัน — กลับมาแค่บางคน${addRes(l, { pop: -lost, morale: -6 })}`);
      },
    },
  ],
  scenes: {
    twist: {
      text: (_l, c) =>
        [
          "ในโกดังด้านหลังมีผู้รอดชีวิตกลุ่มเล็กๆ ซ่อนอยู่ — พวกเขาถือมีดทำครัวชี้มาที่คุณ มือสั่น",
          "ของที่ต้องการอยู่ตรงหน้า แต่บนเพดานมีรังไข่สัตว์อสูรสีเขียวเรืองแสงห้อยอยู่เป็นพวง",
          "อีกทีมหนึ่งจากฐานคู่แข่งมาถึงพร้อมกัน หัวหน้าทีมยกมือขึ้น \"แบ่งกันไหม หรือจะเอาเลือดแลก\"",
          "ทุกอย่างเงียบผิดปกติ ไม่มีสัตว์อสูรสักตัว — มีแค่ข้อความพ่นสีบนผนังว่า 'อย่าเปิดห้องเย็น'",
        ][Number(c.twist)],
      choices: [
        { label: "ชวนพวกเขากลับฐาน", show: (_l, c) => Number(c.twist) === 0, run: (l, c) => { const t = loot(l, c, 0.7); return good(`หลังคุยกันครึ่งชั่วโมง มีดก็วางลง — คุณได้ทั้งของและคนใหม่${t}${addRes(l, { pop: randInt(l, 3, 5) })}`); } },
        { label: "ขนของแล้วไปเงียบๆ", show: (_l, c) => Number(c.twist) === 0, run: (l, c) => meh(`คุณวางกระป๋องไว้ให้พวกเขาสองกระป๋อง แล้วขนที่เหลือกลับ${loot(l, c, 1)}`) },
        {
          label: "เผารังไข่ทิ้งก่อนเก็บของ",
          show: (_l, c) => Number(c.twist) === 1,
          tone: "danger",
          odds: defend(1),
          survival: defendLive(1),
          run: (l, c, ok) => {
            if (ok) { gainExp(l, 400); addFame(l, 2); return good(`ไฟลุกท่วมเพดาน เสียงกรีดร้องเล็กๆ ดังจากในไข่ — คุณกันฝูงใหม่ไม่ให้เกิดได้ทั้งย่าน${loot(l, c, 1.2)}`); }
            if (mayDie(l, defendLive(1)(l), "ถูกสัตว์อสูรที่ฟักออกจากรังรุมกัด")) return bad("ไข่ใบหนึ่งแตกก่อนไฟจะถึง…");
            return bad(`ไข่ฟักออกมาพร้อมกันสิบใบ คุณหนีออกมามือเปล่า${hurt(l, 10, 20, "ถูกลูกสัตว์อสูรรุมกัด")}`);
          },
        },
        { label: "ย่องเก็บของโดยไม่แตะรัง", show: (_l, c) => Number(c.twist) === 1, check: { stat: "luck", dc: 50 }, run: (l, c, ok) => (ok ? good(`ไม่มีไข่ใบไหนขยับ${loot(l, c, 0.9)}`) : bad(`ไข่ใบหนึ่งร่วงลงพื้น — คุณวิ่งหนีพร้อมของครึ่งเป้${loot(l, c, 0.4)}${hurt(l, 4, 10, "ถูกสัตว์อสูรไล่ตาม")}`)) },
        { label: "แบ่งกันครึ่งๆ", show: (_l, c) => Number(c.twist) === 2, run: (l, c) => { withBase(l, (b) => { b.feud = Math.max(0, b.feud - 10); }); return meh(`ทั้งสองทีมขนของเงียบๆ คนละฝั่ง หัวหน้าอีกทีมพยักหน้าให้ตอนแยกกัน${loot(l, c, 0.55)}`); } },
        {
          label: "เอาทั้งหมด",
          show: (_l, c) => Number(c.twist) === 2,
          tone: "danger",
          odds: defend(0),
          survival: defendLive(0),
          run: (l, c, ok) => {
            withBase(l, (b) => { b.feud += 20; });
            if (ok) { addFame(l, 2); return good(`อีกทีมถอยไปพร้อมคำสาบานว่าจะกลับมาแก้แค้น${loot(l, c, 1.3)}`); }
            if (mayDie(l, defendLive(0)(l), "ถูกทีมของฐานคู่แข่งสังหารระหว่างแย่งเสบียง")) return bad("พวกเขามีคนซุ่มอยู่บนหลังคา…");
            return bad(`คุณเสียทั้งของและศักดิ์ศรี${hurt(l, 8, 16, "บาดเจ็บจากการปะทะกับฐานคู่แข่ง")}`);
          },
        },
        { label: "เปิดห้องเย็น", show: (_l, c) => Number(c.twist) === 3, tone: "danger", check: { stat: "luck", dc: 55 }, run: (l, c, ok) => { if (ok) { l.power?.items.push("ตู้เย็นพกพาจากร้านดวงดาว"); return good(`ข้างในคือเนื้อแช่แข็งเต็มห้อง — และกล่องของขวัญจากดวงดาวที่ไม่มีใครกล้าเปิด${loot(l, c, 1.5)}`); } return bad(`ห้องเย็นเต็มไปด้วยซากที่ยังขยับได้${hurt(l, 12, 22, "ถูกซากในห้องเย็นลากเข้าไป")}`); } },
        { label: "เชื่อป้าย แล้วเก็บแค่ของข้างนอก", show: (_l, c) => Number(c.twist) === 3, run: (l, c) => meh(`บางครั้งการเชื่อคนแปลกหน้าที่ตายไปแล้วก็เป็นเรื่องฉลาด${loot(l, c, 0.8)}`) },
        { label: "กลับฐานทันที", run: () => meh("คุณมองดูของที่ต้องทิ้งไว้แล้วถอนหายใจ — มีชีวิตกลับไปก็ยังดี") },
      ],
    },
  },
};

// ───────────────────────── แลกเปลี่ยนกับฐานอื่น ─────────────────────────

export const canTrade = (l: Life) => L(l) && !l.doneThisYear.includes("a20trade");

export function startTrade(l: Life) {
  l.doneThisYear.push("a20trade");
  runEvent(l, "a20.trade", { who: randInt(l, 0, 2) });
}

const rate = (l: Life) => 1 + roleCount(getBase(l)!, "merchant") * 0.3 + (getBase(l)!.allies ? 0.15 : 0);

const TRADE: GameEvent = {
  id: "a20.trade",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ขบวนพ่อค้า",
  text: (l, c) =>
    `【${["ขบวนรถบรรทุกของพ่อค้าเร่", "ทูตจากฐานสนามบิน", "เรือสินค้าของชุมชนริมแม่น้ำ"][Number(c.who)]}】มาจอดหน้า${baseName(l)}\nอัตราแลกของวันนี้ ×${rate(l).toFixed(2)}${roleCount(getBase(l)!, "merchant") ? " (พ่อค้าในฐานของคุณช่วยต่อราคา)" : ""}`,
  choices: [
    { label: "วัสดุ 10 → อาหาร", show: (l) => getBase(l)!.mat >= 10, run: (l) => good(`ตกลง!${addRes(l, { mat: -10, food: Math.round(12 * rate(l)) })}`) },
    { label: "อาหาร 12 → น้ำ", show: (l) => getBase(l)!.food >= 12, run: (l) => good(`ถังน้ำสะอาดถูกกลิ้งเข้าฐาน${addRes(l, { food: -12, water: Math.round(14 * rate(l)) })}`) },
    { label: "อาหาร 15 → ยา", show: (l) => getBase(l)!.food >= 15, run: (l) => good(`กล่องยาปฏิชีวนะที่ยังไม่หมดอายุ${addRes(l, { food: -15, med: Math.round(6 * rate(l)) })}`) },
    { label: "จ่ายเหรียญ 150,000 บาท → วัสดุ", show: (l) => l.money >= 150_000, run: (l) => { addMoney(l, -150_000); return good(`รถบรรทุกเทเหล็กเส้นลงหน้าประตู${addRes(l, { mat: Math.round(14 * rate(l)) })}`); } },
    {
      label: "เสนอเป็นพันธมิตร (มอบอาหาร 20)",
      show: (l) => getBase(l)!.food >= 20 && getBase(l)!.allies < 3,
      check: { stat: "looks", dc: 50, bonus: (l) => roleCount(getBase(l)!, "merchant") * 0.1 },
      run: (l, _c, ok) => {
        if (ok) { withBase(l, (b) => { b.allies++; }); addFame(l, 3); return good(`ทั้งสองฝ่ายจับมือกันกลางลาน — ${baseName(l)}มีพันธมิตรแล้ว${addRes(l, { food: -20, morale: 5 })}`); }
        return bad(`พวกเขารับของขวัญแล้วบอกว่า "จะไปคิดดูก่อน"${addRes(l, { food: -20 })}`);
      },
    },
    { label: "แค่คุยข่าว ไม่แลกอะไร", run: (l) => { addStat(l, "smarts", 1); return meh("พ่อค้าเล่าว่าทางเหนือมีลัทธิใหม่ที่จับคนไปบูชายัญ และฐานสนามบินกำลังหาพันธมิตร"); } },
  ],
};

// ───────────────────────── วิกฤตของฐาน ─────────────────────────

const SIEGE: GameEvent = {
  id: "a20.crisis.siege",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "siege"),
  title: "คืนที่ฝูงมันมา",
  prepare: (l) => ({ r: threatRank(l), warn: getBase(l)!.b.tower > 0 ? 1 : 0 }),
  text: (l, c) =>
    `${Number(c.warn) ? "ยามบนหอสังเกตการณ์ตีระฆังตั้งแต่ฝูงยังอยู่ห่างสามกิโล — คุณมีเวลาเตรียมตัวหนึ่งชั่วโมง" : "ไม่มีใครเห็นมันมา จนกระทั่งรั้วด้านเหนือพังลง"}\nฝูงสัตว์อสูรระดับ ${rankName(Number(c.r))} นับร้อยตัวล้อม${baseName(l)} · พลังป้องกันของฐาน ${defense(getBase(l)!)}`,
  choices: [
    {
      label: "นำทัพรบบนกำแพง",
      tone: "danger",
      odds: (l, c) => defend(0)(l) + (Number(c.warn) ? 0.05 : 0),
      survival: defendLive(0),
      run: (l, c, ok) => {
        if (ok) {
          winDone(l);
          addFame(l, 3 + tierOf(getBase(l)!));
          return good(`ฟ้าสางพร้อมกองซากสูงเท่ากำแพง — ไม่มีตัวไหนข้ามมาได้ ${gateRewards(l, Number(c.r), 0.8, true)}${addRes(l, { morale: 10, mat: 6 })}`);
        }
        crisisDone(l);
        if (mayDie(l, defendLive(0)(l), "สิ้นชีพบนกำแพงฐานในคืนที่ฝูงสัตว์อสูรบุก")) return bad("กำแพงพัง และคุณพังลงไปพร้อมกัน…");
        return bad(`กำแพงแตกหนึ่งด้าน ฝูงทะลักเข้ามาก่อนจะถูกผลักกลับ${addRes(l, { pop: -randInt(l, 2, 5), food: -10, morale: -8 })}${hurt(l, 10, 20, "บาดเจ็บจากการป้องกันฐาน")}`);
      },
    },
    {
      label: "ให้ทุกคนหลบชั้นใน แล้วให้กำแพงรับไว้",
      odds: (l) => clamp(0.25 + getBase(l)!.b.wall * 0.13 + getBase(l)!.b.tower * 0.04, 0.05, 0.95),
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) return good(`ทั้งคืนมีแต่เสียงข่วนเหล็ก — เช้ามากำแพงเป็นรอยเต็มไปหมด แต่ไม่มีใครตาย${addRes(l, { mat: -5 })}`);
        return bad(`กำแพงไม่สูงพอ — มันปีนเข้ามาทางดาดฟ้า${addRes(l, { pop: -randInt(l, 3, 6), food: -12, morale: -12 })}`);
      },
    },
    {
      label: "จุดไฟล่อฝูงให้ไปทางสะพาน",
      check: { stat: "smarts", dc: 55, bonus: (_l, c) => (Number(c.warn) ? 0.15 : 0) },
      skill: ["stealth", "escape"],
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) return good(`ฝูงทั้งฝูงวิ่งตามแสงไฟข้ามสะพาน แล้วสะพานก็ถล่มลงพร้อมมัน${addRes(l, { morale: 6 })}`);
        return bad(`ฝูงแบ่งครึ่ง — ครึ่งหนึ่งไม่สนไฟเลย${addRes(l, { pop: -randInt(l, 2, 4), mat: -8 })}${hurt(l, 6, 12, "ถูกสัตว์อสูรไล่ตามตอนล่อฝูง")}`);
      },
    },
  ],
};

const PLAGUE: GameEvent = {
  id: "a20.crisis.plague",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "plague"),
  title: "ไข้เถ้าดำ",
  text: (l) => `คนแรกไอเป็นเลือดสีดำเมื่อสามวันก่อน วันนี้มีสิบสองคน — ${getBase(l)!.b.clinic ? `ห้องพยาบาล Lv.${getBase(l)!.b.clinic} เตียงเต็มแล้ว` : "ฐานไม่มีห้องพยาบาลด้วยซ้ำ"} · ยาในคลัง ${getBase(l)!.med}`,
  choices: [
    {
      label: "แจกยาทั้งคลัง (ยา 12)",
      show: (l) => getBase(l)!.med >= 12,
      run: (l) => { crisisDone(l); return good(`ไข้ลดลงภายในสัปดาห์ ทุกคนรอด${addRes(l, { med: -12, morale: 6 })}`); },
    },
    {
      label: "กักโรค แยกตึกคนป่วย",
      check: { stat: "smarts", dc: 55, bonus: (l) => getBase(l)!.b.clinic * 0.08 + roleCount(getBase(l)!, "doctor") * 0.1 },
      skill: ["medical", "heal"],
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) return good(`แนวกักโรคได้ผล — เสียไปแค่สองคน ซึ่งป่วยหนักมาตั้งแต่แรก${addRes(l, { pop: -2, med: -3 })}`);
        return bad(`โรคหลุดจากตึกกักกัน ลามทั้งฐาน${addRes(l, { pop: -randInt(l, 4, 8), morale: -12, med: -5 })}${hurt(l, 6, 14, "ติดไข้เถ้าดำ")}`);
      },
    },
    {
      label: "ไล่คนป่วยออกนอกกำแพง",
      run: (l) => { crisisDone(l); addStat(l, "happiness", -10); return bad(`โรคหยุด แต่ไม่มีใครมองหน้าคุณตรงๆ อีก — เสียงเคาะประตูดังอยู่สามคืน${addRes(l, { pop: -randInt(l, 5, 9), morale: -18 })}`); },
    },
  ],
};

const FIRE: GameEvent = {
  id: "a20.crisis.fire",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "fire"),
  title: "ไฟไหม้กลางดึก",
  text: (l) => `เทียนเล่มเดียวล้มในห้องเก็บของ ไฟลามเร็วกว่าที่ใครคิด — ด้านซ้ายคือโกดังอาหาร (${getBase(l)!.food}) ด้านขวาคือห้องนอนเด็ก`,
  choices: [
    {
      label: "วิ่งฝ่าไฟเข้าห้องเด็ก",
      tone: "danger",
      check: { stat: "health", dc: 50 },
      survival: (l) => 1 - (1 - checkChance(l, "health", 50)) * 0.25,
      skill: ["heal", "escape"],
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) { addFame(l, 5); return good(`คุณออกมาพร้อมเด็กสองคนใต้แขน ผมไหม้ไปครึ่งหัว — เด็กทุกคนรอด แต่โกดังไม่รอด${addRes(l, { food: -Math.round(getBase(l)!.food * 0.6), morale: 12 })}`); }
        if (mayDie(l, 0.75, "เสียชีวิตในกองไฟขณะช่วยเด็กในฐาน")) return bad("เพดานถล่มลงมาก่อนคุณจะถึงประตู…");
        return bad(`คุณช่วยได้คนเดียว${addRes(l, { pop: -2, food: -Math.round(getBase(l)!.food * 0.5), morale: -6 })}${hurt(l, 15, 25, "แผลไฟไหม้")}`);
      },
    },
    {
      label: "สั่งทุกคนตัดแนวไฟ",
      check: { stat: "smarts", dc: 55, bonus: (l) => roleCount(getBase(l)!, "soldier") * 0.08 },
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) return good(`แนวกันไฟที่ขุดภายในยี่สิบนาทีหยุดไฟไว้ได้ — เสียแค่ห้องเก็บของ${addRes(l, { mat: -8, food: -6 })}`);
        return bad(`ลมเปลี่ยนทิศ ไฟข้ามแนวไป${addRes(l, { pop: -randInt(l, 1, 3), mat: -12, food: -15, morale: -8 })}`);
      },
    },
  ],
};

const BETRAYAL: GameEvent = {
  id: "a20.crisis.betrayal",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "betrayal") && !!getBase(l)!.res.length,
  title: "หนอนในฐาน",
  prepare: (l) => { const r = [...getBase(l)!.res].sort((a, b) => a.loy - b.loy)[0]; return { rid: r.id, name: r.n }; },
  text: (l, c) => `ยามจับได้ว่ามีคนส่งสัญญาณไฟให้แก๊งปล้นทุกคืน รอยเท้าบนดาดฟ้าตรงกับรองเท้าของ${who(l, c)} — คนที่คุณไว้ใจให้ถือกุญแจโกดัง`,
  choices: [
    {
      label: "ปล่อยให้เขาทำต่อ แล้วซุ่มรอแก๊งที่จะเข้ามา",
      tone: "danger",
      odds: defend(0),
      survival: defendLive(0),
      run: (l, c, ok) => {
        removeResident(l, Number(c.rid));
        if (ok) { winDone(l); addFame(l, 4); withBase(l, (b) => { b.feud = Math.max(0, b.feud - 30); }); return good(`แก๊งเดินเข้ามาในกับดักทั้งแก๊ง — ทั้งหนอนและแก๊งไม่มีใครได้กลับ ${gateRewards(l, threatRank(l), 0.6, true)}${addRes(l, { mat: 10, morale: 8 })}`); }
        crisisDone(l);
        if (mayDie(l, defendLive(0)(l), "ถูกแก๊งปล้นที่มีคนในช่วยเปิดประตูสังหาร")) return bad("หนอนเปิดประตูหลังให้ก่อนเวลานัด…");
        return bad(`แก๊งรู้ตัว — ขนอาหารไปได้ครึ่งโกดัง${addRes(l, { food: -Math.round(getBase(l)!.food / 2) })}${hurt(l, 8, 16, "บาดเจ็บจากการซุ่มโจมตีพลาด")}`);
      },
    },
    {
      label: "เผชิญหน้าเขาต่อหน้าทุกคน",
      run: (l, c) => {
        crisisDone(l);
        const law = getBase(l)!.law;
        removeResident(l, Number(c.rid));
        return meh(
          law === 2
            ? `${c.name}ถูกเนรเทศออกไปกลางคืนพร้อมเป้ใบเดียว${addRes(l, { morale: 4 })}`
            : `${c.name}ร้องไห้ว่าแก๊งจับน้องสาวไว้ — คุณให้เขาไปช่วยน้อง และไม่ต้องกลับมาอีก${addRes(l, { morale: -2 })}`,
        );
      },
    },
    {
      label: "คุยกับเขาลับๆ — ให้โอกาสเป็นสายลับสองหน้า",
      check: { stat: "looks", dc: 55 },
      skill: ["social"],
      run: (l, c, ok) => {
        crisisDone(l);
        if (ok) { withBase(l, (b) => { const r = b.res.find((x) => x.id === Number(c.rid)); if (r) r.loy = 85; b.feud = Math.max(0, b.feud - 15); }); return good(`${c.name}คุกเข่าสาบาน จากนั้นแก๊งก็ได้แต่ข้อมูลผิดๆ ไปตลอดทั้งปี${addRes(l, { mat: 6 })}`); }
        removeResident(l, Number(c.rid));
        return bad(`คืนนั้น${c.name}หนีไปพร้อมกุญแจโกดัง${addRes(l, { food: -15, med: -4 })}`);
      },
    },
  ],
};

const RIVAL: GameEvent = {
  id: "a20.crisis.rival",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "rival"),
  title: "ฐานคู่แข่งยกทัพมา",
  prepare: (l) => ({ r: threatRank(l) + 1, n: pick(l, ["ฐานสนามบิน", "กองทัพเสื้อแดงจากท่าเรือ", "สหพันธ์ห้างสรรพสินค้า", "อาณาจักรสะพานลอย"]) }),
  text: (l, c) => `【${c.n}】ส่งคนสามร้อยคนมาตั้งค่ายหน้า${baseName(l)} ผู้นำของพวกเขาเป็นผู้รอดชีวิตระดับ ${rankName(Number(c.r))} — "ยอมรวมฐาน หรือเราจะรวมมันด้วยกำลัง"`,
  choices: [
    {
      label: "ออกไปท้าดวลผู้นำตัวต่อตัว",
      tone: "danger",
      odds: (l, c) => defend(Number(c.r) - threatRank(l))(l) - 0.05,
      survival: (l, c) => defendLive(Number(c.r) - threatRank(l))(l),
      run: (l, c, ok) => {
        if (ok) { winDone(l); addFame(l, 8); markTurn(l); return big(`ผู้นำ${c.n}ล้มลงต่อหน้าคนของเขาเอง ครึ่งหนึ่งขอย้ายมาอยู่กับคุณ ${gateRewards(l, Number(c.r), 1, true)}${addRes(l, { pop: randInt(l, 8, 15), mat: 15, morale: 12 })}`); }
        crisisDone(l);
        if (mayDie(l, defendLive(Number(c.r) - threatRank(l))(l), `แพ้ดวลกับผู้นำ${c.n}`)) return bad("ดาบของเขาเร็วกว่าที่ข่าวลือบอก…");
        withBase(l, (b) => { b.lead = false; });
        return bad(`คุณแพ้ — ${baseName(l)}ถูกรวมเข้ากับ${c.n} และคุณกลายเป็นแค่ลูกน้อง${addRes(l, { food: -20, mat: -15, morale: -15 })}${hurt(l, 12, 22, "บาดแผลจากการดวล")}`);
      },
    },
    {
      label: "ตั้งรับหลังกำแพงทั้งฐาน",
      odds: (l, c) => clamp(defend(Number(c.r) - threatRank(l))(l) + getBase(l)!.allies * 0.08, 0.03, 0.97),
      run: (l, _c, ok) => {
        if (ok) { winDone(l); withBase(l, (b) => { b.feud = Math.max(0, b.feud - 20); }); return good(`พวกเขาปิดล้อมอยู่สองสัปดาห์แล้วก็ถอยไป${getBase(l)!.allies ? " — ฐานพันธมิตรของคุณส่งคนมาโจมตีข้างหลังพวกมัน" : ""}${addRes(l, { food: -10, water: -10, morale: 8 })}`); }
        crisisDone(l);
        return bad(`ประตูหลักพัง — พวกมันขนเสบียงไปเกือบหมดก่อนจะถูกไล่ออกไป${addRes(l, { food: -Math.round(getBase(l)!.food * 0.6), mat: -15, pop: -randInt(l, 3, 7), morale: -12 })}`);
      },
    },
    {
      label: "เจรจา — เสนอส่งส่วยปีละครั้ง",
      check: { stat: "looks", dc: 50, bonus: (l) => roleCount(getBase(l)!, "merchant") * 0.1 },
      skill: ["social", "business"],
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) return meh(`ผู้นำของพวกเขาหัวเราะแล้วรับข้อเสนอ — ส่วยครั้งแรกเจ็บแต่ไม่ตาย${addRes(l, { food: -15, mat: -10 })}`);
        return bad(`พวกเขารับส่วย แล้วเผาโกดังทิ้งเป็นการเตือนอยู่ดี${addRes(l, { food: -25, mat: -15, morale: -10 })}`);
      },
    },
  ],
};

const CULT: GameEvent = {
  id: "a20.crisis.cult",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "cult"),
  title: "บทสวดในห้องใต้ดิน",
  text: (l) => `ชาวฐานสามสิบคนหายไปจากเวรยามพร้อมกัน คุณพบพวกเขาในห้องใต้ดินของ${baseName(l)} นั่งล้อมวงสวดชื่อดวงดาวดวงหนึ่ง ตรงกลางวงมีเด็กคนหนึ่งถูกมัดไว้`,
  choices: [
    {
      label: "บุกเข้าไปหยุดพิธี",
      tone: "danger",
      odds: (l) => defend(0)(l) + 0.1,
      survival: defendLive(0),
      run: (l, _c, ok) => {
        if (ok) { winDone(l); addFame(l, 4); return good(`เด็กปลอดภัย หัวหน้าลัทธิถูกขังไว้ในห้องเย็น — สาวกที่เหลือร้องไห้เหมือนเพิ่งตื่นจากฝัน${addRes(l, { morale: 4 })}`); }
        crisisDone(l);
        if (mayDie(l, defendLive(0)(l), "ถูกสาวกลัทธิที่ได้พลังจากดวงดาวสังหาร")) return bad("ดวงดาวดวงนั้นตอบรับคำสวด…");
        return bad(`ลัทธิหนีออกไปพร้อมเด็กและเสบียง${addRes(l, { pop: -randInt(l, 8, 14), food: -15, morale: -15 })}${hurt(l, 10, 18, "บาดเจ็บจากพิธีกรรมของลัทธิ")}`);
      },
    },
    {
      label: "หักล้างคำสอนต่อหน้าทุกคน",
      check: { stat: "smarts", dc: 58, bonus: (l) => roleCount(getBase(l)!, "priest") * 0.15 },
      skill: ["social", "study"],
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) return good(`คุณชี้ให้เห็นว่าหัวหน้าลัทธิแอบกินเสบียงของสาวกเองทุกคืน — วงสวดแตกกระจายทันที${addRes(l, { morale: 8 })}`);
        return bad(`คนฟังคุณครึ่งหนึ่ง อีกครึ่งเดินตามลัทธิออกไปจากฐาน${addRes(l, { pop: -randInt(l, 10, 16), morale: -8 })}`);
      },
    },
  ],
};

const COUP: GameEvent = {
  id: "a20.crisis.coup",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "coup") && !!getBase(l)?.lead,
  title: "รัฐประหารในฐาน",
  prepare: (l) => {
    const b = getBase(l)!;
    const r = b.res.find((x) => x.tag === "rival") ?? b.res.find((x) => x.role === "soldier") ?? addRival(l);
    return { rid: r.id, name: r.n };
  },
  text: (l, c) => `ขวัญกำลังใจในฐานเหลือ ${getBase(l)!.morale} ตื่นมาเช้านี้ ${who(l, c)} ยืนอยู่บนเวทีกลางลานพร้อมคนติดอาวุธยี่สิบคน "ผู้นำคนนี้พาพวกเราอดตาย — ถึงเวลาเปลี่ยนแล้ว"`,
  choices: [
    {
      label: "ท้าดวลต่อหน้าทุกคน",
      tone: "danger",
      odds: (l) => defend(-1)(l),
      survival: (l) => defendLive(-1)(l),
      run: (l, c, ok) => {
        if (ok) { winDone(l); removeResident(l, Number(c.rid)); return good(`${c.name}ล้มลงไม่ทันชักอาวุธ คนติดอาวุธยี่สิบคนวางปืนพร้อมกัน — แต่คุณรู้ว่าปัญหาจริงคือท้องที่หิว${addRes(l, { morale: 10 })}`); }
        crisisDone(l);
        if (mayDie(l, defendLive(-1)(l), `ถูก${c.name}สังหารระหว่างรัฐประหารในฐาน`)) return bad("ไม่มีใครในลานยื่นมือมาช่วยคุณ…");
        withBase(l, (b) => { b.lead = false; });
        return bad(`คุณแพ้ — ${c.name}ขึ้นเป็นผู้นำ และคุณถูกส่งไปเฝ้ายามกะดึก${hurt(l, 8, 16, "บาดแผลจากรัฐประหาร")}`);
      },
    },
    {
      label: "ปราศรัยตอบ — สัญญาว่าจะเปลี่ยน",
      check: { stat: "looks", dc: 55 },
      skill: ["social", "perform"],
      run: (l, c, ok) => {
        crisisDone(l);
        if (ok) { withBase(l, (b) => { b.ration = Math.min(b.ration, 1); }); return good(`คุณยอมรับความผิดพลาดต่อหน้าทุกคน แล้วเปิดโกดังส่วนตัวให้ดู — คนติดอาวุธค่อยๆ ลดปืนลง${addRes(l, { morale: 15, food: -8 })}`); }
        withBase(l, (b) => { b.lead = false; });
        return bad(`เสียงโห่ดังกว่าเสียงคุณ — ${c.name}ขึ้นเป็นผู้นำแทน${addRes(l, { morale: 5 })}`);
      },
    },
    {
      label: "ลงจากตำแหน่งเอง",
      run: (l, c) => { crisisDone(l); withBase(l, (b) => { b.lead = false; }); addStat(l, "happiness", -5); return meh(`คุณวางกุญแจโกดังไว้บนเวทีแล้วเดินลงมา ${c.name}มองคุณนานกว่าที่คิด${addRes(l, { morale: 12 })}`); },
    },
  ],
};

function addRival(l: Life) {
  return withBase(l, (b) => {
    const r = addResident(l, b, "soldier");
    r.tag = "rival";
    r.loy = 10;
    b.pop += 1;
    return r;
  })!;
}

const RIOT: GameEvent = {
  id: "a20.crisis.riot",
  minAge: 0,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  when: (l) => crisisNow(l, "riot") && !!getBase(l)?.lead,
  title: "จลาจลหน้าโกดัง",
  text: (l) => `คนห้าสิบคนพังประตูโกดังเพราะได้ข้าววันละครึ่งถ้วยมาสามเดือน (นโยบายปันส่วน: ${["อิ่มท้อง", "ปกติ", "เข้มงวด"][getBase(l)!.ration]}) — มีคนถือไม้หน้าสามมาด้วย`,
  choices: [
    { label: "เปิดโกดังให้กินอิ่มหนึ่งวัน", run: (l) => { crisisDone(l); withBase(l, (b) => { b.ration = 1; }); return meh(`เสียงจลาจลกลายเป็นเสียงช้อนกระทบชาม${addRes(l, { food: -Math.round(getBase(l)!.food * 0.3), morale: 14 })}`); } },
    {
      label: "ปราบด้วยกำลัง",
      odds: fightOdds0,
      run: (l, _c, ok) => {
        crisisDone(l);
        addStat(l, "happiness", -6);
        if (ok) return bad(`จลาจลสงบในสิบนาที แต่ความเงียบหลังจากนั้นน่ากลัวกว่า${addRes(l, { pop: -randInt(l, 2, 5), morale: -6 })}`);
        return bad(`ฝูงชนมีมากกว่าที่คิด${addRes(l, { pop: -randInt(l, 4, 8), food: -15, morale: -12 })}${hurt(l, 6, 14, "ถูกรุมทำร้ายในจลาจล")}`);
      },
    },
    {
      label: "กินข้าวครึ่งถ้วยต่อหน้าทุกคน",
      check: { stat: "looks", dc: 50 },
      skill: ["social"],
      run: (l, _c, ok) => {
        crisisDone(l);
        if (ok) { addFame(l, 3); return good(`คุณนั่งลงกลางฝูงชนแล้วกินส่วนเดียวกับทุกคน — คนที่ถือไม้คนแรกวางมันลง${addRes(l, { morale: 12 })}`); }
        return bad(`มีคนตะโกนว่า "แสดงละคร!" แล้วก้อนหินก้อนแรกก็ลอยมา${addRes(l, { food: -12, morale: -4 })}${hurt(l, 3, 8, "ถูกหินในจลาจล")}`);
      },
    },
  ],
};

function fightOdds0(l: Life) {
  return defend(-2)(l);
}

// ฐานใหม่ไม่มีคนสำคัญ? เติมให้ตอนชีวิตดำเนินไป (ใช้ใน event อื่น)
export const ensureResident = (l: Life) => someResident(l) ?? withBase(l, (b) => addResident(l, b))!;

/** ชาวฐานกลายเป็นคนรัก — ย้ายไปอยู่แท็บคน */
export function residentToPartner(l: Life, rid: number) {
  const b = getBase(l)!;
  const r = b.res.find((x) => x.id === rid);
  if (!r) return;
  const p = createPerson(l, "partner", { gender: r.g, age: clamp(l.age + randInt(l, -4, 4), 16, 90), bond: 75, job: `ชาวฐาน (${siteById(b.site).name})` });
  p.name = r.n;
  p.short = r.n;
  withBase(l, (x) => {
    const y = x.res.find((z) => z.id === rid);
    if (y) { y.tag = "lover"; y.loy = 100; }
  });
}

export const coinFlip = (l: Life) => chance(l, 0.5);

export const M20_CORE: GameEvent[] = [FOUND, EXPEDITION, TRADE, SIEGE, PLAGUE, FIRE, BETRAYAL, RIVAL, CULT, COUP, RIOT];
