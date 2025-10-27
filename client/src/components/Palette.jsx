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
    const t = getTile(id);
    if (t?.dataUrl) {
      const img = new Image();
      img.src = t.dataUrl;
      e.dataTransfer.setDragImage(img, 24, 24);
    }
  };

  return (
    <div
      className="palette"
      style={{
        display: "grid",
        gap: 6,
        gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
      }}
    >
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
            style={{
              aspectRatio: "1 / 1",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
              cursor: "grab",
              background: "#fff",
            }}
          >
            {t?.dataUrl && (
              <img
                src={t.dataUrl}
                alt={t.name}
                onError={(e) => (e.currentTarget.style.display = "none")} // ← hide broken
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "cover",
                }}
                draggable={false}
              />
            )}
          </div>
        );
      })}
      {palette.length === 0 && <div className="hint">All tiles placed.</div>}
    </div>
  );
}
