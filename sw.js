const CACHE_NAME = 'app-shell-v2';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';

const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/icons/favicon.ico',
    '/icons/favicon-16x16.png',
    '/icons/favicon-32x32.png',
    '/icons/favicon-48x48.png',
    '/icons/favicon-64x64.png',
    '/icons/favicon-128x128.png',
    '/icons/favicon-256x256.png',
    '/icons/favicon-512x512.png',
    '/icons/icon-152x152.png'
];

// Установка: кэшируем статические ресурсы (App Shell)
self.addEventListener('install', event => {
    console.log('SW: install event started');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: caching assets in ' + CACHE_NAME);
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log('SW: all assets cached successfully');
                self.skipWaiting();
            })
            .catch(err => console.error('SW: error during install:', err))
    );
});

// Активация: удаляем старые кэши
self.addEventListener('activate', event => {
    console.log('SW: activate event started');
    event.waitUntil(
        caches.keys().then(keys => {
            console.log('SW: found caches:', keys);
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
                    .map(key => {
                        console.log('SW: deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => {
            console.log('SW: activate completed, claiming clients');
            self.clients.claim();
        })
    );
});

// Fetch: используем разные стратегии для статики и контента
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Пропускаем запросы к другим источникам (например, к CDN chota)
    if (url.origin !== location.origin) return;
    
    // Динамические страницы (content/*) – Network First
    if (url.pathname.startsWith('/content/')) {
        event.respondWith(
            fetch(event.request)
                .then(networkRes => {
                    // Кэшируем свежий ответ
                    const resClone = networkRes.clone();
                    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, resClone);
                    });
                    return networkRes;
                })
                .catch(() => {
                    // Если сеть недоступна, берём из кэша (или home как fallback)
                    return caches.match(event.request)
                        .then(cached => cached || caches.match('/content/home.html'));
                })
        );
    } else {
        // Статические ресурсы (App Shell) – Cache First
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});


// Обработчик push-уведомлений
self.addEventListener('push', (event) => {
    console.log('SW: push event received');
    
    let data = { title: 'Новое уведомление', body: '' };
    if (event.data) {
        data = event.data.json();
    }
    
    const options = {
        body: data.body,
        icon: '/icons/favicon-128x128.png',
        badge: '/icons/favicon-48x48.png',
        vibrate: [200, 100, 200],
        tag: 'note-notification',
        requireInteraction: false
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Обработчик клика по уведомлению
self.addEventListener('notificationclick', (event) => {
    console.log('SW: notification click');
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});
