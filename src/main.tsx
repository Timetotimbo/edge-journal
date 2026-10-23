import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyTheme, savedTheme } from './lib/theme';

applyTheme(savedTheme());

createRoot(document.getElementById('root')!).render(<App />);
