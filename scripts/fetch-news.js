// scripts/fetch-news.js
// Belirlenen RSS beslemelerini çeker, AI / Kodlama / Araçlar kategorilerine ayırır
// ve data/news.json dosyasını üretir. GitHub Actions tarafından periyodik çalıştırılır.

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({ timeout: 15000 });

// Her besleme bir varsayılan kategoriyle etiketli; içerik anahtar kelimelerle
// yeniden kategorize edilmeye çalışılır, varsayılan sadece geri düşüş (fallback) içindir.
const FEEDS = [
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch', defaultCat: 'ai' },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat', defaultCat: 'ai' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge', defaultCat: 'ai' },
  { url: 'https://www.technologyreview.com/feed/', source: 'MIT Tech Review', defaultCat: 'ai' },
  { url: 'https://github.blog/feed/', source: 'GitHub Blog', defaultCat: 'kod' },
  { url: 'https://simonwillison.net/atom/everything/', source: 'Simon Willison', defaultCat: 'kod' },
  { url: 'https://stackoverflow.blog/feed/', source: 'Stack Overflow Blog', defaultCat: 'kod' },
  { url: 'https://techcrunch.com/category/apps/feed/', source: 'TechCrunch Apps', defaultCat: 'arac' },
  { url: 'https://www.producthunt.com/feed', source: 'Product Hunt', defaultCat: 'arac' },
];

const KEYWORDS = {
  ai: ['ai ', ' ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'gemini', 'anthropic',
       'openai', 'chatbot', 'machine learning', 'neural', 'agent', 'model release', 'genai'],
  kod: ['code', 'coding', 'developer', 'programming', 'github', 'ide', 'sdk', 'api ',
        'repository', 'open source', 'compiler', 'framework', 'library'],
  arac: ['app', 'tool', 'extension', 'plugin', 'launch', 'pricing', 'subscription',
         'release', 'update', 'feature', 'startup'],
};

function categorize(text, defaultCat) {
  const lower = text.toLowerCase();
  const scores = { ai: 0, kod: 0, arac: 0 };
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    for (const w of words) {
      if (lower.includes(w)) scores[cat] += 1;
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : defaultCat;
}

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function formatDateTR(d) {
  const date = new Date(d);
  if (isNaN(date)) return '';
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]}`;
}

async function main() {
  const byCat = { ai: [], kod: [], arac: [] };
  const seenUrls = new Set();

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items || []) {
        if (!item.link || seenUrls.has(item.link)) continue;
        const title = (item.title || '').trim();
        const desc = (item.contentSnippet || item.summary || '').trim().slice(0, 220);
        if (!title) continue;

        const cat = categorize(`${title} ${desc}`, feed.defaultCat);
        seenUrls.add(item.link);
        byCat[cat].push({
          date: formatDateTR(item.pubDate || item.isoDate || Date.now()),
          rawDate: new Date(item.pubDate || item.isoDate || Date.now()).getTime(),
          source: feed.source,
          title,
          desc,
          url: item.link,
        });
      }
    } catch (err) {
      console.error(`Feed alınamadı: ${feed.url} — ${err.message}`);
    }
  }

  const MAX_PER_CAT = 7;
  for (const cat of Object.keys(byCat)) {
    byCat[cat].sort((a, b) => b.rawDate - a.rawDate);
    byCat[cat] = byCat[cat].slice(0, MAX_PER_CAT).map(({ rawDate, ...rest }) => rest);
  }

  const output = {
    generated_at: new Date().toISOString(),
    generated_at_tr: formatDateTR(new Date()) + ' ' + new Date().getFullYear(),
    categories: byCat,
  };

  const outPath = path.join(__dirname, '..', 'data', 'news.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Yazıldı: ${outPath}`);
  console.log(`AI: ${byCat.ai.length}, Kod: ${byCat.kod.length}, Araç: ${byCat.arac.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
