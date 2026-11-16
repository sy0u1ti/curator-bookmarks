import {createRoot} from 'react-dom/client';
import {useEffect, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {canRenderMediaOnWeb, renderMediaOnWeb, renderStillOnWeb} from '@remotion/web-renderer';
import {CuratorFilm} from './Film';
import {DURATION, FPS, H, SHOTS, W} from './design';
import {fontsReady} from './fonts';
import './preview.css';

const composition = {id: 'Curator-Introduction', component: CuratorFilm, durationInFrames: DURATION, fps: FPS, width: W, height: H};
const save = async (name: string, blob: Blob) => {
  const response = await fetch(`/film-output?name=${encodeURIComponent(name)}`, {method: 'POST', body: blob});
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
type FilmAPI = {
  ready: boolean;
  frame: number;
  state: Record<string, unknown>;
  seek: (frame: number) => void;
  still: (frame: number, name?: string) => Promise<unknown>;
  render: (start?: number, end?: number, scale?: number, name?: string) => void;
  probe: () => Promise<unknown>;
};
declare global {interface Window {film: FilmAPI; filmErrors: string[]}}
window.filmErrors = [];
window.addEventListener('error', event => window.filmErrors.push(event.message));
window.addEventListener('unhandledrejection', event => window.filmErrors.push(String(event.reason)));

function Studio() {
  const player = useRef<PlayerRef>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [status, setStatus] = useState('加载字体与画面');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fontsReady
      .then(() => {setReady(true); setStatus('就绪');})
      .catch(error => {setStatus(`字体加载失败：${String(error)}`); window.filmErrors.push(String(error));});
  }, []);
  useEffect(() => {
    if (!ready || !player.current) return;
    const current = player.current;
    const update = (event: {detail: {frame: number}}) => {
      setFrame(event.detail.frame);
      window.film.frame = event.detail.frame;
    };
    const play = () => {
      if (audio.current) {
        audio.current.currentTime = current.getCurrentFrame() / FPS;
        void audio.current.play().catch(() => {});
      }
    };
    const pause = () => audio.current?.pause();
    current.addEventListener('frameupdate', update);
    current.addEventListener('play', play);
    current.addEventListener('pause', pause);
    return () => {current.removeEventListener('frameupdate', update); current.removeEventListener('play', play); current.removeEventListener('pause', pause);};
  }, [ready]);

  useEffect(() => {
    window.film = {
      ready,
      frame,
      state: window.film?.state || {status: 'idle'},
      seek(next) {
        player.current?.pause();
        player.current?.seekTo(next);
        if (audio.current) audio.current.currentTime = next / FPS;
      },
      async still(next, name = `frame-${String(next).padStart(4, '0')}.png`) {
        await fontsReady;
        const image = await renderStillOnWeb({composition, frame: next, scale: 1, licenseKey: 'free-license'});
        return save(name, await image.blob({format: 'png'}));
      },
      probe: () => canRenderMediaOnWeb({width: W, height: H, container: 'mp4', videoCodec: 'h264', muted: true}),
      render(start = 0, end = DURATION - 1, scale = 1, name = 'curator-intro-silent.mp4') {
        if (window.film.state.status === 'rendering') throw new Error('A render is already running');
        setBusy(true);
        player.current?.pause();
        window.film.state = {status: 'rendering', encodedFrames: 0, progress: 0, name, startedAt: Date.now()};
        void fontsReady.then(async () => {
          const result = await renderMediaOnWeb({
            composition,
            frameRange: [start, end],
            container: 'mp4',
            videoCodec: 'h264',
            muted: true,
            videoBitrate: 4_000_000,
            scale,
            hardwareAcceleration: 'prefer-software',
            keyframeIntervalInSeconds: 2,
            licenseKey: 'free-license',
            pageResponsiveness: 'medium',
            onProgress: progress => {
              window.film.state = {...window.film.state, ...progress};
              setStatus(`渲染 ${Math.round(progress.progress * 100)}%`);
            },
          });
          const written = await save(name, await result.getBlob());
          window.film.state = {...window.film.state, status: 'complete', written};
          setStatus('渲染完成');
        }).catch(error => {
          window.film.state = {...window.film.state, status: 'error', error: String(error), stack: error.stack};
          setStatus(String(error));
        }).finally(() => setBusy(false));
      },
    };
  }, [ready, frame]);

  return <main>
    <header><div><span className="wordmark">Curator</span><span className="divider">/</span><span>让收藏，回到日常</span></div><span className="meta">96″ · 1080p · Remotion</span></header>
    <div className="screen">
      {ready ? <Player ref={player} component={CuratorFilm} durationInFrames={DURATION} fps={FPS} compositionWidth={W} compositionHeight={H}
        style={{width: '100%'}} controls loop={false} autoPlay={false} clickToPlay doubleClickToFullscreen showVolumeControls={false}/>
        : <div className="loading">载入字体…</div>}
    </div>
    <audio ref={audio} src="/audio/curator-score.mp3" preload="auto"/>
    <div className="controls"><span>{Math.floor(frame / FPS).toString().padStart(2, '0')} / 96 秒</span><span role="status" title={status}>{status}</span>
      <button disabled={!ready || busy} onClick={() => window.film.render()}>渲染画面</button></div>
    <nav aria-label="分镜">
      {SHOTS.map((shot, i) => <button key={shot.id} className={frame >= shot.from && frame < shot.from + shot.duration ? 'active' : ''}
        onClick={() => window.film.seek(shot.from + 48)}><span>{String(i + 1).padStart(2, '0')}</span>{shot.label}</button>)}
    </nav>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Studio/>);
