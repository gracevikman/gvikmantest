const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TEMPLATE_DIRECTORIES,
  parseCompareUrl,
  filterTemplateFiles,
  buildTemplateUrl,
  getSelectedTemplate,
} = require('../lib.js');

test('TEMPLATE_DIRECTORIES lists GitHub locations in order', () => {
  assert.deepEqual(TEMPLATE_DIRECTORIES, [
    '.github/PULL_REQUEST_TEMPLATE',
    'PULL_REQUEST_TEMPLATE',
    'docs/PULL_REQUEST_TEMPLATE',
    '.github/pull_request_template',
    'pull_request_template',
    'docs/pull_request_template',
  ]);
});

test('parseCompareUrl parses a simple compare url', () => {
  assert.deepEqual(parseCompareUrl('https://github.com/gracevikman/gvikmantest/compare/branch1'), {
    owner: 'gracevikman',
    repo: 'gvikmantest',
  });
});

test('parseCompareUrl parses an a...b range with query and hash', () => {
  assert.deepEqual(parseCompareUrl('https://github.com/o/r/compare/main...branch1?expand=1#x'), {
    owner: 'o',
    repo: 'r',
  });
});

test('parseCompareUrl parses a bare compare url without trailing slash', () => {
  assert.deepEqual(parseCompareUrl('https://github.com/o/r/compare'), { owner: 'o', repo: 'r' });
});

test('parseCompareUrl returns null for non-compare urls', () => {
  assert.equal(parseCompareUrl('https://github.com/o/r/pull/3'), null);
  assert.equal(parseCompareUrl('https://github.com/o/r'), null);
  assert.equal(parseCompareUrl('https://github.com/o/r/comparefoo'), null);
});

test('parseCompareUrl returns null for invalid input', () => {
  assert.equal(parseCompareUrl('not a url'), null);
});

test('filterTemplateFiles keeps md/txt files, drops dirs and others, sorts', () => {
  const entries = [
    { name: 'test2.md', type: 'file' },
    { name: 'notes.TXT', type: 'file' },
    { name: 'image.png', type: 'file' },
    { name: 'sub.md', type: 'dir' },
    { name: 'Test1.MD', type: 'file' },
    { name: 'README', type: 'file' },
  ];
  assert.deepEqual(filterTemplateFiles(entries), ['Test1.MD', 'notes.TXT', 'test2.md']);
});

test('filterTemplateFiles returns empty array for empty input', () => {
  assert.deepEqual(filterTemplateFiles([]), []);
});

test('buildTemplateUrl adds template and expand', () => {
  assert.equal(
    buildTemplateUrl('https://github.com/o/r/compare/branch1', 'test1.md'),
    'https://github.com/o/r/compare/branch1?expand=1&template=test1.md',
  );
});

test('buildTemplateUrl preserves other params and hash', () => {
  const result = new URL(buildTemplateUrl('https://github.com/o/r/compare/main...b?title=Hi#frag', 'a.md'));
  assert.equal(result.pathname, '/o/r/compare/main...b');
  assert.equal(result.searchParams.get('title'), 'Hi');
  assert.equal(result.searchParams.get('template'), 'a.md');
  assert.equal(result.searchParams.get('expand'), '1');
  assert.equal(result.hash, '#frag');
});

test('buildTemplateUrl replaces an existing template param', () => {
  const result = new URL(buildTemplateUrl('https://github.com/o/r/compare/b?template=old.md&expand=1', 'new.md'));
  assert.deepEqual(result.searchParams.getAll('template'), ['new.md']);
});

test('buildTemplateUrl removes template for null or empty but keeps expand', () => {
  for (const emptyValue of [null, '']) {
    const result = new URL(buildTemplateUrl('https://github.com/o/r/compare/b?template=old.md', emptyValue));
    assert.equal(result.searchParams.has('template'), false);
    assert.equal(result.searchParams.get('expand'), '1');
  }
});

test('getSelectedTemplate reads the template param', () => {
  assert.equal(getSelectedTemplate('https://github.com/o/r/compare/b?template=test1.md'), 'test1.md');
});

test('getSelectedTemplate returns null when absent', () => {
  assert.equal(getSelectedTemplate('https://github.com/o/r/compare/b'), null);
});
