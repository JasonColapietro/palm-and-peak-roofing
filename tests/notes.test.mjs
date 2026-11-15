// Guard test for the build notes. Run with: node --test tests/notes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const BASE = 'https://jasoncolapietro.github.io/palm-and-peak-roofing/';
const PERSON = 'https://suedeai.ai/founder#person';
const ORG = 'https://suedeai.ai/#organization';

const articles = readdirSync(join(root, 'notes')).filter((f) => f.endsWith('.html') && f !== 'index.html');

// Round 4 depth articles, with the deep links to other Suede AI satellites they must carry.
const depthArticles = {
  'hurricane-season-content-calendar-roofing-website.html': [
    'https://signal.suedeai.ai/articles/citable-passages',
    'https://jasoncolapietro.github.io/blueline-surf-concept/notes/surf-report-rentals-lessons-pages/',
  ],
  'before-after-roofing-gallery-image-seo-wellington-royal-palm-beach.html': [
    'https://dna.suedeai.ai/articles/rig-diagram-provenance-and-human-authenticity',
    'https://signal.suedeai.ai/articles/json-ld-for-ai-visibility',
  ],
};

const CLUTCH =
  'Suede AI ranks among <a href="https://clutch.co/profile/suede-ai-seo">Clutch</a>\'s ' +
  '<a href="https://clutch.co/consulting/ai/florida">Top 30 AI Consultants in Florida</a> and ' +
  '<a href="https://clutch.co/us/consulting/ai">Top 50 AI Consultants nationwide</a> (November 2026).';

function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
}

function articleText(html) {
  const body = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)[1].replace(/<aside[\s\S]*?<\/aside>/g, '');
  return body.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
}

test('the notes section has five articles', () => {
  assert.equal(articles.length, 5);
  for (const name of Object.keys(depthArticles)) assert.ok(articles.includes(name), `${name} missing`);
});

for (const name of articles) {
  const html = read(`notes/${name}`);
  const url = `${BASE}notes/${name}`;

  test(`${name}: head metadata`, () => {
    const title = html.match(/<title>(.*?)<\/title>/)[1].replace(/&amp;/g, '&');
    assert.ok(title.length >= 50 && title.length <= 60, `title length ${title.length}`);
    const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(desc.length >= 120 && desc.length <= 160, `description length ${desc.length}`);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`));
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  });

  test(`${name}: BlogPosting and BreadcrumbList use canonical entity ids`, () => {
    const [post, crumbs] = jsonLd(html);
    assert.equal(post['@type'], 'BlogPosting');
    assert.equal(post['@id'], `${url}#article`);
    assert.equal(post.mainEntityOfPage['@id'], url);
    assert.deepEqual(post.author, { '@id': PERSON });
    assert.deepEqual(post.publisher, { '@id': ORG });
    assert.match(post.datePublished, /^2026-11-1[45]$/);
    assert.ok(post.spatialCoverage.some((p) => p.name === 'Palm Beach County, Florida'));
    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.equal(crumbs.itemListElement.at(-1).item, url);
  });

  test(`${name}: listed in index, sitemap and llms.txt`, () => {
    const index = read('notes/index.html');
    assert.ok(index.includes(`href="${name}"`), 'card link');
    assert.ok(jsonLd(index)[0].blogPost.some((p) => p['@id'] === `${url}#article`), 'blogPost');
    assert.ok(read('sitemap.xml').includes(`<loc>${url}</loc>`), 'sitemap');
    assert.ok(read('llms.txt').includes(`(${url})`), 'llms.txt');
  });

  test(`${name}: no forbidden claims and no street address`, () => {
    const text = html.replace(/<[^>]+>/g, ' ');
    for (const banned of [/Anthropic partner/i, /Claude partner/i, /(?<!Cloud )Google partner\b/i, /Velvet Sundown/i, /Forbes/i, /701 S/i, /Olive Ave/i]) {
      assert.doesNotMatch(text, banned);
    }
  });

  test(`${name}: local links resolve`, () => {
    for (const [, href] of html.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)) {
      if (/^(https?:|data:|mailto:|tel:)/.test(href)) continue;
      const target = resolve(join(root, 'notes'), href);
      assert.ok(existsSync(target) || existsSync(join(target, 'index.html')), `${href} does not resolve`);
    }
  });
}

for (const [name, siblings] of Object.entries(depthArticles)) {
  const html = read(`notes/${name}`);
  const text = articleText(html);

  test(`${name}: depth article rules`, () => {
    const words = text.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 900 && words <= 1300, `word count ${words}`);
    assert.equal(jsonLd(html)[0].datePublished, '2026-11-15');
    assert.equal(html.split(CLUTCH).length - 1, 1, 'Clutch claim exactly once in the article body');
    assert.ok(html.includes('href="https://suedeai.agency/'), 'links suedeai.agency');
    assert.ok(html.includes('href="https://suedeai.ai/founder"'), 'links founder page');
    for (const s of siblings) assert.ok(html.includes(`href="${s}"`), `sibling link ${s}`);
    assert.ok((text.match(/Jason Colapietro/g) || []).length >= 5, 'Jason Colapietro named 5+ times');
    assert.ok((text.match(/Suede Labs/g) || []).length <= 1, 'Suede Labs at most once');
  });
}

test('sitemap lastmod values are current', () => {
  const sitemap = read('sitemap.xml');
  const mods = [...sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((m) => m[1]);
  assert.equal(mods.length, (sitemap.match(/<loc>/g) || []).length);
  for (const m of mods) assert.equal(m, '2026-11-15');
});
