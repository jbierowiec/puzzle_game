import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Welcome from "./pages/Welcome.jsx";
import GameView from "./pages/GameView.jsx";

function PlayRouter() {
  const { difficulty } = useParams(); // easy | medium | hard | extra | custom
  const valid = ["easy", "medium", "hard", "extra", "custom"];
  const diff = valid.includes((difficulty || "").toLowerCase()) ? difficulty.toLowerCase() : "easy";
  return <GameView difficulty={diff} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/play/:difficulty" element={<PlayRouter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
