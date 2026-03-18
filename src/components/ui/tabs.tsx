import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap shrink-0 rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/**
 * Wrapper for making TabsList horizontally scrollable on mobile.
 * Usage: <ScrollableTabs><TabsList>...</TabsList></ScrollableTabs>
 */
const ScrollableTabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, ...props }, ref) => {
  const localRef = React.useRef<HTMLDivElement | null>(null);
  const dragState = React.useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    pointerId: -1,
  });

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e);
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const el = localRef.current;
    if (!el) return;

    dragState.current.isDragging = true;
    dragState.current.startX = e.clientX;
    dragState.current.startScrollLeft = el.scrollLeft;
    dragState.current.pointerId = e.pointerId;

    el.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    const el = localRef.current;
    if (!el || !dragState.current.isDragging) return;

    const deltaX = e.clientX - dragState.current.startX;
    if (Math.abs(deltaX) > 2) e.preventDefault();
    el.scrollLeft = dragState.current.startScrollLeft - deltaX;
  };

  const stopDragging = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerUp?.(e);
    const el = localRef.current;
    if (!el) return;

    if (dragState.current.pointerId >= 0 && el.hasPointerCapture(dragState.current.pointerId)) {
      el.releasePointerCapture(dragState.current.pointerId);
    }

    dragState.current.isDragging = false;
    dragState.current.pointerId = -1;
  };

  return (
    <div
      ref={setRefs}
      className={cn("overflow-x-auto scrollbar-hide -mx-1 px-1 touch-pan-x select-none", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={(e) => {
        onPointerCancel?.(e);
        stopDragging(e);
      }}
      {...props}
    />
  );
});
ScrollableTabs.displayName = "ScrollableTabs";

export { Tabs, TabsList, TabsTrigger, TabsContent, ScrollableTabs };
