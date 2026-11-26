// Apex Technologies gallery API — Cloudflare Worker with R2 binding MEDIA
// Configure Cloudflare Access to protect /admin* and /api/admin* on this Worker.
// Set an R2 bucket binding named MEDIA and a public Worker route for /media/* and /api/gallery.
const CATALOG = "gallery/catalog.json";
function admin(req){ return !!req.headers.get("Cf-Access-Jwt-Assertion"); }
async function catalog(env){const obj=await env.MEDIA.get(CATALOG); if(!obj)return [];try{return await obj.json()}catch{return []}}
async function save(env,items){await env.MEDIA.put(CATALOG,JSON.stringify(items,null,2),{httpMetadata:{contentType:"application/json"}})}
export default {async fetch(req,env){
 const url=new URL(req.url), path=url.pathname;
 if(path==="/api/gallery"&&req.method==="GET"){return new Response(JSON.stringify(await catalog(env)),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}})}
 if(path.startsWith("/media/")&&req.method==="GET"){const key=decodeURIComponent(path.slice(7));const obj=await env.MEDIA.get(key);if(!obj)return new Response("Not found",{status:404});const h=new Headers();obj.writeHttpMetadata(h);h.set("Cache-Control","public, max-age=3600");return new Response(obj.body,{headers:h})}
 if(path==="/api/admin/upload"&&req.method==="POST"){if(!admin(req))return new Response("Unauthorized",{status:401});const form=await req.formData(),file=form.get("file");if(!(file instanceof File))return new Response("Missing file",{status:400});if(file.size>200*1024*1024)return new Response("File exceeds 200 MB limit",{status:413});const category=String(form.get("category")||"photo"),title=String(form.get("title")||file.name),description=String(form.get("description")||"");const id=crypto.randomUUID(),ext=file.name.includes(".")?file.name.split(".").pop():"bin",key="uploads/"+id+"."+ext;await env.MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"}});const items=await catalog(env);items.unshift({id,key,title,description,category,type:file.type.startsWith("video/")?"video":"photo",created:new Date().toISOString()});await save(env,items);return Response.json({ok:true,item:items[0]})}
 if(path==="/api/admin/delete"&&req.method==="POST"){if(!admin(req))return new Response("Unauthorized",{status:401});const {id}=await req.json();const items=await catalog(env),item=items.find(x=>x.id===id);if(!item)return new Response("Not found",{status:404});await env.MEDIA.delete(item.key);await save(env,items.filter(x=>x.id!==id));return Response.json({ok:true})}
 if(path==="/api/admin/catalog"&&req.method==="GET"){if(!admin(req))return new Response("Unauthorized",{status:401});return Response.json(await catalog(env))}
 return new Response("Apex Gallery API",{status:200});
}};
