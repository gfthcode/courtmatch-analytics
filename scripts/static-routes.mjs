import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const base = '/courtmatch-analytics/';
const origin = 'https://gfthcode.github.io';
const publicUrl = `${origin}${base}`;
const shell = await readFile(resolve(dist, 'index.html'), 'utf8');

const routes = [
  ['', 'CourtMatch | NBA 直接对位分析', '读懂每一次正面对位。探索 NBA 球员攻防对位、赛季趋势与样本质量，支持双人比较、筛选和分享。当前为明确标记的演示数据。'],
  ['matchups', '联盟对位 | CourtMatch', '按球员、球队、赛季和最低回合筛选 NBA 直接对位，查看交互散点图、详细统计及样本质量。'],
  ['comparison', '双人球员比较 | CourtMatch', '比较两名 NBA 球员的双向直接对位、进攻效率与赛季趋势，导出对比数据与分享卡片。'],
  ['rankings', 'NBA 对位排行榜 | CourtMatch', '探索 NBA 进攻、防守、对位回合和跨赛季变化榜单。可按赛季、球队、位置与样本质量筛选。'],
  ['playtypes', '球员打法分析 | CourtMatch', '按球员、攻防分组与样本回合探索 NBA Play Types 使用频率、每回合效率与百分位。'],
  ['methodology', '数据方法论 | CourtMatch', '了解 CourtMatch 对位效率、每百回合得分、加权联盟基准与样本质量的计算方式和解释边界。'],
  ['sources', '数据来源 | CourtMatch', '查看 NBA 对位演示数据的来源、覆盖范围、更新时间与真实数据 API 接入方式。'],
  ['settings', '网站设置 | CourtMatch', '调整 CourtMatch 主题与体验偏好，查看当前数据模式和连接状态。'],
];

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// GitHub Pages returns a site's custom 404 for unknown deep links. Move through
// its real index document, then restore the complete URL before React mounts.
const restoreScript = `<script>(function(){var u=new URL(location.href),r=u.searchParams.get('__route');if(r&&r.startsWith(${JSON.stringify(base)})&&!r.startsWith('//')){history.replaceState(null,'',r)}})();</script>`;
for (const [path, title, description] of routes) {
  const url = `${publicUrl}${path ? `${path}/` : ''}`;
  let html = shell
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escape(description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escape(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escape(description)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escape(title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escape(description)}">`)
    .replace('</head>', `<link rel="canonical" href="${url}"><meta property="og:url" content="${url}">${restoreScript}</head>`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${publicUrl}social.png$2`);
  const folder = resolve(dist, path);
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, 'index.html'), html);
}

const notFound = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>正在打开分析页 | CourtMatch</title><script>var b=${JSON.stringify(base)};if(location.pathname.startsWith(b)){location.replace(b+'?__route='+encodeURIComponent(location.pathname+location.search+location.hash))}</script></head><body><p>正在打开 CourtMatch 分析页…</p><noscript>请启用 JavaScript 以使用分析工具。</noscript><a href="${base}">返回 CourtMatch 首页</a></body></html>`;
await writeFile(resolve(dist, '404.html'), notFound);
await writeFile(resolve(dist, '.nojekyll'), '');
await writeFile(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(([path]) => `  <url><loc>${publicUrl}${path ? `${path}/` : ''}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${publicUrl}sitemap.xml\n`);
console.log(`Generated ${routes.length} direct-entry pages, 404 recovery and sitemap.`);
