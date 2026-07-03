/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

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
