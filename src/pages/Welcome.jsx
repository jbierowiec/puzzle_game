import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Welcome() {
  const nav = useNavigate();
  const [name, setName] = useState(
    () => localStorage.getItem("playerName") || ""
  );
  const [difficulty, setDifficulty] = useState("easy");

  const go = (e) => {
    e.preventDefault();
    const clean = (name || "Player").trim();
    localStorage.setItem("playerName", clean);
    nav(`/play/${difficulty}`);
  };

  return (
    <div className="welcome-wrap">
      <div className="welcome-card">
        <h1>Welcome to the Puzzle Game</h1>
        <p className="muted">Assemble image tiles into the correct grid.</p>
        <form onSubmit={go} className="welcome-form">
          <label>
            Your name
            <input
              type="text"
              value={name}
              placeholder="Type your name"
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label>
            Difficulty
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="extra">Extra Hard</option>
              <option value="custom">Custom (upload your own)</option>
            </select>
          </label>

          <button type="submit" className="btn primary">
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
