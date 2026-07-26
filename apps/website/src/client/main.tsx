import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

const tree = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// Public routes ship prerendered markup, while private application routes use an
// empty shell. Adopt either shape without maintaining separate client entries.
if (root.firstChild) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}
