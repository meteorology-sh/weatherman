// Types
import type { StormFinding, StormTestScore } from "~/lib/types";

/**
 * How many releases cleared each radar-storm test, and how each flying day
 * scored.
 *
 * Figures come from the eval server. Nothing here re-derives a count from
 * the flares, so the season bar and a published number cannot drift.
 */

type PropsT = { storms: StormFinding };

function share(test: StormTestScore): string {
  if (test.n === 0) return "—";
  return `${test.yes}/${test.n}`;
}

export const StormCoverage = ({ storms }: PropsT) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {storms.tests.map((test) => {
          const rest = Math.max(0, test.n - test.yes);
          return (
            <div key={test.key} className="flex items-center gap-3">
              <div className="w-56 shrink-0 text-xs font-semibold">
                {test.label}
              </div>
              {test.n === 0 ? (
                <div className="text-xs">No storm reading to score.</div>
              ) : (
                <>
                  <div
                    className="flex h-4 flex-1 overflow-hidden rounded bg-base-300"
                    role="img"
                    aria-label={`${test.label}: ${test.yes} of ${test.n} yes`}
                  >
                    {test.yes > 0 && (
                      <div
                        className="bg-success min-w-[3px]"
                        style={{ flexGrow: test.yes, flexBasis: 0 }}
                      />
                    )}
                    {rest > 0 && (
                      <div
                        className="bg-base-content/20"
                        style={{ flexGrow: rest, flexBasis: 0 }}
                      />
                    )}
                  </div>
                  <div className="w-16 shrink-0 text-right font-mono text-xs">
                    {share(test)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Day</th>
              <th className="text-right">Releases</th>
              <th className="text-right">Scored</th>
              {storms.tests.map((test) => (
                <th
                  key={test.key}
                  className="text-right whitespace-normal"
                >
                  {test.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {storms.rows.map((row) => (
              <tr key={row.date}>
                <td className="font-mono whitespace-nowrap">{row.date}</td>
                <td className="text-right font-mono">{row.flares}</td>
                <td className="text-right font-mono">{row.scored}</td>
                {storms.tests.map((test) => {
                  const cell = row.tests[test.key];
                  return (
                    <td
                      key={test.key}
                      className="text-right font-mono whitespace-nowrap"
                    >
                      {!cell || cell.n === 0 ? "—" : `${cell.yes}/${cell.n}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
