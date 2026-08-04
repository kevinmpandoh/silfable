import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "bordered" | "gradient";
}

const variants = {
  default: "border-border bg-card/90",
  elevated: "border-cyan-200/20 bg-linear-to-br from-[#1a2545] to-[#101426] shadow-2xl shadow-black/40",
  bordered: "border-border bg-transparent",
  gradient: "border-cyan-300/20 bg-linear-to-br from-cyan-400/10 via-[#111a38] to-[#0b0e1c]",
};

export function Card({ children, variant = "default", className, ...props }: CardProps) {
  return <div className={cn("overflow-hidden rounded-2xl border p-5", variants[variant], className)} {...props}>{children}</div>;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3.5 flex items-center justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("m-0 text-lg font-semibold text-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4.5 flex items-center justify-end gap-2.5 border-t border-border pt-3.5", className)} {...props} />;
}
