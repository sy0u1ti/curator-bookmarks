import {Composition, registerRoot} from 'remotion';
import {CuratorFilm} from './Film';
import {DURATION, FPS, H, W} from './design';
import './fonts';

const Root = () => <Composition id="Curator-Introduction" component={CuratorFilm} durationInFrames={DURATION} fps={FPS} width={W} height={H}/>;
registerRoot(Root);
