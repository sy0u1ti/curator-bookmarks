import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {DURATION, H, MONO, P, SANS, SERIF, SHOTS, W} from './design';

const ease = Easing.bezier(0.23, 1, 0.32, 1);
const travel = Easing.bezier(0.77, 0, 0.175, 1);
const p = (f: number, start: number, length = 28, smooth = ease) =>
  interpolate(f, [start, start + length], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth});
const at = (left: number, top: number, style: CSSProperties = {}): CSSProperties =>
  ({position: 'absolute', left, top, ...style});

function Bookmark({size = 100, color = P.ink, style}: {size?: number; color?: string; style?: CSSProperties}) {
  return <svg width={size} height={size * 1.45} viewBox="0 0 100 145" style={style} aria-hidden>
    <path d="M0 0H100V145L50 112L0 145Z" fill={color}/>
  </svg>;
}

function Rule({x = 112, y, width = 1696, color = P.line, progress = 1}: {x?: number; y: number; width?: number; color?: string; progress?: number}) {
  return <div style={at(x, y, {width, height: 1.5, background: color, transform: `scaleX(${progress})`, transformOrigin: 'left'})}/>;
}

function Text({children, x, y, size = 34, color = P.ink, serif = false, weight = 400, width, style = {}}: {
  children: ReactNode; x: number; y: number; size?: number; color?: string; serif?: boolean; weight?: number; width?: number; style?: CSSProperties;
}) {
  return <div style={at(x, y, {fontFamily: serif ? SERIF : SANS, fontSize: size, fontWeight: weight, color,
    width, lineHeight: 1.35, letterSpacing: size >= 90 ? '-0.045em' : '-0.01em', ...style})}>{children}</div>;
}

function Headline({lines, x = 112, y = 152, size = 104, color = P.ink, serif = false, delay = 12, gap = 1.27}: {
  lines: string[]; x?: number; y?: number; size?: number; color?: string; serif?: boolean; delay?: number; gap?: number;
}) {
  const f = useCurrentFrame();
  return <>{lines.map((line, i) => <div key={line} style={at(x, y + i * size * gap, {height: size * 1.38, overflow: 'hidden'})}>
    <div style={{color, fontFamily: serif ? SERIF : SANS, fontWeight: serif ? 650 : 750, fontSize: size,
      lineHeight: 1.32, whiteSpace: 'nowrap', letterSpacing: '-0.045em',
      transform: `translateY(${(1 - p(f, delay + i * 7, 28)) * 105}%)`}}>{line}</div>
  </div>)}</>;
}

function Caption({children, x = 112, y = 900, color = P.gray, delay = 34, width = 1500}: {
  children: ReactNode; x?: number; y?: number; color?: string; delay?: number; width?: number;
}) {
  const f = useCurrentFrame();
  return <Text x={x} y={y} size={30} color={color} width={width} style={{opacity: p(f, delay, 22), lineHeight: 1.7}}>{children}</Text>;
}

function Image({name, x, y, width, height, delay = 18, style = {}, sourceWidth, sourceHeight}: {
  name: string; x: number; y: number; width: number; height?: number; delay?: number; style?: CSSProperties; sourceWidth?: number; sourceHeight?: number;
}) {
  const f = useCurrentFrame();
  const t = p(f, delay, 34);
  return <div style={at(x, y, {width, height, overflow: 'hidden', opacity: t,
    transform: `translateY(${(1 - t) * 70}px)`, ...style})}>
    <Img src={`/assets/${name}`} style={{display: 'block', width: '100%', height: height && !sourceWidth ? '100%' : undefined,
      objectFit: height && !sourceWidth ? 'contain' : undefined, ...(sourceWidth ? {aspectRatio: `${sourceWidth}/${sourceHeight}`} : {})}}/>
  </div>;
}

