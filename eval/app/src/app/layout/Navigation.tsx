// Router
import { NavLink, useParams } from "react-router";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

/**
 * The chrome: which programme is open, and the two findings within it.
 *
 * The links are region-scoped, so they only appear once a programme has been
 * chosen. A "THE BAND" link with no region behind it would have nothing to
 * point at.
 */
export const Navigation = () => {
  const { region } = useParams();
  const all = useAppSelector((state) => state.regions.all);
  const open = all?.find((entry) => entry.id === region);

  // A programme with no flight record has nothing behind the two finding links,
  // so it gets neither rather than two pages that explain themselves away.
  const links = !region
    ? []
    : open && !open.evaluable
      ? [{ to: `/${region}`, label: "FINDINGS", end: true }]
      : [
          { to: `/${region}`, label: "FINDINGS", end: true },
          { to: `/${region}/band`, label: "THE BAND" },
          { to: `/${region}/flares`, label: "THE FLARES" },
        ];

  return (
    <div className="navbar bg-black border-b border-base-300 min-h-0 px-4 gap-4">
      <NavLink to="/" className="text-sm tracking-widest font-semibold">
        WEATHERMAN — EVALUATION
      </NavLink>

      {open && (
        <span className="text-xs badge badge-outline" title={open.name}>
          {open.short.toUpperCase()}
        </span>
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
