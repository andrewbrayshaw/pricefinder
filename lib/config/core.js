// lib/config/cors.js
import { WHITELIST_ORIGINS } from './environment.js';

export const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl - for testing)
    // OR if origin is in the whitelist
    if (!origin || WHITELIST_ORIGINS.indexOf(origin) !== -1 || WHITELIST_ORIGINS.length === 0) { // Allow all if whitelist is empty
      callback(null, true);
    } else {
      console.warn(`CORS: Origin ${origin} not allowed.`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
};