function Chrome({dark = false, category = ''}: {dark?: boolean; category?: string}) {
  const foreground = dark ? P.paper : P.ink;
  return <>
    <Text x={112} y={53} size={25} color={foreground} weight={650} style={{letterSpacing: '-0.04em'}}>Curator</Text>
    {category ? <Text x={1690} y={57} size={21} color={dark ? '#a8aca2' : P.gray} style={{textAlign: 'right', width: 118}}>{category}</Text> : null}
    <Rule y={109} color={dark ? P.darkLine : P.line}/>
  </>;
}

function PageCard({x, y, width = 380, height = 460, rotate = 0, title, subtitle, style = {}, dark = false, children}: {
  x: number; y: number; width?: number; height?: number; rotate?: number; title?: string; subtitle?: string; style?: CSSProperties; dark?: boolean; children?: ReactNode;
}) {
  return <div style={at(x, y, {width, height, background: dark ? P.ink : P.light, color: dark ? P.paper : P.ink,
    border: `1px solid ${dark ? P.darkLine : P.line}`, transform: `rotate(${rotate}deg)`, ...style})}>
    <div style={{padding: 34, height: '100%', overflow: 'hidden'}}>
      {title ? <div style={{fontFamily: SERIF, fontWeight: 650, fontSize: 33, lineHeight: 1.5}}>{title}</div> : null}
      {subtitle ? <div style={{fontSize: 18, fontFamily: MONO, color: P.gray, marginTop: 15}}>{subtitle}</div> : null}
      {children}
    </div>
  </div>;
}

function Lines({count = 5, dark = false, width = '100%'}: {count?: number; dark?: boolean; width?: string}) {
  return <div style={{width, marginTop: 32}}>{Array.from({length: count}, (_, i) =>
    <div key={i} style={{height: 4, marginBottom: 16, width: i === count - 1 ? '64%' : '100%', background: dark ? '#4f554c' : '#d9d8d0'}}/>)}</div>;
}

function Opening() {
  const f = useCurrentFrame();
  const card = p(f, 32, 45, travel);
  return <AbsoluteFill style={{background: P.paper}}>
    <Text x={112} y={59} size={23} weight={600}>Curator</Text>
    <Text x={1660} y={63} size={21} color={P.gray}>书签工作区</Text>
    <Rule y={113} progress={p(f, 0, 45)}/>
    <Headline x={112} y={194} size={158} lines={['你收藏的，', '不只是一个网址。']} delay={-28}/>
    <div style={at(1250, 616, {width: 480, height: 224})}>
      {[0, 1, 2].map(i => <div key={i} style={at(i * 18, -i * 16, {
        width: 450, height: 188, background: i === 2 ? P.ink : '#dbd8ce', border: `1px solid ${P.line}`,
        transform: `translateX(${(1 - card) * (i + 1) * 190}px)`,
      })}>
        {i === 2 ? <>
          <div style={at(29, 32, {width: 318, height: 2, background: '#595f55'})}/>
          <div style={at(29, 51, {fontFamily: SERIF, fontSize: 33, color: P.paper})}>一次灵感，一段好奇。</div>
          <div style={at(29, 123, {fontSize: 19, color: '#b8bdb3'})}>值得留下，也值得再打开。</div>
        </> : null}
      </div>)}
    </div>
    <Bookmark size={53} color={P.paper} style={at(1680, 590, {transform: `translateY(${(1 - p(f, 86, 30)) * -120}px)`, opacity: p(f, 86, 15)})}/>
    <Text x={112} y={934} size={29} color={P.gray} style={{opacity: p(f, 112, 28)}}>让每一次收藏，都有下一次打开。</Text>
    <Text x={1710} y={946} size={21} color={P.gray}>1.6</Text>
  </AbsoluteFill>;
}

