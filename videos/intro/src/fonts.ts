import {loadFont} from '@remotion/fonts';

export const fontsReady = Promise.all([
  loadFont({family: 'Curator Sans', url: '/fonts/sans-regular.woff2', weight: '400'}),
  loadFont({family: 'Curator Sans', url: '/fonts/sans-bold.woff2', weight: '750'}),
  loadFont({family: 'Curator Serif', url: '/fonts/serif.woff2', weight: '650'}),
  loadFont({family: 'Curator Mono', url: '/fonts/mono.woff2', weight: '400'}),
]);
