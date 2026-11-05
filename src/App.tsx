import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  AlertCircle, ArrowRight, Box, Boxes, Braces, Check, CheckCircle2, ChevronDown,
  ChevronRight, Code2, Download, Eraser, ExternalLink, FileCode2, FilePlus2,
  FolderOpen, GitBranch, Hammer, HardDriveDownload, Image, Layers3, LoaderCircle, Package,
  Palette, Paintbrush, Play, Plus, Save, Search, Settings2, ShieldCheck, Sparkles, SquareTerminal,
  WandSparkles, X, Zap
} from 'lucide-react';

type Section = 'code' | 'elements' | 'sprites' | 'ai' | 'build' | 'settings';
type Project = { id: string; name: string; loader: string; minecraft: string; version: string; createdAt: string };
type Element = { id: string; name: string; type: 'item' | 'block'; color: string };
type Proposal = { summary: string; elements: Element[]; files: { path: string; content: string }[] };
type Runtime = { platform: string; java: string | null; winget: string | null; node: string };
type BuildState = { running: boolean; task: string | null; exitCode: number | null; logs: string[] };
type Health = { ok: boolean; workspace: string; aiConfigured: boolean; model: string };
const repository = 'https://github.com/taithedev/Minecraftmodcreator-zuzumod-';
const palette = ['#ac8bfa', '#70d7fc', '#ef85aa', '#65d4ad', '#fac875', '#ffd6e8', '#8995ff', '#c7d4e7', '#fdfdfd', '#aab06b', '#dd8265', '#23283b'];
const nav: { id: Section; icon: typeof Code2; label: string }[] = [
  { id: 'code', icon: Code2, label: 'Code editor' },
  { id: 'elements', icon: Boxes, label: 'Mod elements' },
  { id: 'sprites', icon: Paintbrush, label: 'Sprite studio' },
  { id: 'ai', icon: WandSparkles, label: 'AI creator' },
  { id: 'build', icon: SquareTerminal, label: 'Build & test' },
  { id: 'settings', icon: Settings2, label: 'Settings' }
];

