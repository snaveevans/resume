import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
async function hasPosts(dir: string): Promise<boolean> {
  try { for (const e of await readdir(dir, { withFileTypes: true })) { if (e.isDirectory() && await hasPosts(join(dir, e.name))) return true; if (e.isFile() && /\.(md|mdx)$/.test(e.name)) return true; } } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return false;
}
function safeGlob(base: string) {
  const loader = glob({ base, pattern: '**/*.{md,mdx}' });
  return { ...loader, async load(context: Parameters<typeof loader.load>[0]) {
    const dir = fileURLToPath(new URL(base.endsWith('/') ? base : base + '/', context.config.root));
    if (!await hasPosts(dir)) { context.store.clear(); return; }
    await loader.load(context);
  } };
}

const postSchema = z.object({
  title: z.string().trim().min(1),
  date: z.coerce.date(),
  format: z.enum(['deep dive', 'build', 'trip', 'review', 'note']),
  topic: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(1).optional(),
  draft: z.boolean().default(false),
  hero: z.object({ src: z.string().min(1), alt: z.string().min(1) }).strict().optional(),
  specs: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) }).strict()).min(1).optional(),
  tools: z.array(z.string().min(1)).min(1).optional(),
  cutList: z.array(z.union([z.string().min(1), z.object({ part: z.string().min(1), qty: z.string().min(1), dimensions: z.string().min(1), material: z.string().min(1) }).strict()])).min(1).optional(),
  plans: z.string().url().optional(),
  stats: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) }).strict()).min(1).optional(),
  elevation: z.object({ src: z.string().min(1), alt: z.string().min(1), start: z.string().min(1).optional(), end: z.string().min(1).optional() }).strict().optional(),
  map: z.object({ src: z.string().min(1), alt: z.string().min(1) }).strict().optional(),
  gear: z.union([z.array(z.string().min(1)).min(1), z.object({ worked: z.array(z.string().min(1)).min(1).optional(), didnt: z.array(z.string().min(1)).min(1).optional() }).strict().refine(value => !!(value.worked?.length || value.didnt?.length), 'Provide at least one gear note')]).optional(),
  nextTime: z.string().min(1).optional(),
  changes: z.array(z.string().min(1)).min(1).optional(),
  steps: z.array(z.object({ photo: z.object({ src: z.string().min(1), alt: z.string().min(1) }).strict().optional() }).strict()).optional(),
  days: z.array(z.object({ meta: z.array(z.string().min(1)).optional() }).strict()).optional(),
  marginNotes: z.array(z.string().min(1)).min(1).optional(),
  goodFor: z.string().min(1).optional(),
  notFor: z.string().min(1).optional(),
  pricePaid: z.string().min(1).optional(),
  testConditions: z.string().min(1).optional(),
  alternatives: z.string().min(1).optional(),
  disclosure: z.string().min(1).optional(),
  pros: z.array(z.string().min(1)).min(1).optional(),
  cons: z.array(z.string().min(1)).min(1).optional(),
  link: z.string().url().optional(),
  photo: z.object({ src: z.string().min(1), alt: z.string().min(1) }).strict().optional(),
  results: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) }).strict()).min(1).optional(),
  onThisPage: z.boolean().optional(),
}).strict();
const blog = defineCollection({ loader: safeGlob('./src/content/blog'), schema: postSchema });
const fixtures = defineCollection({
  loader: process.env.RESUME_TEST_FIXTURES === '1' ? safeGlob('./tests/fixtures/posts') : { name: 'disabled-fixtures', load: async ({ store }) => { store.clear(); } },
  schema: postSchema,
});
export const collections = { blog, fixtures };
