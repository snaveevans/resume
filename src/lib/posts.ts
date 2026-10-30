import { getCollection, type CollectionEntry } from 'astro:content';
export type Post = CollectionEntry<'blog'> | CollectionEntry<'fixtures'>;
export async function publishedPosts(): Promise<Post[]> {
  if (process.env.RESUME_TEST_EMPTY === '1') return [];
  const real = process.env.RESUME_TEST_FIXTURES === '1' ? [] : await getCollection('blog');
  const fixture = process.env.RESUME_TEST_FIXTURES === '1' ? await getCollection('fixtures') : [];
  const only = process.env.RESUME_TEST_FIXTURES === '1' ? process.env.RESUME_FIXTURE_ONLY : undefined;
  const now = Date.now();
  return [...(only ? [] : real), ...fixture].filter(post => (!only || post.id === only) && !post.data.draft && post.data.date.getTime() <= now)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.data.title.localeCompare(b.data.title, 'en'));
}
export const postUrl = (post: Post) => `/writing/${post.id}`;
export const displayDate = (date: Date) => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
