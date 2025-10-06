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
      const gap = 6;
      const pad = 6 * 2;
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
          gridTemplateColumns: `repeat(${cols}, var(--cell))`,
          gridTemplateRows: `repeat(${rows}, var(--cell))`,
          ["--cell"]: `${cellPx}px`,
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
              >
                {t ? (
                  <img src={t.dataUrl} alt={t?.name} />
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
