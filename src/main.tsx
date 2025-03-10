
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add this for proper path resolution in Electron
if (window.location.pathname === '/index.html' && window.location.href.indexOf('file:') !== -1) {
  window.history.replaceState(null, document.title, '/');
}

// Make sure the root element exists before rendering
const rootElement = document.getElementById("root");
if (!rootElement) {
  const newRoot = document.createElement("div");
  newRoot.id = "root";
  document.body.appendChild(newRoot);
}

createRoot(document.getElementById("root")!).render(<App />);
