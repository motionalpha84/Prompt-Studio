import {spawn} from 'node:child_process';
import path from 'node:path';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(path.resolve('node_modules/electron/dist/electron.exe'),[path.resolve('scripts/download-library.cjs')],{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>process.exit(code??1));
