
import helmet from 'helmet';
import hpp from 'hpp';
import express, { Express, Request, Response, NextFunction } from 'express';

// --- HTTP Parameter Pollution ---
// Prevents array injection attacks (e.g., ?id=1&id=2)
export const hppMiddleware = hpp();

// --- Secure Headers (Helmet) ---
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "ws:"], // Allow WebSocket for Live
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disabled for image loading flexibility
  xFrameOptions: { action: 'deny' }, // MitM / Clickjacking
  strictTransportSecurity: {
    maxAge: 31536000, // 1 Year
    includeSubDomains: true,
    preload: true,
  },
  xXssProtection: true,
});

// --- JSON Body Parser with strict limits ---
// Prevents large payload DoS attacks
export const jsonBodyParser = express.json({ limit: '10kb' }); // Strict limit
