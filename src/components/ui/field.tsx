import { cn } from "@/lib/utils";

const control =
  "h-10 w-full rounded-sm border border-hair bg-surface px-3 text-[14px] text-ink-900 placeholder:text-muted focus-visible:border-gold-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("t-label mb-1.5 block", className)} {...props}>
      {children}
    </label>
  );
}

export function Field({ label, htmlFor, hint, children }: { label?: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "appearance-none bg-[right_0.6rem_center] bg-no-repeat pr-9 cursor-pointer", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b5b57' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  );
}
