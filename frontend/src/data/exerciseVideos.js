/**
 * ScanRig exercise video links.
 *
 * Paste a YouTube URL beside any built-in exercise. Supported examples:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *
 * Leave a value blank to show the normal ScanRig demo placeholder instead of
 * a broken iframe. Admin-created exercises can store their own youtubeUrl in
 * MongoDB from AI Lab.
 */
export const exerciseVideos = {
  'push-up': '',
  squat: 'https://www.youtube.com/watch?v=LLyhvvdcLB8',
  lunge: '',
  'jumping-jack': '',
  'shoulder-press': '',
  'biceps-curl': '',
  'high-knees': '',
  crunch: '',
  plank: '',
};

export function youtubeEmbedUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host.endsWith('youtube.com')) {
      if (url.pathname.startsWith('/watch')) id = url.searchParams.get('v') || '';
      else if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/embed/')[1]?.split('/')[0] || '';
      else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/shorts/')[1]?.split('/')[0] || '';
    }
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return '';
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  } catch {
    return '';
  }
}

export function getExerciseVideo(exercise) {
  return String(exercise?.youtubeUrl || exerciseVideos[exercise?.id] || '').trim();
}
