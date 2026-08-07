import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-none border border-[var(--hairline-strong)] bg-transparent px-4 py-3 text-body-md text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-2 focus-visible:border-primary disabled:opacity-40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
