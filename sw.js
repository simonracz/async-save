const map = new Map();

self.addEventListener('install', event => {
  console.log("sw installed");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log("sw activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  console.log('message at sw');
  console.log(event);
  const uniqueLink = self.registration.scope + "/local-download/" + Math.random();
  const port = event.ports[0];
  const stream = new ReadableStream({
    start (controller) {
      port.onmessage = ({ data }) => {
        console.log("got message ");

        if (data === 'end') {
          map.delete(uniqueLink);
          return controller.close();
        }

        if (data === 'abort') {
          controller.error('Aborted the download');
          map.delete(uniqueLink);
          return;
        }
        // console.log(data.data);
        const realData = new Uint8Array(data.data);
        // console.log(realData.length);
        controller.enqueue(realData);
        // console.log(controller.desiredSize);
        if (controller.desiredSize > 0) {
          port.postMessage({enqueued: true});
        }
      }
    },
    pull() {
      // console.log("at pull");
      port.postMessage({enqueued: true});
    },
    cancel () {
      console.log('user aborted');
    }
  });
  map.set(uniqueLink, [stream, event.data]);
  port.postMessage({downloadLink: uniqueLink});
});

self.addEventListener('fetch', event => {
  console.log('fetch ' + event);

  const url = event.request.url;
  console.log('Handling ', url);
  const stored = map.get(url);
  if (!stored) return;
  const [stream, data] = stored;

  const filename = encodeURIComponent(data.filename);

  const headers = {
    'Content-Type': 'application/octet-stream; charset=utf-8',
    'Content-Disposition': "attachment; filename=" + filename,
    'Content-Length': data.size
  };

  event.respondWith(new Response(stream, { headers }));
});