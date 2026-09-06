type RowT = { label: string; value: string };

export const MeasurementGrid = ({ rows }: { rows: RowT[] }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
    {rows.map((row) => (
      <div key={row.label} className="contents">
        <span>{row.label}</span>
        <span>{row.value}</span>
      </div>
    ))}
  </div>
);

export const dash = (value: string | null | undefined) =>
  value == null || value === "" ? "—" : value;
