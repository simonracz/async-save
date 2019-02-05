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
  if (event.data === 'ping') {
    return;
  }
  // console.log('message at sw');
  const uniqueLink = self.registration.scope + "/local-download/" + Math.random();
  const port = event.ports[0];
  const stream = new ReadableStream({
    start (controller) {
      port.onmessage = ({ data }) => {
        //console.log("got message ");

        if (data === 'end') {
          console.log('End of the download');
          map.delete(uniqueLink);
          port.close();
          return controller.close();
        }

        if (data === 'abort') {
          console.log('Aborted the download');
          controller.error('Aborted the download');
          map.delete(uniqueLink);
          port.close();
          return;
        }
        const realData = new Uint8Array(data.data);
        controller.enqueue(realData);
      };
      port.onmessageerror = () => {
        console.log("received onmessageerror in sw");
      };
    },
    pull(controller) {
      // On Firefox this is called multiple times.
      // Fetch doesn't seem to support backpressure
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