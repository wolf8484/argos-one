import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-none border-0 border-b border-[var(--hairline-strong)] bg-transparent px-0 text-body-md text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-b-2 focus-visible:border-primary disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
