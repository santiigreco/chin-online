import { io } from 'socket.io-client';

// In production, set VITE_SERVER_URL in your hosting provider's dashboard
// (Vercel, Netlify, etc.) to your backend URL.
// e.g. VITE_SERVER_URL=https://chin-server.onrender.com
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