function Capture() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background: P.paper}}>
    <Chrome category="随手收藏"/>
    <Headline x={112} y={220} lines={['先收下。', '思路不断。']} size={118}/>
    <Caption y={590} width={660}>一个快捷键。<br/>先放进待整理，再慢慢决定。</Caption>
    <div style={at(116, 770, {display: 'flex', alignItems: 'center', gap: 13})}>
      {['Alt', 'Shift', 'I'].map((key, i) => <div key={key} style={{border: `1.5px solid ${P.ink}`, background: P.light,
        minWidth: i === 1 ? 176 : 106, height: 94, padding: '14px 24px', fontSize: 42, fontWeight: 500, textAlign: 'center',
        transform: `translateY(${(1 - p(f, 39 + i * 5, 25)) * 38}px)`, opacity: p(f, 39 + i * 5, 25)}}>{key}</div>)}
    </div>
    <Image name="popup.png" x={895} y={204} width={920} height={690} delay={30}/>
    <Rule x={790} y={204} width={1}/>
    <Bookmark size={42} style={at(1770, 149)}/>
  </AbsoluteFill>;
}

function Search() {
  const f = useCurrentFrame();
  const query = 'react';
  const typed = query.slice(0, Math.floor(p(f, 58, 30, Easing.linear) * query.length));
  return <AbsoluteFill style={{background: P.ink}}>
    <Chrome dark category="重新找回"/>
    <Headline y={157} lines={['只记得一点，', '也能再遇见。']} size={118} color={P.paper}/>
    <Text x={1212} y={159} size={32} color="#b4b9ad" serif width={560} style={{opacity: p(f, 24)}}>标题可以忘记。<br/>线索，总会留下。</Text>
    <div style={at(114, 513, {width: 920, height: 126, borderBottom: `2px solid ${P.paper}`, overflow: 'hidden'})}>
      <Text x={0} y={22} size={66} color={P.paper} style={{fontFamily: MONO, whiteSpace: 'nowrap', letterSpacing: '-0.04em'}}>{typed}
        <span style={{display: 'inline-block', verticalAlign: '-8px', height: 66, width: 3, marginLeft: 8, background: P.paper,
          opacity: Math.floor(f / 17) % 2 ? .2 : 1}}/>
      </Text>
    </div>
    <Caption x={118} y={696} width={860} color="#a8aea1" delay={74}>
      关键词、拼音、目录，<br/>或已经保存在本机的正文。
    </Caption>
    <Image name="search.png" x={1120} y={444} width={688} height={516} delay={38}/>
    <div style={at(116, 934, {display: 'flex', gap: 25, color: '#c2c6bc', fontSize: 24, opacity: p(f, 130, 24)})}>
      <span>“原文短语”</span><span style={{color: '#656b60'}}>／</span><span>folder:设计</span><span style={{color: '#656b60'}}>／</span><span>最近2周</span>
    </div>
  </AbsoluteFill>;
}

function Beside() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background: P.paper}}>
    <Chrome category="常驻侧栏"/>
    <Headline x={112} y={183} lines={['资料在手边。', '阅读继续。']} size={105}/>
    <Caption x={116} y={564} width={535}>网页变换，搜索还在。<br/>打开侧栏，顺手整理。</Caption>
    <PageCard x={734} y={197} width={586} height={702} style={{transform: `translateX(${(1 - p(f, 22, 34)) * 50}px)`}}>
      <div style={{fontFamily: MONO, fontSize: 17, color: P.gray, letterSpacing: 2}}>READING ROOM</div>
      <div style={{fontFamily: SERIF, fontSize: 56, lineHeight: 1.5, marginTop: 42}}>在阅读之间，<br/>留下自己的路径。</div>
      <div style={{width: 86, height: 4, background: P.ink, marginTop: 35}}/>
      <Lines count={6}/>
      <div style={{fontSize: 22, color: P.gray, lineHeight: 1.9, marginTop: 38}}>有时是一句解释，<br/>有时是下一次创作的起点。</div>
    </PageCard>
    <Image name="sidepanel.png" x={1305} y={197} width={430} height={702} delay={43}/>
    <Bookmark size={36} style={at(112, 787)}/>
  </AbsoluteFill>;
}

