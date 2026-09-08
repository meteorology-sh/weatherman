// Router
import { NavLink, useMatch, useParams } from "react-router";

// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { dayActions } from "~/lib/store/features/day";

/**
 * The chrome: which program is open, which day, and the findings within them.
 *
 * **The day belongs here rather than in the page.** It selects what every map
 * below is showing, so it has to be reachable without scrolling to find it —
 * buried in a section it read as page content and looked like there was only
 * ever one day. It appears only on the route that draws days; a day control on
 * the sounding page would be selecting nothing.
 */
export const Navigation = () => {
  const { region } = useParams();
  const onFlares = useMatch("/:region/flares");
  const all = useAppSelector((state) => state.regions.all);
  const days = useAppSelector((state) => state.day.days);
  const date = useAppSelector((state) => state.day.date);
  const dispatch = useAppDispatch();
  const open = all?.find((entry) => entry.id === region);

  // A day that has not been painted has no frames to draw, so it cannot be
  // opened. The page says how many there are and how to build one.
  //
  // The picker is given a fixed width rather than `w-auto`: auto shrank the box
  // below the padding DaisyUI reserves for its chevron, and the arrow ended up
  // sitting off the text's baseline.
  const painted = days?.filter((day) => day.painted) ?? [];

  // A program with no flight record has nothing behind the two finding links,
  // so it gets neither rather than two pages that explain themselves away.
  const links = !region
    ? []
    : open && !open.evaluable
      ? [{ to: `/${region}`, label: "FINDINGS", end: true }]
      : [
          { to: `/${region}`, label: "FINDINGS", end: true },
          { to: `/${region}/radiosonde`, label: "RADIOSONDE" },
          { to: `/${region}/flares`, label: "THE FLARES" },
        ];

  return (
    <div className="navbar bg-black border-b border-base-300 min-h-0 px-4 gap-3">
      <NavLink to="/" className="text-sm tracking-widest font-semibold">
        WEATHERMAN — EVALUATION
      </NavLink>

      {open && (
        <span className="text-xs badge badge-outline" title={open.name}>
          {open.short.toUpperCase()}
        </span>
      )}

      {onFlares && painted.length > 0 && (
        <select
          className="select select-sm select-bordered font-mono w-56"
          aria-label="Flying day"
          value={date ?? ""}
          onChange={(e) => dispatch(dayActions.setDate(e.target.value))}
        >
          {painted.map((day) => (
            <option key={day.date} value={day.date}>
              {day.date} · {day.flares} flares
            </option>
          ))}
        </select>
      )}

      <div className="flex-1" />

      <div className="flex gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `btn btn-sm btn-ghost tracking-wider ${isActive ? "btn-active" : ""}`
            }
          >
            {link.label}
          </NavLink>
        ))}
        {region && (
          <NavLink to="/" className="btn btn-sm btn-ghost tracking-wider">
            SWITCH
          </NavLink>
        )}
      </div>
    </div>
  );
};
