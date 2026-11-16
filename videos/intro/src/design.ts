export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const DURATION = 2880;
export const P = {
  paper: '#eeeae2',
  light: '#f8f6f0',
  ink: '#191b19',
  gray: '#757970',
  line: '#c8c7bd',
  warm: '#d5d1c6',
  darkLine: '#424640',
};
export const SANS = '"Curator Sans", sans-serif';
export const SERIF = '"Curator Serif", serif';
export const MONO = '"Curator Mono", monospace';

export const SHOTS = [
  {id: 'opening', label: '你收藏的，不只是一个网址', from: 0, duration: 210},
  {id: 'capture', label: '先收下，思路不断', from: 210, duration: 240},
  {id: 'search', label: '只记得一点，也能再遇见', from: 450, duration: 300},
  {id: 'beside', label: '资料在手边，阅读继续', from: 750, duration: 210},
  {id: 'newtab', label: '从自己的世界开始', from: 960, duration: 330},
  {id: 'curate', label: '留下有用的', from: 1290, duration: 270},
  {id: 'assist', label: '琐碎交给助手，选择留给自己', from: 1560, duration: 240},
  {id: 'sync', label: '换一台设备，接着用', from: 1800, duration: 300},
  {id: 'recover', label: '整理，也有退路', from: 2100, duration: 210},
  {id: 'archive', label: '网页会远去，内容可以留下', from: 2310, duration: 210},
  {id: 'yours', label: '你的收藏，始终由你保管', from: 2520, duration: 210},
  {id: 'closing', label: '让收藏，回到日常', from: 2730, duration: 150},
] as const;
