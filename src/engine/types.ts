export type WorldId = "hunter" | "murim" | "court" | "tower" | "apocalypse" | "ordinary";

/** ประเทศที่เกิด (เฉพาะโลกยุคปัจจุบัน) */
export type Country = "th" | "kr" | "jp";

/** ค่าสถานะแบบเกม (ระบบชีวิตของโลกธรรมดา) */
export type SysStat = "str" | "agi" | "sta" | "int" | "cha" | "luk";

export interface SysState extends Record<SysStat, number> {
  level: number;
  exp: number;
  /** แต้มที่ยังไม่ได้แจก */
  points: number;
}

/** มือถือ (โลกยุคปัจจุบัน) */
export interface PhoneState {
  ig: number;
  igPosts: number;
  yt: number;
  ytVideos: number;
  ytViews: number;
  /** มูลค่าพอร์ตหุ้น */
  portfolio: number;
}

export type StatKey = "health" | "happiness" | "smarts" | "looks" | "luck";

export type Stats = Record<StatKey, number>;

export type Gender = "m" | "f";

export type Relation =
  | "father"
  | "mother"
  | "sibling"
  | "friend"
  | "partner"
  | "spouse"
  | "child"
  | "rival"
  | "ally"; // เพื่อนร่วมทีม (M8)

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  relation: Relation;
  age: number;
  bond: number; // 0-100
  alive: boolean;
  job?: string;
  /** ชื่อเรียกสั้น (เกาหลี/ญี่ปุ่นเรียกด้วยชื่อตัว ซึ่งอยู่ท้ายชื่อเต็ม) */
  short?: string;
  /** เรื่องราวที่เกิดกับคนนี้แล้ว (เช่น ลูกผ่านวัยต่อต้านแล้ว) */
  tags?: string[];
  /** ความรู้สึกหลายแกนต่อผู้เล่น (MURIM_PLAN §18.4) — ไม่มี = สร้างจาก bond ตอนใช้ครั้งแรก */
  rel?: import("./npc").RelAxes;
  /** ความทรงจำต่อผู้เล่น (สำคัญสุด 10 เรื่อง) */
  mem?: import("./npc").NpcMemory[];
  /** บุคลิก 2–3 อย่าง */
  traits?: string[];
  /** เป้าหมายชีวิตของคนนี้ */
  goal?: string;
  /** เป้าหมายรอง ความกลัว ค่านิยม เส้นที่ไม่ข้าม และความลับ (MURIM_PLAN §18.1 · EXPANSION §4.1) */
  sideGoals?: string[];
  fear?: string;
  values?: string[];
  limit?: string;
  secret?: { text: string; known: boolean };
  /** วิชายุทธ์ของ NPC (ยุทธภพ): ขั้น 0–8 · สาย · สำนัก · ความคืบหน้าสู่ขั้นถัดไป (0–100) */
  martial?: { rank: number; style: string; sect?: string; xp: number };
}

export type Wealth = "poor" | "middle" | "rich" | "elite";

export type SchoolStage =
  | "none"
  | "kinder"
  | "primary"
  | "secondary"
  | "high"
  | "university"
  | "done";

export type Faculty = "med" | "eng" | "business" | "comm" | "edu";

export interface Education {
  stage: SchoolStage;
  grade: number; // 0-100 ผลการเรียนช่วงปัจจุบัน
  faculty?: Faculty;
  uniYearsLeft?: number;
  degree?: Faculty; // ปริญญาที่จบแล้ว
  highSchoolDone: boolean;
}

export interface Job {
  careerId: string;
  level: number; // 1..5
  performance: number; // 0-100
  years: number;
}

export type Rarity = "common" | "rare" | "legendary" | "divine" | "mythic";

export interface TalentState {
  id: string;
  revealed: boolean;
}

export type LogKind =
  | "normal" | "good" | "bad" | "system" | "milestone"
  // การนำเสนอแบบมังฮวา
  | "chapter" | "arc" | "comments";

export interface LogEntry {
  age: number;
  text: string;
  kind: LogKind;
}

