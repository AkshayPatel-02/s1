import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global Buffer is provided by vite-plugin-node-polyfills

createRoot(document.getElementById("root")!).render(<App />);
