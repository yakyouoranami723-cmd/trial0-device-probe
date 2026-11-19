/* Trial Zero v0.8.2 isolated Service Worker.
 * Intentionally restricted to ./trial0-v082-isolated/ by the registration scope.
 * Never intercepts the Trial Zero app, model, or diagnostic HTML outside that scope.
 */
'use strict';
const MARK='TRIAL0-V082-ISOLATED-SW';
const PROBE='probe.html';
const SHELL=`<!doctype html><html lang="ja"><meta charset="utf-8"><title>Trial Zero SW Probe</title><body><div id="probe">T0-SW-OK</div></body></html>`;
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting());});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('message',e=>{
 if(e.data?.type!=='trial0-v082-ping')return;
 try{e.ports?.[0]?.postMessage({mark:MARK,scope:self.registration.scope,version:'v0.8.2'});}catch{}
});
self.addEventListener('fetch',e=>{
 if(e.request.mode!=='navigate')return;
 const target=new URL(e.request.url);
 const path=new URL(PROBE,self.registration.scope);
 if(target.href!==path.href)return;
 e.respondWith(Promise.resolve(new Response(SHELL,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Trial-Zero-Probe':'v0.8.2'}})));
});