function NewTab() {
  const f = useCurrentFrame();
  const expansion = p(f, 77, 52, travel);
  return <AbsoluteFill style={{background: P.paper}}>
    <Chrome category="新标签页"/>
    <div style={{opacity: 1 - p(f, 94, 25)}}>
      <Headline x={112} y={153} lines={['从自己的世界开始。']} size={106}/>
      <Caption y={310} delay={26}>常用的入口，熟悉的目录。每次打开，都回到自己的节奏。</Caption>
    </div>
    <div style={at(112 - expansion * 40, 417 - expansion * 253, {
      width: 1696 + expansion * 80, overflow: 'hidden', height: 595 + expansion * 280,
      transform: `translateY(${(1 - p(f, 31, 37)) * 90}px)`, opacity: p(f, 31, 28),
    })}>
      <Img src="/assets/newtab.png" style={{width: '100%', display: 'block', transform: `translateY(${-expansion * 16}px)`}}/>
    </div>
    <div style={at(112, 897, {width: 1100, height: 140, background: P.paper, opacity: p(f, 167, 28),
      transform: `translateY(${(1 - p(f, 167, 28)) * 80}px)`})}>
      <Text x={26} y={17} size={46} weight={650}>排好书签，也留一点留白。</Text>
      <Text x={28} y={89} size={23} color={P.gray}>多来源 · 固定入口 · 自选背景与玻璃材质</Text>
    </div>
  </AbsoluteFill>;
}

function Curate() {
  const f = useCurrentFrame();
  const merge = p(f, 65, 65, travel);
  const cards = [
    {name: '设计参考', x: 748, y: 190, r: -6},
    {name: '设计参考', x: 1190, y: 335, r: 5},
    {name: '设计参考', x: 980, y: 570, r: -2},
  ];
  return <AbsoluteFill style={{background: P.paper}}>
    <Chrome category="整理与清理"/>
    <Headline x={112} y={226} lines={['留下', '有用的。']} size={140}/>
    <Caption x={116} y={682} width={570} delay={36}>重复的，合并。<br/>可疑的，先看检测证据。</Caption>
    {cards.map((card, i) => <PageCard key={i}
      x={card.x + (1090 - card.x) * merge} y={card.y + (305 - card.y) * merge} width={500} height={300}
      title={card.name} subtitle="design.example / inspiration"
      rotate={card.r * (1 - merge)}
      style={{opacity: i < 2 ? 1 - p(f, 114 + i * 6, 20) : 1}}>
      <Lines count={3}/>
    </PageCard>)}
    <div style={at(1090, 671, {width: 500, borderTop: `1px solid ${P.line}`, paddingTop: 21, fontSize: 28, color: P.gray,
      opacity: p(f, 140, 24)})}>至少保留一份。<span style={{float: 'right', color: P.ink}}>✓</span></div>
    <Rule y={908} progress={p(f, 169, 40)}/>
    <Text x={112} y={947} size={27} color={P.gray} style={{opacity: p(f, 178, 25)}}>失效检测、网址更新、忽略规则与回收站，让每一步有据可循。</Text>
    <Bookmark size={46} style={at(1586, 269, {opacity: p(f, 139, 20)})}/>
  </AbsoluteFill>;
}

function Assist() {
  const f = useCurrentFrame();
  const t = p(f, 65, 47, travel);
  return <AbsoluteFill style={{background: P.ink}}>
    <Chrome dark category="可选 AI"/>
    <Headline x={112} y={159} size={105} color={P.paper} lines={['琐碎交给助手。', '选择留给自己。']}/>
    <div style={at(1190, 201, {width: 510, height: 514, borderLeft: `1px solid ${P.darkLine}`, paddingLeft: 54})}>
      {['标题', '摘要', '标签', '目录'].map((word, i) => <div key={word} style={{fontFamily: i % 2 ? SERIF : SANS,
        fontSize: i === 0 ? 85 : 63, fontWeight: 550, color: P.paper, marginBottom: 22,
        opacity: p(f, 32 + i * 13, 24), transform: `translateX(${(1 - p(f, 32 + i * 13, 24)) * 100}px)`}}>
        <span style={{display: 'inline-block', width: 250}}>{word}</span>
        <span style={{fontSize: 28, color: '#8b9585', opacity: p(f, 133 + i * 13, 16)}}>就绪</span>
      </div>)}
    </div>
    <Rule y={786} color={P.darkLine} progress={t}/>
    <Caption y={841} color="#b3b9ad" delay={120}>
      使用自己的服务，或本机模型。<br/>要不要自动分析、何时移动，由你选择。
    </Caption>
    <Text x={1500} y={916} size={23} color="#89917f" style={{opacity: p(f, 153, 25)}}>AI 始终可选</Text>
  </AbsoluteFill>;
}

