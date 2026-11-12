export interface YouTubePlayer {
 playVideo(): void;
 pauseVideo(): void;
 mute(): void;
 destroy(): void;
}

export interface YouTubeOptions {
 events: {
  onReady(event: { target: YouTubePlayer }): void;
  onStateChange(event: { data: number }): void;
  onError(): void;
  onAutoplayBlocked(): void;
 };
}

interface YouTubeAPI { Player: new (element: HTMLIFrameElement, options: YouTubeOptions) => YouTubePlayer }
declare global {
 interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void }
}

let api: Promise<YouTubeAPI> | undefined;
export function loadYouTubePlayer(): Promise<YouTubeAPI> {
 if (window.YT?.Player) return Promise.resolve(window.YT);
 return api ??= new Promise((resolve, reject) => {
  const script = document.createElement('script');
  const timeout = window.setTimeout(() => reject(new Error('YouTube unavailable')), 8000);
  const previous = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
   window.clearTimeout(timeout);
   previous?.();
   if (window.YT?.Player) resolve(window.YT);
   else reject(new Error('YouTube player unavailable'));
  };
  script.src = 'https://www.youtube.com/iframe_api';
  script.async = true;
  script.onerror = () => { window.clearTimeout(timeout); reject(new Error('YouTube unavailable')); };
  document.head.append(script);
 });
}
