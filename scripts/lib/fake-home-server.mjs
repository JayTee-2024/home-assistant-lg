// Puts the stand-in Home Assistant (fake-home.mjs) on a real network port, so a browser
// or the TV can talk to it over HTTP and WebSocket.
//
// This file is only the plumbing: reading request bodies, the header that lets a desktop
// browser read the answers, and passing WebSocket messages through. What the answers are
// is decided in fake-home.mjs.

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createFakeHome } from './fake-home.mjs';

/**
 * Starts the stand-in home. Port 0 means "any free port".
 * Resolves with { address, home, stop() }; `address` is like 'http://localhost:8124'.
 */
export function startFakeHomeServer(sampleHome, port) {
  const home = createFakeHome(sampleHome);

  const httpServer = createServer((request, response) => {
    // A real Home Assistant refuses web pages from other addresses. The stand-in allows
    // them, so the app can be developed in a desktop browser.
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    let text = '';
    request.on('data', (chunk) => (text += chunk));
    request.on('end', () => {
      const path = (request.url || '/').split('?')[0];
      const body = parseBody(request.headers['content-type'], text);
      const answer = home.handleHttp({ method: request.method, path, body });

      response.writeHead(answer.status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(answer.json));
    });
  });

  const socketServer = new WebSocketServer({ server: httpServer, path: '/api/websocket' });
  socketServer.on('connection', (webSocket) => {
    const session = home.openSocket((message) => webSocket.send(JSON.stringify(message)));
    webSocket.on('message', (data) => {
      // Home Assistant accepts one message or a list of them.
      const parsed = JSON.parse(String(data));
      for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
        session.receive(message);
      }
    });
    webSocket.on('close', () => session.close());
  });

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      resolve({
        address: 'http://localhost:' + httpServer.address().port,
        home,
        stop: () =>
          new Promise((stopped) => {
            for (const client of socketServer.clients) client.terminate();
            socketServer.close();
            httpServer.close(() => stopped());
          }),
      });
    });
  });
}

/**
 * Reads a request body into a plain object. Home Assistant's sign-in addresses are sent
 * JSON by this app, form fields by other clients, and a multi-part form by the connection
 * library (it uses the browser's FormData). Anything unreadable gives an empty object.
 */
export function parseBody(contentType, text) {
  const type = contentType || '';

  if (type.indexOf('application/json') === 0) {
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  if (type.indexOf('application/x-www-form-urlencoded') === 0) {
    const fields = {};
    for (const [name, value] of new URLSearchParams(text)) fields[name] = value;
    return fields;
  }

  if (type.indexOf('multipart/form-data') === 0) {
    const fields = {};
    const fieldPattern = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g;
    let match;
    while ((match = fieldPattern.exec(text)) !== null) {
      fields[match[1]] = match[2];
    }
    return fields;
  }

  return {};
}
