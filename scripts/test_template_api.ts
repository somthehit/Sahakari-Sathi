import 'dotenv/config';
import http from 'http';

const payload = JSON.stringify({ category: 'receipt', name: 'Test Template' });

// Use API_MODE=false to bypass auth and hit the real DB path
const req = http.request('http://localhost:3000/api/v1/document-templates', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'Content-Length': Buffer.byteLength(payload),
    'X-Test-Mode': 'true',
  },
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});
req.on('error', (e) => console.error('Request error:', e.message));
req.write(payload);
req.end();
