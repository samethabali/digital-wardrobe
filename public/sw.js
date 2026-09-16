// Aura servis çalışanı: yalnızca web push bildirimleri (önbellekleme yapmaz).
self.addEventListener('push', (event) => {
  let data = { title: 'Aura', body: 'Bugünün kombini hazır.', url: '/', tag: 'aura' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (e) {
    // Metin yük
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
