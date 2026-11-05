let aTab = 0;
let tabCounter = 1;
let bTabs = [];
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const savedRelay = localStorage.getItem("cherri_wispUrl");
let wispUrl = "wss://wisp.rhw.one/";
try {
  const relay = new URL(savedRelay || wispUrl);
  if (relay.protocol === "wss:" && !relay.username && !relay.password) wispUrl = relay.href;
} catch (_) { /* Fall back to the existing encrypted public relay. */ }
const bareUrl = "https://useclassplay.vercel.app/fq/";

let searchE;
const se = localStorage.getItem("cherri_searchEngine") || "DuckDuckGo";

if (se === "DuckDuckGo") {
  searchE = "https://duckduckgo.com/search?q=";
} else if (se === "Bing") {
  searchE = "https://bing.com/search?q=";
} else if (se === "Google") {
  searchE = "https://google.com/search?q=";
} else if (se === "Startpage") {
  searchE = "https://startpage.com/search?q=";
} else if (se === "Qwant") {
  searchE = "https://qwant.com/search?q=";
} else {
  searchE = "https://search.brave.com/search?q=";
}

const transportReady = connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);

const CONFIG = {
  files: {
    wasm: "/homework/history.wasm.wasm",
    all: "/homework/math.all.js",
    sync: "/homework/science.sync.js",
  },
};

const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
  files: CONFIG.files,
});
const engineReady = scramjet.init();
// Startup errors are reported by the browser UI; avoid unhandled rejections on legacy pages.
transportReady.catch(() => {});
engineReady.catch(() => {});

function newTab() {
  const tabCont = document.querySelector(".tabs");
  const nTab = {
    id: tabCounter++,
    title: "New Tab",
    url: "",
    history: [],
    historyIndex: -1,
  };

  bTabs.push(nTab);
  if (!tabCont) return;

  const ntBtn = document.querySelector(".newtab");

  const tabElement = document.createElement("div");
  tabElement.classList.add("tab", "hcontainer");
  tabElement.dataset.tabId = nTab.id;
  tabElement.innerHTML = `
        <img src="/assets/img/fav.png" id="fav" data-fav-id="${nTab.id}" width="24" alt="">
            <span>
                New Tab
            </span>
        <button type="button" class="close-btn" aria-label="Close tab">×</button>
        `;

  tabElement.setAttribute("role", "button");
  tabElement.tabIndex = 0;
  tabElement.addEventListener("keydown", (e) => {
    if (e.target === tabElement && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      switchTab(nTab.id);
    }
  });

  tabElement.addEventListener("click", (e) => {
    if (!e.target.closest(".close-btn")) {
      switchTab(nTab.id);
    }
  });

  const closebtn = tabElement.querySelector(".close-btn");
  closebtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(nTab.id);
  });

  tabCont.insertBefore(tabElement, ntBtn);

  const tabFrame = document.createElement("iframe");
  tabFrame.classList.add("viewframe", "browser-frame");
  tabFrame.dataset.frameId = nTab.id;
  tabFrame.setAttribute("allowfullscreen", "true");
  tabFrame.title = "Browser tab";
  tabFrame.src = "/newtab.html";

  document.body.appendChild(tabFrame);

  switchTab(nTab.id);
}

function switchTab(tId) {
  aTab = tId;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", parseInt(tab.dataset.tabId) === tId);
  });

  document.querySelectorAll(".viewframe").forEach((frame) => {
    frame.classList.toggle("active", parseInt(frame.dataset.frameId) === tId);
  });

  const cTab = bTabs.find((t) => t.id === tId);
  if (cTab) {
    const input = document.getElementById("searchbar");
    if (input) input.value = cTab.url;
  }
}

function closeTab(tId) {
  if (bTabs.length === 1) {
    showToast("error", "Cannot close last tab!", "fas fa-circle-xmark");
    return;
  }

  const tIndex = bTabs.findIndex((t) => t.id === tId);
  if (tIndex === -1) return;

  bTabs.splice(tIndex, 1);

  const tEl = document.querySelector(`.tab[data-tab-id="${tId}"]`);
  const frame = document.querySelector(`.viewframe[data-frame-id="${tId}"]`);

  if (tEl) tEl.remove();
  if (frame) frame.remove();

  if (aTab === tId) {
    const newATab = bTabs[Math.max(0, tIndex - 1)];
    if (newATab) {
      switchTab(newATab.id);
    }
  }
}

