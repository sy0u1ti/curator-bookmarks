import {access, mkdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const repository = path.resolve(root, '../..');
const temporary = path.join(repository, '.tmp/curator-intro');
const input = path.join(temporary, 'render/curator-intro-silent.mp4');
const audio = path.join(root, 'public/audio/curator-score.mp3');
const output = path.join(repository, 'assets/readme/curator-intro.mp4');
const master = path.join(temporary, 'curator-intro-master.mp4');
const run = (program, args, capture = false) => {
  const result = spawnSync(program, args, {
    windowsHide: true,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed (${result.status}): ${result.stderr || ''}`);
  return result.stdout;
};
const probe = file => JSON.parse(run('ffprobe', [
  '-v', 'error', '-count_frames',
  '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,channels',
  '-of', 'json', file,
], true));
const verify = (report, withAudio) => {
  const video = report.streams.find(stream => stream.codec_type === 'video');
  const sound = report.streams.find(stream => stream.codec_type === 'audio');
  if (video?.width !== 1920 || video?.height !== 1080 || video?.r_frame_rate !== '30/1' ||
      Number(video?.nb_read_frames) !== 2880 || Math.abs(Number(report.format.duration) - 96) > .1) {
    throw new Error('Expected the complete 96-second, 2880-frame, 1920×1080 composition.');
  }
  if (withAudio && (sound?.codec_name !== 'aac' || sound?.channels !== 2)) {
    throw new Error('The exported film must contain its stereo AAC soundtrack.');
  }
};

await Promise.all([access(input), access(audio)]);
await mkdir(path.dirname(output), {recursive: true});
verify(probe(input), false);
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-i', audio,
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
  '-t', '96', '-movflags', '+faststart',
  '-metadata', 'title=Curator · 让收藏，回到日常',
  '-metadata', 'comment=Original Remotion introduction · Curator 1.6',
  master,
]);
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', master,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
  '-movflags', '+faststart', output,
]);
const report = probe(output);
verify(report, true);
await writeFile(path.join(temporary, 'export-report.json'), JSON.stringify({
  output, master, ...report, bytes: (await stat(output)).size,
}, null, 2));
console.log(JSON.stringify({output, master, duration: report.format.duration, bytes: report.format.size}));
