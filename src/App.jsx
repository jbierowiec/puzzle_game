import React, { useEffect, useState } from "react";
import Controls from "./components/Controls.jsx";
import Palette from "./components/Palette.jsx";
import Grid from "./components/Grid.jsx";
import { parseZipToTiles, inferGridFromTiles } from "./utils/zip.js";
import { naturalCompare } from "./utils/naturalSort.js";

export default function App() {
  // Persisted theme; index.html sets it before mount to prevent flash
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  const [tiles, setTiles] = useState([]); // [{id,name,dataUrl,row?,col?}]
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const [assisted, setAssisted] = useState(true);
  const [grid, setGrid] = useState([]); // 2D: tileId | null
  const [palette, setPalette] = useState([]); // tileIds not placed
  const [toast, setToast] = useState(null);
  const [selectedTileId, setSelectedTileId] = useState(null); // click-to-place

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Lightweight toast
  const showToast = (m) => {
    setToast(m);
    window.clearTimeout(showToast._tid);
    showToast._tid = window.setTimeout(() => setToast(null), 1800);
  };

  const tileById = (id) => tiles.find((t) => t.id === id);

  // Load zip → tiles
  const handleZip = async (file) => {
    try {
      const loadedTiles = await parseZipToTiles(file);
      if (!loadedTiles.length) {
        showToast("No images found in ZIP.");
        return;
      }

      const inferred = inferGridFromTiles(loadedTiles);
      const R = inferred.rows ?? 0;
      const C = inferred.cols ?? 0;

      setTiles(loadedTiles);
      setRows(R);
      setCols(C);
      setGrid(
        Array.from({ length: R }, () => Array.from({ length: C }, () => null))
      );
      setPalette(loadedTiles.map((t) => t.id));
      setSelectedTileId(null);

      showToast(
        inferred.source === "filenames"
          ? `Grid inferred: ${R} × ${C}`
          : "Set rows/cols and click Build Grid"
      );
    } catch (err) {
      console.error(err);
      showToast("Failed to read ZIP.");
    }
  };

  // Build blank grid of current size; return all tiles to palette
  const buildGrid = () => {
    const R = Math.max(0, Number(rows) || 0);
    const C = Math.max(0, Number(cols) || 0);
    setGrid(
      Array.from({ length: R }, () => Array.from({ length: C }, () => null))
    );
    setPalette(tiles.map((t) => t.id));
    setSelectedTileId(null);
  };

  const clearBoard = () => {
    const R = Math.max(0, Number(rows) || 0);
    const C = Math.max(0, Number(cols) || 0);
    setGrid(
      Array.from({ length: R }, () => Array.from({ length: C }, () => null))
    );
    setPalette(tiles.map((t) => t.id));
    setSelectedTileId(null);
  };

  const autoSolve = () => {
    if (rows <= 0 || cols <= 0) {
      showToast("Set a valid grid first.");
      return;
    }
    if (!tiles.length) return;

    const allHaveIdx = tiles.every((t) => t.row != null && t.col != null);
    const layout = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null)
    );

    if (allHaveIdx) {
      for (const t of tiles) {
        if (t.row < rows && t.col < cols) layout[t.row][t.col] = t.id;
      }
    } else {
      const ordered = [...tiles].sort((a, b) => naturalCompare(a.name, b.name));
      let k = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          layout[r][c] = ordered[k] ? ordered[k].id : null;
          k++;
        }
      }
    }
    setGrid(layout);
    const placed = new Set(layout.flat().filter(Boolean));
    setPalette(tiles.map((t) => t.id).filter((id) => !placed.has(id)));
    setSelectedTileId(null);
    showToast("Auto-solved.");
  };

  const checkSolution = () => {
    const allHaveIdx = tiles.every((t) => t.row != null && t.col != null);
    if (!allHaveIdx) {
      showToast("Cannot verify: tiles lack row/col indices.");
      return;
    }
    let correct = 0,
      total = rows * cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = grid[r]?.[c];
        if (!id) continue;
        const t = tileById(id);
        if (t && t.row === r && t.col === c) correct++;
      }
    }
    showToast(`Scored ${correct}/${total}.`);
  };

  // Shared placer used by DnD + click-to-place
  const attemptPlace = (tileId, r, c) => {
    const t = tileById(tileId);
    if (!t) return;
    if (
      assisted &&
      t.row != null &&
      t.col != null &&
      (t.row !== r || t.col !== c)
    ) {
      showToast(`Not correct for (${r}, ${c}).`);
      return;
    }
    setGrid((g) => {
      const copy = g.map((row) => row.slice());
      const existing = copy[r][c];
      if (existing) setPalette((p) => [...p, existing]);
      copy[r][c] = tileId;
      return copy;
    });
    setPalette((p) => p.filter((id) => id !== tileId));
    setSelectedTileId(null);
    if (assisted) showToast("Correct placement!");
  };

  // Drag & drop
  const onAllowDrop = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDropToCell = (e, r, c) => {
    e.preventDefault();
    const tileId = e.dataTransfer.getData("text/plain");
    if (tileId) attemptPlace(tileId, r, c);
  };

  // Click-to-place
  const onSelectTile = (id) =>
    setSelectedTileId((prev) => (prev === id ? null : id));
  const onCellClick = (r, c) => {
    if (selectedTileId) attemptPlace(selectedTileId, r, c);
  };

  // Compute cell correctness state for outlines
  const cellState = (r, c) => {
    const id = grid[r]?.[c];
    if (!id) return "";
    const t = tileById(id);
    if (t && t.row != null && t.col != null)
      return t.row === r && t.col === c ? "correct" : "wrong";
    return "";
  };

  return (
    <>
      {/* FULL-WIDTH NAVBAR */}
      <nav className="navbar-full">
        <div className="brand">🧩 Puzzle Game</div>
        <button
          className="btn"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </nav>

      {/* CENTERED APP CONTENT */}
      <div className="app">
        <div className="panel">
          <Controls
            rows={rows}
            cols={cols}
            assisted={assisted}
            onAssistedChange={setAssisted}
            onRowsChange={setRows}
            onColsChange={setCols}
            onBuildGrid={buildGrid}
            onClearBoard={clearBoard}
            onAutoSolve={autoSolve}
            onCheck={checkSolution}
            onReset={() => {
              setTiles([]);
              setPalette([]);
              setGrid([]);
              setRows(0);
              setCols(0);
              setSelectedTileId(null);
              showToast("Reset.");
            }}
            onZipSelect={handleZip}
          />
        </div>

        <section className="stage">
          <div className="panel grid-panel">
            <div className="grid-header">
              <h3>Grid</h3>
              <div className="legend">
                <span className="dot good"></span> correct
                <span className="dot bad"></span> wrong
              </div>
            </div>
            <Grid
              rows={rows}
              cols={cols}
              grid={grid}
              getTile={tileById}
              cellState={cellState}
              onAllowDrop={onAllowDrop}
              onDropToCell={onDropToCell}
              onCellClick={onCellClick}
            />
          </div>

          <div className="panel palette-panel">
            <h3 style={{ marginTop: 0 }}>Tile Palette ({palette.length})</h3>
            <Palette
              palette={palette}
              getTile={tileById}
              onSelectTile={onSelectTile}
              selectedTileId={selectedTileId}
            />
            <div className="hint">
              {palette.length === 0
                ? "All tiles placed."
                : "Tip: Click a tile, then click a grid cell to place. Or drag & drop a tile onto any cell."}
            </div>
          </div>
        </section>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}
