import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import {
  listProjects, createProject, projectFiles, readCodeFile, writeCodeFile,
  readElements, addElement, projectDir, readMeta
} from './lib.mjs';

const server = new McpServer({ name: 'zuzumod-studio', version: '0.1.0' });
const output = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
function tool(name, description, schema, fn) {
  server.tool(name, description, schema, async input => {
    try { return output(await fn(input)); }
    catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
  });
}
tool('list_projects', 'List local ZuzuMod Studio projects', {}, () => listProjects());
tool('create_project', 'Create a NeoForge 1.21.1 mod project by downloading the official MDK', {
  id: z.string(), name: z.string()
}, input => createProject(input));
tool('list_project_files', 'List project source and metadata files', { id: z.string() }, input => projectFiles(input.id));
tool('read_project_file', 'Read a source file', { id: z.string(), path: z.string() }, input => readCodeFile(input.id, input.path));
tool('write_project_file', 'Write a source file after user approval', { id: z.string(), path: z.string(), content: z.string() }, async input => {
  await writeCodeFile(input.id, input.path, input.content); return { saved: true };
});
tool('list_elements', 'List visual Minecraft elements', { id: z.string() }, input => readElements(input.id));
tool('create_element', 'Create an item or block, including registry, JSON models, texture and translation', {
  id: z.string(), type: z.enum(['item', 'block']), element_id: z.string(), name: z.string(), color: z.string()
}, input => addElement(input.id, { type: input.type, id: input.element_id, name: input.name, color: input.color }));
tool('build_project', 'Compile a Minecraft mod into a JAR using the Gradle wrapper. Long running.', {
  id: z.string()
}, async input => {
  await readMeta(input.id);
  return new Promise(resolve => {
    const windows = process.platform === 'win32';
    const cmd = windows ? 'cmd.exe' : 'bash';
    const args = windows ? ['/d', '/s', '/c', 'gradlew.bat build'] : ['gradlew', 'build'];
    const child = spawn(cmd, args, { cwd: projectDir(input.id), shell: false, windowsHide: true });
    let logs = '';
    child.stdout.on('data', d => { logs = (logs + d.toString()).slice(-15000); });
    child.stderr.on('data', d => { logs = (logs + d.toString()).slice(-15000); });
    child.on('error', e => resolve({ error: e.message, logs }));
    child.on('close', code => resolve({ exitCode: code, logs }));
  });
});
await server.connect(new StdioServerTransport());
