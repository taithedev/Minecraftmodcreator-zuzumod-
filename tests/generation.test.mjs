import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';

const folder = await fsp.mkdtemp(path.join(os.tmpdir(), 'zuzumod-test-'));
process.env.ZUZUMOD_WORKSPACE = folder;
const lib = await import('../server/lib.mjs');
const id = 'test_mod';
const base = path.join(folder, id);
await fsp.mkdir(path.join(base, '.zuzumod'), { recursive: true });
await fsp.writeFile(path.join(base, '.zuzumod', 'project.json'), JSON.stringify({ id, name: 'Test Mod', loader: 'NeoForge', minecraft: '1.21.1', version: '1.0.0', createdAt: new Date().toISOString() }));
await fsp.writeFile(path.join(base, '.zuzumod', 'elements.json'), '[]');

test('reject unsafe project and file paths', () => {
  assert.equal(lib.safeId('ruby_mod'), 'ruby_mod');
  assert.throws(() => lib.safeId('../unsafe'));
  assert.throws(() => lib.safeId('A-Name'));
  assert.throws(() => lib.withinProject(id, '../../private.txt'));
  assert.throws(() => lib.withinProject(id, '/tmp/external'));
  assert.equal(lib.textureRelative(id, 'block', 'ruby_block'), 'src/main/resources/assets/test_mod/textures/block/ruby_block.png');
});

test('generate an item with Java registration, model, translation and 16px texture', async () => {
  const item = await lib.addElement(id, { type: 'item', id: 'ruby', name: 'Ruby', color: '#b25c84' });
  assert.equal(item.id, 'ruby');
  const source = await fsp.readFile(path.join(base, 'src/main/java/dev/zuzumod/test_mod/GeneratedContent.java'), 'utf8');
  assert.match(source, /registerSimpleItem\("ruby"/);
  const model = JSON.parse(await fsp.readFile(path.join(base, 'src/main/resources/assets/test_mod/models/item/ruby.json'), 'utf8'));
  assert.equal(model.textures.layer0, 'test_mod:item/ruby');
  const lang = JSON.parse(await fsp.readFile(path.join(base, 'src/main/resources/assets/test_mod/lang/en_us.json'), 'utf8'));
  assert.equal(lang['item.test_mod.ruby'], 'Ruby');
  const texture = PNG.sync.read(await fsp.readFile(path.join(base, 'src/main/resources/assets/test_mod/textures/item/ruby.png')));
  assert.equal(texture.width, 16);
  assert.equal(texture.height, 16);
});

test('generate a block with JSON blockstate, cube model and registered item', async () => {
  await lib.addElement(id, { type: 'block', id: 'ruby_block', name: 'Ruby Block', color: '#a74484' });
  const source = await fsp.readFile(path.join(base, 'src/main/java/dev/zuzumod/test_mod/GeneratedContent.java'), 'utf8');
  assert.match(source, /registerSimpleBlock\("ruby_block"/);
  assert.match(source, /registerSimpleBlockItem\("ruby_block"/);
  const states = JSON.parse(await fsp.readFile(path.join(base, 'src/main/resources/assets/test_mod/blockstates/ruby_block.json'), 'utf8'));
  assert.equal(states.variants[''].model, 'test_mod:block/ruby_block');
  const language = JSON.parse(await fsp.readFile(path.join(base, 'src/main/resources/assets/test_mod/lang/en_us.json'), 'utf8'));
  assert.equal(language['item.test_mod.ruby'], 'Ruby');
  assert.equal(language['block.test_mod.ruby_block'], 'Ruby Block');
  await assert.rejects(() => lib.addElement(id, { type: 'item', id: 'ruby', name: 'Duplicate' }), /already in use/);
});

test('code editing stays within the project and persists', async () => {
  const file = 'src/main/java/dev/zuzumod/test_mod/CustomFeature.java';
  await lib.writeCodeFile(id, file, 'package dev.zuzumod.test_mod;\npublic class CustomFeature {}');
  assert.match(await lib.readCodeFile(id, file), /CustomFeature/);
  await assert.rejects(() => lib.writeCodeFile(id, '../../outside.java', 'x'));
  await assert.rejects(() => lib.writeCodeFile(id, 'src/main/java/feature.exe', 'x'));
});
