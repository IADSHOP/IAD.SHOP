import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'};
http.createServer((req,res)=>{try{
 const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(url==='/'?'/index.html':url));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 const size=fs.statSync(file).size;let start=0,end=size-1,status=200;
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
 if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416).end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;if(start>end){res.writeHead(416).end();return;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;}
 res.writeHead(status,{...headers,'Content-Length':end-start+1});if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
 }catch{res.writeHead(400).end();}
}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
