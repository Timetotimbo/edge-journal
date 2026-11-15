import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyTheme, savedTheme } from './lib/theme';

applyTheme(savedTheme());

createRoot(document.getElementById('root')!).render(<App />);

// Lets the phone list Edge Journal under Share for pictures (see public/sw.js)
if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
