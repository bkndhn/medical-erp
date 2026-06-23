import { useRef, ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualListProps<T> {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  height?: string | number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
}

/**
 * Reusable virtual scrolling list — only renders rows in the viewport.
 * Use when row count is reliably >500 (POS items, Reports rows, etc).
 *
 * Usage:
 *   <VirtualList items={rows} estimateSize={56} renderItem={(r) => <Row data={r} />} />
 */
export function VirtualList<T>({
  items,
  estimateSize = 56,
  overscan = 8,
  height = "100%",
  className = "",
  renderItem,
  getKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div ref={parentRef} className={`overflow-auto scrollbar-thin ${className}`} style={{ height }}>
      <div style={{ height: v.getTotalSize(), width: "100%", position: "relative" }}>
        {v.getVirtualItems().map((vi) => {
          const item = items[vi.index];
          return (
            <div
              key={getKey ? getKey(item, vi.index) : vi.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: vi.size,
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderItem(item, vi.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;
