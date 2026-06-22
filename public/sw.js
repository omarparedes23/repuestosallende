// No-op service worker — prevents 404 from stale browser registrations
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