async function nav(i) {
  if (!i.trim()) return;

  let url = i.trim();

  if (!url.includes(".") || url.includes(" ")) {
    url = searchE + encodeURIComponent(url);
  } else {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
  }

  try {
    const destination = new URL(url);
    if (!["https:", "http:"].includes(destination.protocol) || destination.username || destination.password) {
      throw new Error("unsupported destination");
    }
    url = destination.href;
  } catch (_) {
    showToast("error", "Enter an HTTP or HTTPS website, or a search query.");
    return;
  }

  const cTab = bTabs.find((t) => t.id === aTab);
  if (!cTab) return;

  cTab.history.splice(cTab.historyIndex + 1);
  cTab.history.push(url);
  cTab.historyIndex++;

  cTab.url = url;

  let fUrl;
  if (
    localStorage.getItem("cherri_backend") === "Scramjet" ||
    localStorage.getItem("cherri_backend") === "scramjet" ||
    !localStorage.getItem("cherri_backend")
  ) {
    fUrl = scramjet.encodeUrl(url);
  } else if (localStorage.getItem("cherri_backend") === "Ultraviolet") {
    fUrl = "/uv/service/" + __uv$config.encodeUrl(url);
  } else {
    fUrl = scramjet.encodeUrl(url);
  }

  go(fUrl);
}

function updateUrlFromIframe(viewframe) {
  try {
    const frameId = Number(viewframe.dataset.frameId);
    const cTab = bTabs.find((t) => t.id === frameId);
    if (!cTab) return;

    let decodedUrl;
    const currentSrc = viewframe.src;

    if (localStorage.getItem("cherri_backend") === "Ultraviolet") {
      if (currentSrc.includes("/uv/service/")) {
        decodedUrl = __uv$config.decodeUrl(currentSrc.split("/uv/service/")[1]);
      }
    } else {
      decodedUrl = scramjet.decodeUrl(currentSrc);
    }

    if (decodedUrl && decodedUrl !== cTab.url) {
      cTab.url = decodedUrl;

      const ubar = document.getElementById("searchbar");
      if (ubar && aTab === cTab.id) ubar.value = decodedUrl;

      const favEl = document.querySelector(`#fav[data-fav-id="${cTab.id}"]`);
      if (favEl)
        favEl.src = "/assets/img/fav.png";
    }
  } catch (e) {
    console.error("Error updating URL from iframe:", e);
  }
}

async function go(u) {
  try {
    await (window.proxyReady || Promise.all([transportReady, engineReady]));
    if (!(await connection.getTransport())) {
      await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }
  } catch (_) {
    showToast("error", "Browser setup failed. Try reconnecting or reloading this page.");
    return;
  }


  const cTab = bTabs.find((t) => t.id === aTab);
  const favEl = document.querySelector(`#fav[data-fav-id="${aTab}"]`);
  const viewframe = document.querySelector(
    `.viewframe[data-frame-id="${aTab}"]`
  );
  if (!viewframe) return;

  const ubar = document.getElementById("searchbar");

  const tabEl = document.querySelector(`.tab[data-tab-id="${aTab}"]`);
  if (tabEl) {
    const titleEl = tabEl.querySelector("span");
    if (titleEl) titleEl.textContent = "Loading...";
  }

  if (ubar) ubar.value = cTab.url;
  if (favEl)
    favEl.src = "/assets/img/fav.png";

  try {
    viewframe.onload = () => {
      try {
        const iframeDoc =
          viewframe.contentDocument || viewframe.contentWindow.document;
        const title = iframeDoc.title || new URL(cTab.url).hostname;

        const tabEl = document.querySelector(`.tab[data-tab-id="${cTab.id}"]`);
        if (tabEl) {
          const titleEl = tabEl.querySelector("span");
          if (titleEl) titleEl.textContent = title;
        }

        updateUrlFromIframe(viewframe);
      } catch (e) {
        console.error("Error accessing iframe content:", e);
        const tabEl = document.querySelector(`.tab[data-tab-id="${cTab.id}"]`);
        if (tabEl) {
          const titleEl = tabEl.querySelector("span");
          if (titleEl) titleEl.textContent = new URL(cTab.url).hostname;
        }

        updateUrlFromIframe(viewframe);
      }
    };
    viewframe.src = u;
  } catch (e) {
    console.error("There was an error while loading the page:", e);
    showToast(
      "error",
      "There was a problem loading the page. Check the console for more info.",
      "fas fa-times-circle"
    );
  }
}

