import React, { useEffect, useMemo, useState } from "react";
import Controls from "../components/Controls.jsx";
import Palette from "../components/Palette.jsx";
import Grid from "../components/Grid.jsx";
import { parseZipToTiles, inferGridFromTiles } from "../utils/zip.js";
import { naturalCompare } from "../utils/naturalSort.js";

export default function GameView({ difficulty = "easy" }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  const [tiles, setTiles] = useState([]);
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const [assisted, setAssisted] = useState(true);
  const [grid, setGrid] = useState([]);
  const [palette, setPalette] = useState([]);
  const [toast, setToast] = useState(null);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [points, setPoints] = useState(
    () => Number(localStorage.getItem("points")) || 0
  );
  const [selectedPuzzle, setSelectedPuzzle] = useState(null);
  const [puzzles, setPuzzles] = useState([]);

  const playerName = useMemo(
    () => localStorage.getItem("playerName") || "Player",
    []
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const showToast = (m) => {
    setToast(m);
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(() => setToast(null), 2000);
  };

  const tileById = (id) => tiles.find((t) => t.id === id);

  // Load catalog
  useEffect(() => {
    fetch("/puzzles/puzzle_list.json")
      .then((r) => r.json())
      .then(setPuzzles)
      .catch(() => showToast("Failed to load puzzle list."));
  }, []);

  const filtered = useMemo(() => {
    if (difficulty === "custom") return puzzles;
    return puzzles.filter(
      (p) => (p.difficulty || "").toLowerCase() === difficulty
    );
  }, [puzzles, difficulty]);

  const handleZip = async (file) => {
    try {
      const loadedTiles = await parseZipToTiles(file);
      // --- Normalize filenames that are 1-based (1,1 top-left) to 0-based (0,0) ---
      {
        const withIdx = loadedTiles.filter(
          (t) => t.row != null && t.col != null
        );
        if (withIdx.length) {
          const minRow = Math.min(...withIdx.map((t) => t.row));
          const minCol = Math.min(...withIdx.map((t) => t.col));
          const hasZero = withIdx.some((t) => t.row === 0 || t.col === 0);
          const looksOneBased = !hasZero && (minRow === 1 || minCol === 1);
          if (looksOneBased) {
            for (const t of loadedTiles) {
              if (t.row != null) t.row -= 1;
              if (t.col != null) t.col -= 1;
            }
          }
        }
      }
      if (!loadedTiles.length) return showToast("No images found in ZIP.");
      const inferred = inferGridFromTiles(loadedTiles);
      const R = inferred.rows ?? 0;
      const C = inferred.cols ?? 0;
      setTiles(loadedTiles);
      setRows(R);
      setCols(C);
      setGrid(Array.from({ length: R }, () => Array(C).fill(null)));
      setPalette(loadedTiles.map((t) => t.id));
      setSelectedTileId(null);
      showToast(`Loaded ${R}×${C} puzzle.`);
    } catch {
      showToast("Failed to read ZIP.");
    }
  };

  // inside GameView.jsx
  const loadDefaultPuzzle = async (p) => {
    try {
      const res = await fetch(p.zipPath, { cache: "no-store" });
      if (!res.ok) {
        console.error(
          "ZIP fetch failed:",
          p.zipPath,
          res.status,
          res.statusText
        );
        return showToast(`Missing ZIP: ${p.zipPath} (${res.status})`);
      }
      const blob = await res.blob();
      if (!blob || !blob.size) {
        console.error("ZIP blob empty:", p.zipPath);
        return showToast("ZIP is empty.");
      }
      const file = new File([blob], `${p.id}.zip`, { type: "application/zip" });
      await handleZip(file);
      setSelectedPuzzle(p);
    } catch (e) {
      console.error("loadDefaultPuzzle error:", e);
      showToast("Could not load default puzzle.");
    }
  };

  const buildGrid = () => {
    setGrid(Array.from({ length: rows }, () => Array(cols).fill(null)));
    setPalette(tiles.map((t) => t.id));
    setSelectedTileId(null);
  };
  const clearBoard = () => buildGrid();

  const autoSolve = () => {
    if (points < 5) return showToast("Earn 5 points to unlock Auto-Solve!");
    if (!tiles.length) return;
    const ordered = [...tiles].sort((a, b) => naturalCompare(a.name, b.name));
    let k = 0;
    const layout = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ordered[k++]?.id || null)
    );
    setGrid(layout);
    setPalette([]);
    setSelectedTileId(null);
    setPoints(0);
    localStorage.setItem("points", "0");
    showToast("Auto-solved! Points reset to 0.");
  };

  const checkSolution = () => {
    const allHaveIdx = tiles.every((t) => t.row != null && t.col != null);
    if (!allHaveIdx)
      return showToast("Cannot verify: tiles lack row/col indices.");
    let correct = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const id = grid[r]?.[c];
        const t = tileById(id);
        if (t && t.row === r && t.col === c) correct++;
      }
    if (correct === rows * cols) {
      const newPoints = points + 1;
      setPoints(newPoints);
      localStorage.setItem("points", String(newPoints));
      showToast(`Puzzle solved! +1 point (${newPoints} total)`);
    } else {
      showToast(`Scored ${correct}/${rows * cols}`);
    }
  };

  const attemptPlace = (tileId, r, c) => {
    const t = tileById(tileId);
    if (!t) return;
    if (
      assisted &&
      t.row != null &&
      t.col != null &&
      (t.row !== r || t.col !== c)
    ) {
      return showToast(`Incorrect placement for (${r},${c}).`);
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
  };

  const onAllowDrop = (e) => e.preventDefault();
  const onDropToCell = (e, r, c) => {
    e.preventDefault();
    const tileId = e.dataTransfer.getData("text/plain");
    if (tileId) attemptPlace(tileId, r, c);
  };

  const cellState = (r, c) => {
    const id = grid[r]?.[c];
    if (!id) return "";
    const t = tileById(id);
    if (t && t.row != null && t.col != null)
      return t.row === r && t.col === c ? "correct" : "wrong";
    return "";
  };

  // Optional preview: if your JSON has preview images at p.preview (e.g. /puzzles/previews/<id>.jpg)
  const previewSrc = (p) => p.preview || `/puzzles/previews/${p.id}.jpg`;

  const uploadDisabled = difficulty !== "custom";

  return (
    <>
      <nav className="navbar-full">
        <div className="brand">🧩 Puzzle Challenge</div>
        <div className="grow"></div>
        <div className="muted">Hi, {playerName}</div>
        <div style={{ marginLeft: 12, marginRight: 12 }}>Points: {points}</div>
        <button
          className="btn"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </nav>

      <div className="layout">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar">
          <h4 style={{ marginTop: 0, marginBottom: 8 }}>
            {difficulty === "custom"
              ? "All Puzzles"
              : `Difficulty: ${difficulty}`}
          </h4>

          <div className="puzzle-list">
            {filtered.map((p) => (
              <div
                key={p.id}
                className={`puzzle-item ${
                  selectedPuzzle?.id === p.id ? "active" : ""
                }`}
                onClick={() => setSelectedPuzzle(p)}
              >
                <div className="thumb">
                  <img
                    src={previewSrc(p)}
                    alt={p.name}
                    onError={(e) =>
                      (e.currentTarget.style.visibility = "hidden")
                    }
                  />
                </div>
                <div className="meta">
                  <div className="title">{p.name}</div>
                  <div className="dim muted">
                    {p.rows && p.cols ? `${p.rows}×${p.cols}` : p.difficulty}
                  </div>
                  <button
                    className="btn tiny"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadDefaultPuzzle(p);
                    }}
                  >
                    Load
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="muted">No puzzles found.</div>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="content">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Controls</h3>
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
                setSelectedPuzzle(null);
                showToast("Reset.");
              }}
              onZipSelect={
                uploadDisabled
                  ? () => alert("Upload is only available in Custom mode.")
                  : handleZip
              }
            />
            {uploadDisabled && (
              <div className="hint" style={{ marginTop: 6 }}>
                Upload is disabled outside <strong>Custom</strong> mode.
              </div>
            )}
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
                onCellClick={(r, c) =>
                  selectedTileId && attemptPlace(selectedTileId, r, c)
                }
              />
            </div>

            <div className="panel palette-panel">
              <h3 style={{ marginTop: 0 }}>Tile Palette ({palette.length})</h3>
              <Palette
                palette={palette}
                getTile={tileById}
                onSelectTile={setSelectedTileId}
                selectedTileId={selectedTileId}
              />
              <div className="hint">
                {palette.length === 0
                  ? "All tiles placed."
                  : "Tip: Click a tile, then a grid cell to place. Or drag & drop a tile onto any cell."}
              </div>
            </div>
          </section>

          {toast && <div className="toast">{toast}</div>}
        </main>
      </div>
    </>
  );
}
