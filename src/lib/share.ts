import { postUrl, type Post } from './posts';

export const canonicalPostUrl = (
  post: Post,
  site: URL | string = 'https://www.tylerevans.co'
) => new URL(`${postUrl(post)}/`, site).href;

export function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url),
    t = encodeURIComponent(title);
  return [
    { label: 'X', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    {
      label: 'Reddit',
      href: `https://www.reddit.com/submit?url=${u}&title=${t}`,
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    { label: 'Email', href: `mailto:?subject=${t}&body=${u}` },
  ];
}
