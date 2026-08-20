import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border font-mono text-xs font-semibold uppercase tracking-[0.08em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-[#df6b22] bg-[#df6b22] text-white shadow-xs hover:border-[#c95b18] hover:bg-[#c95b18]",
        secondary: "border-[rgb(32_33_42_/_0.12)] bg-white text-[#20212a] hover:bg-[#f3f4f6] hover:text-[#20212a]",
        danger: "border-rose-600 bg-rose-600 text-white shadow-xs hover:border-rose-700 hover:bg-rose-700",
        ghost: "border-[rgb(32_33_42_/_0.12)] bg-white text-[#686970] hover:bg-[#f3f4f6] hover:text-[#20212a]",
        outline: "border-[rgb(32_33_42_/_0.12)] bg-white text-[#20212a] hover:bg-[#f3f4f6]",
      },
      size: {
        sm: "h-8 px-3 text-[10px]",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-sm",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", fullWidth: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, size, fullWidth, loading = false, icon, disabled, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