function Sync() {
  const f = useCurrentFrame();
  const reveal = p(f, 95, 38, travel);
  const x = 1080 + p(f, 38, 52, travel) * 460;
  return <AbsoluteFill style={{background: P.paper}}>
    <Chrome category="多设备同步"/>
    <Headline x={112} y={171} size={112} lines={['换一台设备，', '接着用。']}/>
    <Caption y={558} width={720} delay={31}>书签与标签页，去你选择的服务。<br/>合并、上传或下载，方向由你定。</Caption>
    <div style={{opacity: 1 - reveal}}>
      {[0, 1].map(i => <div key={i} style={at(1015 + i * 453, 247, {width: 350, height: 431, border: `1.5px solid ${P.ink}`, background: P.light})}>
        <div style={{padding: 30}}>
          <div style={{fontFamily: SERIF, fontSize: 36}}>{i === 0 ? '在这里' : '到那里'}</div>
          <Lines count={5}/>
        </div>
      </div>)}
      <Rule x={1117} y={514} width={518} color={P.ink} progress={p(f, 26, 55, travel)}/>
      <Bookmark size={67} style={at(x, 405)}/>
    </div>
    <Image name="sync.png" x={974} y={200} width={832} height={624} delay={100} style={{opacity: reveal}}/>
    <Rule y={872} progress={p(f, 164, 40)}/>
    <Text x={112} y={918} size={29} weight={500} style={{opacity: p(f, 165, 25)}}>WebDAV　Nextcloud　S3　Git</Text>
    <Text x={112} y={968} size={29} weight={500} style={{opacity: p(f, 177, 25)}}>Linkwarden　Karakeep　Google Drive　Dropbox</Text>
  </AbsoluteFill>;
}

function Recover() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background: P.paper}}>
    <Chrome category="备份与恢复"/>
    <Headline x={112} y={181} lines={['整理，', '也有退路。']} size={117}/>
    <Caption y={610} width={600}>操作前留一份恢复点。<br/>需要时，先看预览，再找回来。</Caption>
    <div style={at(115, 845, {width: 556})}>
      <div style={{height: 1.5, background: P.line, transform: `scaleX(${p(f, 42, 42)})`, transformOrigin: 'left'}}/>
      {[0, 1, 2, 3].map((n) => <div key={n} style={at(n * 169, -5, {width: 11, height: 11, borderRadius: 20,
        background: n === 2 ? P.ink : P.line, opacity: p(f, 50 + n * 12, 19)})}/>)}
      <Text x={295} y={33} size={23} color={P.gray}>回到这一刻</Text>
    </div>
    <div style={at(854, 165, {width: 954, height: 803, overflow: 'hidden', opacity: p(f, 23, 30)})}>
      <Img src="/assets/backup.png" style={{width: 1139, position: 'absolute', left: -166, top: -9,
        transform: `translateY(${-(1 - p(f, 23, 36)) * 55}px)`}}/>
    </div>
  </AbsoluteFill>;
}

