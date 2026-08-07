import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[2px] border text-button-md whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // button-primary — Sunlight Yellow CTA
        primary:
          "border-transparent bg-primary text-primary-foreground hover:bg-[var(--primary-deep)]",
        // button-secondary-dark — solid black/white CTA
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:opacity-85",
        // button-outline-dark — outlined on light, button-outline-light on dark
        outline:
          "border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background",
        // button-pill — sub-nav chip
        pill:
          "rounded-[46px] border-foreground bg-transparent text-foreground text-button-sm hover:bg-foreground hover:text-background",
        // quiet text-only action
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
      },
      size: {
        default: "h-12 gap-2 px-6",
        sm: "h-9 gap-1.5 px-4 text-button-sm",
        lg: "h-14 gap-2 px-8 text-button-lg",
        icon: "size-10 rounded-[2px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
