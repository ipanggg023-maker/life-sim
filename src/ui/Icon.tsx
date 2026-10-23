// ไอคอนเส้นวาดเอง (ใช้แทนอีโมจิในหน้าจอ) — เส้นเดียวกันทั้งชุด สีตามตัวอักษร
const PATHS = {
  career: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M21 20c0-2.5-1.8-4.3-4-4.8",
  power: "M4 20L18 6M14 4h6v6M4 16l4 4M3 21l2-2",
  jianghu: "M2 20h20M4 20v-8l8-6 8 6v8M3 12l9-7 9 7M9 20v-5h6v5",
  activities: "M12 3l2.5 5.5L20 9.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1z",
  phone: "M7 3h10v18H7zM11 18h2",
  soul: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6",
  health: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  happiness: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4M9 9.5v.5M15 9.5v.5",
  smarts: "M14 4l6 6-9 9H5v-6zM12 6l6 6",
  looks: "M12 3a6 6 0 0 1 6 6c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6zM12 15v6M9 21h6",
  luck: "M12 12c-2-4-6-4-6-1s4 3 6 1zm0 0c4-2 4-6 1-6s-3 4-1 6zm0 0c2 4 6 4 6 1s-4-3-6-1zm0 0c-4 2-4 6-1 6s3-4 1-6zM12 12l3 9",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  close: "M6 6l12 12M18 6L6 18",
  lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  scroll: "M6 4h12v16H6zM9 9h6M9 13h6",
  chevron: "M7 10l5 5 5-5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className ?? ""}`} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** ตัดอีโมจิออกจากข้อความของเกม (เว้นเครื่องหมายเพศ) — หน้าจอใช้ไอคอนเส้นแทน */
const PICTO = /(?![♂♀])\p{Extended_Pictographic}️?‍?\s?/gu;
export const noEmoji = (s: string) => s.replace(PICTO, "").replace(/\s{2,}/g, " ").trim();
