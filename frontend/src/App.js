import { useEffect, useRef } from "react";
import "@/App.css";

function App() {
  const frameRef = useRef(null);

  useEffect(() => {
    document.title = "DOOMFALL — Retro FPS";
  }, []);

  return (
    <div
      data-testid="app-shell"
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        padding: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      <iframe
        ref={frameRef}
        data-testid="game-iframe"
        title="DOOMFALL"
        src="/retrodeck/index.html"
        style={{
          width: "100vw",
          height: "100vh",
          border: "0",
          display: "block",
        }}
        allow="autoplay; fullscreen; pointer-lock"
      />
    </div>
  );
}

export default App;
