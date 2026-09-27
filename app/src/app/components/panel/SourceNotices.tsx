// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { noticesActions } from "@/lib/store/features/notices";

// Types
import type { SourceNotice } from "@/lib/types";

/** An ISO time as HH:MMZ. */
const clock = (iso: string) => `${iso.slice(11, 16)}Z`;

/**
 * Every data source with something wrong with it, as one stack of alerts at
 * the top of the panel.
 *
 * The server decides what counts — a request that failed, or data that looks
 * wrong — and this prints it. One alert per source: the top one is read and
 * closed, and the next takes its place. The ones underneath peek out so the
 * count is visible before it is read. Closing one hides that problem only: a
 * new one arrives under a new id and shows again.
 */
export const SourceNotices = () => {
  const items = useAppSelector((state) => state.notices.items);
  const dismissed = useAppSelector((state) => state.notices.dismissed);
  const dispatch = useAppDispatch();

  const shown = items.filter((notice) => !dismissed.includes(notice.id));
  if (shown.length === 0) return null;

  return (
    <div className="pb-4">
      <div className="stack w-full">
        {shown.map((notice, i) => (
          <NoticeCard
            key={notice.id}
            notice={notice}
            position={i}
            count={shown.length}
            onDismiss={() => dispatch(noticesActions.dismiss(notice.id))}
          />
        ))}
      </div>
    </div>
  );
};

/** One alert. Only the top of the stack is read or closed. */
const NoticeCard = ({
  notice,
  position,
  count,
  onDismiss,
}: {
  notice: SourceNotice;
  position: number;
  count: number;
  onDismiss: () => void;
}) => {
  const top = position === 0;
  return (
    <div
      role={top ? "alert" : undefined}
      aria-hidden={!top}
      inert={!top}
      className="alert alert-warning items-start text-sm shadow-md"
    >
      <div className="flex flex-col gap-1">
        <span className="font-semibold">
          Something is wrong with {notice.source}
        </span>
        <span>{notice.detail}</span>
        <span className="text-xs opacity-80">
          {notice.delayMinutes !== null &&
            `${notice.delayMinutes} min behind live · `}
          since {clock(notice.since)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {count > 1 && (
          <span className="text-xs opacity-80">
            {position + 1} of {count}
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle"
          aria-label={`Dismiss ${notice.source} notice`}
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
};