/** event ที่รอผู้เล่นตัดสินใจ — เก็บเฉพาะข้อมูลที่ serialize ได้ */
export interface QueuedEvent {
  eventId: string;
  ctx: Record<string, string | number | boolean>;
  /** ฉากปัจจุบันของตอนพิเศษ (ไม่มี = "start") */
  scene?: string;
  /** ข้อความฉากที่แสดงไปแล้ว (คิดครั้งเดียว — ข้อความที่สุ่มจะไม่เปลี่ยนทุกครั้งที่หน้าจอวาดใหม่) */
  txt?: Record<string, string>;
}

export type HunterClass =
  | "sword" | "mage" | "healer" | "assassin" | "tank" | "summoner"
  // วิชาในยุทธภพ
  | "m_sword" | "m_palm" | "m_spear" | "m_hidden" | "m_medic" | "m_demon"
  // สายเวทในราชสำนัก
  | "c_fire" | "c_ice" | "c_holy" | "c_aura" | "c_spirit" | "c_dark"
  // ตำแหน่งในหอคอย
  | "t_vanguard" | "t_lancer" | "t_lantern" | "t_wave" | "t_scout" | "t_outsider"
  // ผู้รอดชีวิตหลังวันสิ้นโลก
  | "a_blade" | "a_gunner" | "a_medic" | "a_warden" | "a_tamer" | "a_reader"
  // เส้นทางของระบบชีวิต (โลกธรรมดา)
  | "o_fighter" | "o_idol" | "o_doctor" | "o_gamer" | "o_chef" | "o_chaebol"
  // คลาสเพิ่มเติม (M22)
  | "archer" | "crafter" | "psychic" | "berserker" | "m_qin" | "m_light" | "m_staff" | "m_poison" | "c_alchemist" | "c_shadow" | "c_paladin" | "c_wind" | "t_shield" | "t_puppet" | "t_bard" | "a_engineer" | "a_hunter" | "a_psyker";

/** สถานะผู้ตื่นพลัง — rank: 0=F … 8=SSS */
export interface Power {
  rank: number;
  hunterClass: HunterClass;
  level: number;
  exp: number;
  skills: string[];
  guild?: string;
  gates: number;
  bossKills: number;
  awakenedAt: number;
  items: string[];
  /** จำนวนครั้งที่ใช้แต่ละสกิลในฉากจริง (ความชำนาญ) */
  mastery?: Record<string, number>;
}

export interface Life {
  version: 1;
  /** รุ่นโครงสร้างเซฟ (engine/validate SAVE_VERSION) — ไม่มี = เซฟก่อนยกเครื่องยุทธภพ */
  sv?: number;
  id: string;
  worldId: WorldId;
  /** ประเทศที่เกิด — ไม่มี = ไทย (เซฟเก่า และโลกแฟนตาซี) */
  country?: Country;
  seed: number;
  rng: number; // สถานะ RNG ปัจจุบัน

  firstName: string;
  nickname: string;
  lastName: string;
  gender: Gender;
  birthYear: number;
  age: number;
  alive: boolean;
  causeOfDeath?: string;

  stats: Stats;
  money: number;
  debt: number;
  fame: number; // -100..100

  wealth: Wealth;
  talents: TalentState[];
  people: Person[];
  education: Education;
  job?: Job;
  power?: Power;

  flags: Record<string, string | number | boolean>;
  /** event ที่เคยเกิดแล้ว (นับครั้ง) */
  seen: Record<string, number>;
  /** event เรื่องราวที่วิญญาณเคยเจอในชาติก่อนๆ — ชาตินี้จะเลี่ยงไปเจอเรื่องใหม่ก่อน */
  pastSeen?: string[];
  /** ของสะสมที่วิญญาณมีอยู่แล้วตอนเกิด */
  ownedItems?: string[];
  /** กิจกรรมที่ทำไปแล้วในปีนี้ */
  doneThisYear: string[];

  log: LogEntry[];
  queue: QueuedEvent[];
  devCreated?: boolean;

