import{r as l,f,a as u,j as e,R as x,D as h,d as p}from"./index-1HQcghmU.js";import{F as b}from"./file-exclamation-point-D7JJlRSN.js";function v({path:t}){const[o,a]=l.useState("loading"),[s,n]=l.useState(""),[i,c]=l.useState("");return l.useEffect(()=>{a("loading"),c(""),f().then(r=>r.available?u(t):(a("unavailable"),null)).then(r=>{if(!r)return;const m=w(r.editor_url,r.access_token,r.access_token_ttl);c(m),a("ready")}).catch(r=>{n(r.message||"Failed to load editor"),a("error")})},[t]),o==="unavailable"?e.jsx(d,{path:t,reason:"Collabora Online is not available"}):o==="error"?e.jsx(d,{path:t,reason:s||"Failed to load editor"}):o==="loading"||!i?e.jsxs("div",{className:"flex items-center justify-center gap-2 p-10 text-muted-foreground",style:{flex:1},children:[e.jsx(x,{size:16,className:"animate-spin"}),e.jsx("span",{className:"text-sm",children:"Loading Office editor..."})]}):e.jsx("iframe",{srcDoc:i,title:"Office Editor",style:{flex:1,width:"100%",height:"100%",border:"none",display:"block"},allowFullScreen:!0,allow:"clipboard-read; clipboard-write"})}let g=0;function w(t,o,a){const s=`cool_frame_${++g}_${Date.now()}`,n=t.startsWith("/")?`${location.origin}${t}`:t;return`<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  iframe { width: 100%; height: 100%; border: none; }
</style></head><body>
<iframe name="${s}" allowfullscreen
  allow="clipboard-read; clipboard-write"></iframe>
<form id="f" target="${s}" action="${n}" method="post">
  <input name="access_token" value="${o}" type="hidden"/>
  <input name="access_token_ttl" value="${a}" type="hidden"/>
</form>
<script>document.getElementById('f').submit();<\/script>
</body></html>`}function d({path:t,reason:o}){const a=t.split("/").pop()||"file";return e.jsxs("div",{className:"flex flex-col items-center gap-3 p-8 text-muted-foreground",children:[e.jsx(b,{size:40,className:"opacity-50"}),e.jsx("span",{className:"text-sm font-medium text-foreground",children:a}),e.jsx("span",{className:"text-xs text-center max-w-xs",children:o}),e.jsx("div",{className:"flex gap-2 mt-2",children:e.jsxs("a",{href:p(t),className:"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors",download:!0,children:[e.jsx(h,{size:13})," Download"]})})]})}export{v as default};
