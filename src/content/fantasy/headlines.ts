// เรื่องหลักของปีทุกชุด
import type { GameEvent } from "../../engine/events";
import { HL_YOUNG } from "./hl_young";
import { HL_ADULT } from "./hl_adult";
import { HL_FAMILY } from "./hl_family";
import { HL_LATE } from "./hl_late";
import { HL_MORE } from "./hl_more";
import { HL_R24 } from "./hl_r24";

export const HEADLINE_EVENTS: GameEvent[] = [...HL_YOUNG, ...HL_ADULT, ...HL_FAMILY, ...HL_LATE, ...HL_MORE, ...HL_R24];
