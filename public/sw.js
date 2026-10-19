// Minimal service worker. It exists so browsers treat Whispa as an installable app.
// It deliberately caches nothing: every request goes to the network, so people always see the live feed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
