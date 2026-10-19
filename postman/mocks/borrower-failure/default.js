// Test-only dependency: exercise the frontend's real HTTP error handling.
const http = require('http');
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(503);
  res.end(JSON.stringify({ success: false, data: null, error: {
    code: 'SERVICE_UNAVAILABLE', message: 'Account data is temporarily unavailable. Please retry.', details: {}
  }}));
}).listen(process.env.PORT);
