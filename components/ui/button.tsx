import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border text-button whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // button-primary — near-black CTA
        primary:
          "border-transparent bg-primary text-primary-foreground hover:bg-[var(--primary-active)]",
        // button-secondary — white with hairline outline
        secondary:
          "border-[var(--hairline)] bg-card text-foreground hover:bg-muted",
        outline:
          "border-[var(--hairline)] bg-transparent text-foreground hover:bg-muted",
        pill:
          "rounded-full border-transparent bg-transparent text-muted-foreground text-nav-link hover:text-foreground",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
      },
      size: {
        default: "h-10 gap-2 px-5",
        sm: "h-9 gap-1.5 px-4 text-[13px]",
        lg: "h-12 gap-2 px-6 text-[15px]",
        icon: "size-9 rounded-full",
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
