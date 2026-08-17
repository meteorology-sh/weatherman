// Router
import { NavLink } from "react-router";

const LINKS = [
  { to: "/", label: "FINDINGS", end: true },
  { to: "/band", label: "THE BAND" },
  { to: "/overlap", label: "THE FLARES" },
];

export const Navigation = () => (
  <div className="navbar bg-black border-b border-base-300 min-h-0 px-4">
    <div className="flex-1">
      <span className="text-sm tracking-widest font-semibold">
        WEATHERMAN — EVALUATION
      </span>
    </div>
    <div className="flex gap-1">
      {LINKS.map((link) => (
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
    </div>
  </div>
);
