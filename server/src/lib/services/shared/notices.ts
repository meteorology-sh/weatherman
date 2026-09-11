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

/**
 * Pass a live request through, putting its source on the board when it fails
 * or its answer looks wrong, and taking it off when the answer is good.
 *
 * The failure still propagates: the board says why a layer is missing, it does
 * not stand in for the error.
 */
export async function watch<T>(
  source: string,
  request: Promise<T>,
  looksWrong: (answer: T) => boolean = () => false,
  board: NoticeBoard = Notices
): Promise<T> {
  let answer: T;
  try {
    answer = await request;
  } catch (error) {
    board.report(source, { detail: REQUEST_FAILED, delayMinutes: null });
    throw error;
  }
  if (looksWrong(answer)) {
    board.report(source, { detail: LOOKS_WRONG, delayMinutes: null });
  } else {
    board.clear(source);
  }
  return answer;
}
