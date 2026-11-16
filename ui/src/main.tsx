import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App(): React.ReactElement {
  return (
    <main className="jig-bootstrap" aria-labelledby="jig-title">
      <h1 id="jig-title">Jig</h1>
      <p>Just-in-time daily planner</p>
    </main>
  );
}

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Jig root element is missing");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