async function api<T>(route: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api' + route, {
    ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').');
  return data as T;
}
const json = (method: string, value: unknown): RequestInit => ({ method, body: JSON.stringify(value) });
function IconBadge({ children }: { children: React.ReactNode }) { return <span className="icon-badge">{children}</span>; }
function Brand({ small = false }: { small?: boolean }) {
  return <div className={'brand ' + (small ? 'brand-small' : '')}>
    <div className="brand-mark"><img src="/mark.svg" alt="ZuzuMod logo" /></div>
    {!small && <div className="brand-copy"><strong>ZuzuMod</strong><span>STUDIO</span></div>}
  </div>;
}
function FileIcon({ file }: { file: string }) {
  if (file.endsWith('.json')) return <Braces size={15} className="file-icon json" />;
  if (file.endsWith('.java')) return <FileCode2 size={15} className="file-icon java" />;
  if (file.endsWith('.gradle') || file.includes('gradle')) return <Layers3 size={15} className="file-icon gradle" />;
  return <FileCode2 size={15} className="file-icon" />;
}
function SpriteEditor({ project, element, notify }: { project: Project; element: Element; notify: (s: string, error?: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState('#ac8bfa');
  const [erase, setErase] = useState(false);
  const [working, setWorking] = useState(false);
  const [zoom, setZoom] = useState(20);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const context = canvas.current?.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.clearRect(0, 0, 16, 16);
    const image = new window.Image();
    image.onload = () => { context.imageSmoothingEnabled = false; context.clearRect(0, 0, 16, 16); context.drawImage(image, 0, 0, 16, 16); };
    image.onerror = () => notify('Could not load the texture.', true);
    image.src = '/api/projects/' + project.id + '/texture/' + element.type + '/' + element.id + '?v=' + version;
  }, [project.id, element.id, element.type, version, notify]);
  const paint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const node = canvas.current;
    const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    const rect = node.getBoundingClientRect();
    const x = Math.max(0, Math.min(15, Math.floor((event.clientX - rect.left) / rect.width * 16)));
    const y = Math.max(0, Math.min(15, Math.floor((event.clientY - rect.top) / rect.height * 16)));
    if (erase) ctx.clearRect(x, y, 1, 1);
    else { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
  };
  async function save() {
    if (!canvas.current) return;
    setWorking(true);
    try {
      await api('/projects/' + project.id + '/texture/' + element.type + '/' + element.id, json('PUT', { dataUrl: canvas.current.toDataURL('image/png') }));
      setVersion(v => v + 1);
      notify('Texture saved to your mod assets.');
    } catch (error) { notify(String(error), true); }
    finally { setWorking(false); }
  }
  return <div className="sprite-workbench">
    <div className="sprite-topline">
      <div><span className="eyebrow">PIXEL WORKSPACE</span><h2>{element.name} <span className="subtle">/ 16×16 PNG</span></h2></div>
      <button className="primary-btn" onClick={save} disabled={working}><Save size={15} /> Save texture</button>
    </div>
    <div className="sprite-grid-layout">
      <div className="canvas-card">
        <div className="canvas-toolbar"><span><span className="tiny-dot green" /> Canvas / 16px</span><div className="toggle-pills"><button className={!erase ? 'selected' : ''} onClick={() => setErase(false)} title="Paint"><Paintbrush size={15}/></button><button className={erase ? 'selected' : ''} onClick={() => setErase(true)} title="Erase"><Eraser size={15}/></button></div></div>
        <div className="canvas-stage"><div className="pixel-canvas" style={{ width: Math.min(384, zoom * 16), maxWidth: '100%', aspectRatio: '1' }}><canvas width={16} height={16} ref={canvas} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); paint(e); }} onPointerMove={e => { if (e.buttons & 1) paint(e); }} /></div></div>
        <div className="canvas-foot"><span>16 × 16 px</span><div><button onClick={() => setZoom(v => Math.max(12, v - 2))}>−</button><span>{zoom * 5}%</span><button onClick={() => setZoom(v => Math.min(24, v + 2))}>+</button></div><span>PNG · RGBA</span></div>
      </div>
      <div className="sprite-tools">
        <div className="panel-title"><Palette size={16}/> Color library</div>
        <div className="color-palette">{palette.map(p => <button key={p} className={'swatch ' + (color === p ? 'active' : '')} style={{ background: p }} onClick={() => {setColor(p);setErase(false);}} title={p}/>)}</div>
        <label className="field-label" htmlFor="sprite-color">Custom color</label>
        <div className="color-choice"><input id="sprite-color" type="color" value={color} onChange={e => {setColor(e.target.value);setErase(false);}}/><span>{color.toUpperCase()}</span></div>
        <div className="mini-divider" />
        <div className="panel-title"><Image size={16}/> In-game texture</div>
        <div className="sprite-summary"><div className="element-tile"><img src={'/api/projects/' + project.id + '/texture/' + element.type + '/' + element.id + '?v=' + version} alt="" /></div><div><strong>{element.name}</strong><span>{project.id + ':' + element.id}</span><small>Asset is stored in the mod's resources.</small></div></div>
        <div className="helper-note"><CheckCircle2 size={16} /><span>Transparent pixels are supported. Saving updates the actual PNG Minecraft will use.</span></div>
      </div>
    </div>
  </div>;
}
function App() {
  const [online, setOnline] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [section, setSection] = useState<Section>('code');
  const [files, setFiles] = useState<string[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [code, setCode] = useState('');
  const [lastSaved, setLastSaved] = useState('');
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState('');
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showElementDialog, setShowElementDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newElementType, setNewElementType] = useState<Element['type']>('item');
  const [newElementName, setNewElementName] = useState('');
  const [newElementId, setNewElementId] = useState('');
  const [newElementColor, setNewElementColor] = useState('#ac8bfa');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aiWorking, setAiWorking] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [build, setBuild] = useState<BuildState>({ running: false, task: null, exitCode: null, logs: [] });
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const logEnd = useRef<HTMLDivElement>(null);
  const selected = elements.find(e => e.id === selectedElement) || elements[0] || null;
  const dirty = code !== lastSaved;
  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  const refreshProjects = useCallback(async () => {
    const list = await api<Project[]>('/projects');
    setProjects(list);
    setActive(current => {
      const remembered = localStorage.getItem('zuzumod:project');
      return list.find(p => p.id === current?.id) || list.find(p => p.id === remembered) || list[0] || null;
    });
  }, []);
  const refreshProject = useCallback(async (id: string) => {
    const [fileList, items, jars] = await Promise.all([
      api<string[]>('/projects/' + id + '/files'),
      api<Element[]>('/projects/' + id + '/elements'),
      api<string[]>('/projects/' + id + '/artifacts')
    ]);
    setFiles(fileList);
    setElements(items);
    setArtifacts(jars);
    setSelectedElement(current => items.some(e => e.id === current) ? current : items[0]?.id || '');
  }, []);
  const openFile = useCallback(async (id: string, file: string) => {
    try {
      const data = await api<{ content: string }>('/projects/' + id + '/file?path=' + encodeURIComponent(file));
      setSelectedFile(file);
      setCode(data.content);
      setLastSaved(data.content);
      setSection('code');
    } catch (error) { notify(String(error), true); }
  }, [notify]);
  useEffect(() => {
    (async () => {
      try {
        const response = await api<Health>('/health');
        setHealth(response);
        setOnline(response.ok);
        await refreshProjects();
      } catch { setOnline(false); }
    })();
  }, [refreshProjects]);
  useEffect(() => {
    if (!active) return;
    localStorage.setItem('zuzumod:project', active.id);
    setSelectedFile('');
    setCode('');
    setLastSaved('');
    setBuild({ running: false, task: null, exitCode: null, logs: [] });
    void refreshProject(active.id).then(async () => {
      const list = await api<string[]>('/projects/' + active.id + '/files');
      const starter = list.find(p => p.endsWith('Mod.java')) || list.find(p => p.endsWith('.java')) || list[0];
      if (starter) await openFile(active.id, starter);
    }).catch(e => notify(String(e), true));
  }, [active, refreshProject, openFile, notify]);
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    const check = async () => {
      try {
        const [state, jars] = await Promise.all([
          api<BuildState>('/projects/' + active.id + '/status'),
          api<string[]>('/projects/' + active.id + '/artifacts')
        ]);
        if (mounted) { setBuild(state); setArtifacts(jars); }
      } catch { /* API may be restarting */ }
    };
    void check();
    const timer = setInterval(check, 1800);
    return () => { mounted = false; clearInterval(timer); };
  }, [active]);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: 'end' }); }, [build.logs]);
  const saveCode = useCallback(async () => {
    if (!active || !selectedFile || !dirty) return;
    try {
      await api('/projects/' + active.id + '/file', json('PUT', { path: selectedFile, content: code }));
      setLastSaved(code);
      notify('Saved ' + selectedFile.split('/').pop());
    } catch (error) { notify(String(error), true); }
  }, [active, selectedFile, dirty, code, notify]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void saveCode(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [saveCode]);
  function chooseFile(file: string) {
    if (!active || file === selectedFile) return;
    if (dirty && !window.confirm('Discard unsaved edits and open another file?')) return;
    void openFile(active.id, file);
  }
  async function createNewProject(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      const project = await api<Project>('/projects', json('POST', { name: newProjectName, id: newProjectId }));
      await refreshProjects();
      setActive(project);
      setShowProjectDialog(false);
      setNewProjectName('');
      setNewProjectId('');
      notify('Project created from the official NeoForge 1.21.1 template.');
    } catch (error) { notify(String(error), true); }
    finally { setWorking(false); }
  }
  async function createNewElement(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setWorking(true);
    try {
      const item = await api<Element>('/projects/' + active.id + '/elements', json('POST', { type: newElementType, name: newElementName, id: newElementId, color: newElementColor }));
      await refreshProject(active.id);
      setSelectedElement(item.id);
      setSection('sprites');
      setShowElementDialog(false);
      setNewElementName('');
      setNewElementId('');
      notify('Created working Minecraft ' + item.type + ': ' + item.id);
    } catch (error) { notify(String(error), true); }
    finally { setWorking(false); }
  }
  async function newFile() {
    if (!active) return;
    const file = window.prompt('File path inside mod project (example: src/main/java/dev/zuzumod/' + active.id + '/MyFeature.java)');
    if (!file) return;
    try {
      await api('/projects/' + active.id + '/file', json('PUT', { path: file, content: '' }));
      await refreshProject(active.id);
      await openFile(active.id, file);
      notify('New file created.');
    } catch (error) { notify(String(error), true); }
  }
  async function task(taskName: 'build' | 'runClient') {
    if (!active) return;
    if (dirty && !window.confirm('There are unsaved code edits. Continue with the saved version?')) return;
    try {
      await api('/projects/' + active.id + '/tasks', json('POST', { task: taskName }));
      setSection('build');
      setBuild(s => ({ ...s, running: true, task: taskName, logs: ['Starting ' + taskName + '…'] }));
      notify(taskName === 'build' ? 'Build started. Watch the live console.' : 'Starting the Minecraft development client.');
    } catch (error) { notify(String(error), true); }
  }
  async function loadRuntime() {
    try { setRuntime(await api<Runtime>('/runtime')); }
    catch (error) { notify(String(error), true); }
  }
  useEffect(() => { if (section === 'settings') void loadRuntime(); }, [section]);
  async function installJava() {
    if (!window.confirm('Install Microsoft OpenJDK 21 using Windows Package Manager (winget)? This downloads and installs software on your PC.')) return;
    setRuntimeBusy(true);
    try {
      await api('/runtime/install-jdk', json('POST', {}));
      notify('JDK installer started. Windows may request permission. Restart the studio after installation if Java is not detected.');
      const timer = setInterval(async () => {
        try {
          const progress = await api<{ running: boolean; logs: string[]; exitCode: number | null }>('/runtime/status');
          if (!progress.running) { clearInterval(timer); setRuntimeBusy(false); await loadRuntime(); notify(progress.exitCode === 0 ? 'JDK installer completed.' : 'JDK installer ended. Check Windows Package Manager if Java is still missing.', progress.exitCode !== 0); }
        } catch { clearInterval(timer); setRuntimeBusy(false); }
      }, 2000);
    } catch (error) { setRuntimeBusy(false); notify(String(error), true); }
  }
  async function connectAI() {
    try {
      const result = await api<{ configured: boolean }>('/settings/groq', json('POST', { key: apiKey }));
      setHealth(s => s ? { ...s, aiConfigured: result.configured } : s);
      setApiKey('');
      notify(result.configured ? 'Groq AI connected for this local studio session.' : 'No AI key configured.');
    } catch (error) { notify(String(error), true); }
  }
  async function generateAI() {
    if (!active) return;
    setAiWorking(true);
    setProposal(null);
    try {
      const result = await api<Proposal>('/projects/' + active.id + '/ai', json('POST', { prompt }));
      setProposal(result);
      notify('AI proposal ready. Review changes before applying.');
    } catch (error) { notify(String(error), true); }
    finally { setAiWorking(false); }
  }
  async function applyAI() {
    if (!active || !proposal) return;
    if (!window.confirm('Apply proposed items, blocks and source files to this project? Review code before building.')) return;
    setWorking(true);
    try {
      const result = await api<{ results: string[] }>('/projects/' + active.id + '/ai/apply', json('POST', proposal));
      await refreshProject(active.id);
      setProposal(null);
      notify('Applied ' + result.results.length + ' AI operations. Inspect the source before compiling.');
    } catch (error) { notify(String(error), true); }
    finally { setWorking(false); }
  }
  const sectionTitle = nav.find(n => n.id === section)?.label || 'Studio';
  return <div className="app">
    <div className="ambient ambient-a"/><div className="ambient ambient-b"/>
    <header className="app-header">
      <Brand/>
      <div className="header-center"><span className="header-separator"/><span className="workspace-label">WORKSPACE</span><ChevronRight size={13}/><div className="project-switch"><select value={active?.id || ''} onChange={e => { if (dirty && !window.confirm('Discard unsaved changes?')) return; setActive(projects.find(p => p.id === e.target.value) || null); }}><option value="" disabled>Choose project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={13}/></div><span className="header-divider"/><span className="breadcrumb-section">{sectionTitle}</span></div>
      <div className="header-actions"><span className={'connection-pill ' + (online ? 'online' : 'offline')}><span className="tiny-dot"/>{online ? 'LOCAL ENGINE' : 'ENGINE OFFLINE'}</span><a className="icon-button" href={repository} target="_blank" rel="noopener noreferrer" title="View GitHub source"><GitBranch size={17}/></a><button className="icon-button" title="Settings" onClick={() => setSection('settings')}><Settings2 size={17}/></button></div>
    </header>
    <div className="studio-shell">
      <nav className="activity-rail" aria-label="Studio navigation"><div className="rail-top">{nav.slice(0, 5).map(item => <button key={item.id} className={'rail-button ' + (section === item.id ? 'active' : '')} onClick={() => setSection(item.id)} title={item.label} aria-label={item.label}><item.icon size={21} strokeWidth={1.9}/></button>)}</div><div className="rail-bottom"><button className={'rail-button ' + (section === 'settings' ? 'active' : '')} onClick={() => setSection('settings')} title="Settings"><Settings2 size={21}/></button><button className="avatar-button" title="ZuzuMod Studio">Z</button></div></nav>
      <aside className="explorer">
        <div className="explorer-heading"><div><span className="eyebrow">EXPLORER</span><h3>{active ? active.name : 'Your projects'}</h3></div><button className="square-action" title="New mod project" onClick={() => setShowProjectDialog(true)}><Plus size={17}/></button></div>
        {active ? <>
          <div className="project-descriptor"><span className="little-box"><Box size={18}/></span><div><strong>{active.id}</strong><span>NeoForge · {active.minecraft}</span></div><span className="project-live-dot"/></div>
          <div className="explorer-section-label"><span>PROJECT FILES</span><button onClick={() => void newFile()} title="New file"><FilePlus2 size={16}/></button></div>
          <label className="file-search"><Search size={15}/><input value={fileSearch} onChange={e => setFileSearch(e.target.value)} placeholder="Filter files..." aria-label="Filter files"/></label>
          <div className="file-list">{files.filter(f => f.toLowerCase().includes(fileSearch.toLowerCase())).map(f => <button key={f} className={'file-entry ' + (section === 'code' && selectedFile === f ? 'active' : '')} title={f} onClick={() => chooseFile(f)}><FileIcon file={f}/><span>{f.split('/').pop()}</span>{selectedFile === f && dirty && <i className="dirty-dot"/>}</button>)}{!files.length && <p className="small-muted">No project files yet.</p>}</div>
          <div className="explorer-section-label elements-header"><span>MOD ELEMENTS</span><button onClick={() => setShowElementDialog(true)} title="Add item or block"><Plus size={16}/></button></div>
          <div className="element-explorer">{elements.slice(0, 30).map(e => <button key={e.id} onClick={() => { setSelectedElement(e.id); setSection('sprites'); }}><span className="element-mini" style={{ background: e.color }}/><span>{e.name}</span><span className="element-type">{e.type}</span></button>)}{!elements.length && <p className="small-muted">Create your first item or block.</p>}</div>
        </> : <div className="empty-explorer"><FolderOpen size={27}/><span>No active project</span><button onClick={() => setShowProjectDialog(true)}>Create project <ArrowRight size={14}/></button></div>}
        <div className="explorer-footer"><span><span className="tiny-dot green"/> 1.21.1 TOOLCHAIN</span><span>v0.1.0</span></div>
      </aside>
      <main className="main-view">
        {!online ? <div className="centered-state"><IconBadge><AlertCircle size={26}/></IconBadge><h1>Local engine offline</h1><p>Start the app using <code>npm run dev</code>. The browser interface needs the local engine to create files and compile mods.</p><button className="primary-btn" onClick={() => window.location.reload()}>Reconnect</button></div>
        : !active ? <div className="welcome-screen"><div className="welcome-orb"><Box size={56}/></div><div className="eyebrow accent">CREATE SOMETHING UNREAL</div><h1>Your next mod<br/><em>starts here.</em></h1><p>A complete development workspace for NeoForge, with real code, visual mod tools, pixel art, AI-assisted creation, and build pipelines.</p><button className="primary-btn large" onClick={() => setShowProjectDialog(true)}><Plus size={18}/> Create new project <ArrowRight size={17}/></button><div className="welcome-features"><span><Braces size={16}/> Java editor</span><span><Paintbrush size={16}/> Pixel creator</span><span><Hammer size={16}/> Real compiler</span></div></div>
        : <>
          {section === 'code' && <div className="code-view">
            <div className="view-toolbar"><div className="tab-cluster"><span className="tab-item active"><FileIcon file={selectedFile}/>{selectedFile?.split('/').pop() || 'Select a file'}{dirty && <i className="dirty-dot"/>}</span></div><div className="toolbar-actions"><span className="tool-hint">Ctrl + S</span><button className="secondary-btn compact" onClick={() => void saveCode()} disabled={!dirty}><Save size={15}/> Save</button><button className="primary-btn compact" onClick={() => void task('build')} disabled={build.running}><Hammer size={15}/> Build mod</button></div></div>
            <div className="editor-breadcrumb">{selectedFile.split('/').map((part, i) => <span key={i}>{i > 0 && <ChevronRight size={11}/>} {part}</span>)}</div>
            <div className="monaco-container">{selectedFile ? <Editor path={selectedFile} height="100%" language={selectedFile.endsWith('.java') ? 'java' : selectedFile.endsWith('.json') ? 'json' : 'plaintext'} value={code} onChange={v => setCode(v || '')} beforeMount={monaco => monaco.editor.defineTheme('zuzumod-dark', { base: 'vs-dark', inherit: true, rules: [{ token: 'keyword', foreground: 'c4a7ff' }, { token: 'string', foreground: '9bdfba' }, { token: 'comment', foreground: '69738a' }, { token: 'number', foreground: 'f8c98c' }], colors: { 'editor.background': '#0b101b', 'editorLineNumber.foreground': '#4b5266', 'editorCursor.foreground': '#a99bff', 'editor.selectionBackground': '#39365775', 'editor.lineHighlightBackground': '#ffffff08' } })} theme="zuzumod-dark" options={{ fontSize: 13, lineHeight: 23, minimap: { enabled: true, scale: 1, showSlider: 'mouseover' }, fontFamily: "'JetBrains Mono', Consolas, monospace", smoothScrolling: true, padding: { top: 20, bottom: 28 }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, bracketPairColorization: { enabled: true }, guides: { indentation: true } }}/>:<div className="centered-state"><FileCode2 size={32}/><p>Select a source file from Explorer.</p></div>}</div>
            <div className="editor-status"><span><span className="tiny-dot green"/> {dirty ? 'Unsaved changes' : 'All changes saved'}</span><span>{selectedFile.endsWith('.java') ? 'Java 21' : 'Text'} · UTF-8</span><span>NeoForge {active.minecraft}</span></div>
          </div>}
          {section === 'elements' && <div className="scroll-view"><div className="page-heading"><div><div className="eyebrow accent">VISUAL MOD BUILDER</div><h1>Mod elements</h1><p>Create real registries and assets, with no Java required.</p></div><button className="primary-btn" onClick={() => setShowElementDialog(true)}><Plus size={16}/> Add element</button></div><div className="stat-stripe"><div><Boxes size={18}/><strong>{elements.length}</strong><span>Total elements</span></div><div><Package size={18}/><strong>{elements.filter(e => e.type === 'item').length}</strong><span>Items</span></div><div><Box size={18}/><strong>{elements.filter(e => e.type === 'block').length}</strong><span>Blocks</span></div></div><div className="section-subhead"><h3>Your creations</h3><span>All elements compile into your mod</span></div><div className="elements-grid">{elements.map(e => <button key={e.id} className="element-card" onClick={() => { setSelectedElement(e.id); setSection('sprites'); }}><div className="element-preview"><img src={'/api/projects/' + active.id + '/texture/' + e.type + '/' + e.id} alt="" /></div><div className="element-card-text"><strong>{e.name}</strong><small>{active.id + ':' + e.id}</small></div><span className="small-tag">{e.type.toUpperCase()}</span></button>)}<button className="element-card create-card" onClick={() => setShowElementDialog(true)}><div className="create-card-graphic"><Plus size={24}/></div><strong>Create something new</strong><small>Item or block</small></button></div><div className="feature-note"><Sparkles size={18}/><div><strong>No-code, real output</strong><span>Elements are converted to Java registrations, model JSON files, language keys and PNG textures in your project. Open them in Code to inspect.</span></div></div></div>}
          {section === 'sprites' && <div className="scroll-view"><div className="page-heading"><div><div className="eyebrow accent">ART & ASSETS</div><h1>Sprite Studio</h1><p>Draw textures at native Minecraft pixel resolution.</p></div><button className="secondary-btn" onClick={() => setShowElementDialog(true)}><Plus size={16}/> New asset</button></div>{elements.length ? <><div className="element-tabs">{elements.map(e => <button key={e.id} className={selected?.id === e.id ? 'active' : ''} onClick={() => setSelectedElement(e.id)}><span style={{ background: e.color }}/>{e.name}</button>)}</div>{selected && <SpriteEditor key={active.id + ':' + selected.id} project={active} element={selected} notify={notify}/>}</> : <div className="mid-empty"><Palette size={35}/><h3>No textures yet</h3><p>Create an item or block to start painting its 16×16 sprite.</p><button className="primary-btn" onClick={() => setShowElementDialog(true)}><Plus size={15}/> Create element</button></div>}</div>}
          {section === 'ai' && <div className="scroll-view ai-page"><div className="page-heading"><div><div className="eyebrow accent">ZUZU INTELLIGENCE</div><h1>AI Mod Creator <Sparkles size={26} className="heading-spark"/></h1><p>Describe your idea. Get a reviewable plan with working starter files and visual elements.</p></div><span className={'ai-status ' + (health?.aiConfigured ? 'ready' : '')}><span className="tiny-dot"/>{health?.aiConfigured ? 'Groq connected' : 'API key needed'}</span></div><div className="ai-hero"><span className="ai-orbit"><WandSparkles size={26}/></span><div><h2>Imagine it. Build it.</h2><p>Tell the assistant what your Minecraft mod should do. It will propose items, blocks, and Java source for NeoForge 1.21.1.</p></div></div><div className="prompt-box"><label className="eyebrow" htmlFor="ai-prompt">DESCRIBE YOUR MOD</label><textarea id="ai-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Create a glowing crystal block and matching crystal item. Give them purple textures and register them in the creative inventory..." rows={6} maxLength={4000}/><div className="prompt-bottom"><span>{prompt.length} / 4,000 characters</span><button className="primary-btn" disabled={aiWorking || !prompt.trim() || !health?.aiConfigured} onClick={() => void generateAI()}>{aiWorking ? <LoaderCircle size={16} className="spin"/> : <Sparkles size={16}/>} {aiWorking ? 'Thinking…' : 'Generate mod'}</button></div></div><div className="prompt-suggestions">{['A glowing amethyst item', 'A new decorative block', 'A set of five colorful gems'].map(x => <button key={x} onClick={() => setPrompt('Create ' + x.toLowerCase() + ' for Minecraft 1.21.1 NeoForge. Include correct registrations and assets.')}><Sparkles size={13}/>{x}</button>)}</div>{!health?.aiConfigured && <div className="feature-note notice-feature"><AlertCircle size={18}/><div><strong>Connect AI to generate mods</strong><span>Open Settings, enter your Groq API key, and connect. Your key is kept in local engine memory, not GitHub.</span></div><button className="secondary-btn compact" onClick={() => setSection('settings')}>Settings <ArrowRight size={14}/></button></div>}{proposal && <div className="proposal-card"><div className="proposal-heading"><span className="ready-mark"><Check size={18}/></span><div><span className="eyebrow">REVIEW PROPOSAL</span><h3>{proposal.summary}</h3></div></div><div className="proposal-stats"><span><Box size={15}/>{proposal.elements.length} elements</span><span><FileCode2 size={15}/>{proposal.files.length} source files</span></div><div className="proposal-items">{proposal.elements.map((e, i) => <div key={i}><span className="element-mini" style={{ background: e.color }}/>{e.name} <small>{e.type}</small></div>)}{proposal.files.map((f, i) => <div key={'f' + i}><FileCode2 size={15}/>{f.path}<small>{f.content.length} characters</small></div>)}</div><div className="proposal-footer"><span><ShieldCheck size={16}/> Always inspect AI-generated code before running it.</span><button className="primary-btn" onClick={() => void applyAI()} disabled={working}><Check size={16}/> Apply to project</button></div></div>}</div>}
          {section === 'build' && <div className="build-view"><div className="page-heading"><div><div className="eyebrow accent">COMPILE & TEST</div><h1>Build pipeline</h1><p>Compile a real NeoForge mod JAR using the official Gradle wrapper.</p></div><span className={'build-state ' + (build.running ? 'busy' : build.exitCode === 0 ? 'success' : '')}><span className="tiny-dot"/>{build.running ? 'Task running' : build.exitCode === 0 ? 'Build successful' : build.exitCode == null ? 'Ready' : 'Task finished with errors'}</span></div><div className="build-actions"><div className="build-action-card"><span className="build-glyph purple"><Hammer size={24}/></span><div><strong>Build mod</strong><span>Compile and package a usable .jar</span></div><button className="primary-btn compact" onClick={() => void task('build')} disabled={build.running}><Hammer size={14}/> Build</button></div><div className="build-action-card"><span className="build-glyph aqua"><Play size={24}/></span><div><strong>Test in Minecraft</strong><span>Launch the NeoForge development client</span></div><button className="secondary-btn compact" onClick={() => void task('runClient')} disabled={build.running}><Play size={14}/> Run</button></div></div><div className="terminal-window"><div className="terminal-title"><span><SquareTerminal size={16}/> BUILD OUTPUT</span><span><i className="tiny-dot green"/> {build.running ? 'LIVE' : 'CONSOLE'}</span></div><div className="terminal-body"><div className="terminal-intro">ZuzuMod Studio / Gradle Build System</div>{build.logs.length ? build.logs.map((line, i) => <pre key={i} className={/error|failed|exception/i.test(line) ? 'log-error' : /BUILD SUCCESSFUL/i.test(line) ? 'log-success' : ''}>{line}</pre>) : <div className="terminal-prompt"><span>$</span> Ready for your first build. Choose Build mod above.</div>}<div ref={logEnd}/></div></div><div className="artifacts-heading"><div><h3>Build artifacts</h3><p>Successful builds appear here as downloadable JAR files.</p></div><button className="square-action" title="Refresh artifacts" onClick={() => void refreshProject(active.id)}><Download size={16}/></button></div><div className="artifact-list">{artifacts.length ? artifacts.map(name => <a key={name} href={'/api/projects/' + active.id + '/download/' + encodeURIComponent(name)} className="artifact-item"><span className="build-glyph aqua"><Package size={19}/></span><div><strong>{name}</strong><small>NeoForge mod · Java Archive</small></div><Download size={18}/></a>) : <div className="artifact-empty"><Package size={24}/><span>No build artifacts yet. Your compiled mods will show up here.</span></div>}</div></div>}
          {section === 'settings' && <div className="scroll-view settings-view"><div className="page-heading"><div><div className="eyebrow accent">PREFERENCES & TOOLS</div><h1>Studio settings</h1><p>Manage AI, local development dependencies, and integrations.</p></div></div><div className="settings-card"><div className="settings-card-heading"><IconBadge><Sparkles size={20}/></IconBadge><div><h3>AI provider</h3><p>Groq-backed code generation</p></div><span className={health?.aiConfigured ? 'settings-ok' : 'settings-warn'}>{health?.aiConfigured ? 'CONNECTED' : 'NOT CONNECTED'}</span></div><label className="field-label" htmlFor="groq-key">Groq API key</label><div className="key-row"><input id="groq-key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="gsk_••••••••••••••••••••" autoComplete="off"/><button className="primary-btn" onClick={() => void connectAI()} disabled={!apiKey.trim()}>Connect</button></div><p className="microcopy">The key remains in server memory for this session. It is never saved into your mod or pushed to GitHub. You can alternatively set GROQ_API_KEY in your environment.</p><div className="provider-tag"><Zap size={14}/> Model: {health?.model || 'llama-3.3-70b-versatile'}</div></div><div className="settings-card"><div className="settings-card-heading"><IconBadge><HardDriveDownload size={20}/></IconBadge><div><h3>Development tools</h3><p>Java is required for real mod compilation</p></div></div><div className="runtime-row"><div><span>Java JDK 21</span><small>{runtime?.java || 'Not detected in PATH'}</small></div><span className={runtime?.java ? 'settings-ok' : 'settings-warn'}>{runtime?.java ? 'DETECTED' : 'MISSING'}</span></div><div className="runtime-row"><div><span>Node.js runtime</span><small>{runtime?.node || 'Checking...'}</small></div><span className="settings-ok">ACTIVE</span></div><div className="runtime-row"><div><span>Windows Package Manager</span><small>{runtime?.winget || (runtime?.platform === 'win32' ? 'Not installed' : 'Windows only')}</small></div><span className={runtime?.winget ? 'settings-ok' : 'settings-neutral'}>{runtime?.winget ? 'AVAILABLE' : 'UNAVAILABLE'}</span></div><div className="settings-actions"><button className="secondary-btn" onClick={() => void loadRuntime()}>Refresh detection</button><button className="primary-btn" onClick={() => void installJava()} disabled={runtimeBusy || runtime?.platform !== 'win32' || !runtime?.winget}><Download size={15}/>{runtimeBusy ? 'Installing…' : 'Install Java 21 (optional)'}</button></div><p className="microcopy">Installation requires your approval and uses Microsoft OpenJDK 21 via winget. Gradle is downloaded by the official MDK wrapper as needed; first builds require internet.</p></div><div className="settings-card"><div className="settings-card-heading"><IconBadge><GitBranch size={20}/></IconBadge><div><h3>MCP integration</h3><p>Connect tools to coding assistants</p></div><span className="settings-neutral">LOCAL</span></div><div className="command-line"><code>npm run mcp</code><button onClick={() => {void navigator.clipboard.writeText('npm run mcp');notify('Copied MCP command.');}} title="Copy command"><FileCode2 size={16}/></button></div><p className="microcopy">The included stdio MCP server supports listing projects, creating blocks/items, editing source files, and running builds. ChatGPT requires a supported remote MCP connection or secure tunnel; this local server is not an automatic ChatGPT connection.</p><a className="text-link" href="https://developers.openai.com/api/docs/guides/tools-connectors-mcp" target="_blank" rel="noopener noreferrer">MCP connection documentation <ExternalLink size={14}/></a></div><div className="settings-card"><div className="settings-card-heading"><IconBadge><FolderOpen size={20}/></IconBadge><div><h3>Local projects</h3><p>Your source files live on your device</p></div></div><div className="location-box">{health?.workspace || 'Loading...'}</div><p className="microcopy">Generated mods and textures remain in this local directory. You control when to export JARs.</p></div></div>}
        </>}
      </main>
      <aside className="inspector"><div className="inspector-header"><span className="eyebrow">STUDIO INSPECTOR</span><span className="inspector-header-dot"><Zap size={15}/></span></div><div className="inspector-body"><div className="inspector-card hero-inspector"><div className="inspector-card-label"><Sparkles size={15}/> WORKSPACE OVERVIEW</div><h3>{active?.name || 'ZuzuMod Studio'}</h3><p>{active ? 'Your development environment is ready for ideas.' : 'Create a project to unlock the studio.'}</p><div className="progress-line"/><span className="meta-line"><span>ENGINE</span><strong>NeoForge 1.21.1</strong></span></div><div className="inspector-title">QUICK ACTIONS</div><div className="quick-actions"><button disabled={!active} onClick={() => setShowElementDialog(true)}><span><Box size={17}/></span><div><strong>New element</strong><small>Block or item</small></div><Plus size={15}/></button><button disabled={!active} onClick={() => setSection('ai')}><span><Sparkles size={17}/></span><div><strong>Ask Zuzu AI</strong><small>Create without coding</small></div><ChevronRight size={15}/></button><button disabled={!active || build.running} onClick={() => void task('build')}><span><Hammer size={17}/></span><div><strong>Compile mod</strong><small>Real Gradle build</small></div><ChevronRight size={15}/></button></div><div className="inspector-title">PROJECT HEALTH</div><div className="health-panel"><div><CheckCircle2 size={16}/><span>Project files</span><strong>{files.length}</strong></div><div><CheckCircle2 size={16}/><span>Mod elements</span><strong>{elements.length}</strong></div><div><CheckCircle2 size={16}/><span>Build artifacts</span><strong>{artifacts.length}</strong></div><div><span className={'tiny-dot ' + (health?.aiConfigured ? 'green' : '')}/><span>AI assistant</span><strong>{health?.aiConfigured ? 'Ready' : 'Offline'}</strong></div></div><div className="inspector-tip"><Zap size={18}/><div><strong>Studio tip</strong><p>Make an item with the visual builder, then switch to Sprite Studio to paint its texture.</p></div></div></div><div className="inspector-footer"><span><ShieldCheck size={14}/> Local-first development</span><a href={repository} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/></a></div></aside>
    </div>
    <footer className="status-bar"><div><span className="tiny-dot green"/> ZUZUMOD ENGINE <span className="status-separator"/> <span>{active ? active.id + ' / ' + active.minecraft : 'No project opened'}</span></div><div><span><Check size={14}/> Local workspace</span><span>UTF-8</span><span className="status-version">ZuzuMod Studio v0.1</span></div></footer>
    {notice && <div className={'toast ' + (notice.error ? 'error' : '')}><span>{notice.error ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}</span><div>{notice.text}</div><button onClick={() => setNotice(null)}><X size={15}/></button></div>}
    {showProjectDialog && <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !working) setShowProjectDialog(false); }}><form className="modal" onSubmit={createNewProject}><div className="modal-header"><IconBadge><Box size={21}/></IconBadge><button type="button" onClick={() => setShowProjectDialog(false)} disabled={working}><X size={20}/></button></div><span className="eyebrow accent">NEW MOD PROJECT</span><h2>Start creating.</h2><p>Create a working NeoForge 1.21.1 project with the official Gradle toolchain.</p><label className="field-label" htmlFor="new-project-name">Project name</label><input id="new-project-name" required maxLength={64} placeholder="My Awesome Mod" value={newProjectName} onChange={e => { setNewProjectName(e.target.value); if (!newProjectId || newProjectId === newProjectName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')) setNewProjectId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48)); }}/><label className="field-label" htmlFor="new-project-id">Mod ID</label><input id="new-project-id" required minLength={2} maxLength={49} pattern="[a-z][a-z0-9_]{1,48}" placeholder="my_awesome_mod" value={newProjectId} onChange={e => setNewProjectId(e.target.value.toLowerCase())}/><div className="modal-info"><ShieldCheck size={17}/><span>Requires internet for the official MDK download. Java 21 is required when you build, not when you create a project.</span></div><button type="submit" className="primary-btn large modal-submit" disabled={working}>{working ? <LoaderCircle size={17} className="spin"/> : <Plus size={17}/>} {working ? 'Setting up NeoForge…' : 'Create project'}</button></form></div>}
    {showElementDialog && <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !working) setShowElementDialog(false); }}><form className="modal" onSubmit={createNewElement}><div className="modal-header"><IconBadge><Boxes size={21}/></IconBadge><button type="button" onClick={() => setShowElementDialog(false)} disabled={working}><X size={20}/></button></div><span className="eyebrow accent">VISUAL ELEMENT CREATOR</span><h2>Make a new element.</h2><p>ZuzuMod generates Java registration, models, language entries, and an editable texture.</p><div className="type-picker"><button type="button" className={newElementType === 'item' ? 'active' : ''} onClick={() => setNewElementType('item')}><Package size={18}/> Item</button><button type="button" className={newElementType === 'block' ? 'active' : ''} onClick={() => setNewElementType('block')}><Box size={18}/> Block</button></div><label className="field-label" htmlFor="element-name">Display name</label><input id="element-name" required maxLength={60} value={newElementName} onChange={e => { const oldName = newElementName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); const nextId = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48); if (!newElementId || newElementId === oldName) setNewElementId(nextId); setNewElementName(e.target.value); }} placeholder="Ruby Crystal"/><label className="field-label" htmlFor="element-id">Registry ID</label><input id="element-id" required pattern="[a-z][a-z0-9_]{1,48}" value={newElementId} onChange={e => setNewElementId(e.target.value.toLowerCase())} placeholder="ruby_crystal"/><label className="field-label">Starting texture color</label><div className="modal-color"><input type="color" value={newElementColor} onChange={e => setNewElementColor(e.target.value)}/><span>{newElementColor.toUpperCase()}</span><span className="subtle">Editable in Sprite Studio</span></div><button type="submit" className="primary-btn large modal-submit" disabled={working}>{working ? <LoaderCircle size={17} className="spin"/> : <Plus size={17}/>} {working ? 'Generating files…' : 'Create ' + newElementType}</button></form></div>}
  </div>;
}
export default App;
