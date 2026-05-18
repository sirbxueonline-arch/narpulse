import * as React from "react";

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
  icon?: React.ReactNode;
  accent?: "red" | "amber" | "green" | "muted";
}) {
  const palette = {
    red: { tint: "#fde8ec", fg: "#a50c24", border: "rgba(200,16,46,0.20)" },
    amber: { tint: "#fff1d9", fg: "#b87514", border: "rgba(184,117,20,0.20)" },
    green: { tint: "#def5e8", fg: "#138a5b", border: "rgba(19,138,91,0.20)" },
    muted: { tint: "#f4f1e9", fg: "#6e7484", border: "rgba(110,116,132,0.18)" },
  }[accent ?? "muted"];
  return (
    <div
      className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 overflow-hidden np-card-hover"
      style={{
        background: `linear-gradient(135deg, ${palette.tint} 0%, #ffffff 70%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {label}
          </p>
          <p
            className="text-3xl font-extrabold tabular mt-2 leading-none"
            style={{ color: palette.fg }}
          >
            {value}
          </p>
        </div>
        {icon && (
          <div
            className="h-10 w-10 rounded-xl grid place-items-center"
            style={{
              background: "#ffffff",
              color: palette.fg,
              border: `1px solid ${palette.border}`,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      {(hint || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
          {trend && (
            <span className="font-semibold text-[var(--text)]">{trend}</span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
