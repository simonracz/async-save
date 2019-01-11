const map = new Map();

self.addEventListener('install', function(event) {
  console.log("sw installed");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  console.log("sw activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  console.log('message at sw');
  console.log(event);
  const uniqueLink = self.registration.scope + Math.random();
  const port = event.ports[0];
  const stream = new ReadableStream({
    start (controller) {
      port.onmessage = ({ data }) => {
        console.log("got message ");

        if (data === 'end') {
          return controller.close();
        }

        if (data === 'abort') {
          controller.error('Aborted the download');
          return;
        }
        console.log(data.data);
        const realData = new Uint8Array(data.data);
        console.log(realData.length);
        controller.enqueue(realData);
        port.postMessage({enqueued: true});
      }
    },
    cancel () {
      console.log('user aborted');
    }
  });
  map.set(uniqueLink, [stream, event.data]);
  port.postMessage({downloadLink: uniqueLink});
});

self.addEventListener('fetch', function(event) {
  console.log('fetch ' + event);

  const url = event.request.url;
  console.log('Handling ', url);
  const stored = map.get(url);
  if (!stored) return null;
  const [stream, data] = stored;

  const filename = encodeURIComponent(data.filename);

  const headers = {
    'Content-Type': 'application/octet-stream; charset=utf-8',
    'Content-Disposition': "attachment; filename=" + filename,
    'Content-Length': data.size
  };

  event.respondWith(new Response(stream, { headers }));

});