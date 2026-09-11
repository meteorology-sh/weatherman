// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { noticesActions } from "@/lib/store/features/notices";

/** An ISO time as HH:MMZ. */
const clock = (iso: string) => `${iso.slice(11, 16)}Z`;

/**
 * A data source with something wrong with it, said at the top of the panel.
 *
 * The server decides what counts — a request that failed, or data that looks
 * wrong — and this prints it. Closing one hides that problem only: a new one
 * arrives under a new id and shows again.
 */
export const SourceNotices = () => {
  const items = useAppSelector((state) => state.notices.items);
  const dismissed = useAppSelector((state) => state.notices.dismissed);
  const dispatch = useAppDispatch();

  const shown = items.filter((notice) => !dismissed.includes(notice.id));
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 pb-2">
      {shown.map((notice) => (
        <div
          key={notice.id}
          role="alert"
          className="alert alert-warning alert-soft items-start text-sm"
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
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            aria-label={`Dismiss ${notice.source} notice`}
            onClick={() => dispatch(noticesActions.dismiss(notice.id))}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
