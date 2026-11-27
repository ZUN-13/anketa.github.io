const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const CHANNEL_NAME = 'survey_updates_v6';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const d = JSON.parse(raw);
      return {
        users: d.users || [],
        surveys: d.surveys || [],
        bots: d.bots || [],
        responses: d.responses || []
      };
    }
  } catch (e) {}
  return { users: [], surveys: [], bots: [], responses: [] };
}

function saveDB(db) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

let db = loadDB();
const clients = new Set();

app.get('/api/state', (req, res) => {
  res.json(db);
});

app.post('/api/state', (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'invalid body' });
  }
  db = {
    users: incoming.users || [],
    surveys: incoming.surveys || [],
    bots: incoming.bots || [],
    responses: incoming.responses || []
  };
  saveDB(db);
  const payload = `data: ${JSON.stringify({ type: 'update', at: Date.now() })}\n\n`;
  clients.forEach(c => { try { c.write(payload); } catch (e) {} });
  res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'hello' })}\n\n`);
  clients.add(res);
  const ping = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch (e) {}
  }, 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

app.get('/api/ping', (req, res) => res.json({ ok: true, at: Date.now() }));

app.listen(PORT, () => {
  console.log(`[survey] Server running on http://localhost:${PORT}`);
});