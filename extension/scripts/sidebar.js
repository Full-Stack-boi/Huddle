/* === Huddle — Sidebar === */

/* ---------- UI Sidebar Visibility Helpers ---------- */
function openSidebar() {
  const s = document.getElementById("huddle-sidebar");
  const b = document.getElementById("huddle-open-btn");
  if (s && b) {
    s.classList.add("huddle-visible");
    b.classList.add("sidebar-open");
  }
}

function closeSidebar() {
  const s = document.getElementById("huddle-sidebar");
  const b = document.getElementById("huddle-open-btn");
  if (s && b) {
    s.classList.remove("huddle-visible");
    b.classList.remove("sidebar-open");
  }
}

/* ---------- UI: Build Sidebar ---------- */
function buildSidebar() {
  if (document.getElementById("huddle-sidebar")) return;

  // Sidebar container (built first so openBtn closure can reference it)
  const sidebar = document.createElement("div");
  sidebar.className = "huddle-sidebar"; // Starts closed by default via CSS (translateX 100%)
  sidebar.id = "huddle-sidebar";

  // Header
  const header = document.createElement("div");
  header.className = "huddle-header";
  header.innerHTML = `
    <div class="huddle-logo">
      <span class="huddle-logo-icon" id="huddle-logo-icon">🎬</span>
      <span class="huddle-logo-text">Huddle</span>
    </div>
  `;

  const closeBtn = document.createElement("div");
  closeBtn.className = "huddle-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", closeSidebar);
  header.appendChild(closeBtn);
  sidebar.appendChild(header);

  // Pages Container
  const mainPage = document.createElement("div");
  mainPage.className = "huddle-page active";
  mainPage.id = "huddle-page-main";
  sidebar.appendChild(mainPage);

  const twitchPage = document.createElement("div");
  twitchPage.className = "huddle-page";
  twitchPage.id = "huddle-page-twitch";
  sidebar.appendChild(twitchPage);

  const roomPage = document.createElement("div");
  roomPage.className = "huddle-page";
  roomPage.id = "huddle-page-room";
  sidebar.appendChild(roomPage);

  // Open/toggle button
  const openBtn = document.createElement("div");
  openBtn.className = "huddle-open-btn";
  openBtn.id = "huddle-open-btn";
  openBtn.innerHTML = `<span class="huddle-btn-icon-wrapper" style="display:inline-block; writing-mode:horizontal-tb; line-height:1;">🎬</span>`;

  // Apply saved visibility preference
  if (localStorage.getItem("huddle_show_floating_btn") === "false") {
    openBtn.style.display = "none";
  }

  openBtn.addEventListener("click", () => {
    sidebar.classList.toggle("huddle-visible");
    openBtn.classList.toggle("sidebar-open");
  });

  // Handle fullscreen changes to hide/show the floating button and sidebar
  const handleFullscreenChange = () => {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (isFullscreen) {
      openBtn.classList.add("huddle-fullscreen-hide");
      sidebar.classList.add("huddle-fullscreen-hide");
    } else {
      openBtn.classList.remove("huddle-fullscreen-hide");
      sidebar.classList.remove("huddle-fullscreen-hide");
    }
  };

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);

  // Extension Icon Click Listener (from background.js)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "HUDDLE_TOGGLE_SIDEBAR") {
      const s = document.getElementById("huddle-sidebar");
      const b = document.getElementById("huddle-open-btn");
      if (s && b) {
        s.classList.toggle("huddle-visible");
        b.classList.toggle("sidebar-open");
      }
    }
  });

  // Append both to DOM together to avoid reflow between inserts
  document.body.appendChild(sidebar);
  document.body.appendChild(openBtn);

  // Render initial view
  renderMainView();

  // Apply initial dynamic theme based on page context
  applyDynamicTheme(getVideoMetadata().source);
}

/* ---------- UI: Page Navigation ---------- */
function showPage(page) {
  currentPage = page;
  document
    .querySelectorAll(".huddle-page")
    .forEach((p) => p.classList.remove("active"));
  const target = document.getElementById(`huddle-page-${page}`);
  if (target) target.classList.add("active");
}
