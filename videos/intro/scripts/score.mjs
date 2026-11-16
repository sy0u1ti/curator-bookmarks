import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Original, deterministic 80 BPM score: soft felt-like plucks, brushed ticks,
// low sine pulses and slow suspended chords. No samples or borrowed melodies.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const duration = 96;
const rate = 48000;
const frames = duration * rate;
const left = new Float32Array(frames);
const right = new Float32Array(frames);
const beat = 60 / 80;
const frequency = note => 440 * 2 ** ((note - 69) / 12);
let seed = 1201616;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const put = (time, length, amplitude, pan, voice) => {
  const start = Math.floor(time * rate);
  const count = Math.min(Math.floor(length * rate), frames - start);
  const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const value = voice(t, i) * amplitude;
    left[start + i] += value * l;
    right[start + i] += value * r;
  }
};
const chords = [[50,57,60,64,69], [53,60,64,67,72], [48,55,60,64,67], [55,62,65,69,74]];
const pluck = (time, midi, amp, pan) => {
  const hz = frequency(midi);
  put(time, 2.8, amp, pan, t => {
    const attack = Math.min(1, t / .012);
    const soft = Math.exp(-t * 2.1);
    return attack * soft * (Math.sin(2*Math.PI*hz*t) + .20*Math.sin(2*Math.PI*hz*2*t)*Math.exp(-t*3) + .06*Math.sin(2*Math.PI*hz*3*t)*Math.exp(-t*5));
  });
};
for (let bar = 0; bar < 32; bar++) {
  const time = bar * 4 * beat;
  const chord = chords[Math.floor(bar / 2) % chords.length];
  const energy = time < 7 ? .50 : time < 43 ? .8 : time < 60 ? .65 : time < 84 ? .88 : .60;
  chord.slice(0, 4).forEach((note, i) => {
    const hz = frequency(note);
    put(time, 6, .025 * energy, -.6 + .4 * i, t => {
      const envelope = Math.min(1, t / 1.3) * Math.min(1, (6 - t) / 2.2);
      return envelope * (Math.sin(2*Math.PI*hz*t) + .11*Math.sin(2*Math.PI*hz*2*t));
    });
  });
  [0, 1.5, 2.5, 3.5].forEach((offset, j) => {
    if (time < 3 && j > 1 || time > 91 && j > 1) return;
    pluck(time + offset * beat + .08, chord[[1, 3, 2, 4][(j + bar % 2) % 4]] + 12, .046 * energy, j % 2 ? .35 : -.35);
  });
  if (time >= 7 && time < 91) {
    for (let b = 0; b < 4; b++) {
      const when = time + b * beat;
      put(when, .26, .030 * energy, 0, t => Math.sin(2*Math.PI*(49*t + 12*(1-Math.exp(-t*24))/24))*Math.exp(-t*22)*Math.min(1,t/.007));
      put(when + beat / 2, .06, .008 * energy, b % 2 ? -.35 : .35, t => random() * Math.exp(-t*80)*Math.min(1,t/.002));
    }
  }
}
const cuts = [7,15,25,32,43,52,60,70,77,84,91];
for (const time of cuts) {
  put(time-.14, .30, .016, -.15, t => random()*Math.sin(Math.PI*t/.30)*Math.sin(Math.PI*t/.30));
  pluck(time+.08, time===91?74:69, .032, .20);
}
// Short diffuse delay. Feedback is bounded; no loop-dependent randomness.
for (const [delay, gain, swap] of [[.18,.10,true],[.36,.065,false],[.54,.035,true]]) {
  const d = Math.floor(delay*rate);
  for (let i=frames-1;i>=d;i--) {
    left[i] += (swap?right[i-d]:left[i-d])*gain;
    right[i] += (swap?left[i-d]:right[i-d])*gain;
  }
}
let peak = 0;
for(let i=0;i<frames;i++){
  const t=i/rate;
  const fade=Math.min(1,t/1.0)*Math.min(1,(duration-t)/3.0);
  left[i]*=fade;right[i]*=fade;
  peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
}
const normalization=.62/peak;
const bytes=frames*4;
const wav=Buffer.alloc(44+bytes);
wav.write('RIFF',0);wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(bytes,40);
for(let i=0;i<frames;i++){wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left[i]*normalization))*32767),44+i*4);wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right[i]*normalization))*32767),46+i*4);}
const audio=path.join(root,'public/audio');
const temporary=path.resolve(root,'../../.tmp/curator-intro');
await mkdir(audio,{recursive:true});await mkdir(temporary,{recursive:true});
const source=path.join(temporary,'curator-score.wav');
await writeFile(source,wav);
const result=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',source,'-af','loudnorm=I=-20:TP=-2:LRA=7','-c:a','libmp3lame','-b:a','160k',path.join(audio,'curator-score.mp3')],{stdio:'inherit',windowsHide:true});
if(result.status!==0)throw new Error('Soundtrack encoding failed');
console.log(JSON.stringify({duration,rate,originalScore:true,output:'public/audio/curator-score.mp3'}));
