// Custom Service Worker additions for push notifications
// This file is imported by the main service worker via injectManifest or custom SW

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch {
        data = { title: 'BRead', body: event.data.text() };
    }

    const options = {
        body: data.body || 'Nouvelle notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/notifications',
            type: data.type || 'reminder'
        },
        actions: [
            { action: 'open', title: 'Ouvrir' },
            { action: 'dismiss', title: 'Fermer' }
        ],
        tag: data.tag || 'bread-notification',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'BRead', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/notifications';

    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window
            return clients.openWindow(url);
        })
    );
});
