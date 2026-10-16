import { formatViews } from "../content/manhwa";
import type { Series, WorldId } from "../engine/types";

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating} ดาว`}>
      {"★".repeat(full)}
      <span className="stars-off">{"★".repeat(5 - full)}</span> {rating.toFixed(1)}
    </span>
  );
}

/** ปกมังฮวาของหนึ่งชีวิต */
export function SeriesCover({ series, world, author, compact }: { series: Series; world?: WorldId; author?: string; compact?: boolean }) {
  return (
    <div className={`cover cover-${world ?? "hunter"} ${compact ? "compact" : ""}`}>
      <div className="cover-badge">จบบริบูรณ์</div>
      <div className="cover-title">{series.title}</div>
      {author && <div className="cover-author">เรื่องราวของ {author}</div>}
      <div className="cover-meta">
        <Stars rating={series.rating} /> · 👁 {formatViews(series.views)} · {series.chapters} ตอน
      </div>
      {!compact && <div className="cover-tags">{series.tags.join(" ")}</div>}
    </div>
  );
}
