/* === Huddle — Theme === */

/* ---------- UI Theme Management Helpers ---------- */
function applyDynamicTheme(sourcePlatform) {
  const sidebar = document.getElementById("huddle-sidebar");
  if (!sidebar) return;

  // Elegant pastel palettes matching each platform
  const themes = {
    YouTube: {
      primary: "#f43f5e", // Soft Coral Red
      "primary-light": "#fb7185", // Light Coral
      secondary: "#06b6d4", // Soft Cyan
      "bg-cream": "#fff5f5", // Ultra soft red tint
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="display:inline-block; vertical-align:middle;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.003 3.003 0 0 0-2.11 2.107C0 8.053 0 12 0 12s0 3.947.502 5.837a3.003 3.003 0 0 0 2.11 2.107c1.883.511 9.388.511 9.388.511s7.505 0 9.388-.511a3.003 3.003 0 0 0 2.11-2.107C24 15.947 24 12 24 12s0-3.947-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    },
    "Twitch Clip": {
      primary: "#8b5cf6", // Soft Twitch Purple
      "primary-light": "#a78bfa", // Light Purple
      secondary: "#06b6d4", // Soft Cyan
      "bg-cream": "#f8f6ff", // Ultra soft purple tint
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="display:inline-block; vertical-align:middle;"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>`,
    },
    Netflix: {
      primary: "#e11d48", // Soft Netflix Crimson
      "primary-light": "#fb7185", // Light Crimson
      secondary: "#10b981", // Soft Green
      "bg-cream": "#fff5f5", // Ultra soft red tint
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="display:inline-block; vertical-align:middle;"><path d="M4 0h3.8l5.8 13.9V0h3.8v24h-3.8l-5.8-13.9V24H4z"/></svg>`,
    },
    "Disney+ Hotstar": {
      primary: "#1d4ed8", // Deep Royal Blue
      "primary-light": "#60a5fa", // Light Royal Blue
      secondary: "#f43f5e", // Soft Pink/Red
      "bg-cream": "#f0f4ff", // Ultra soft blue tint
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="display:inline-block; vertical-align:middle;"><path d="M12 0l3.09 6.26L22 7.27l-5 4.87 1.18 6.87L12 15.77l-6.18 3.25L7 12.14 2 7.27l6.91-1.01L12 0z"/></svg>`,
    },
    "Prime Video": {
      primary: "#0284c7", // Sky Prime Blue
      "primary-light": "#38bdf8", // Light Prime Blue
      secondary: "#f59e0b", // Soft Amber/Yellow
      "bg-cream": "#f0f9ff", // Ultra soft cyan tint
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="display:inline-block; vertical-align:middle;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
    },
    Default: {
      primary: "#8b5cf6", // Pastel Violet
      "primary-light": "#a78bfa", // Light Violet
      secondary: "#06b6d4", // Soft Cyan
      "bg-cream": "#fff8f0", // Pastel Peach/Cream
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="display:inline-block; vertical-align:middle;"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`,
    },
  };

  const theme = themes[sourcePlatform] || themes["Default"];

  // Set the CSS variables dynamically on the sidebar container
  sidebar.style.setProperty("--hud-primary", theme["primary"]);
  sidebar.style.setProperty("--hud-primary-light", theme["primary-light"]);
  sidebar.style.setProperty("--hud-secondary", theme["secondary"]);
  sidebar.style.setProperty("--hud-bg-cream", theme["bg-cream"]);

  // Update floating button variables as well
  const openBtn = document.getElementById("huddle-open-btn");
  if (openBtn) {
    openBtn.style.setProperty("--hud-primary", theme["primary"]);
    openBtn.style.setProperty("--hud-primary-light", theme["primary-light"]);
  }

  // Update dynamic brand SVGs
  const logoIcon = document.getElementById("huddle-logo-icon");
  const openBtnIcon = document.querySelector(
    "#huddle-open-btn .huddle-btn-icon-wrapper",
  );
  if (logoIcon) {
    logoIcon.innerHTML = theme["icon"];
  }
  if (openBtnIcon) {
    openBtnIcon.innerHTML = theme["icon"];
  }
}
