import {execFile} from 'node:child_process';
import {mkdir, mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {setTimeout as sleep} from 'node:timers/promises';

const run = promisify(execFile);
const {LATERCLIP_ENDPOINT: endpoint, LATERCLIP_TOKEN: token, LATERCLIP_DRIVE_REMOTE: remote} = process.env;
const limit = 32 * 1024 * 1024;
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint ?? '') ||
    (token?.length ?? 0) < 32 || !/^[\w-]+:$/.test(remote ?? '')) {
  throw Error('Set LATERCLIP_ENDPOINT, LATERCLIP_TOKEN and LATERCLIP_DRIVE_REMOTE (for example, drive:).');
}
const {LATERCLIP_TOKEN: _token, ...toolEnv} = process.env;
const runTool = (tool,args,options) => run(tool,args,{env:toolEnv,...options});
for (const [tool, flag] of [['yt-dlp','--version'],['ffmpeg','-version'],['ffprobe','-version'],['rclone','version']]) {
  await runTool(tool,[flag]);
}

async function api(action, fields = {}) {
  const response = await fetch(endpoint,{
    method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
    body:JSON.stringify({...fields,action,token}),signal:AbortSignal.timeout(75_000)
  });
  if (!response.ok) throw Error('LaterClip API HTTP '+response.status);
  const result = await response.json();
  if (!result.ok) throw Error(result.error);
  return result;
}

async function prepare(job) {
  const {id, videoID, folder} = job;
  if (!/^[\w-]+$/.test(id) || !/^[\w-]{11}$/.test(videoID) || !/^[\w-]+$/.test(folder)) {
    throw Error('Invalid audio job');
  }
  const name = id+'.mp3';
  const flags = ['--drive-root-folder-id',folder];
  async function existingFile() {
    const {stdout} = await runTool('rclone',['lsjson',remote,'--files-only','--max-depth','1','--include','/'+name,...flags],
      {timeout:90_000});
    const file = JSON.parse(stdout).find(item=>item.Name===name && item.ID && item.Size>0 && item.Size<=limit);
    return file?.ID;
  }
  const existing = await existingFile();
  if (existing) return existing;

  const directory = await mkdtemp(join(tmpdir(),'laterclip-audio-'));
  try {
    const input = join(directory,'source');
    await mkdir(input);
    await runTool('yt-dlp',['--ignore-config','--no-playlist','--no-progress','--no-remote-components',
      '--js-runtimes','node:'+process.execPath,'--max-filesize','128M','--match-filters','duration <= 5400 & !is_live',
      '-f','bestaudio','--extract-audio','--audio-format','mp3','--audio-quality','48K',
      '--output',join(input,'audio.%(ext)s'),'--','https://www.youtube.com/watch?v='+videoID],
      {timeout:12*60_000,maxBuffer:512*1024,killSignal:'SIGKILL'});
    const mp3 = join(input,'audio.mp3');
    const size = (await stat(mp3)).size;
    if (size < 1 || size > limit) throw Error('MP3 size exceeds the playback limit');
    await runTool('rclone',['copyto',mp3,remote+name,...flags],{timeout:5*60_000,killSignal:'SIGKILL'});
    const fileID = await existingFile();
    if (!fileID) throw Error('Uploaded MP3 was not found');
    return fileID;
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
}

do {
  try {
    const {job} = await api('audioClaim');
    if (!job) {
      if (process.argv.includes('--once')) break;
      await sleep(20_000);
      continue;
    }
    let fileID;
    try { fileID = await prepare(job); }
    catch (error) {
      console.error('오디오 추출 또는 Drive 업로드 실패:',job.id,error.stderr?.trim().split('\n').at(-1) || error.message);
      if (process.argv.includes('--once')) process.exitCode = 1;
    }
    await api('audioFinish',{id:job.id,lease:job.lease,fileID});
    if (fileID) console.log('오디오 저장 완료:',job.id);
  } catch (error) {
    console.error('오디오 작업 요청 실패:',error.message);
    if (process.argv.includes('--once')) process.exitCode = 1;
    else await sleep(20_000);
  }
} while (!process.argv.includes('--once'));
