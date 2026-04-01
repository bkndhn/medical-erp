import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Restore saved accent color
const savedAccent = localStorage.getItem('app-accent');
if (savedAccent) {
  document.documentElement.style.setProperty('--primary', savedAccent);
  document.documentElement.style.setProperty('--ring', savedAccent);
  document.documentElement.style.setProperty('--sidebar-primary', savedAccent);
}

// Restore saved theme
const savedTheme = localStorage.getItem('app-theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

createRoot(document.getElementById("root")!).render(<App />);