function b() {
  const cTab = bTabs.find((t) => t.id === aTab);
  if (!cTab || cTab.historyIndex <= 0) return;

  cTab.historyIndex--;
  const u = cTab.history[cTab.historyIndex];
  cTab.url = u;
  let furl;
  const ba = localStorage.getItem("cherri_backend") || "Scramjet";
  if (ba.toLowerCase() === "scramjet") {
    furl = scramjet.encodeUrl(u);
  } else if (ba.toLowerCase() === "ultraviolet") {
    furl = __uv$config.prefix + __uv$config.encodeUrl(u);
  } else {
    furl = scramjet.encodeUrl(u);
  }

  go(furl);
}

function f() {
  const cTab = bTabs.find((t) => t.id === aTab);
  if (!cTab || cTab.historyIndex >= cTab.history.length - 1) return;

  cTab.historyIndex++;
  const u = cTab.history[cTab.historyIndex];
  cTab.url = u;
  let furl;
  const ba = localStorage.getItem("cherri_backend") || "Scramjet";
  if (ba.toLowerCase() === "scramjet") {
    furl = scramjet.encodeUrl(u);
  } else if (ba.toLowerCase() === "ultraviolet") {
    furl = __uv$config.prefix + __uv$config.encodeUrl(u);
  } else {
    furl = scramjet.encodeUrl(u);
  }

  go(furl);
}

function r() {
  const viewframe = document.querySelector(
    `.viewframe[data-frame-id="${aTab}"]`
  );
  const curl = viewframe.src;

  viewframe.src = curl;
}

function full() {
  const viewframe = document.querySelector(
    `.viewframe[data-frame-id="${aTab}"]`
  );
  viewframe.requestFullscreen();
  console.log("sdfkjhasdkjhfg");
}

function hideBrowser() {
  const b = document.querySelector(".browser-container");
  const frames = document.querySelectorAll(".viewframe");
  b.style.opacity = 0;
  frames.forEach((frame) => {
    frame.style.opacity = 0;
    frame.style.pointerEvents = "none";
  });
  b.style.pointerEvents = "none";
}

async function launchEruda() {
  showToast("info", "Launching Eruda...", "fas fa-info-circle");
  try {
    eruda.init();
    showToast(
      "success",
      "Successfully injected Eruda",
      "fa-solid fa-check-circle"
    );
  } catch (e) {
    showToast("error", "Failed to inject Eruda", "fas fa-times-circle");
  }
}

async function fixProxy() {
  await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);

  showToast("success", "Connection reset to Libcurl!", "fas fa-check-circle")
  console.log(
    "%c[SUCCESS]" + "%c Connection reset to Libcurl.",
    "color: lime; font-weight: bold;",
    "color: white; font-weight: normal;"
  );

  await navigator.serviceWorker.register("/sw.js")

  showToast("success", "Service workers reregistered. (1/2)", "fas fa-check-circle");
  console.log(
    "%c[SUCCESS]" + "%c Service workers reregistered. (1/2)",
    "color: lime; font-weight: bold;",
    "color: white; font-weight: normal;"
  );

  await navigator.serviceWorker.register("/uv/sw.js")

  showToast("success", "Service workers reregistered. (2/2)", "fas fa-check-circle");
  console.log(
    "%c[SUCCESS]" + "%c Service workers reregistered. (2/2)",
    "color: lime; font-weight: bold;",
    "color: white; font-weight: normal;"
  );
}