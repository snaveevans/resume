export function headingText(node) {
  return (node.children ?? []).map(child => child.value ?? headingText(child)).join('').trim();
}
const nonSteps = /^(intro(?:duction)?|context|overview|tools(?: and materials)?|materials|cut list(?:\s*\/.*)?|parts|plans|conclusion|takeaways?|results|summary|the build)$/i;
export function isRequiredHeading(format, node) {
  if (node.type !== 'heading' || node.depth > 3) return false;
  const title = headingText(node);
  if (format === 'deep dive') return /^tl;dr$/i.test(title);
  if (format === 'review') return /^verdict$/i.test(title);
  if (format === 'trip') return /^day\s+\d+\b/i.test(title);
  if (format === 'build') return node.depth >= 2 && !!title && !nonSteps.test(title);
  return false;
}
