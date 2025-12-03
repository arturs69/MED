const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const fsp = fs.promises;
const { createAppServer } = require('./server');

let context;

test.beforeEach(async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'med-appointments-'));
  const dataFile = path.join(tempDir, 'appointments.json');
  const frontendDir = path.join(__dirname, '..', 'frontend');

  const app = createAppServer({ dataFile, frontendDir });
  await app.listen(0);
  const port = app.server.address().port;

  context = {
    app,
    baseUrl: `http://localhost:${port}`,
    dataFile,
    tempDir,
  };
});

test.afterEach(async () => {
  if (context?.app) {
    await context.app.close();
  }
  if (context?.tempDir) {
    await fsp.rm(context.tempDir, { recursive: true, force: true });
  }
  context = null;
});

test('GET /api/appointments returns an empty collection initially', async () => {
  const res = await fetch(`${context.baseUrl}/api/appointments`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body.appointments, []);
});

test('POST /api/appointments stores and returns the new ordination', async () => {
  const payload = {
    patientName: 'John Doe',
    doctorName: 'Dr. Smith',
    dateTime: '2024-01-01T10:00',
    reason: 'Routine checkup',
  };

  const createRes = await fetch(`${context.baseUrl}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.strictEqual(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(created.id, 'response should include an id');
  assert.strictEqual(created.patientName, payload.patientName);

  const fileContents = await fsp.readFile(context.dataFile, 'utf-8');
  const saved = JSON.parse(fileContents);
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].patientName, payload.patientName);

  const listRes = await fetch(`${context.baseUrl}/api/appointments`);
  const listBody = await listRes.json();
  assert.strictEqual(listBody.appointments.length, 1);
});

test('POST /api/appointments rejects missing fields', async () => {
  const res = await fetch(`${context.baseUrl}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientName: '' }),
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /required/i);

  const fileContents = await fsp.readFile(context.dataFile, 'utf-8');
  const saved = JSON.parse(fileContents);
  assert.deepStrictEqual(saved, []);
});
