import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const textVariants = cva("m-0 min-w-0", {
  variants: {
    variant: {
      caption: "text-[length:var(--type-caption-size)] leading-[var(--type-caption-line)]",
      micro: "text-[length:var(--type-micro-size)] leading-[var(--type-micro-line)]",
      label: "text-[length:var(--type-label-size)] leading-[var(--type-label-line)]",
      bodySm: "text-[length:var(--type-body-sm-size)] leading-[var(--type-body-sm-line)]",
      bodyMd: "text-[length:var(--type-body-md-size)] leading-[var(--type-body-md-line)]",
      titleSm: "text-[length:var(--type-title-sm-size)] leading-[var(--type-title-sm-line)]",
      titleMd: "text-[length:var(--type-title-md-size)] leading-[var(--type-title-md-line)]",
      titleLg: "text-[length:var(--type-title-lg-size)] leading-[var(--type-title-lg-line)]",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      subtle: "text-[var(--color-text-subtle)]",
      ghost: "text-[var(--color-text-ghost)]",
      accent: "text-accent-foreground",
      danger: "text-red",
      success: "text-green",
      warning: "text-orange",
    },
    weight: {
      regular: "font-[var(--type-weight-regular)]",
      medium: "font-[var(--type-weight-medium)]",
      semibold: "font-[var(--type-weight-semibold)]",
      bold: "font-[var(--type-weight-bold)]",
    },
    font: {
      sans: "font-sans",
      mono: "font-mono",
    },
    truncate: {
      true: "truncate",
      false: "",
    },
  },
  defaultVariants: {
    variant: "bodySm",
    tone: "default",
    weight: "regular",
    font: "sans",
    truncate: false,
  },
})

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  asChild?: boolean
  as?: "span" | "p" | "div" | "label" | "small" | "strong" | "em" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ asChild = false, as, className, variant, tone, weight, font, truncate, ...props }, ref) => {
    const Comp: React.ElementType = asChild ? Slot : (as ?? "span")

    return (
      <Comp
        ref={ref}
        className={cn(textVariants({ variant, tone, weight, font, truncate }), className)}
        {...props}
      />
    )
  }
)
Text.displayName = "Text"

export { Text, textVariants }
