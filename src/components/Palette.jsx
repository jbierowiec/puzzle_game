import React from "react";

export default function Palette({
  palette,
  getTile,
  onSelectTile,
  selectedTileId,
}) {
  const onDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    // Optional nicer preview (works with data: URLs)
    const t = getTile(id);
    if (t?.dataUrl) {
      const img = new Image();
      img.src = t.dataUrl;
      e.dataTransfer.setDragImage(img, 24, 24);
    }
  };

  return (
    <div className="palette">
      {palette.map((id) => {
        const t = getTile(id);
        const isSelected = id === selectedTileId;
        return (
          <div
            key={id}
            className={`tile ${isSelected ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(e) => onDragStart(e, id)}
            onClick={() => onSelectTile(id)}
            title={t?.name}
          >
            {t && <img src={t.dataUrl} alt={t.name} />}
          </div>
        );
      })}
      {palette.length === 0 && <div className="hint">All tiles placed.</div>}
    </div>
  );
}
