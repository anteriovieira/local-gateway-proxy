"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "./lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const tabsListVariants = cva(
  "inline-flex items-center justify-center",
  {
    variants: {
      variant: {
        default: "h-10 rounded-lg bg-muted p-1 text-muted-foreground",
        line: "h-10 shrink-0 border-b border-border text-muted-foreground",
        vertical: "h-auto flex flex-col justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
        bordered: "h-11 border-b border-zinc-700 bg-zinc-900/80 gap-0",
        borderedVertical: "h-auto flex flex-col gap-1 bg-transparent",
        pill: "gap-2 bg-transparent",
        pillVertical: "flex flex-col gap-2 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  {
    variants: {
      variant: {
        default: "",
        line:
          "rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-1.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
        vertical:
          "w-full justify-start gap-2 rounded-md px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        bordered:
          "rounded-t-lg rounded-b-none -mb-px px-4 py-2.5 bg-zinc-800 text-zinc-400 border-x border-t border-zinc-700 border-b-transparent first:rounded-tl-lg first:rounded-tr-none last:rounded-tr-lg last:rounded-tl-none data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:border-zinc-600",
        borderedVertical:
          "w-full justify-start gap-2 rounded-md px-4 py-2.5 bg-zinc-800 text-zinc-400 border border-zinc-700 data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:border-zinc-600",
        pill:
          "rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-300 data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:shadow-sm",
        pillVertical:
          "w-full justify-start gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-300 data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants }
