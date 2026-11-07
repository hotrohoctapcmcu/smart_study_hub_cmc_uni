'use strict';

const http = require('node:http');
const { duplexPair, Readable } = require('node:stream');
const { isAppUrl } = require('./app-origin');

// Keep Node's request/response semantics (uploads, ranges, streams and errors),
// but join the two ends with memory streams. No TCP socket or port is opened.
function createLocalTransport(handler) {
    const server = http.createServer(handler);
    const connections = new Set();
    let closed = false;

    function fetchLocal(input, options) {
        return new Promise((resolve, reject) => {
            const request = new Request(input, options);
            if (closed) throw new Error('Desktop backend is closed.');
            if (!isAppUrl(request.url)) throw new Error('Invalid desktop address.');
            request.signal.throwIfAborted();

            const url = new URL(request.url);
            const [client, peer] = duplexPair();
            // The HTTP parser expects these socket methods; these streams never
            // connect to a network and have no TCP settings to change.
            for (const stream of [client, peer]) {
                stream.setTimeout = stream.setNoDelay = stream.setKeepAlive = () => stream;
            }
            const cleanup = () => {
                connections.delete(cleanup);
                client.destroy();
                peer.destroy();
            };
            connections.add(cleanup);
            server.emit('connection', peer);

            const outgoing = http.request({
                hostname: url.hostname, path: url.pathname + url.search,
                method: request.method,
                headers: { ...Object.fromEntries(request.headers), connection: 'close' },
                createConnection: () => client,
                signal: request.signal
            }, incoming => {
                const headers = new Headers();
                for (const [name, value] of Object.entries(incoming.headers)) {
                    if (['connection', 'keep-alive', 'transfer-encoding'].includes(name)) continue;
                    for (const entry of Array.isArray(value) ? value : [value]) {
                        if (entry !== undefined) headers.append(name, entry);
                    }
                }
                incoming.once('close', cleanup);
                const noBody = request.method === 'HEAD' || [204, 205, 304].includes(incoming.statusCode);
                if (noBody) incoming.resume();
                resolve(new Response(noBody ? null : Readable.toWeb(incoming), {
                    status: incoming.statusCode, statusText: incoming.statusMessage, headers
                }));
            });
            outgoing.once('error', error => { cleanup(); reject(error); });
            if (request.body) {
                const body = Readable.fromWeb(request.body);
                body.once('error', error => outgoing.destroy(error));
                outgoing.once('error', () => body.destroy());
                body.pipe(outgoing);
            } else {
                outgoing.end();
            }
        });
    }

    return {
        fetch: fetchLocal,
        close() {
            closed = true;
            for (const cleanup of connections) cleanup();
        }
    };
}

module.exports = { createLocalTransport };
