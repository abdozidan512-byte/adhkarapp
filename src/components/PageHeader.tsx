import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("relative overflow-hidden", className)}
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="pattern-islamic absolute inset-0 opacity-20" />
      <div className="relative px-5 pb-8 pt-12">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary-foreground drop-shadow-lg">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-primary-foreground/80">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      </div>
      {/* decorative arch */}
      <div
        className="h-4"
        style={{
          background: "var(--background)",
          borderTopLeftRadius: "2rem",
          borderTopRightRadius: "2rem",
          marginTop: "-1rem",
          position: "relative",
        }}
      />
    </header>
  );
}
