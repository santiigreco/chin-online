import { io } from 'socket.io-client';

// In production, set VITE_SERVER_URL to your backend URL
// e.g. https://chin-server.onrender.com
const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