  // ── ระบบวิญญาณ (M3) — optional เพื่อให้เซฟเก่ายังโหลดได้ ──
  /** seed ของโลก: ข้อเท็จจริงของโลก (เลขหวย, มหันตภัย ฯลฯ) มาจากค่านี้ + ปีเกิด ไม่ขึ้นกับการตัดสินใจของผู้เล่น */
  worldSeed?: number;
  /** ย้อนเวลามาแล้วกี่ครั้งในเส้นเวลานี้ */
  regressions?: number;
  /** อนาคตเบี่ยงไปจากที่จำได้มากแค่ไหน (0–100+) */
  divergence?: number;
  /** ความทรงจำจากชาติก่อนที่ติดตัวมา */
  memories?: Memory[];
  /** สิ่งที่ได้เห็นในชาตินี้ — จะกลายเป็นความทรงจำถ้าย้อนเวลา */
  observed?: Memory[];
  /** มรดกจากชาติก่อนในโลกเดียวกัน (เกิดใหม่ยุคถัดไป) */
  legacy?: Legacy;
  /** ระบบชีวิต (โลกธรรมดา) */
  sys?: SysState;
  /** มือถือ */
  phone?: PhoneState;
  /** สภาพโลกยุทธภพ: ยุค แรงกดดัน วิกฤต (MURIM_PLAN Phase 1) */
  mw?: import("../content/murim/life/world").MurimWorld;
  /** วิชายุทธ์ที่รู้ (MURIM_PLAN §8.1) */
  mwArts?: import("../content/murim/martial/arts").KnownArt[];
  /** ร่างกายและบาดแผล (MURIM_PLAN §15) */
  body?: import("./body").Body;
  /** เป้าหมายชีวิต: ตัวแรกที่ยังไม่จบ = เป้าหมายหลัก (MURIM_PLAN §18.1) */
  goals?: import("../content/murim/life/goals").LifeGoal[];
  /** เหตุการณ์สำคัญของชีวิตนี้ (ลงบันทึกยุทธภพทันที — MURIM_PLAN §18.2 ข้อ 7) */
  chron?: { year: number; text: string }[];
  /** สรุปผลของปีล่าสุด (แสดงใต้บันทึก) */
  report?: import("./report").YearReport;
}

export interface Memory {
  key: string;
  age: number;
  text: string;
  data?: Record<string, string | number>;
}

export interface Legacy {
  founderName: string;
  lastName: string;
  founderAge: number;
  founderDeathYear: number;
  fame: number;
  rank?: number;
  wealth: Wealth;
  children: string[];
  stash?: number;
  generation: number;
}

export interface PastLife {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  cause: string;
  money: number;
  job?: string;
  degree?: Faculty;
  fame: number;
  talents: string[];
  endedAt: number;
  rank?: number;
  points?: number;
  regressed?: boolean;
  birthYear?: number;
  world?: WorldId;
  /** มังฮวาของชีวิตนี้ (M7) */
  series?: Series;
}

export interface Soul {
  version: 1;
  points: number;
  totalPoints: number;
  lives: number;
  achievements: string[];
  /** life id ที่ให้แต้มไปแล้ว (กันได้ซ้ำ) */
  awarded: string[];
  /** event เรื่องราวที่เคยเจอแล้วในทุกชาติ (ไม่นับกลไกที่วนซ้ำได้) */
  seenEver?: string[];
  /** ตู้สะสม: ของที่เคยเจอในทุกชาติ */
  collection?: string[];
  /** สมุดพรสวรรค์: พรสวรรค์ที่เคยได้ในทุกชาติ */
  talentBook?: string[];
  /** พรสวรรค์ประสานที่วิญญาณเคยค้นพบ (ยุทธภพ) */
  comboBook?: string[];
  /** ริบบิ้นที่สะสมได้ (ชีวิตละหนึ่ง แบบ BitLife) */
  ribbons?: string[];
  /** บันทึกยุทธภพ: ชีวิตทุกชีวิตและเหตุการณ์โลกที่ผ่านมา (MURIM_PLAN §9) */
  chronicle?: import("../content/murim/life/generations").ChronEntry[];
  perks: {
    blessing: number; // ใช้ครั้งเดียวต่อการเกิด
    reroll: number;
    clarity: boolean; // ถาวร: ความทรงจำเพี้ยนช้าลง
    lockedTalent?: string;
  };
  timeline?: {
    worldSeed: number;
    regressions: number;
    divergence: number;
    memories: Memory[];
    legacy?: Legacy;
  };
}

/** ชีวิตหนึ่งชีวิต = มังฮวาหนึ่งเรื่องบนชั้นหนังสือของวิญญาณ */
export interface Series {
  title: string;
  rating: number; // 1–5
  views: number;
  chapters: number;
  tags: string[];
}
