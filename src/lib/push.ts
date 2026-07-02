import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getExistingSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePushNotifications(playerId: string) {
  const reg = await navigator.serviceWorker.ready
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Du må tillate varsler i nettleseren for å skru dette på.')
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  })

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      player_id: playerId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function disablePushNotifications() {
  const sub = await getExistingSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
