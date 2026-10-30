import rss from '@astrojs/rss';
import { publishedPosts, postUrl } from '../lib/posts';
export async function GET(context) {
  const posts = await publishedPosts();
  return rss({ title: 'Tyler Evans — Writing', description: 'Writing by Tyler Evans', site: context.site, items: posts.map(post => ({ title: post.data.title, description: post.data.description ?? post.data.title, pubDate: post.data.date, link: postUrl(post) })) });
}