function Archive() {
  const f = useCurrentFrame();
  const pack = p(f, 47, 60, travel);
  return <AbsoluteFill style={{background: P.ink}}>
    <Chrome dark category="离线存档"/>
    <Headline x={112} y={181} lines={['网页会远去。', '内容可以留下。']} size={105} color={P.paper}/>
    <Caption y={626} width={730} color="#adb5a7" delay={40}>把已经加载的页面，保存为 MHTML。<br/>下一次阅读，可以不在线。</Caption>
    <div style={at(1100, 204, {width: 574, height: 677, background: P.paper, transform: `scale(${1 - pack * .17}) rotate(${(1 - pack) * 3}deg)`})}>
      <div style={{padding: 50}}>
        <div style={{fontFamily: SERIF, fontSize: 51, lineHeight: 1.5}}>一次阅读。<br/>一份留存。</div>
        <Lines count={6}/>
        <div style={{position: 'absolute', left: 50, right: 50, bottom: 49, borderTop: `1px solid ${P.gray}`, paddingTop: 24,
          fontFamily: MONO, fontSize: 43, letterSpacing: '-.05em', opacity: p(f, 80, 28)}}>.mhtml</div>
      </div>
      <Bookmark color={P.ink} size={59} style={at(444, 0)}/>
    </div>
    <Caption y={948} color="#88917f" delay={118}>保存文字、图片与排版；流媒体与服务器功能不包含在离线文件中。</Caption>
  </AbsoluteFill>;
}

function Yours() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background: P.paper}}>
    <Chrome/>
    <Headline x={112} y={175} lines={['你的收藏，', '始终由你保管。']} size={137} serif/>
    <div style={at(119, 692, {display: 'flex', gap: 0})}>
      {['原生书签', '本地优先', '无遥测'].map((word, i) => <div key={word} style={{fontSize: 41, fontWeight: 500,
        borderTop: `1.5px solid ${P.ink}`, paddingTop: 27, width: 425, marginRight: 67,
        opacity: p(f, 49 + i * 13, 26), transform: `translateY(${(1 - p(f, 49 + i * 13, 26)) * 27}px)`}}>{word}</div>)}
    </div>
    <Caption y={887} delay={115}>AI 和同步，按需连接。书签仍在你熟悉的浏览器里。</Caption>
    <Bookmark size={73} style={at(1670, 683, {opacity: p(f, 100, 32)})}/>
  </AbsoluteFill>;
}

function Closing() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background: P.ink}}>
    <Rule x={112} y={110} width={1696} color={P.darkLine}/>
    <Text x={112} y={55} size={23} color="#b3b8aa">为每一次值得留下的阅读。</Text>
    <Img src="/assets/logo.png" style={at(123, 249, {width: 108, height: 108, opacity: p(f, 15, 24)})}/>
    <Text x={268} y={212} size={155} color={P.paper} weight={650} style={{letterSpacing: '-.07em', opacity: p(f, 15, 26)}}>Curator</Text>
    <Headline x={112} y={467} lines={['让收藏，回到日常。']} size={114} color={P.paper} delay={30} serif/>
    <Caption y={687} color="#acb4a3" delay={58}>Chrome 书签工作区 · 1.6</Caption>
    <Rule y={903} color={P.darkLine} progress={p(f, 65, 34)}/>
    <Text x={114} y={949} size={26} color="#bec5b5" style={{fontFamily: MONO, letterSpacing: '.01em', opacity: p(f, 80, 22)}}>github.com/sy0u1ti/curator-bookmarks</Text>
    <Bookmark size={81} color={P.paper} style={at(1702, 484, {opacity: p(f, 33, 30)})}/>
  </AbsoluteFill>;
}

const SCENES = [Opening, Capture, Search, Beside, NewTab, Curate, Assist, Sync, Recover, Archive, Yours, Closing];

function SceneGate({children, first}: {children: ReactNode; first: boolean}) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{clipPath: first ? undefined : `inset(0 ${100 * (1 - p(f, 0, 17, travel))}% 0 0)`}}>
    {children}
  </AbsoluteFill>;
}

export function CuratorFilm() {
  return <AbsoluteFill style={{background: P.paper, color: P.ink, fontFamily: SANS, width: W, height: H, overflow: 'hidden'}}>
    {SHOTS.map((shot, i) => {
      const Scene = SCENES[i];
      return <Sequence key={shot.id} from={shot.from} durationInFrames={Math.min(shot.duration + 17, DURATION - shot.from)}>
        <SceneGate first={i === 0}><Scene/></SceneGate>
      </Sequence>;
    })}
  </AbsoluteFill>;
}
