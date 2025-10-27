import React, { useEffect, useMemo, useRef, useState } from "react";
import Controls from "../components/Controls.jsx";
import Palette from "../components/Palette.jsx";
import Grid from "../components/Grid.jsx";
import { parseZipToTiles, inferGridFromTiles } from "../utils/zip.js";
import { naturalCompare } from "../utils/naturalSort.js";

/* ------------ helpers ------------- */
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  const mm = (m % 60).toString().padStart(2, "0");
  const ss = r.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/* per-user points in localStorage */
const pointsKey = (name) => `points:${name}`;
/* per-puzzle leaderboard key in localStorage */
const lbKey = (puzzleId, rows, cols) =>
  `leaderboard:${puzzleId || "custom"}:${rows}x${cols}`;

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

  // --- points are per user; initialize below in useEffect
  const [points, setPoints] = useState(0);

  const [selectedPuzzle, setSelectedPuzzle] = useState(null);
  const [puzzles, setPuzzles] = useState([]);

  // timer
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const tickRef = useRef(null);
  const startRef = useRef(0);
  const hasPlacedRef = useRef(false); // first placement flag

  // leaderboard modal/display
  const [justSolved, setJustSolved] = useState(null); // {rank, total, ms}

  // Player name is still read from localStorage, as in your current app
  const playerName = useMemo(
    () => localStorage.getItem("playerName") || "Player",
    []
  );

  /* -------------- THEME -------------- */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  /* -------------- INITIALIZE PER-USER POINTS -------------- */
  useEffect(() => {
    // if no points exist for this user, seed with 5
    const key = pointsKey(playerName);
    const existing = localStorage.getItem(key);
    if (existing == null) {
      localStorage.setItem(key, "5");
      setPoints(5);
    } else {
      setPoints(Math.max(0, Number(existing) || 0));
    }
  }, [playerName]);

  /* -------------- LOAD CATALOG (from API) -------------- */
  useEffect(() => {
    const fetchPuzzles = async () => {
      try {
        const res = await fetch("/api/puzzles");
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        setPuzzles(Array.isArray(data) ? data : []); // ✅ ensure array
      } catch (err) {
        console.error("Failed to fetch puzzles:", err);
        setPuzzles([]); // fallback
      }
    };

    fetchPuzzles();
  }, []);

  const showToast = (m) => {
    setToast(m);
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(() => setToast(null), 2000);
  };

  const tileById = (id) => tiles.find((t) => t.id === id);

  const filtered = Array.isArray(puzzles)
    ? puzzles.filter((p) => (p.difficulty || "").toLowerCase() === difficulty)
    : [];

  /* -------------- TIMER CONTROLS -------------- */
  const startTimer = () => {
    if (running) return;
    setRunning(true);
    setElapsedMs(0);
    startRef.current = performance.now();
    tickRef.current = setInterval(() => {
      setElapsedMs(performance.now() - startRef.current);
    }, 200);
  };
  const stopTimer = () => {
    if (!running) return;
    clearInterval(tickRef.current);
    tickRef.current = null;
    setRunning(false);
    setElapsedMs(performance.now() - startRef.current);
  };
  const resetTimer = () => {
    clearInterval(tickRef.current);
    tickRef.current = null;
    setRunning(false);
    setElapsedMs(0);
    startRef.current = 0;
  };

  /* -------------- ZIP / LOAD -------------- */
  const handleZip = async (file) => {
    try {
      const loadedTiles = await parseZipToTiles(file);
      if (!loadedTiles.length) {
        showToast("No tiles found in ZIP.");
        return;
      }

      const inferred = inferGridFromTiles(loadedTiles);
      const R = inferred.rows ?? 0;
      const C = inferred.cols ?? 0;
      if (!R || !C) {
        showToast("Could not infer rows/cols from filenames.");
        return;
      }

      // keep only tiles within [0..R-1] × [0..C-1], and prefer first tile per (r,c)
      const coordKey = (t) => `${t.row}:${t.col}`;
      const seen = new Set();
      const inBounds = [];
      for (const t of loadedTiles) {
        if (t.row < 0 || t.col < 0 || t.row >= R || t.col >= C) continue;
        const k = coordKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        inBounds.push(t);
      }

      // enforce exactly R*C at most (if ZIP had extras)
      const finalTiles = inBounds.slice(0, R * C);

      setTiles(finalTiles);
      setRows(R);
      setCols(C);
      setGrid(Array.from({ length: R }, () => Array(C).fill(null)));
      setPalette(finalTiles.map((t) => t.id)); // ← only valid, in-bounds tiles
      setSelectedTileId(null);
      hasPlacedRef.current = false;
      resetTimer();
      setJustSolved(null);
      showToast(`Loaded ${R}×${C} puzzle with ${finalTiles.length} tiles.`);
    } catch {
      showToast("Failed to read ZIP.");
    }
  };

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
    setPalette(shuffle(tiles.map((t) => t.id)));
    setSelectedTileId(null);
    hasPlacedRef.current = false;
    resetTimer();
    setJustSolved(null);
  };
  const clearBoard = () => buildGrid();

  /* -------------- AUTO-SOLVE (cost 5 points) -------------- */
  const spendPoints = (n) => {
    const key = pointsKey(playerName);
    const newPts = Math.max(0, points - n);
    setPoints(newPts);
    localStorage.setItem(key, String(newPts));
  };

  const grantPoint = (n = 1) => {
    const key = pointsKey(playerName);
    const newPts = points + n;
    setPoints(newPts);
    localStorage.setItem(key, String(newPts));
  };

  const autoSolve = () => {
    if (points < 5) return showToast("Need 5 points to Auto-solve.");
    if (!tiles.length) return;
    const ordered = [...tiles].sort((a, b) => naturalCompare(a.name, b.name));
    let k = 0;
    const layout = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ordered[k++]?.id || null)
    );
    setGrid(layout);
    setPalette([]);
    setSelectedTileId(null);
    spendPoints(5); // deduct 5
    stopTimer();
    showToast("Auto-solved (−5 points).");
  };

  /* -------------- CHECK / SAVE RESULT -------------- */
  const recordLeaderboard = (ms) => {
    const key = lbKey(selectedPuzzle?.id, rows, cols);
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.push({
      name: playerName,
      ms,
      when: Date.now(),
    });
    list.sort((a, b) => a.ms - b.ms);
    if (list.length > 100) list.length = 100;
    localStorage.setItem(key, JSON.stringify(list));
    const rank = list.findIndex(
      (r) =>
        r.name === playerName &&
        r.ms === ms &&
        Math.abs(r.when - Date.now()) < 2000
    );
    return { rank: rank >= 0 ? rank + 1 : null, total: list.length };
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
      stopTimer();
      grantPoint(1); // +1 for a solve
      const { rank, total } = recordLeaderboard(elapsedMs);
      setJustSolved({ rank, total, ms: elapsedMs });
      showToast(`Solved in ${fmtTime(elapsedMs)}! +1 point`);
    } else {
      showToast(`Scored ${correct}/${rows * cols}`);
    }
  };

  /* -------------- PLACE TILE (start timer on first place) -------------- */
  const attemptPlace = (tileId, r, c) => {
    const t = tileById(tileId);
    if (!t) return;

    if (!hasPlacedRef.current) {
      hasPlacedRef.current = true;
      startTimer();
    }

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

  const previewSrc = (p) => p.preview || `/puzzles/previews/${p.id}.jpg`;
  const uploadDisabled = difficulty !== "custom";

  /* -------------- UI -------------- */
  return (
    <>
      <nav className="navbar-full">
        <div className="brand">
          <a href="/Welcome.jsx">🧩 Puzzle Challenge</a>
        </div>
        <div className="grow"></div>
        <div className="muted">Hi, {playerName}</div>
        <div style={{ marginLeft: 12, marginRight: 12 }}>Points: {points}</div>
        <div className="muted" style={{ marginRight: 12 }}>
          Time: {fmtTime(elapsedMs)}
        </div>
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
                hasPlacedRef.current = false;
                resetTimer();
                setJustSolved(null);
                showToast("Reset.");
              }}
              onZipSelect={
                uploadDisabled
                  ? () => alert("Upload is only available in Custom mode.")
                  : handleZip
              }
              onShuffle={() => setPalette((p) => shuffle(p))}
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

          {/* Leaderboard after a solve */}
          {justSolved && (
            <div className="panel" style={{ marginTop: 12 }}>
              <h3 style={{ marginTop: 0 }}>
                Leaderboard — {selectedPuzzle?.name || "Custom"} ({rows}×{cols})
              </h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Your time: <strong>{fmtTime(justSolved.ms)}</strong> · Rank{" "}
                <strong>{justSolved.rank ?? "—"}</strong> of {justSolved.total}
              </p>
              <Leaderboard
                puzzleId={selectedPuzzle?.id}
                rows={rows}
                cols={cols}
              />
            </div>
          )}

          {toast && <div className="toast">{toast}</div>}
        </main>
      </div>
    </>
  );
}

/* simple inline leaderboard component (reads localStorage) */
function Leaderboard({ puzzleId, rows, cols }) {
  const key = lbKey(puzzleId, rows, cols);
  const [rowsData, setRowsData] = useState([]);

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      setRowsData(list.slice(0, 20)); // top 20
    } catch {
      setRowsData([]);
    }
  }, [key]);

  if (!rowsData.length) return <div className="muted">No entries yet.</div>;

  return (
    <div className="table" style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Time</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rowsData.map((r, i) => (
            <tr key={r.when}>
              <td>{i + 1}</td>
              <td>{r.name}</td>
              <td>{fmtTime(r.ms)}</td>
              <td>{new Date(r.when).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
