export function headingText(node) {
  return (node.children ?? []).map(child => child.value ?? headingText(child)).join('').trim();
}
const nonSteps = /^(intro(?:duction)?|context|overview|tools(?: and materials)?|materials|cut list(?:\s*\/.*)?|parts|plans|conclusion|takeaways?|results|summary|the build|steps|instructions|directions|process)$/i;
export function isRequiredHeading(format, node) {
  if (node.type !== 'heading' || node.depth > 3) return false;
  const title = headingText(node);
  if (format === 'deep dive') return /^tl;dr$/i.test(title);
  if (format === 'review') return /^verdict$/i.test(title);
  if (format === 'trip') return /^day\s+\d+\b/i.test(title);
  if (format === 'build') return node.depth >= 2 && !!title && !nonSteps.test(title);
  return false;
}
const wrappers = /^(the build|steps|instructions|directions|process)$/i;
// Step headings sit at the shallowest depth that holds real steps: a ### under a step, or under
// a section such as Tools, belongs to that section, while ### steps under a wrapper like "The build" stay steps.
export function buildStepHeadings(nodes) {
  let parent = null;
  const candidates = [];
  for (const node of nodes) {
    if (node.type !== 'heading') continue;
    if (node.depth === 1) parent = null;
    else if (node.depth === 2) {
      if (isRequiredHeading('build', node)) { parent = 'step'; candidates.push(node); }
      else parent = wrappers.test(headingText(node)) ? 'wrapper' : 'other';
    } else if (node.depth === 3 && isRequiredHeading('build', node) && (parent === null || parent === 'wrapper')) candidates.push(node);
  }
  const depth = Math.min(...candidates.map(node => node.depth));
  return new Set(candidates.filter(node => node.depth === depth));
}
export function isSectionHeading(format, node, steps) {
  return format === 'build' ? steps.has(node) : isRequiredHeading(format, node);
}
