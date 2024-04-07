"use strict";var x=Object.create;var u=Object.defineProperty;var A=Object.getOwnPropertyDescriptor;var B=Object.getOwnPropertyNames;var w=Object.getPrototypeOf,D=Object.prototype.hasOwnProperty;var W=(i,e)=>{for(var t in e)u(i,t,{get:e[t],enumerable:!0})},y=(i,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of B(e))!D.call(i,n)&&n!==t&&u(i,n,{get:()=>e[n],enumerable:!(r=A(e,n))||r.enumerable});return i};var a=(i,e,t)=>(t=i!=null?x(w(i)):{},y(e||!i||!i.__esModule?u(t,"default",{value:i,enumerable:!0}):t,i)),L=i=>y(u({},"__esModule",{value:!0}),i);var M={};W(M,{IdsToolbox:()=>v});module.exports=L(M);var g=a(require("@actions/core"),1),S=require("crypto");function E(i){let e={correlation_source:"github-actions",repository:h("GHR",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID"]),workflow:h("GHW",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID","GITHUB_WORKFLOW"]),run:h("GHWR",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID","GITHUB_RUN_ID"]),run_differentiator:h("GHWA",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID","GITHUB_REPOSITORY","GITHUB_REPOSITORY_ID","GITHUB_RUN_ID","GITHUB_RUN_NUMBER","GITHUB_RUN_ATTEMPT"]),groups:{ci:"github-actions",project:i,github_organization:h("GHO",["GITHUB_SERVER_URL","GITHUB_REPOSITORY_OWNER","GITHUB_REPOSITORY_OWNER_ID"])}};return g.debug("Correlation data:"),g.debug(JSON.stringify(e,null,2)),e}function h(i,e){let t=(0,S.createHash)("sha256");for(let r of e){let n=process.env[r];if(n===void 0){g.debug(`Environment variable not set: ${r} -- can't generate the requested identity`);return}else t.update(n),t.update("\0")}return`${i}-${t.digest("hex")}`}var U={name:"detsys-ts",version:"1.0.0",description:"TypeScript goodies for DetSys projects",main:"./lib/main.js",types:"./lib/main.d.ts",type:"module",scripts:{build:"tsc",format:"prettier --write .",lint:"eslint src/**/*.ts",prebuild:"cp package.json ./src/package.json",package:"ncc build --license licenses.txt",all:"npm run build && npm run format && npm run lint && npm run package"},repository:{type:"git",url:"git+https://github.com/DeterminateSystems/detsys-ts.git"},keywords:[],author:"",license:"ISC",bugs:{url:"https://github.com/DeterminateSystems/detsys-ts/issues"},homepage:"https://github.com/DeterminateSystems/detsys-ts#readme",dependencies:{"@actions/cache":"^3.2.4","@actions/core":"^1.10.0","@actions/exec":"^1.1.1","@actions/github":"^5.1.1","fetch-retry":"^5.0.6",got:"^14.2.1","string-argv":"^0.3.2",uuid:"^9.0.1"},devDependencies:{"@trivago/prettier-plugin-sort-imports":"^4.3.0","@types/node":"^18.19.30","@types/uuid":"^9.0.8","@typescript-eslint/eslint-plugin":"^7.2.0","@vercel/ncc":"^0.36.1",eslint:"^8.57.0","eslint-import-resolver-typescript":"^3.6.1","eslint-plugin-github":"^4.3.6","eslint-plugin-import":"^2.29.1","eslint-plugin-prettier":"^5.0.0-alpha.1",prettier:"^3.0.0",typescript:"^5.1.6"}};var l=a(require("@actions/core"),1);function I(){let i=process.env.RUNNER_ARCH,e=process.env.RUNNER_OS;if(i&&e)return`${i}-${e}`;throw l.error(`Can't identify the platform: RUNNER_ARCH or RUNNER_OS undefined (${i}-${e})`),new Error("RUNNER_ARCH and/or RUNNER_OS is not defined")}function T(i){let t=new Map([["X64-macOS","x86_64-darwin"],["ARM64-macOS","aarch64-darwin"],["X64-Linux","x86_64-linux"],["ARM64-Linux","aarch64-linux"]]).get(i);if(t)return t;throw l.error(`ArchOs (${i}) doesn't map to a supported Nix platform.`),new Error(`Cannot convert ArchOs (${i}) to a supported Nix platform.`)}var p=a(require("@actions/core"),1);function P(i){let e=t=>{let r=C(`source-${t}`);if(!i)return r;let n=C(`${i}-${t}`);return r&&n?(p.warning(`The supported option source-${t} and the legacy option ${i}-${t} are both set. Preferring source-${t}. Please stop setting ${i}-${t}.`),r):n?(p.warning(`The legacy option ${i}-${t} is set. Please migrate to source-${t}.`),n):r};return{path:e("path"),url:e("url"),tag:e("tag"),pr:e("pr"),branch:e("branch"),revision:e("revision")}}function C(i){let e=p.getInput(i);if(e!=="")return e}var m=a(require("@actions/cache"),1),s=a(require("@actions/core"),1),O=a(require("got"),1),H=require("fs"),o=a(require("fs/promises"),1),N=require("os"),b=a(require("path"),1),G=require("stream/promises"),$=require("uuid"),R="https://install.determinate.systems",f=process.env.IDS_HOST??R,_=O.default.extend({retry:{limit:3,methods:["GET","HEAD"]},hooks:{beforeRetry:[(i,e)=>{s.info(`Retrying after error ${i.code}, retry #: ${e}`)}]}}),v=class{constructor(e){this.actionOptions=j(e),this.events=[],this.client=O.default.extend({retry:{limit:3,methods:["GET","HEAD"]},hooks:{beforeRetry:[(r,n)=>{s.info(`Retrying after error ${r.code}, retry #: ${n}`)}]}}),this.facts={$lib:"idslib",$lib_version:U.version,project:this.actionOptions.name,ids_project:this.actionOptions.idsProjectName};let t=[["github_action_ref","GITHUB_ACTION_REF"],["github_action_repository","GITHUB_ACTION_REPOSITORY"],["github_event_name","GITHUB_EVENT_NAME"],["$os","RUNNER_OS"],["arch","RUNNER_ARCH"]];for(let[r,n]of t){let c=process.env[n];c&&(this.facts[r]=c)}if(this.identity=E(this.actionOptions.name),this.archOs=I(),this.nixSystem=T(this.archOs),this.facts.arch_os=this.archOs,this.facts.nix_system=this.nixSystem,s.getState("idstoolbox_execution_phase")===""?(s.saveState("idstoolbox_execution_phase","post"),this.executionPhase="main"):this.executionPhase="post",this.facts.execution_phase=this.executionPhase,this.actionOptions.fetchStyle==="gh-env-style")this.architectureFetchSuffix=this.archOs;else if(this.actionOptions.fetchStyle==="nix-style")this.architectureFetchSuffix=this.nixSystem;else if(this.actionOptions.fetchStyle==="universal")this.architectureFetchSuffix="universal";else throw new Error(`fetchStyle ${this.actionOptions.fetchStyle} is not a valid style`);this.sourceParameters=P(this.actionOptions.legacySourcePrefix),this.recordEvent(`begin_${this.executionPhase}`)}recordEvent(e,t={}){this.events.push({event_name:`${this.actionOptions.eventPrefix}${e}`,context:t,correlation:this.identity,facts:this.facts,timestamp:new Date})}async fetch(){s.info(`Fetching from ${this.getUrl()}`);let e=this.getUrl();e.searchParams.set("ci","github"),e.searchParams.set("correlation",JSON.stringify(this.identity));let t=await _.head(e);if(t.headers.etag){let c=t.headers.etag;s.debug(`Checking the tool cache for ${this.getUrl()} at ${c}`);let d=await this.getCachedVersion(c);if(d)return this.facts.artifact_fetched_from_cache=!0,s.debug("Tool cache hit."),d}this.facts.artifact_fetched_from_cache=!1,s.debug(`No match from the cache, re-fetching from the redirect: ${t.url}`);let r=this.getTemporaryName(),n=_.stream(t.url);if(await(0,G.pipeline)(n,(0,H.createWriteStream)(r,{encoding:"binary",mode:493})),n.response?.headers.etag){let c=n.response.headers.etag;try{await this.saveCachedVersion(c,r)}catch(d){s.debug(`Error caching the artifact: ${d}`)}}return r}async fetchExecutable(){let e=await this.fetch();return await(0,o.chmod)(e,o.default.constants.S_IXUSR|o.default.constants.S_IXGRP),e}async complete(){this.recordEvent(`complete_${this.executionPhase}`),await this.submitEvents()}getUrl(){let e=this.sourceParameters;if(e.url)return new URL(e.url);let t=new URL(f);return t.pathname+=this.actionOptions.idsProjectName,e.tag?t.pathname+=`/tag/${e.tag}`:e.pr?t.pathname+=`/pr/${e.pr}`:e.branch?t.pathname+=`/branch/${e.branch}`:e.revision?t.pathname+=`/rev/${e.revision}`:t.pathname+="/stable",t.pathname+=`/${this.architectureFetchSuffix}`,t}cacheKey(e){let t=e.replace(/[^a-zA-Z0-9-+.]/g,"");return`determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${t}`}async getCachedVersion(e){let t=process.cwd();try{let r=this.getTemporaryName();if(await(0,o.mkdir)(r),process.chdir(r),process.env.GITHUB_WORKSPACE_BACKUP=process.env.GITHUB_WORKSPACE,delete process.env.GITHUB_WORKSPACE,await m.restoreCache([this.actionOptions.name],this.cacheKey(e),[],void 0,!0))return this.recordEvent("artifact_cache_hit"),`${r}/${this.actionOptions.name}`;this.recordEvent("artifact_cache_miss");return}finally{process.env.GITHUB_WORKSPACE=process.env.GITHUB_WORKSPACE_BACKUP,delete process.env.GITHUB_WORKSPACE_BACKUP,process.chdir(t)}}async saveCachedVersion(e,t){let r=process.cwd();try{let n=this.getTemporaryName();await(0,o.mkdir)(n),process.chdir(n),await(0,o.copyFile)(t,`${n}/${this.actionOptions.name}`),process.env.GITHUB_WORKSPACE_BACKUP=process.env.GITHUB_WORKSPACE,delete process.env.GITHUB_WORKSPACE,await m.saveCache([this.actionOptions.name],this.cacheKey(e),void 0,!0),this.recordEvent("artifact_cache_hit")}finally{process.env.GITHUB_WORKSPACE=process.env.GITHUB_WORKSPACE_BACKUP,delete process.env.GITHUB_WORKSPACE_BACKUP,process.chdir(r)}}async submitEvents(){if(!this.actionOptions.diagnosticsUrl){s.debug("Diagnostics are disabled. Not sending the following events:"),s.debug(JSON.stringify(this.events,void 0,2));return}let e={type:"eventlog",sent_at:new Date,events:this.events};try{await _.post(this.actionOptions.diagnosticsUrl,{json:e})}catch(t){s.debug(`Error submitting diagnostics event: ${t}`)}this.events=[]}getTemporaryName(){let e=process.env.RUNNER_TEMP||(0,N.tmpdir)();return b.join(e,`${this.actionOptions.name}-${(0,$.v4)()}`)}};function j(i){let e=i.idsProjectName??i.name,t={name:i.name,idsProjectName:e,eventPrefix:i.eventPrefix||"action:",fetchStyle:i.fetchStyle,legacySourcePrefix:i.legacySourcePrefix,diagnosticsUrl:F(e,i.diagnosticsUrl)};return s.debug("idslib options:"),s.debug(JSON.stringify(t,void 0,2)),t}function F(i,e){if(e!==null){if(e!==void 0)return e;{let t=process.env["INPUT_DIAGNOSTIC-ENDPOINT"];if(t==="")return;if(t!==void 0)try{return V(new URL(t))}catch(r){s.info(`User-provided diagnostic endpoint ignored: not a valid URL: ${r}`)}}try{let t=new URL(f);return t.pathname+=i,t.pathname+="/diagnostics",t}catch(t){s.info(`Generated diagnostic endpoint ignored: not a valid URL: ${t}`)}}}function V(i){if(R===f)return i;try{let e=new URL(R),t=new URL(f);return i.origin!==e.origin||(i.protocol=t.protocol,i.host=t.host,i.username=t.username,i.password=t.password),i}catch(e){s.info(`Default or overridden IDS host isn't a valid URL: ${e}`)}return i}0&&(module.exports={IdsToolbox});
//# sourceMappingURL=main.cjs.map