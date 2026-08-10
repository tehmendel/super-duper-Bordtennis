/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

// index.html is deliberately excluded from the precache: it's the one file
// whose content (which hashed JS/CSS bundle it references) changes on every
// deploy without the file's own URL changing, so caching it risks serving a
// shell that points at asset files a newer deploy has already deleted from
// the server — exactly what caused "must refresh to load" reports after a
// burst of same-day deploys. Handled by the network-first navigation
// listener below instead.
precacheAndRoute(
  self.__WB_MANIFEST.filter((entry) => {
    const url = typeof entry === 'string' ? entry : entry.url
    return !url.endsWith('.html')
  }),
)

// Navigation requests (loading the page itself) always go to the network
// first, so the HTML shell — and therefore the asset hashes it references —
// is never staler than the last successful fetch.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request))
  }
})

interface PushPayload {
  title?: string
  body?: string
  url?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }

  const iconUrl = new URL('pwa-192.png', self.registration.scope).href

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Bordtennisportalen', {
      body: data.body ?? '',
      icon: iconUrl,
      badge: iconUrl,
      data: { url: data.url ?? '.' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url ?? '.', self.registration.scope).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})

self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())
