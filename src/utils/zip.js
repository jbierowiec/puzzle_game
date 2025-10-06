import JSZip from "jszip";
import { naturalCompare } from "./naturalSort.js";

// Accept only real image file extensions
const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

// Ignore common junk/metadata files and folders in zips
const IGNORE_NAME_RE =
  /(^|\/)(__macosx|\.ds_store|thumbs\.db|icon\r|readme(\.txt|\.md)?|license(\.txt|\.md)?)/i;

/** Parse row/col from filename.
 * Supported examples:
 *   r3_c7.png
 *   row3_col7.jpg
 *   3x7.jpeg
 *   3-7.png
 *   (3,7).png
 */
export function parseIndicesFromFilename(name) {
  const s = name.toLowerCase();
  let m;
  if ((m = s.match(/r\s*(\d+)\s*[_-]?\s*c\s*(\d+)/)))
    return { row: +m[1], col: +m[2] };
  if ((m = s.match(/row\s*(\d+)\s*[_-]?\s*col\s*(\d+)/)))
    return { row: +m[1], col: +m[2] };
  if ((m = s.match(/\((\d+)\s*,\s*(\d+)\)/))) return { row: +m[1], col: +m[2] };
  if ((m = s.match(/(\d+)\s*[xX_-]\s*(\d+)/)))
    return { row: +m[1], col: +m[2] };
  return null;
}

/** If filenames are 1-based (no zero appears), shift all to 0-based. */
function normalizeIndexBaseToZero(tiles) {
  const withIdx = tiles.filter((t) => t.row != null && t.col != null);
  if (!withIdx.length) return;
  const minRow = Math.min(...withIdx.map((t) => t.row));
  const minCol = Math.min(...withIdx.map((t) => t.col));
  if (minRow >= 1 && minCol >= 1) {
    for (const t of withIdx) {
      t.row -= 1;
      t.col -= 1;
    }
  }
}

/** Deduplicate by (row,col); drop negatives. */
function dedupeByCoord(tiles) {
  const seen = new Set();
  const out = [];
  for (const t of tiles) {
    if (t.row == null || t.col == null) continue;
    if (t.row < 0 || t.col < 0) continue;
    const key = `${t.row},${t.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Infer grid dimensions from tiles if every tile has indices. */
export function inferGridFromTiles(tiles) {
  const withIdx = tiles.filter((t) => t.row != null && t.col != null);
  if (withIdx.length === tiles.length && tiles.length > 0) {
    const rows = Math.max(...withIdx.map((t) => t.row)) + 1;
    const cols = Math.max(...withIdx.map((t) => t.col)) + 1;
    return { rows, cols, source: "filenames" };
  }
  return { rows: null, cols: null, source: "manual" };
}

/** Read a .zip File -> [{ id, name, dataUrl, row, col }, ...]
 *  Strict mode:
 *   - Only include images whose filenames encode row/col
 *   - Normalize 1-based -> 0-based
 *   - Deduplicate per (row,col)
 */
export async function parseZipToTiles(file) {
  if (!file) return [];

  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  // Candidate image entries (filtered + stable order)
  const entries = Object.values(zip.files)
    .filter(
      (f) => !f.dir && IMAGE_RE.test(f.name) && !IGNORE_NAME_RE.test(f.name)
    )
    .sort((a, b) => naturalCompare(a.name, b.name));

  let idCounter = 0;
  const candidates = [];

  for (const f of entries) {
    // Must have indices in filename
    const idx = parseIndicesFromFilename(f.name);
    if (!idx) continue;

    // Read as Data URL (Safari-friendly with many images)
    const arr = await f.async("uint8array");
    const lower = f.name.toLowerCase();
    let type = "image/png";
    if (/\.(jpe?g)$/.test(lower)) type = "image/jpeg";
    else if (/\.webp$/.test(lower)) type = "image/webp";
    else if (/\.gif$/.test(lower)) type = "image/gif";
    const blob = new Blob([arr], { type });

    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });

    candidates.push({
      id: `t${idCounter++}`,
      name: f.name.split("/").pop(),
      dataUrl,
      row: idx.row,
      col: idx.col,
    });
  }

  // Normalize & dedupe
  normalizeIndexBaseToZero(candidates);
  const tiles = dedupeByCoord(candidates);

  return tiles;
}
