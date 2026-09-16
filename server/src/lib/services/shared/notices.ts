/**
 * Which data sources have something wrong with them right now.
 *
 * A live request that fails, or answers with data that looks wrong, puts its
 * source on the board, and the panel says so. Without it a broken feed looks
 * exactly like quiet weather.
 *
 * **One notice per source, replaced rather than appended.** A service reports
 * on every rebuild, so the board holds the current state and not a log of it,
 * and a source comes off the moment it answers well again.
 */

export type Notice = {
  /**
   * The source and when this problem began. Stable while the problem is, so
   * closing a notice in the panel hides that problem and not the next one.
   */
  id: string;
  /** The feed the notice is about, as a person names it. */
  source: string;
  /** What went wrong, and what is drawn instead if anything is. */
  detail: string;
  /**
   * How far the drawn data trails the live feed, minutes. Null unless an
   * older copy is drawn in its place.
   */
  delayMinutes: number | null;
  /** When the service first reported this problem, ISO 8601. */
  since: string;
};

export type Report = Pick<Notice, "detail" | "delayMinutes">;

export const REQUEST_FAILED = "The live request failed.";
export const LOOKS_WRONG = "The live data looks wrong.";

export class NoticeBoard {
  private notices = new Map<string, Notice>();

  /**
   * Put `source` on the board.
   *
   * The same problem keeps the time it began even as the delay moves, so a
   * notice does not reappear on every rebuild after it has been closed.
   */
  report(source: string, report: Report, now: Date = new Date()): void {
    const current = this.notices.get(source);
    const since =
      current && current.detail === report.detail
        ? current.since
        : now.toISOString();
    this.notices.set(source, {
      id: `${source}@${since}`,
      source,
      since,
      ...report,
    });
  }

  /** The source answered well. */
  clear(source: string): void {
    this.notices.delete(source);
  }

  list(): Notice[] {
    return Array.from(this.notices.values());
  }
}

export const Notices = new NoticeBoard();

/** Minutes from `later` back to `earlier`, never negative. */
export function minutesBehind(later: Date, earlier: string): number {
  return Math.max(
    0,
    Math.round((later.getTime() - Date.parse(earlier)) / 60_000)
  );
}

export type Fallback<T> = {
  /** The feed, as the notice names it. */
  source: string;
  /** What is drawn instead, as the notice names it: "NOAA's archived copy". */
  copy: string;
  /** Read the live feed. */
  live: () => Promise<T>;
  /** Read the copy nearest `want`. */
  archive: (want: Date) => Promise<T>;
  /** When an answer's data was observed or initialized, ISO 8601. */
  validTime: (answer: T) => string;
  /** The answer arrived but is not a reading. */
  looksWrong?: (answer: T) => boolean;
  board?: NoticeBoard;
};

/**
 * The live feed, or its archived copy when the live request fails or its data
 * looks wrong.
 *
 * The live feed is asked first every time, so a service returns to it, and its
 * notice clears, as soon as it answers well. The copy is wanted at the live
 * answer's own time when there is one, and at now when there is not, and the
 * notice carries how many minutes the copy trails that. When the copy fails or
 * looks wrong too, the live answer is kept if there is one and the live
 * failure is thrown if there is not; the notice then has no delay.
 */
export async function liveOrArchive<T>(fallback: Fallback<T>): Promise<T> {
  const board = fallback.board ?? Notices;
  const looksWrong = fallback.looksWrong ?? (() => false);

  let live: T;
  try {
    live = await fallback.live();
  } catch (error) {
    return drawCopy(fallback, board, looksWrong, REQUEST_FAILED, null, error);
  }
  if (looksWrong(live)) {
    return drawCopy(fallback, board, looksWrong, LOOKS_WRONG, { live });
  }
  board.clear(fallback.source);
  return live;
}

async function drawCopy<T>(
  fallback: Fallback<T>,
  board: NoticeBoard,
  looksWrong: (answer: T) => boolean,
  detail: string,
  answered: { live: T } | null,
  failure?: unknown
): Promise<T> {
  const want = answered
    ? new Date(fallback.validTime(answered.live))
    : new Date();
  const copy = await fallback
    .archive(want)
    .then((answer) => ({ answer }))
    .catch(() => null);

  if (copy && !looksWrong(copy.answer)) {
    board.report(fallback.source, {
      detail: `${detail} Showing ${fallback.copy}.`,
      delayMinutes: minutesBehind(want, fallback.validTime(copy.answer)),
    });
    return copy.answer;
  }

  board.report(fallback.source, { detail, delayMinutes: null });
  if (answered) return answered.live;
  throw failure;
}
