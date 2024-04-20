"use strict";var Ke=Object.create;var x=Object.defineProperty;var Ye=Object.getOwnPropertyDescriptor;var Ve=Object.getOwnPropertyNames;var Je=Object.getPrototypeOf,Xe=Object.prototype.hasOwnProperty;var P=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports),j=(t,e)=>{for(var i in e)x(t,i,{get:e[i],enumerable:!0})},ne=(t,e,i,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of Ve(e))!Xe.call(t,n)&&n!==i&&x(t,n,{get:()=>e[n],enumerable:!(r=Ye(e,n))||r.enumerable});return t};var v=(t,e,i)=>(i=t!=null?Ke(Je(t)):{},ne(e||!t||!t.__esModule?x(i,"default",{value:t,enumerable:!0}):i,t)),Qe=t=>ne(x({},"__esModule",{value:!0}),t);var q=P(a=>{"use strict";var Ze=a&&a.__createBinding||(Object.create?function(t,e,i,r){r===void 0&&(r=i),Object.defineProperty(t,r,{enumerable:!0,get:function(){return e[i]}})}:function(t,e,i,r){r===void 0&&(r=i),t[r]=e[i]}),et=a&&a.__setModuleDefault||(Object.create?function(t,e){Object.defineProperty(t,"default",{enumerable:!0,value:e})}:function(t,e){t.default=e}),ae=a&&a.__importStar||function(t){if(t&&t.__esModule)return t;var e={};if(t!=null)for(var i in t)i!=="default"&&Object.hasOwnProperty.call(t,i)&&Ze(e,t,i);return et(e,t),e},M=a&&a.__awaiter||function(t,e,i,r){function n(s){return s instanceof i?s:new i(function(o){o(s)})}return new(i||(i=Promise))(function(s,o){function c(u){try{l(r.next(u))}catch(m){o(m)}}function p(u){try{l(r.throw(u))}catch(m){o(m)}}function l(u){u.done?s(u.value):n(u.value).then(c,p)}l((r=r.apply(t,e||[])).next())})},g;Object.defineProperty(a,"__esModule",{value:!0});a.getCmdPath=a.tryGetExecutablePath=a.isRooted=a.isDirectory=a.exists=a.READONLY=a.UV_FS_O_EXLOCK=a.IS_WINDOWS=a.unlink=a.symlink=a.stat=a.rmdir=a.rm=a.rename=a.readlink=a.readdir=a.open=a.mkdir=a.lstat=a.copyFile=a.chmod=void 0;var ce=ae(require("fs")),T=ae(require("path"));g=ce.promises,a.chmod=g.chmod,a.copyFile=g.copyFile,a.lstat=g.lstat,a.mkdir=g.mkdir,a.open=g.open,a.readdir=g.readdir,a.readlink=g.readlink,a.rename=g.rename,a.rm=g.rm,a.rmdir=g.rmdir,a.stat=g.stat,a.symlink=g.symlink,a.unlink=g.unlink;a.IS_WINDOWS=process.platform==="win32";a.UV_FS_O_EXLOCK=268435456;a.READONLY=ce.constants.O_RDONLY;function tt(t){return M(this,void 0,void 0,function*(){try{yield a.stat(t)}catch(e){if(e.code==="ENOENT")return!1;throw e}return!0})}a.exists=tt;function it(t,e=!1){return M(this,void 0,void 0,function*(){return(e?yield a.stat(t):yield a.lstat(t)).isDirectory()})}a.isDirectory=it;function rt(t){if(t=st(t),!t)throw new Error('isRooted() parameter "p" cannot be empty');return a.IS_WINDOWS?t.startsWith("\\")||/^[A-Z]:/i.test(t):t.startsWith("/")}a.isRooted=rt;function nt(t,e){return M(this,void 0,void 0,function*(){let i;try{i=yield a.stat(t)}catch(n){n.code!=="ENOENT"&&console.log(`Unexpected error attempting to determine if executable file exists '${t}': ${n}`)}if(i&&i.isFile()){if(a.IS_WINDOWS){let n=T.extname(t).toUpperCase();if(e.some(s=>s.toUpperCase()===n))return t}else if(oe(i))return t}let r=t;for(let n of e){t=r+n,i=void 0;try{i=yield a.stat(t)}catch(s){s.code!=="ENOENT"&&console.log(`Unexpected error attempting to determine if executable file exists '${t}': ${s}`)}if(i&&i.isFile()){if(a.IS_WINDOWS){try{let s=T.dirname(t),o=T.basename(t).toUpperCase();for(let c of yield a.readdir(s))if(o===c.toUpperCase()){t=T.join(s,c);break}}catch(s){console.log(`Unexpected error attempting to determine the actual case of the file '${t}': ${s}`)}return t}else if(oe(i))return t}}return""})}a.tryGetExecutablePath=nt;function st(t){return t=t||"",a.IS_WINDOWS?(t=t.replace(/\//g,"\\"),t.replace(/\\\\+/g,"\\")):t.replace(/\/\/+/g,"/")}function oe(t){return(t.mode&1)>0||(t.mode&8)>0&&t.gid===process.getgid()||(t.mode&64)>0&&t.uid===process.getuid()}function ot(){var t;return(t=process.env.COMSPEC)!==null&&t!==void 0?t:"cmd.exe"}a.getCmdPath=ot});var me=P(h=>{"use strict";var at=h&&h.__createBinding||(Object.create?function(t,e,i,r){r===void 0&&(r=i),Object.defineProperty(t,r,{enumerable:!0,get:function(){return e[i]}})}:function(t,e,i,r){r===void 0&&(r=i),t[r]=e[i]}),ct=h&&h.__setModuleDefault||(Object.create?function(t,e){Object.defineProperty(t,"default",{enumerable:!0,value:e})}:function(t,e){t.default=e}),ue=h&&h.__importStar||function(t){if(t&&t.__esModule)return t;var e={};if(t!=null)for(var i in t)i!=="default"&&Object.hasOwnProperty.call(t,i)&&at(e,t,i);return ct(e,t),e},E=h&&h.__awaiter||function(t,e,i,r){function n(s){return s instanceof i?s:new i(function(o){o(s)})}return new(i||(i=Promise))(function(s,o){function c(u){try{l(r.next(u))}catch(m){o(m)}}function p(u){try{l(r.throw(u))}catch(m){o(m)}}function l(u){u.done?s(u.value):n(u.value).then(c,p)}l((r=r.apply(t,e||[])).next())})};Object.defineProperty(h,"__esModule",{value:!0});h.findInPath=h.which=h.mkdirP=h.rmRF=h.mv=h.cp=void 0;var ut=require("assert"),w=ue(require("path")),f=ue(q());function lt(t,e,i={}){return E(this,void 0,void 0,function*(){let{force:r,recursive:n,copySourceDirectory:s}=ft(i),o=(yield f.exists(e))?yield f.stat(e):null;if(o&&o.isFile()&&!r)return;let c=o&&o.isDirectory()&&s?w.join(e,w.basename(t)):e;if(!(yield f.exists(t)))throw new Error(`no such file or directory: ${t}`);if((yield f.stat(t)).isDirectory())if(n)yield he(t,c,0,r);else throw new Error(`Failed to copy. ${t} is a directory, but tried to copy without recursive flag.`);else{if(w.relative(t,c)==="")throw new Error(`'${c}' and '${t}' are the same file`);yield pe(t,c,r)}})}h.cp=lt;function dt(t,e,i={}){return E(this,void 0,void 0,function*(){if(yield f.exists(e)){let r=!0;if((yield f.isDirectory(e))&&(e=w.join(e,w.basename(t)),r=yield f.exists(e)),r)if(i.force==null||i.force)yield le(e);else throw new Error("Destination already exists")}yield k(w.dirname(e)),yield f.rename(t,e)})}h.mv=dt;function le(t){return E(this,void 0,void 0,function*(){if(f.IS_WINDOWS&&/[*"<>|]/.test(t))throw new Error('File path must not contain `*`, `"`, `<`, `>` or `|` on Windows');try{yield f.rm(t,{force:!0,maxRetries:3,recursive:!0,retryDelay:300})}catch(e){throw new Error(`File was unable to be removed ${e}`)}})}h.rmRF=le;function k(t){return E(this,void 0,void 0,function*(){ut.ok(t,"a path argument must be provided"),yield f.mkdir(t,{recursive:!0})})}h.mkdirP=k;function de(t,e){return E(this,void 0,void 0,function*(){if(!t)throw new Error("parameter 'tool' is required");if(e){let r=yield de(t,!1);if(!r)throw f.IS_WINDOWS?new Error(`Unable to locate executable file: ${t}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also verify the file has a valid extension for an executable file.`):new Error(`Unable to locate executable file: ${t}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also check the file mode to verify the file is executable.`);return r}let i=yield fe(t);return i&&i.length>0?i[0]:""})}h.which=de;function fe(t){return E(this,void 0,void 0,function*(){if(!t)throw new Error("parameter 'tool' is required");let e=[];if(f.IS_WINDOWS&&process.env.PATHEXT)for(let n of process.env.PATHEXT.split(w.delimiter))n&&e.push(n);if(f.isRooted(t)){let n=yield f.tryGetExecutablePath(t,e);return n?[n]:[]}if(t.includes(w.sep))return[];let i=[];if(process.env.PATH)for(let n of process.env.PATH.split(w.delimiter))n&&i.push(n);let r=[];for(let n of i){let s=yield f.tryGetExecutablePath(w.join(n,t),e);s&&r.push(s)}return r})}h.findInPath=fe;function ft(t){let e=t.force==null?!0:t.force,i=!!t.recursive,r=t.copySourceDirectory==null?!0:!!t.copySourceDirectory;return{force:e,recursive:i,copySourceDirectory:r}}function he(t,e,i,r){return E(this,void 0,void 0,function*(){if(i>=255)return;i++,yield k(e);let n=yield f.readdir(t);for(let s of n){let o=`${t}/${s}`,c=`${e}/${s}`;(yield f.lstat(o)).isDirectory()?yield he(o,c,i,r):yield pe(o,c,r)}yield f.chmod(e,(yield f.stat(t)).mode)})}function pe(t,e,i){return E(this,void 0,void 0,function*(){if((yield f.lstat(t)).isSymbolicLink()){try{yield f.lstat(e),yield f.unlink(e)}catch(n){n.code==="EPERM"&&(yield f.chmod(e,"0666"),yield f.unlink(e))}let r=yield f.readlink(t);yield f.symlink(r,e,f.IS_WINDOWS?"junction":null)}else(!(yield f.exists(e))||i)&&(yield f.copyFile(t,e))})}});var ve=P(_=>{"use strict";var ht=_&&_.__createBinding||(Object.create?function(t,e,i,r){r===void 0&&(r=i),Object.defineProperty(t,r,{enumerable:!0,get:function(){return e[i]}})}:function(t,e,i,r){r===void 0&&(r=i),t[r]=e[i]}),pt=_&&_.__setModuleDefault||(Object.create?function(t,e){Object.defineProperty(t,"default",{enumerable:!0,value:e})}:function(t,e){t.default=e}),b=_&&_.__importStar||function(t){if(t&&t.__esModule)return t;var e={};if(t!=null)for(var i in t)i!=="default"&&Object.hasOwnProperty.call(t,i)&&ht(e,t,i);return pt(e,t),e},ge=_&&_.__awaiter||function(t,e,i,r){function n(s){return s instanceof i?s:new i(function(o){o(s)})}return new(i||(i=Promise))(function(s,o){function c(u){try{l(r.next(u))}catch(m){o(m)}}function p(u){try{l(r.throw(u))}catch(m){o(m)}}function l(u){u.done?s(u.value):n(u.value).then(c,p)}l((r=r.apply(t,e||[])).next())})};Object.defineProperty(_,"__esModule",{value:!0});_.argStringToArray=_.ToolRunner=void 0;var U=b(require("os")),ye=b(require("events")),mt=b(require("child_process")),gt=b(require("path")),_t=b(me()),_e=b(q()),yt=require("timers"),N=process.platform==="win32",K=class extends ye.EventEmitter{constructor(e,i,r){if(super(),!e)throw new Error("Parameter 'toolPath' cannot be null or empty.");this.toolPath=e,this.args=i||[],this.options=r||{}}_debug(e){this.options.listeners&&this.options.listeners.debug&&this.options.listeners.debug(e)}_getCommandString(e,i){let r=this._getSpawnFileName(),n=this._getSpawnArgs(e),s=i?"":"[command]";if(N)if(this._isCmdFile()){s+=r;for(let o of n)s+=` ${o}`}else if(e.windowsVerbatimArguments){s+=`"${r}"`;for(let o of n)s+=` ${o}`}else{s+=this._windowsQuoteCmdArg(r);for(let o of n)s+=` ${this._windowsQuoteCmdArg(o)}`}else{s+=r;for(let o of n)s+=` ${o}`}return s}_processLineBuffer(e,i,r){try{let n=i+e.toString(),s=n.indexOf(U.EOL);for(;s>-1;){let o=n.substring(0,s);r(o),n=n.substring(s+U.EOL.length),s=n.indexOf(U.EOL)}return n}catch(n){return this._debug(`error processing line. Failed with error ${n}`),""}}_getSpawnFileName(){return N&&this._isCmdFile()?process.env.COMSPEC||"cmd.exe":this.toolPath}_getSpawnArgs(e){if(N&&this._isCmdFile()){let i=`/D /S /C "${this._windowsQuoteCmdArg(this.toolPath)}`;for(let r of this.args)i+=" ",i+=e.windowsVerbatimArguments?r:this._windowsQuoteCmdArg(r);return i+='"',[i]}return this.args}_endsWith(e,i){return e.endsWith(i)}_isCmdFile(){let e=this.toolPath.toUpperCase();return this._endsWith(e,".CMD")||this._endsWith(e,".BAT")}_windowsQuoteCmdArg(e){if(!this._isCmdFile())return this._uvQuoteCmdArg(e);if(!e)return'""';let i=[" ","	","&","(",")","[","]","{","}","^","=",";","!","'","+",",","`","~","|","<",">",'"'],r=!1;for(let o of e)if(i.some(c=>c===o)){r=!0;break}if(!r)return e;let n='"',s=!0;for(let o=e.length;o>0;o--)n+=e[o-1],s&&e[o-1]==="\\"?n+="\\":e[o-1]==='"'?(s=!0,n+='"'):s=!1;return n+='"',n.split("").reverse().join("")}_uvQuoteCmdArg(e){if(!e)return'""';if(!e.includes(" ")&&!e.includes("	")&&!e.includes('"'))return e;if(!e.includes('"')&&!e.includes("\\"))return`"${e}"`;let i='"',r=!0;for(let n=e.length;n>0;n--)i+=e[n-1],r&&e[n-1]==="\\"?i+="\\":e[n-1]==='"'?(r=!0,i+="\\"):r=!1;return i+='"',i.split("").reverse().join("")}_cloneExecOptions(e){e=e||{};let i={cwd:e.cwd||process.cwd(),env:e.env||process.env,silent:e.silent||!1,windowsVerbatimArguments:e.windowsVerbatimArguments||!1,failOnStdErr:e.failOnStdErr||!1,ignoreReturnCode:e.ignoreReturnCode||!1,delay:e.delay||1e4};return i.outStream=e.outStream||process.stdout,i.errStream=e.errStream||process.stderr,i}_getSpawnOptions(e,i){e=e||{};let r={};return r.cwd=e.cwd,r.env=e.env,r.windowsVerbatimArguments=e.windowsVerbatimArguments||this._isCmdFile(),e.windowsVerbatimArguments&&(r.argv0=`"${i}"`),r}exec(){return ge(this,void 0,void 0,function*(){return!_e.isRooted(this.toolPath)&&(this.toolPath.includes("/")||N&&this.toolPath.includes("\\"))&&(this.toolPath=gt.resolve(process.cwd(),this.options.cwd||process.cwd(),this.toolPath)),this.toolPath=yield _t.which(this.toolPath,!0),new Promise((e,i)=>ge(this,void 0,void 0,function*(){this._debug(`exec tool: ${this.toolPath}`),this._debug("arguments:");for(let l of this.args)this._debug(`   ${l}`);let r=this._cloneExecOptions(this.options);!r.silent&&r.outStream&&r.outStream.write(this._getCommandString(r)+U.EOL);let n=new Y(r,this.toolPath);if(n.on("debug",l=>{this._debug(l)}),this.options.cwd&&!(yield _e.exists(this.options.cwd)))return i(new Error(`The cwd: ${this.options.cwd} does not exist!`));let s=this._getSpawnFileName(),o=mt.spawn(s,this._getSpawnArgs(r),this._getSpawnOptions(this.options,s)),c="";o.stdout&&o.stdout.on("data",l=>{this.options.listeners&&this.options.listeners.stdout&&this.options.listeners.stdout(l),!r.silent&&r.outStream&&r.outStream.write(l),c=this._processLineBuffer(l,c,u=>{this.options.listeners&&this.options.listeners.stdline&&this.options.listeners.stdline(u)})});let p="";if(o.stderr&&o.stderr.on("data",l=>{n.processStderr=!0,this.options.listeners&&this.options.listeners.stderr&&this.options.listeners.stderr(l),!r.silent&&r.errStream&&r.outStream&&(r.failOnStdErr?r.errStream:r.outStream).write(l),p=this._processLineBuffer(l,p,u=>{this.options.listeners&&this.options.listeners.errline&&this.options.listeners.errline(u)})}),o.on("error",l=>{n.processError=l.message,n.processExited=!0,n.processClosed=!0,n.CheckComplete()}),o.on("exit",l=>{n.processExitCode=l,n.processExited=!0,this._debug(`Exit code ${l} received from tool '${this.toolPath}'`),n.CheckComplete()}),o.on("close",l=>{n.processExitCode=l,n.processExited=!0,n.processClosed=!0,this._debug(`STDIO streams have closed for tool '${this.toolPath}'`),n.CheckComplete()}),n.on("done",(l,u)=>{c.length>0&&this.emit("stdline",c),p.length>0&&this.emit("errline",p),o.removeAllListeners(),l?i(l):e(u)}),this.options.input){if(!o.stdin)throw new Error("child process missing stdin");o.stdin.end(this.options.input)}}))})}};_.ToolRunner=K;function vt(t){let e=[],i=!1,r=!1,n="";function s(o){r&&o!=='"'&&(n+="\\"),n+=o,r=!1}for(let o=0;o<t.length;o++){let c=t.charAt(o);if(c==='"'){r?s(c):i=!i;continue}if(c==="\\"&&r){s(c);continue}if(c==="\\"&&i){r=!0;continue}if(c===" "&&!i){n.length>0&&(e.push(n),n="");continue}s(c)}return n.length>0&&e.push(n.trim()),e}_.argStringToArray=vt;var Y=class t extends ye.EventEmitter{constructor(e,i){if(super(),this.processClosed=!1,this.processError="",this.processExitCode=0,this.processExited=!1,this.processStderr=!1,this.delay=1e4,this.done=!1,this.timeout=null,!i)throw new Error("toolPath must not be empty");this.options=e,this.toolPath=i,e.delay&&(this.delay=e.delay)}CheckComplete(){this.done||(this.processClosed?this._setResult():this.processExited&&(this.timeout=yt.setTimeout(t.HandleTimeout,this.delay,this)))}_debug(e){this.emit("debug",e)}_setResult(){let e;this.processExited&&(this.processError?e=new Error(`There was an error when attempting to execute the process '${this.toolPath}'. This may indicate the process failed to start. Error: ${this.processError}`):this.processExitCode!==0&&!this.options.ignoreReturnCode?e=new Error(`The process '${this.toolPath}' failed with exit code ${this.processExitCode}`):this.processStderr&&this.options.failOnStdErr&&(e=new Error(`The process '${this.toolPath}' failed because one or more lines were written to the STDERR stream`))),this.timeout&&(clearTimeout(this.timeout),this.timeout=null),this.done=!0,this.emit("done",e,this.processExitCode)}static HandleTimeout(e){if(!e.done){if(!e.processClosed&&e.processExited){let i=`The STDIO streams did not close within ${e.delay/1e3} seconds of the exit event from process '${e.toolPath}'. This may indicate a child process inherited the STDIO streams and has not yet exited.`;e._debug(i)}e._setResult()}}}});var be=P(y=>{"use strict";var Ot=y&&y.__createBinding||(Object.create?function(t,e,i,r){r===void 0&&(r=i),Object.defineProperty(t,r,{enumerable:!0,get:function(){return e[i]}})}:function(t,e,i,r){r===void 0&&(r=i),t[r]=e[i]}),wt=y&&y.__setModuleDefault||(Object.create?function(t,e){Object.defineProperty(t,"default",{enumerable:!0,value:e})}:function(t,e){t.default=e}),St=y&&y.__importStar||function(t){if(t&&t.__esModule)return t;var e={};if(t!=null)for(var i in t)i!=="default"&&Object.hasOwnProperty.call(t,i)&&Ot(e,t,i);return wt(e,t),e},Se=y&&y.__awaiter||function(t,e,i,r){function n(s){return s instanceof i?s:new i(function(o){o(s)})}return new(i||(i=Promise))(function(s,o){function c(u){try{l(r.next(u))}catch(m){o(m)}}function p(u){try{l(r.throw(u))}catch(m){o(m)}}function l(u){u.done?s(u.value):n(u.value).then(c,p)}l((r=r.apply(t,e||[])).next())})};Object.defineProperty(y,"__esModule",{value:!0});y.getExecOutput=y.exec=void 0;var Oe=require("string_decoder"),we=St(ve());function Ee(t,e,i){return Se(this,void 0,void 0,function*(){let r=we.argStringToArray(t);if(r.length===0)throw new Error("Parameter 'commandLine' cannot be null or empty.");let n=r[0];return e=r.slice(1).concat(e||[]),new we.ToolRunner(n,e,i).exec()})}y.exec=Ee;function Et(t,e,i){var r,n;return Se(this,void 0,void 0,function*(){let s="",o="",c=new Oe.StringDecoder("utf8"),p=new Oe.StringDecoder("utf8"),l=(r=i?.listeners)===null||r===void 0?void 0:r.stdout,u=(n=i?.listeners)===null||n===void 0?void 0:n.stderr,m=I=>{o+=p.write(I),u&&u(I)},Me=I=>{s+=c.write(I),l&&l(I)},qe=Object.assign(Object.assign({},i?.listeners),{stdout:Me,stderr:m}),ke=yield Ee(t,e,Object.assign(Object.assign({},i),{listeners:qe}));return s+=c.end(),o+=p.end(),{exitCode:ke,stdout:s,stderr:o}})}y.getExecOutput=Et});var Ie=P(V=>{"use strict";Object.defineProperty(V,"__esModule",{value:!0});var Ce=require("fs"),R=require("os"),bt=require("util"),Rt=bt.promisify(Ce.readFile),Ct={mode:"async",custom_file:null,debug:!1};function It(t){t={...Ct,...t};let e=Pt(t.custom_file);async function i(n,s){let o=null;for(let c of n)try{s.debug&&console.log(`Trying to read '${c}'...`),o=await Rt(c,"binary"),s.debug&&console.log(`Read data:
`+o);break}catch(p){s.debug&&console.error(p)}if(o===null)throw new Error("Cannot read os-release file!");return Re(A(),o)}function r(n,s){let o=null;for(let c of n)try{s.debug&&console.log(`Trying to read '${c}'...`),o=Ce.readFileSync(c,"binary"),s.debug&&console.log(`Read data:
`+o);break}catch(p){s.debug&&console.error(p)}if(o===null)throw new Error("Cannot read os-release file!");return Re(A(),o)}return R.type()!=="Linux"?t.mode==="sync"?A():Promise.resolve(A()):t.mode==="sync"?r(e,t):Promise.resolve(i(e,t))}V.releaseInfo=It;function Re(t,e){return e.split(`
`).forEach(r=>{let n=r.split("=");n.length===2&&(n[1]=n[1].replace(/["'\r]/gi,""),Object.defineProperty(t,n[0].toLowerCase(),{value:n[1],writable:!0,enumerable:!0,configurable:!0}))}),t}function Pt(t){let e=["/etc/os-release","/usr/lib/os-release"];return t?Array(t):e}function A(){return{type:R.type(),platform:R.platform(),hostname:R.hostname(),arch:R.arch(),release:R.release()}}});var Vt={};j(Vt,{IdsToolbox:()=>re,inputs:()=>Z,platform:()=>B});module.exports=Qe(Vt);var se="1.0.0";var Ue=v(require("@actions/core"),1),D=v(be(),1),Ne=v(Ie(),1),J=v(require("os"),1),xt=async()=>{let{stdout:t}=await D.getExecOutput('powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Version"',void 0,{silent:!0}),{stdout:e}=await D.getExecOutput('powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Caption"',void 0,{silent:!0});return{name:e.trim(),version:t.trim()}},Tt=async()=>{let{stdout:t}=await D.getExecOutput("sw_vers",void 0,{silent:!0}),e=t.match(/ProductVersion:\s*(.+)/)?.[1]??"";return{name:t.match(/ProductName:\s*(.+)/)?.[1]??"",version:e}};function Pe(t,e,i){for(let r of e){let n=Ut(t,r,i);if(n!==i)return n}return i}function Ut(t,e,i){if(!t.hasOwnProperty(e))return i;let r=t[e];return typeof r!=typeof i?i:r}var Nt=async()=>{let t={};try{t=(0,Ne.releaseInfo)({mode:"sync"}),console.log(t)}catch(e){Ue.debug(`Error collecting release info: ${e}`)}return{name:Pe(t,["id","name","pretty_name","id_like"],"unknown"),version:Pe(t,["version_id","version","version_codename"],"unknown")}},$=J.default.platform(),At=J.default.arch(),xe=$==="win32",Te=$==="darwin",Dt=$==="linux";async function Ae(){return{...await(xe?xt():Te?Tt():Nt()),platform:$,arch:At,isWindows:xe,isMacOS:Te,isLinux:Dt}}var H=v(require("@actions/core"),1),De=require("crypto");function $e(t){let e={correlation_source:"github-actions",repository:C("GHR",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID"]),workflow:C("GHW",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID","GITHUB_WORKFLOW"]),job:C("GHWJ",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID","GITHUB_WORKFLOW","GITHUB_JOB"]),run:C("GHWJR",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID","GITHUB_WORKFLOW","GITHUB_JOB","GITHUB_RUN_ID"]),run_differentiator:C("GHWJA",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID","GITHUB_WORKFLOW","GITHUB_JOB","GITHUB_RUN_ID","GITHUB_RUN_NUMBER","GITHUB_RUN_ATTEMPT"]),groups:{ci:"github-actions",project:t,github_organization:C("GHO",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID"])}};return H.debug("Correlation data:"),H.debug(JSON.stringify(e,null,2)),e}function C(t,e){let i=(0,De.createHash)("sha256");for(let r of e){let n=process.env[r];if(n===void 0){H.debug(`Environment variable not set: ${r} -- can't generate the requested identity`);return}else i.update(n),i.update("\0")}return`${t}-${i.digest("hex")}`}var B={};j(B,{getArchOs:()=>Q,getNixPlatform:()=>z});var X=v(require("@actions/core"),1);function Q(){let t=process.env.RUNNER_ARCH,e=process.env.RUNNER_OS;if(t&&e)return`${t}-${e}`;throw X.error(`Can't identify the platform: RUNNER_ARCH or RUNNER_OS undefined (${t}-${e})`),new Error("RUNNER_ARCH and/or RUNNER_OS is not defined")}function z(t){let i=new Map([["X64-macOS","x86_64-darwin"],["ARM64-macOS","aarch64-darwin"],["X64-Linux","x86_64-linux"],["ARM64-Linux","aarch64-linux"]]).get(t);if(i)return i;throw X.error(`ArchOs (${t}) doesn't map to a supported Nix platform.`),new Error(`Cannot convert ArchOs (${t}) to a supported Nix platform.`)}var Z={};j(Z,{getBool:()=>Bt,getMultilineStringOrNull:()=>Gt,getNumberOrNull:()=>Wt,getString:()=>Ft,getStringOrNull:()=>Lt,getStringOrUndefined:()=>G});var S=v(require("@actions/core"),1),Bt=t=>S.getBooleanInput(t),Gt=t=>{let e=S.getMultilineInput(t);return e.length===0?null:e},Wt=t=>{let e=S.getInput(t);return e===""?null:Number(e)},Ft=t=>S.getInput(t),Lt=t=>{let e=S.getInput(t);return e===""?null:e},G=t=>{let e=S.getInput(t);if(e!=="")return e};var ee=v(require("@actions/core"),1);function He(t){let e=i=>{let r=G(`source-${i}`);if(!t)return r;let n=G(`${t}-${i}`);return r&&n?(ee.warning(`The supported option source-${i} and the legacy option ${t}-${i} are both set. Preferring source-${i}. Please stop setting ${t}-${i}.`),r):n?(ee.warning(`The legacy option ${t}-${i} is set. Please migrate to source-${i}.`),n):r};return{path:e("path"),url:e("url"),tag:e("tag"),pr:e("pr"),branch:e("branch"),revision:e("revision")}}var L=v(require("@actions/cache"),1),d=v(require("@actions/core"),1),We=v(require("got"),1),W=require("crypto"),Fe=require("fs"),O=v(require("fs/promises"),1),Le=require("os"),te=v(require("path"),1),je=require("stream/promises"),ie="https://install.determinate.systems",F=process.env.IDS_HOST??ie,jt="exception",Be="artifact_cache_hit",Mt="artifact_cache_miss",Ge="ended_with_exception",qt="final_exception",re=class{constructor(e){this.actionOptions=kt(e),this.hookMain=void 0,this.hookPost=void 0,this.events=[],this.client=We.default.extend({retry:{limit:3,methods:["GET","HEAD"]},hooks:{beforeRetry:[(r,n)=>{d.info(`Retrying after error ${r.code}, retry #: ${n}`)}]}}),this.facts={$lib:"idslib",$lib_version:se,project:this.actionOptions.name,ids_project:this.actionOptions.idsProjectName};let i=[["github_action_ref","GITHUB_ACTION_REF"],["github_action_repository","GITHUB_ACTION_REPOSITORY"],["github_event_name","GITHUB_EVENT_NAME"],["$os","RUNNER_OS"],["arch","RUNNER_ARCH"]];for(let[r,n]of i){let s=process.env[n];s&&(this.facts[r]=s)}if(this.identity=$e(this.actionOptions.name),this.archOs=Q(),this.nixSystem=z(this.archOs),this.facts.arch_os=this.archOs,this.facts.nix_system=this.nixSystem,Ae().then(r=>{r.name!=="unknown"&&this.addFact("$os",r.name),r.version!=="unknown"&&this.addFact("$os_version",r.version)}).catch(r=>{d.debug(`Failure getting platform details: ${r}`)}),d.getState("idstoolbox_execution_phase")===""?(d.saveState("idstoolbox_execution_phase","post"),this.executionPhase="main"):this.executionPhase="post",this.facts.execution_phase=this.executionPhase,this.actionOptions.fetchStyle==="gh-env-style")this.architectureFetchSuffix=this.archOs;else if(this.actionOptions.fetchStyle==="nix-style")this.architectureFetchSuffix=this.nixSystem;else if(this.actionOptions.fetchStyle==="universal")this.architectureFetchSuffix="universal";else throw new Error(`fetchStyle ${this.actionOptions.fetchStyle} is not a valid style`);this.sourceParameters=He(this.actionOptions.legacySourcePrefix),this.recordEvent(`begin_${this.executionPhase}`)}onMain(e){this.hookMain=e}onPost(e){this.hookPost=e}execute(){this.executeAsync().catch(e=>{console.log(e),process.exitCode=1})}async executeAsync(){try{if(process.env.DETSYS_CORRELATION=JSON.stringify(this.getCorrelationHashes()),!await this.preflightRequireNix()){this.recordEvent("preflight-require-nix-denied");return}this.executionPhase==="main"&&this.hookMain?await this.hookMain():this.executionPhase==="post"&&this.hookPost&&await this.hookPost(),this.addFact(Ge,!1)}catch(e){this.addFact(Ge,!0);let i=e instanceof Error||typeof e=="string"?e.toString():JSON.stringify(e);this.addFact(qt,i),this.executionPhase==="post"?d.warning(i):d.setFailed(i),this.recordEvent(jt)}finally{await this.complete()}}addFact(e,i){this.facts[e]=i}getDiagnosticsUrl(){return this.actionOptions.diagnosticsUrl}getUniqueId(){return this.identity.run_differentiator||process.env.RUNNER_TRACKING_ID||(0,W.randomUUID)()}getCorrelationHashes(){return this.identity}recordEvent(e,i={}){this.events.push({event_name:`${this.actionOptions.eventPrefix}${e}`,context:i,correlation:this.identity,facts:this.facts,timestamp:new Date,uuid:(0,W.randomUUID)()})}async fetch(){d.info(`Fetching from ${this.getUrl()}`);let e=this.getUrl();e.searchParams.set("ci","github"),e.searchParams.set("correlation",JSON.stringify(this.identity));let i=await this.client.head(e);if(i.headers.etag){let s=i.headers.etag;d.debug(`Checking the tool cache for ${this.getUrl()} at ${s}`);let o=await this.getCachedVersion(s);if(o)return this.facts.artifact_fetched_from_cache=!0,d.debug("Tool cache hit."),o}this.facts.artifact_fetched_from_cache=!1,d.debug(`No match from the cache, re-fetching from the redirect: ${i.url}`);let r=this.getTemporaryName(),n=this.client.stream(i.url);if(await(0,je.pipeline)(n,(0,Fe.createWriteStream)(r,{encoding:"binary",mode:493})),n.response?.headers.etag){let s=n.response.headers.etag;try{await this.saveCachedVersion(s,r)}catch(o){d.debug(`Error caching the artifact: ${o}`)}}return r}async fetchExecutable(){let e=await this.fetch();return await(0,O.chmod)(e,O.default.constants.S_IXUSR|O.default.constants.S_IXGRP),e}async complete(){this.recordEvent(`complete_${this.executionPhase}`),await this.submitEvents()}getUrl(){let e=this.sourceParameters;if(e.url)return new URL(e.url);let i=new URL(F);return i.pathname+=this.actionOptions.idsProjectName,e.tag?i.pathname+=`/tag/${e.tag}`:e.pr?i.pathname+=`/pr/${e.pr}`:e.branch?i.pathname+=`/branch/${e.branch}`:e.revision?i.pathname+=`/rev/${e.revision}`:i.pathname+="/stable",i.pathname+=`/${this.architectureFetchSuffix}`,i}cacheKey(e){let i=e.replace(/[^a-zA-Z0-9-+.]/g,"");return`determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${i}`}async getCachedVersion(e){let i=process.cwd();try{let r=this.getTemporaryName();if(await(0,O.mkdir)(r),process.chdir(r),process.env.GITHUB_WORKSPACE_BACKUP=process.env.GITHUB_WORKSPACE,delete process.env.GITHUB_WORKSPACE,await L.restoreCache([this.actionOptions.name],this.cacheKey(e),[],void 0,!0))return this.recordEvent(Be),`${r}/${this.actionOptions.name}`;this.recordEvent(Mt);return}finally{process.env.GITHUB_WORKSPACE=process.env.GITHUB_WORKSPACE_BACKUP,delete process.env.GITHUB_WORKSPACE_BACKUP,process.chdir(i)}}async saveCachedVersion(e,i){let r=process.cwd();try{let n=this.getTemporaryName();await(0,O.mkdir)(n),process.chdir(n),await(0,O.copyFile)(i,`${n}/${this.actionOptions.name}`),process.env.GITHUB_WORKSPACE_BACKUP=process.env.GITHUB_WORKSPACE,delete process.env.GITHUB_WORKSPACE,await L.saveCache([this.actionOptions.name],this.cacheKey(e),void 0,!0),this.recordEvent(Be)}finally{process.env.GITHUB_WORKSPACE=process.env.GITHUB_WORKSPACE_BACKUP,delete process.env.GITHUB_WORKSPACE_BACKUP,process.chdir(r)}}async preflightRequireNix(){let e,i=(process.env.PATH||"").split(":");for(let n of i){let s=te.join(n,"nix");try{await O.default.access(s,O.default.constants.X_OK),d.debug(`Found Nix at ${s}`),e=s}catch{d.debug(`Nix not at ${s}`)}}if(this.addFact("nix_location",e||""),this.actionOptions.requireNix==="ignore")return!0;if(d.getState("idstoolbox_nix_not_found")==="not-found")return!1;if(e!==void 0)return!0;switch(d.saveState("idstoolbox_nix_not_found","not-found"),this.actionOptions.requireNix){case"fail":d.setFailed("This action can only be used when Nix is installed. Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow.");break;case"warn":d.warning("This action is in no-op mode because Nix is not installed. Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow.");break}return!1}async submitEvents(){if(!this.actionOptions.diagnosticsUrl){d.debug("Diagnostics are disabled. Not sending the following events:"),d.debug(JSON.stringify(this.events,void 0,2));return}let e={type:"eventlog",sent_at:new Date,events:this.events};try{await this.client.post(this.actionOptions.diagnosticsUrl,{json:e})}catch(i){d.debug(`Error submitting diagnostics event: ${i}`)}this.events=[]}getTemporaryName(){let e=process.env.RUNNER_TEMP||(0,Le.tmpdir)();return te.join(e,`${this.actionOptions.name}-${(0,W.randomUUID)()}`)}};function kt(t){let e=t.idsProjectName??t.name,i={name:t.name,idsProjectName:e,eventPrefix:t.eventPrefix||"action:",fetchStyle:t.fetchStyle,legacySourcePrefix:t.legacySourcePrefix,requireNix:t.requireNix,diagnosticsUrl:Kt(e,t.diagnosticsUrl)};return d.debug("idslib options:"),d.debug(JSON.stringify(i,void 0,2)),i}function Kt(t,e){if(e!==null){if(e!==void 0)return e;{let i=process.env["INPUT_DIAGNOSTIC-ENDPOINT"];if(i==="")return;if(i!==void 0)try{return Yt(new URL(i))}catch(r){d.info(`User-provided diagnostic endpoint ignored: not a valid URL: ${r}`)}}try{let i=new URL(F);return i.pathname+=t,i.pathname+="/diagnostics",i}catch(i){d.info(`Generated diagnostic endpoint ignored: not a valid URL: ${i}`)}}}function Yt(t){if(ie===F)return t;try{let e=new URL(ie),i=new URL(F);return t.origin!==e.origin||(t.protocol=i.protocol,t.host=i.host,t.username=i.username,t.password=i.password),t}catch(e){d.info(`Default or overridden IDS host isn't a valid URL: ${e}`)}return t}0&&(module.exports={IdsToolbox,inputs,platform});
/*! Bundled license information:

linux-release-info/dist/index.js:
  (*!
   * linux-release-info
   * Get Linux release info (distribution name, version, arch, release, etc.)
   * from '/etc/os-release' or '/usr/lib/os-release' files and from native os
   * module. On Windows and Darwin platforms it only returns common node os module
   * info (platform, hostname, release, and arch)
   *
   * Licensed under MIT
   * Copyright (c) 2018-2020 [Samuel Carreira]
   *)
*/