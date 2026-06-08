import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonVariantProps } from "@/components/ui/button-variants"

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & ButtonVariantProps) {
  const effectiveNativeButton = render != null ? false : (nativeButton ?? true)

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      nativeButton={effectiveNativeButton}
      {...props}
    />
  )
}

export { Button, buttonVariants }
