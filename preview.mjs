import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
const args=process.argv.slice(2),value=(name,other)=>args.includes(name)?args[args.indexOf(name)+1]:other;
const port=Number(value('--port','43139')),host=value('--host','127.0.0.1');
const file='dist/index.html';
if(!existsSync(file))throw new Error('Ejecuta npm run build antes de preview.');
http.createServer((req,res)=>{
  if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(file));}
  else if(req.url==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('User-agent: *\nDisallow: /\n');}
  else if(req.url==='/favicon.ico'){res.writeHead(204);res.end();}
  else {res.writeHead(404);res.end('No existe esta página.');}
}).listen(port,host,()=>console.log(`Local: http://${host}:${port}`));
