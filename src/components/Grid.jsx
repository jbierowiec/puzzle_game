// Grid.jsx
import React, { useLayoutEffect, useRef, useState } from "react";

export default function Grid({
  rows,
  cols,
  grid,
  getTile,
  cellState,
  onAllowDrop,
  onDropToCell,
  onCellClick,
}) {
  const wrapperRef = useRef(null);
  const [cellPx, setCellPx] = useState(72);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el || cols <= 0) return;
    const recompute = () => {
      const w = el.clientWidth;
      const gap = 0; // 👈 no gaps; lines are drawn by overlay
      const pad = 0;
      const maxCell = 72;
      const minCell = 16;
      const usable = Math.max(0, w - pad - (cols - 1) * gap);
      const target = Math.floor(usable / cols);
      setCellPx(Math.max(minCell, Math.min(maxCell, target)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols]);

  return (
    <div className="grid-wrapper" ref={wrapperRef}>
      <div
        className="grid-inner"
        style={{
          // size of the cells exposed to CSS via a var
          ["--cell"]: `${cellPx}px`,
          gridTemplateColumns: `repeat(${cols}, var(--cell))`,
          gridTemplateRows: `repeat(${rows}, var(--cell))`,
          gap: 0, // 👈 important
        }}
        onDragOver={onAllowDrop}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const id = grid[r]?.[c];
            const t = id ? getTile(id) : null;
            const state = cellState(r, c);
            return (
              <div
                key={`${r}-${c}`}
                className={`cell ${state}`}
                onDragOver={onAllowDrop}
                onDrop={(e) => onDropToCell(e, r, c)}
                onClick={() => onCellClick(r, c)}
                title={`(${r}, ${c})`}
                style={{
                  width: "var(--cell)",
                  height: "var(--cell)",
                  overflow: "hidden",
                  border: "0", // 👈 no per-cell borders
                }}
              >
                {t ? (
                  <img
                    src={t.dataUrl}
                    alt={t?.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                      objectFit: "cover",
                    }}
                    draggable={false}
                  />
                ) : (
                  <span className="hint">
                    {r},{c}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
