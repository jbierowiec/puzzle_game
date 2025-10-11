// src/utils/zip.js
import { unzip } from "unzipit";

/**
 * Read a ZIP File/Blob, return tiles:
 *   [{ id, name, dataUrl, row?, col? }]
 * Supports images in subfolders and ignores __MACOSX, hidden files.
 */
export async function parseZipToTiles(fileOrBlob) {
  // Safari sometimes gives plain Blob; both are OK.
  const ab = await fileOrBlob.arrayBuffer();
  const { entries } = await unzip(ab);

  const imageExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
  const tiles = [];

  const toExt = (name) => {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i).toLowerCase() : "";
  };

  // Turn an entry into a data URL
  const entryToDataUrl = async (entry) => {
    const blob = await entry.blob();
    const reader = new FileReader();
    const p = new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
    reader.readAsDataURL(blob);
    return p;
  };

  for (const [fullName, entry] of Object.entries(entries)) {
    // Skip folders, macOS junk, hidden files
    if (entry.isDirectory) continue;
    if (fullName.startsWith("__MACOSX/")) continue;

    const ext = toExt(fullName);
    if (!imageExt.has(ext)) continue;

    const base = fullName.split("/").pop() || fullName; // strip folders
    const dataUrl = await entryToDataUrl(entry);

    // Optional: parse row/col indices if present in filename:
    // patterns like: tile_r3_c5.png OR r3c5.png OR _3x5_14.png
    let row = null,
      col = null;

    // r3_c5
    let m = base.match(/(?:^|[_-])r(\d+)[_\-]?c(\d+)(?:[^0-9]|$)/i);
    if (m) {
      row = parseInt(m[1], 10);
      col = parseInt(m[2], 10);
    } else {
      // 3-5 or 3x5 tokens near the name
      m = base.match(/(?:^|[_-])(\d+)[x\-](\d+)(?:[^0-9]|$)/i);
      if (m) {
        row = parseInt(m[1], 10);
        col = parseInt(m[2], 10);
      }
    }

    tiles.push({
      id: crypto.randomUUID(),
      name: base,
      dataUrl,
      row: Number.isFinite(row) ? row : null,
      col: Number.isFinite(col) ? col : null,
    });
  }

  // Natural-ish sort by name so Auto-solve and palette feel stable
  tiles.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  return tiles;
}

/**
 * Try to infer grid size:
 * 1) If many tiles carry row/col, use max(row)+1, max(col)+1
 * 2) If ZIP filename encodes AxB (e.g., ..._5x8.zip) and count matches, use that
 * 3) Fallback to near-square from count
 */
export function inferGridFromTiles(tiles, zipFileName = "") {
  let rows = null,
    cols = null,
    source = "fallback";

  // 1) From tile indices
  const withIdx = tiles.filter((t) => t.row != null && t.col != null);
  if (withIdx.length >= Math.max(tiles.length * 0.6, 10)) {
    rows = Math.max(...withIdx.map((t) => t.row)) + 1;
    cols = Math.max(...withIdx.map((t) => t.col)) + 1;
    source = "indices";
    return { rows, cols, source };
  }

  // 2) From ZIP name like *_5x8.zip
  const m = zipFileName.match(/(\d+)[xX](\d+)/);
  if (m) {
    const R = parseInt(m[1], 10);
    const C = parseInt(m[2], 10);
    if (R > 0 && C > 0 && R * C >= tiles.length * 0.9) {
      rows = R;
      cols = C;
      source = "filename";
      return { rows, cols, source };
    }
  }

  // 3) Near-square fallback
  const n = tiles.length || 0;
  if (n > 0) {
    const root = Math.floor(Math.sqrt(n));
    rows = root;
    cols = Math.ceil(n / root);
  } else {
    rows = cols = 0;
  }
  return { rows, cols, source };
}
