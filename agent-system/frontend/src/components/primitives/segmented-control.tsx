import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

type SegmentId = string

export interface SegmentItem {
  id: SegmentId
  label: React.ReactNode
  icon?: React.ComponentType<{ size?: number; className?: string }>
  count?: React.ReactNode
  disabled?: boolean
  dimmed?: boolean
  title?: string
}

const segmentedControlVariants = cva("min-w-0", {
  variants: {
    variant: {
      segmented: "flex gap-1",
      cardTabs:
        "flex gap-px border-t border-[var(--color-border-subtle)] bg-[var(--color-border-subtle)]",
      flatTabs:
        "flex border-t border-[var(--color-border-subtle)] bg-[var(--bg-card)] overflow-hidden",
    },
    radius: {
      none: "",
      bottom: "rounded-b-md",
    },
  },
  defaultVariants: {
    variant: "segmented",
    radius: "none",
  },
})

const segmentButtonVariants = cva(
  "flex-1 min-w-0 inline-flex items-center justify-center border-none bg-transparent cursor-pointer transition-colors disabled:cursor-default disabled:opacity-40",
  {
    variants: {
      variant: {
        segmented:
          "gap-1 px-2 py-1.5 type-caption type-medium rounded-md border border-[var(--color-border-subtle)] text-muted-foreground hover:border-border hover:text-foreground",
        cardTabs:
          "gap-[3px] px-2 py-1.5 type-caption type-medium text-muted-foreground hover:bg-[var(--bg-ingrained)] hover:text-foreground first:rounded-bl-lg last:rounded-br-lg",
        flatTabs:
          "gap-1 py-1.5 type-caption type-medium text-muted-foreground hover:text-foreground hover:bg-[var(--bg-card-hover)] first:rounded-bl-md last:rounded-br-md",
      },
      active: {
        true: "",
        false: "",
      },
      dimmed: {
        true: "opacity-35 hover:opacity-60",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "segmented",
        active: true,
        className:
          "bg-[var(--color-accent-dim)] text-accent border-[rgba(59,130,246,0.3)] type-semibold",
      },
      {
        variant: "cardTabs",
        active: true,
        className:
          "bg-[var(--color-accent-dim)] text-accent type-semibold",
      },
      {
        variant: "flatTabs",
        active: true,
        className:
          "bg-accent/10 text-accent type-semibold",
      },
    ],
    defaultVariants: {
      variant: "segmented",
      active: false,
      dimmed: false,
    },
  }
)

export interface SegmentedControlProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof segmentedControlVariants> {
  items: SegmentItem[]
  value?: SegmentId
  values?: Iterable<SegmentId>
  onValueChange: (id: SegmentId) => void
  iconSize?: number
  stopPropagation?: boolean
}

export function SegmentedControl({
  items,
  value,
  values,
  onValueChange,
  variant = "segmented",
  radius,
  iconSize = 11,
  stopPropagation = false,
  className,
  ...props
}: SegmentedControlProps) {
  const selected = React.useMemo(() => new Set(values ?? (value ? [value] : [])), [value, values])

  return (
    <div className={cn(segmentedControlVariants({ variant, radius }), className)} {...props}>
      {items.map((item) => {
        const Icon = item.icon
        const active = selected.has(item.id)
        return (
          <button
            key={item.id}
            type="button"
            className={cn(segmentButtonVariants({ variant, active, dimmed: item.dimmed }))}
            disabled={item.disabled}
            title={item.title}
            aria-pressed={active}
            onClick={(event) => {
              if (stopPropagation) event.stopPropagation()
              if (!item.disabled) onValueChange(item.id)
            }}
          >
            {Icon && <Icon size={iconSize} />}
            <span className="truncate">{item.label}</span>
            {item.count != null && (
              <span className="type-caption type-mono type-medium opacity-70 tabular-nums">
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { segmentedControlVariants, segmentButtonVariants }
