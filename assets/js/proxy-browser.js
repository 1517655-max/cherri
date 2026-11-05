const statusLine = document.getElementById('connection-status');
const message = document.getElementById('browser-message');
let messageTimer;
window.showToast = (_type, text) => {
  message.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { message.textContent = ''; }, 12000);
};

async function activateWorker(script, scope) {
  const registration = await navigator.serviceWorker.register(script, { scope });
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('No service worker');
  if (worker.state === 'activated') return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Worker activation timed out')), 20000);
    const check = () => {
      if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
      if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('Worker installation failed')); }
    };
    worker.addEventListener('statechange', check);
    check();
  });
}

async function setupBrowser() {
  statusLine.textContent = 'Preparing browser…';
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    throw new Error('Open this site over HTTPS in a browser that supports service workers.');
  }
  if (!window.crossOriginIsolated) {
    throw new Error('Browser isolation is unavailable. Open this page directly in a current browser.');
  }
  let startupTimer;
  try {
    await Promise.race([
      Promise.all([
        transportReady, engineReady,
        activateWorker('/sw.js', '/'),
        activateWorker('/uv/sw.js', '/uv/'),
      ]),
      new Promise((_, reject) => {
        startupTimer = setTimeout(() => reject(new Error('Browser setup timed out. Reload this page to retry.')), 25000);
      }),
    ]);
  } finally { clearTimeout(startupTimer); }
  statusLine.textContent = `Browser ready · Relay: ${new URL(wispUrl).hostname}`;
}

function startSetup() {
  window.proxyReady = setupBrowser();
  window.proxyReady.catch((error) => {
    statusLine.textContent = 'Browser setup failed · Try reconnecting';
    showToast('error', error.message || 'Browser setup failed. Reload to try again.');
  });
  return window.proxyReady;
}

newTab();
startSetup().then(() => {
  const query = new URLSearchParams(location.search).get('q');
  if (query?.trim()) nav(query);
  // Remove the initial destination from the visible browser URL.
  history.replaceState(null, '', location.pathname);
}).catch(() => {});

document.getElementById('browser-form').addEventListener('submit', (event) => {
  event.preventDefault();
  nav(document.getElementById('searchbar').value);
});

document.getElementById('retry-connection').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await connection.setTransport('/libcurl/index.mjs', [{ websocket: wispUrl }]);
    await startSetup();
    const tab = bTabs.find((item) => item.id === aTab);
    if (tab?.url) r();
    showToast('info', 'Browser reset. If a site still fails, the relay or destination may be unavailable.');
  } catch (_) {
    showToast('error', 'Unable to reset the browser. Reload this page to try again.');
  } finally { button.disabled = false; }
});

window.addEventListener('offline', () => { statusLine.textContent = 'You are offline · Check your network'; });
window.addEventListener('online', () => { statusLine.textContent = 'Network restored · Reconnect to reset the browser'; });
