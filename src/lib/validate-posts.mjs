import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import { slug } from 'github-slugger';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { isRequiredHeading } from './post-headings.mjs';
async function files(dir) {
  let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : /\.(md|mdx)$/.test(e.name) ? [join(dir, e.name)] : []))).flat();
}
function meaningful(node) {
  if (['html', 'mdxjsEsm', 'heading'].includes(node.type)) return false;
  if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') {
    return !!(node.value ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
  }
  if (node.children) return node.children.some(meaningful);
  return !!(node.value ?? '').trim();
}
export async function validatePosts() {
  const dirs = ['src/content/blog'];
  if (process.env.RESUME_TEST_FIXTURES === '1') dirs.push('tests/fixtures/posts');
  for (const dir of dirs) for (const file of await files(dir)) {
    const id = relative(dir, file).replace(/\.(md|mdx)$/, '').split(sep).map(segment => slug(segment)).join('/').replace(/\/index$/, '');
    if (id === 'topic' || id.startsWith('topic/')) throw new Error(`${file}: post id "${id}" uses the reserved topic route`);
    const raw = await readFile(file, 'utf8');
    const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);
    if (!match) throw new Error(`${file}: missing frontmatter`);
    let meta; try { meta = parse(match[1]); } catch (error) { throw new Error(`${file}: invalid frontmatter: ${error.message}`); }
    let nodes;
    try { const parser = unified().use(remarkParse); if (file.endsWith('.mdx')) parser.use(remarkMdx); nodes = parser.parse(match[2]).children; }
    catch (error) { throw new Error(`${file}: invalid Markdown: ${error.message}`); }
    if (meta?.format === 'note' && !nodes.some(n => n.type === 'paragraph' && meaningful(n))) throw new Error(`${file}: note requires prose`);
    if (['deep dive', 'build', 'trip', 'review'].includes(meta?.format)) {
      const index = nodes.findIndex(node => isRequiredHeading(meta.format, node));
      if (index < 0) throw new Error(`${file}: ${meta.format} requires its required section`);
      const depth = nodes[index].depth;
      const content = [];
      for (const n of nodes.slice(index + 1)) { if (n.type === 'heading' && n.depth <= depth) break; content.push(n); }
      if (!content.some(meaningful)) throw new Error(`${file}: ${meta.format} required section must contain text`);
    }
  }
}
