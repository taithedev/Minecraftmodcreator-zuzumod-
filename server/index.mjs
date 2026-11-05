import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  workspace, ensureWorkspace, projectDir, withinProject, listProjects, readMeta, readElements,
  createProject, addElement, projectFiles, readCodeFile, writeCodeFile, textureRelative,
  saveTexture, listArtifacts
} from './lib.mjs';

const execFileAsync = promisify(execFile);
const app = express();
const port = Number(process.env.PORT || 4317);
const localOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:' + port, 'http://localhost:' + port]);
app.use((req, res, next) => {
  if (req.headers.origin && !localOrigins.has(req.headers.origin)) return res.status(403).json({ error: 'Local-only API: origin rejected.' });
  next();
});
app.use(express.json({ limit: '4mb' }));
const api = express.Router();
const sessions = new Map();
let sessionKey = '';
const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const key = () => sessionKey || process.env.GROQ_API_KEY || '';
const handle = fn => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(e.status || 400).json({ error: String(e.message || e) }); } };
async function probe(executable, args) {
  try {
    const result = await execFileAsync(executable, args, { timeout: 7000, windowsHide: true });
    return ((result.stdout || '') + '\n' + (result.stderr || '')).trim().split('\n')[0];
  } catch (error) {
    if (error.stderr || error.stdout) return ((error.stderr || '') + '\n' + (error.stdout || '')).trim().split('\n')[0];
    return null;
  }
}
function emit(id, text) {
  const state = sessions.get(id);
  if (!state) return;
  state.lines.push(text);
  if (state.lines.length > 1000) state.lines.shift();
  for (const send of state.listeners) send(text);
}
async function launchTask(id, task) {
  if (!['build', 'runClient'].includes(task)) throw new Error('Invalid build task.');
  await readMeta(id);
  if (sessions.get(id)?.running) throw new Error('A task is already running in this project.');
  const state = { running: true, task, lines: [], listeners: new Set(), exitCode: null };
  sessions.set(id, state);
  const cwd = projectDir(id);
  const windows = process.platform === 'win32';
  const cmd = windows ? 'cmd.exe' : 'bash';
  const args = windows ? ['/d', '/s', '/c', 'gradlew.bat ' + task] : ['gradlew', task];
  const child = spawn(cmd, args, { cwd, shell: false, windowsHide: true, env: process.env });
  child.stdout.on('data', chunk => emit(id, String(chunk)));
  child.stderr.on('data', chunk => emit(id, String(chunk)));
  child.on('error', error => { emit(id, '[ERROR] ' + error.message + '\n'); state.running = false; state.exitCode = -1; });
  child.on('close', code => { state.running = false; state.exitCode = code; emit(id, '\n[ZuzuMod] ' + task + ' exited with code ' + code + '\n'); });
  emit(id, '[ZuzuMod] Executing ' + task + ' in ' + cwd + '\n');
  return { started: true, task };
}
api.get('/health', handle(async (_, res) => { await ensureWorkspace(); res.json({ ok: true, workspace, aiConfigured: !!key(), model }); }));
api.get('/projects', handle(async (_, res) => res.json(await listProjects())));
api.post('/projects', handle(async (req, res) => res.status(201).json(await createProject(req.body || {}))));
api.get('/projects/:id', handle(async (req, res) => res.json(await readMeta(req.params.id))));
api.get('/projects/:id/files', handle(async (req, res) => res.json(await projectFiles(req.params.id))));
api.get('/projects/:id/file', handle(async (req, res) => res.json({ content: await readCodeFile(req.params.id, req.query.path) })));
api.put('/projects/:id/file', handle(async (req, res) => { await writeCodeFile(req.params.id, req.body.path, req.body.content); res.json({ saved: true }); }));
api.get('/projects/:id/elements', handle(async (req, res) => res.json(await readElements(req.params.id))));
api.post('/projects/:id/elements', handle(async (req, res) => res.status(201).json(await addElement(req.params.id, req.body || {}))));
api.get('/projects/:id/texture/:type/:element', handle(async (req, res) => {
  const file = withinProject(req.params.id, textureRelative(req.params.id, req.params.type, req.params.element));
  await fsp.access(file);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}));
