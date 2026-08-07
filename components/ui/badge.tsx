import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[2px] border px-2.5 text-button-sm whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // badge-new — the signature yellow pill, reserved / scarce
        new: "rounded-[46px] border-transparent bg-primary text-primary-foreground",
        outline: "border-foreground text-foreground bg-transparent",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        error: "border-transparent bg-destructive/15 text-destructive",
        info: "border-transparent bg-info/15 text-info",
        neutral: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
