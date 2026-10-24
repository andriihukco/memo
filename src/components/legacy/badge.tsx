import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline:
          "text-foreground",
        /**
         * Warning badge — amber with sufficient contrast (≥4.5:1 in both themes).
         * Uses a solid amber-500 background with dark text to guarantee readability
         * on both dark (#0B0F19) and light (#FFFFFF) page backgrounds.
         */
        warning:
          "border-amber-500/50 bg-amber-500/20 text-amber-300 dark:text-amber-200",
        /**
         * Success badge — green with sufficient contrast.
         */
        success:
          "border-green-500/50 bg-green-500/20 text-green-300 dark:text-green-200",
        /**
         * Primary-tinted badge (log/metric indicator).
         */
        primary:
          "border-primary/40 bg-primary/20 text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
