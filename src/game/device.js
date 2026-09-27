/** Detect touch / coarse pointer for mobile-first controls */

export function isMobileLike() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(location.search);
  if (params.get('mobile') === '1' || params.get('mobile') === 'true') return true;
  if (params.get('desktop') === '1') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const noHover = window.matchMedia?.('(hover: none)').matches;
  const touchPoints = navigator.maxTouchPoints > 0;
  const narrow = Math.min(innerWidth, innerHeight) <= 920;
  return Boolean((coarse || noHover || touchPoints) && narrow) ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

export function mobilePerfProfile() {
  const mobile = isMobileLike();
  return {
    mobile,
    pixelRatioCap: mobile ? 1.25 : 2,
    antialias: !mobile,
    shadows: !mobile,
  };
}
