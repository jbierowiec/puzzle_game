import React from "react";

export default function Controls({
  rows,
  cols,
  assisted,
  onAssistedChange,
  onRowsChange,
  onColsChange,
  onBuildGrid,
  onClearBoard,
  onAutoSolve,
  onCheck,
  onReset,
  onZipSelect,
}) {
  return (
    <div className="controls">
      <div className="row">
        <input
          type="file"
          accept=".zip"
          onChange={(e) => onZipSelect(e.target.files?.[0])}
          aria-label="Upload zip of tiles"
        />
        <button className="btn ghost" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="row">
        <label>
          Rows:&nbsp;
          <input
            type="number"
            min="0"
            value={rows}
            onChange={(e) => onRowsChange(parseInt(e.target.value || "0", 10))}
            style={{ width: 90 }}
          />
        </label>
        <label>
          Cols:&nbsp;
          <input
            type="number"
            min="0"
            value={cols}
            onChange={(e) => onColsChange(parseInt(e.target.value || "0", 10))}
            style={{ width: 90 }}
          />
        </label>

        <button className="btn primary" onClick={onBuildGrid}>
          Build/Resize Grid
        </button>

        <label className="chk">
          <input
            type="checkbox"
            checked={assisted}
            onChange={(e) => onAssistedChange(e.target.checked)}
          />
          <span>Assisted mode</span>
        </label>

        <button className="btn" onClick={onCheck}>
          Check
        </button>
        <button className="btn" onClick={onClearBoard}>
          Clear Board
        </button>
        <button className="btn primary" onClick={onAutoSolve}>
          Auto-solve
        </button>
      </div>

      <div className="hint">
        Assisted mode blocks incorrect drops and shows ✓/✗ feedback. Unassisted
        lets you place freely.
      </div>
    </div>
  );
}
