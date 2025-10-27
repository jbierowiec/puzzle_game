// client/src/utils/zip.js
export async function parseZipToTiles(fileOrUrl) {
  const { unzip } = await import("unzipit");

  const buf = await (async () => {
    if (fileOrUrl instanceof Blob) return await fileOrUrl.arrayBuffer();
    const r = await fetch(fileOrUrl);
    return await r.arrayBuffer();
  })();

  const { entries } = await unzip(buf);

  // Accept only images + filenames containing indices:
  //  "12_7.jpg", "12-7.png", "r12_c7.jpeg"
  const indexREs = [
    /(^|[\\/])(\d+)[_.-](\d+)\.(png|jpg|jpeg|webp)$/i,
    /(^|[\\/])r(\d+)[_.-]c(\d+)\.(png|jpg|jpeg|webp)$/i,
  ];

  const tiles = [];
  for (const [name, entry] of Object.entries(entries)) {
    if (entry.isDirectory) continue;
    if (!/\.(png|jpg|jpeg|webp)$/i.test(name)) continue;

    let m = null;
    for (const re of indexREs) {
      m = name.match(re);
      if (m) break;
    }
    if (!m) continue; // ← require indices

    const row = Number(m[2]);
    const col = Number(m[3]);

    const blob = await entry.blob();
    if (!blob || !blob.size) continue;

    tiles.push({
      id: name,
      name,
      row,
      col,
      dataUrl: URL.createObjectURL(blob),
    });
  }

  // Normalize to 0-based if filenames were 1-based
  const withIdx = tiles.filter(
    (t) => Number.isFinite(t.row) && Number.isFinite(t.col)
  );
  if (withIdx.length) {
    const minRow = Math.min(...withIdx.map((t) => t.row));
    const minCol = Math.min(...withIdx.map((t) => t.col));
    const hasZero = withIdx.some((t) => t.row === 0 || t.col === 0);
    const looksOneBased = !hasZero && (minRow === 1 || minCol === 1);
    if (looksOneBased)
      for (const t of tiles) {
        t.row -= 1;
        t.col -= 1;
      }
  }

  return tiles;
}

export function inferGridFromTiles(tiles) {
  const rMax = Math.max(...tiles.map((t) => t.row ?? -1));
  const cMax = Math.max(...tiles.map((t) => t.col ?? -1));
  return {
    rows: rMax >= 0 ? rMax + 1 : null,
    cols: cMax >= 0 ? cMax + 1 : null,
  };
}
