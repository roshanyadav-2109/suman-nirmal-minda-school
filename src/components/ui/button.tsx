import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "subtle" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-black text-white hover:bg-[rgb(38,38,38)] border border-transparent",
  gold: "bg-gold-500 text-ink-900 hover:bg-gold-700 hover:text-gold-100 border border-transparent",
  subtle: "bg-panel text-ink-900 hover:bg-gold-100 border border-hair",
  ghost: "bg-transparent text-ink-700 hover:bg-panel border border-transparent",
  danger: "bg-down text-white hover:opacity-90 border border-transparent",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-sm gap-1.5",
  md: "h-10 px-4 text-[14px] rounded-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
