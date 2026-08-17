/**
 * What the page is doing, said out loud.
 *
 * **Three states, never collapsed into one.** A run that has not happened yet
 * is not a failure — it has a command that fixes it, and the page prints that
 * command. A slow load is not a failure either. The previous version of this
 * app showed nothing in all three cases, so a cold start and a broken server
 * looked exactly alike and neither could be acted on.
 */

type PropsT = {
  loading: boolean;
  /** A harness run that has not produced its file yet, and how to produce it. */
  missing: string | null;
  error: string | null;
  /** What is being waited for, when loading. */
  what?: string;
};

export const Status = ({ loading, missing, error, what }: PropsT) => {
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4">
        <span className="loading loading-spinner loading-sm" />
        <span className="text-sm">{what ?? "Loading"}…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error rounded-none text-sm">
        <div>
          <div className="font-semibold">The eval server did not answer.</div>
          <div className="font-mono text-xs pt-1">{error}</div>
          <div className="pt-2">Start it with `node eval/server.mjs`.</div>
        </div>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="alert rounded-none text-sm bg-base-200">
        <div>
          <div className="font-semibold">Not measured yet.</div>
          <div className="font-mono text-xs pt-1">{missing}</div>
        </div>
      </div>
    );
  }

  return null;
};
