import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96] touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-sm hover:shadow-glow",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 shadow-sm",
        outline: "border border-border/60 bg-background/50 hover:bg-surface-hover hover:border-border hover:text-foreground active:bg-surface-hover/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-hover active:bg-surface-hover/80",
        ghost: "hover:bg-surface-hover hover:text-foreground active:bg-surface-hover/80",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
      },
      size: {
        default: "h-11 px-5 py-2.5 min-h-[44px]", // iOS 44pt minimum
        sm: "h-9 rounded-lg px-3 text-sm min-h-[36px]",
        lg: "h-12 rounded-xl px-8 text-lg min-h-[48px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Trigger haptic feedback
      if (variant === 'destructive') {
        haptics.delete();
      } else if (variant === 'default') {
        haptics.buttonPress();
      } else {
        haptics.tap();
      }
      onClick?.(e);
    };

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} onClick={handleClick} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
