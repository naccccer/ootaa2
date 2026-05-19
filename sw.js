const CACHE_VERSION = "ootaa-shell-v1";
const ORIGIN = self.location.origin;
const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, "").replace(/\/$/, "");

function withBase(path) {
    if (path === "" || path === "/") {
        return BASE_PATH === "" ? "/" : `${BASE_PATH}/`;
    }

    return `${BASE_PATH}${path}`;
}

const SHELL_URLS = [
    withBase("/"),
    withBase("/index.php"),
    withBase("/manifest.webmanifest"),
    withBase("/assets/style.css"),
    withBase("/assets/app.js"),
    withBase("/public/fonts/Vazir-Regular-FD.woff2"),
    withBase("/public/Logo/app-icon.svg")
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key.startsWith("ootaa-shell-") && key !== CACHE_VERSION)
                .map((key) => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== ORIGIN) {
        return;
    }

    const pathname = url.pathname;
    const isApi = pathname.startsWith(`${BASE_PATH}/api`) || pathname.endsWith("/api.php");
    const isDownload = pathname.endsWith("/download.php") || pathname.startsWith(`${BASE_PATH}/file/`);
    const isNavigation = request.mode === "navigate";
    const isStatic = /\.(?:css|js|woff2|svg|png)$/i.test(pathname);

    if (isApi || isDownload) {
        event.respondWith(fetch(request));
        return;
    }

    if (isNavigation) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(withBase("/"), copy));
                    return response;
                })
                .catch(() => caches.match(withBase("/")))
        );
        return;
    }

    if (isStatic) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const networkFetch = fetch(request).then((response) => {
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
                    return response;
                });

                return cached || networkFetch;
            })
        );
        return;
    }

    event.respondWith(
        fetch(request).catch(() => caches.match(request))
    );
});
