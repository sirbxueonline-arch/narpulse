import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "mark";
  className?: string;
  size?: number;
};

export default function Logo({
  variant = "full",
  className,
  size = 28,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark size={size} />
      {variant === "full" && (
        <span className="font-extrabold tracking-tight text-[1.05rem] leading-none">
          Nar<span className="text-[var(--accent)]">Pulse</span>
        </span>
      )}
    </span>
  );
}

function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      role="img"
    >
      {/* Pomegranate body */}
      <defs>
        <linearGradient id="np-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E63950" />
          <stop offset="100%" stopColor="#C8102E" />
        </linearGradient>
      </defs>
      <path
        d="M20 4c-1.4 0-2.2.8-2.6 1.6-.5 1-.6 2.1-.5 3.1-3.5.7-6.6 2.6-8.4 5.5-2 3.3-2.4 7.6-.8 11.6 1.5 3.9 4.7 7.4 8.7 9.4 1.1.5 2.3.8 3.6.8s2.5-.3 3.6-.8c4-2 7.2-5.5 8.7-9.4 1.6-4 1.2-8.3-.8-11.6-1.8-2.9-4.9-4.8-8.4-5.5.1-1 0-2.1-.5-3.1C22.2 4.8 21.4 4 20 4Z"
        fill="url(#np-grad)"
      />
      {/* Crown */}
      <path
        d="M19 4c-.4.7-.6 1.6-.5 2.5h3c.1-.9-.1-1.8-.5-2.5h-2Z"
        fill="#7A0A1C"
      />
      {/* Pulse line */}
      <path
        d="M5 22h6l2.5-5 3 9 3.5-7 2.5 4h12.5"
        stroke="#F5F5F0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
