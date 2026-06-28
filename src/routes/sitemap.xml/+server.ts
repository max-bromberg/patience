import { catalog } from '$lib/games/registry';

/** Prerendered at build time by adapter-static. */
export const prerender = true;

const SITE = 'https://patience.maxbromberg.me';

export function GET() {
	const urls = [
		{ loc: `${SITE}/`, priority: '1.0' },
		...catalog.map((m) => ({ loc: `${SITE}/play/${m.id}`, priority: '0.7' }))
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map((u) => `\t<url>\n\t\t<loc>${u.loc}</loc>\n\t\t<priority>${u.priority}</priority>\n\t</url>`)
	.join('\n')}
</urlset>
`;

	return new Response(body, {
		headers: { 'Content-Type': 'application/xml' }
	});
}
