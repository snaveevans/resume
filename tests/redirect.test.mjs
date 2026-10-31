import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../redirect/worker.js';

test('apex requests redirect to the same path and query on www', async () => {
  for (const [from, to] of [
    ['https://tylerevans.co/', 'https://www.tylerevans.co/'],
    [
      'https://tylerevans.co/writing/some-post?ref=rss',
      'https://www.tylerevans.co/writing/some-post?ref=rss',
    ],
    ['http://tylerevans.co/rss.xml', 'https://www.tylerevans.co/rss.xml'],
  ]) {
    const response = await worker.fetch(new Request(from));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), to);
  }
});