api.put('/projects/:id/texture/:type/:element', handle(async (req, res) => {
  await saveTexture(req.params.id, req.params.type, req.params.element, req.body.dataUrl);
  res.json({ saved: true });
}));
api.post('/projects/:id/tasks', handle(async (req, res) => res.json(await launchTask(req.params.id, req.body.task))));
api.get('/projects/:id/status', handle(async (req, res) => {
  await readMeta(req.params.id);
  const state = sessions.get(req.params.id);
  res.json({ running: state?.running || false, task: state?.task || null, exitCode: state?.exitCode ?? null, logs: state?.lines || [] });
}));
api.get('/projects/:id/logs', handle(async (req, res) => {
  await readMeta(req.params.id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const state = sessions.get(req.params.id) || { running: false, task: null, exitCode: null, lines: [], listeners: new Set() };
  sessions.set(req.params.id, state);
  const send = message => res.write('data: ' + JSON.stringify(message) + '\n\n');
  state.listeners.add(send);
  send('[ZuzuMod] Log stream connected.\n');
  req.on('close', () => state.listeners.delete(send));
}));
api.get('/projects/:id/artifacts', handle(async (req, res) => res.json(await listArtifacts(req.params.id))));
api.get('/projects/:id/download/:filename', handle(async (req, res) => {
  const name = req.params.filename;
  if (!/^[A-Za-z0-9_.-]+\.jar$/.test(name) || !(await listArtifacts(req.params.id)).includes(name)) throw new Error('Build artifact not found.');
  res.download(withinProject(req.params.id, 'build/libs/' + name));
}));
api.get('/runtime', handle(async (_, res) => res.json({
  platform: process.platform,
  java: await probe('java', ['-version']),
  winget: process.platform === 'win32' ? await probe('winget', ['--version']) : null,
  node: process.version
})));
api.post('/runtime/install-jdk', handle(async (_, res) => {
  if (process.platform !== 'win32') throw new Error('Automatic JDK installation currently supports Windows with winget.');
  if (!(await probe('winget', ['--version']))) throw new Error('Windows Package Manager (winget) is required.');
  if (sessions.get('runtime')?.running) throw new Error('Installation is already running.');
  const state = { running: true, task: 'install', lines: [], listeners: new Set(), exitCode: null };
  sessions.set('runtime', state);
  const child = spawn('winget', ['install', '--id', 'Microsoft.OpenJDK.21', '-e', '--accept-package-agreements', '--accept-source-agreements'], { windowsHide: false, shell: false });
  child.stdout.on('data', x => emit('runtime', String(x)));
  child.stderr.on('data', x => emit('runtime', String(x)));
  child.on('error', e => { emit('runtime', '[ERROR] ' + e.message); state.running = false; state.exitCode = -1; });
  child.on('close', code => { state.running = false; state.exitCode = code; emit('runtime', '[ZuzuMod] Installer exited: ' + code); });
  res.json({ started: true });
}));
api.get('/runtime/status', handle(async (_, res) => { const s = sessions.get('runtime'); res.json({ running: s?.running || false, logs: s?.lines || [], exitCode: s?.exitCode ?? null }); }));
api.post('/settings/groq', handle(async (req, res) => {
  const supplied = String(req.body.key || '').trim();
  if (supplied && (supplied.length < 20 || supplied.length > 300)) throw new Error('Invalid API key.');
  sessionKey = supplied;
  res.json({ configured: !!key(), stored: 'session-only' });
}));
api.post('/projects/:id/ai', handle(async (req, res) => {
  if (!key()) throw new Error('Connect a Groq API key in Settings first.');
  const meta = await readMeta(req.params.id);
  const elements = await readElements(req.params.id);
  const prompt = String(req.body.prompt || '').trim().slice(0, 4000);
  if (!prompt) throw new Error('Describe what you want to make.');
  const instructions = [
    'You are the code generation assistant for a Minecraft 1.21.1 NeoForge ModDevGradle Java 21 project.',
    'Return ONLY JSON with keys summary (string), elements (array), files (array).',
    'Each element must be {"type":"item"|"block","id":"lowercase_id","name":"Visible Name","color":"#rrggbb"}.',
    'Each file must be {"path":"src/main/java/... or src/main/resources/...","content":"full text"}.',
    'Prefer elements for straightforward blocks/items, because the studio will generate valid registration and assets.',
    'Do not emit files that modify Gradle, delete existing files, or replace GeneratedContent.java or the main mod class.',
    'You can create additional classes for more complicated behaviors. Do not invent nonexistent NeoForge APIs.',
    'No markdown, no code fences. Limit to 8 files. Be concise and favor compilable code.',
    'Project ID: ' + meta.id + ', Java package: dev.zuzumod.' + meta.id + '.',
    'Existing elements: ' + JSON.stringify(elements.slice(0, 30))
  ].join('\n');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: instructions }, { role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) throw new Error('Groq API returned ' + response.status + ': ' + (await response.text()).slice(0, 280));
  const answer = await response.json();
  let raw = answer.choices?.[0]?.message?.content || '';
  const fence = String.fromCharCode(96).repeat(3);
  raw = raw.replace(new RegExp('^' + fence + '(?:json)?\\s*', 'i'), '').replace(new RegExp('\\s*' + fence + '$'), '').trim();
  let proposal;
  try { proposal = JSON.parse(raw); } catch { throw new Error('AI did not return valid JSON. Try a more specific request.'); }
  res.json({ summary: String(proposal.summary || 'Generated proposal'), elements: Array.isArray(proposal.elements) ? proposal.elements.slice(0, 30) : [], files: Array.isArray(proposal.files) ? proposal.files.slice(0, 8) : [] });
}));
api.post('/projects/:id/ai/apply', handle(async (req, res) => {
  await readMeta(req.params.id);
  const elements = Array.isArray(req.body.elements) ? req.body.elements.slice(0, 30) : [];
  const files = Array.isArray(req.body.files) ? req.body.files.slice(0, 8) : [];
  const results = [];
  for (const element of elements) {
    try { const added = await addElement(req.params.id, element); results.push('Created ' + added.type + ': ' + added.id); }
    catch (e) { results.push('Skipped ' + String(element.id || '?') + ': ' + e.message); }
  }
  for (const file of files) {
    const filePath = String(file.path || '');
    const prefix = 'src/main/';
    if (!filePath.startsWith(prefix) || !(/\.(java|json|mcmeta|toml)$/i.test(filePath)) ||
        filePath.includes('GeneratedContent.java') || filePath.includes('Mod.java') || filePath.includes('/META-INF/') || filePath.includes('..')) {
      results.push('Skipped unsafe path: ' + filePath.slice(0, 80)); continue;
    }
    await writeCodeFile(req.params.id, filePath, file.content);
    results.push('Wrote ' + filePath);
  }
  res.json({ results });
}));

app.use('/api', api);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(path.join(root, 'index.html'))) {
  app.use(express.static(root));
  app.get('*', (_, res) => res.sendFile(path.join(root, 'index.html')));
}
await ensureWorkspace();
app.listen(port, '127.0.0.1', () => console.log('ZuzuMod Studio API: http://127.0.0.1:' + port + '\nProjects: ' + workspace));
