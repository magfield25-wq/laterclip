export function thumbnailURL(clip) {
  try {
    const image = new URL(clip.thumbnailURL);
    if (image.protocol === 'https:' && image.hostname === 'i.ytimg.com' &&
        /^\/vi\/[A-Za-z0-9_-]{11}\//.test(image.pathname)) return image.href;
    if (image.protocol === 'https:' && !image.username && !image.password && !image.port &&
        /(^|\.)fbcdn\.net$/.test(image.hostname)) return image.href;
  } catch {}
  try {
    const url = new URL(clip.url);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') :
        /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
  } catch { return ''; }
}
