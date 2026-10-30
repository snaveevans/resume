import { buildStepHeadings, isSectionHeading } from './post-headings.mjs';
const wrap = (name, classes, children, properties = {}) => ({ type: 'container', data: { hName: name, hProperties: { className: classes, ...properties } }, children });
const paragraph = (value, cls) => wrap('p', [cls], [{ type: 'text', value }]);
function wrapMedia(node) {
  if (!node.children) return;
  node.children = node.children.map(child => {
    if (child.type === 'table') return wrap('div', ['table-scroll'], [child]);
    if (child.type === 'code') {
      const filename = child.meta?.match(/(?:title|filename)=(?:"([^"]+)"|'([^']+)'|(\S+))/);
      return filename ? wrap('figure', ['code-figure'], [child, wrap('figcaption', ['code-caption'], [{ type: 'text', value: filename[1] ?? filename[2] ?? filename[3] }])]) : child;
    }
    wrapMedia(child); return child;
  });
}
export function calloutPlugin() {
  return (tree, file) => {
    const data = file.data?.astro?.frontmatter ?? {};
    const format = data.format;
    const buildSteps = format === 'build' ? buildStepHeadings(tree.children) : new Set();
    wrapMedia(tree);
    let count = 0;
    let hoisted = false;
    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];
      if (node.type !== 'heading') continue;
      const matches = isSectionHeading(format, node, buildSteps);
      const target = matches && !hoisted && (format === 'deep dive' || format === 'review');
      const step = matches && format === 'build';
      const day = matches && format === 'trip';
      if (!target && !step && !day) continue;
      let end = i + 1;
      while (end < tree.children.length && !(tree.children[end].type === 'heading' && (tree.children[end].depth <= node.depth || isSectionHeading(format, tree.children[end], buildSteps)))) end++;
      const children = tree.children.slice(i, end);
      // All supported section levels use the board's h2 styling.
      node.depth = 2;
      let replacement;
      if (target) {
        hoisted = true;
        let callout = wrap('aside', ['post-callout', format === 'review' ? 'verdict' : 'tldr'], children);
        if (format === 'review') {
          if (data.goodFor) callout.children.push(paragraph(`Good for · ${data.goodFor}`, 'verdict-detail'));
          if (data.notFor) callout.children.push(paragraph(`Not for · ${data.notFor}`, 'verdict-detail'));
          replacement = wrap('div', ['review-verdict-top'], [callout]);
        } else replacement = callout;
        tree.children.splice(i, end - i); tree.children.unshift(replacement); i = 0; continue;
      }
      count++;
      if (step) {
        const detail = data.steps?.[count - 1];
        const photo = detail?.photo ? [wrap('div', ['step-photo'], [{ type: 'image', url: detail.photo.src, alt: detail.photo.alt }])] : [];
        replacement = wrap('section', ['build-step', 'g12'], [...photo, wrap('div', ['step-text'], [paragraph(String(count).padStart(2, '0'), 'step-number'), ...children])]);
      } else {
        const details = data.days?.[count - 1]?.meta ?? [];
        replacement = wrap('section', ['trip-day', 'g12'], [wrap('div', ['day-label'], [node]), wrap('div', ['day-content'], children.slice(1)), ...(details.length ? [wrap('aside', ['day-meta'], details.map(value => paragraph(value, 'day-meta-line')))] : [])]);
      }
      tree.children.splice(i, end - i, replacement);
    }
    if (format === 'review' && tree.children[0]?.data?.hProperties?.className?.includes('review-verdict-top') && tree.children.length > 1) {
      tree.children = [tree.children[0], wrap('div', ['review-body'], tree.children.slice(1))];
    }
  };
}
