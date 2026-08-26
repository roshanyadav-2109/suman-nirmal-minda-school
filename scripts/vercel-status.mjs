const TOKEN=process.env.VERCEL_TOKEN, H={Authorization:`Bearer ${TOKEN}`};
const url=process.env.DEPLOY_URL || "suman-nirmal-minda-school.vercel.app";
async function get(p){const r=await fetch(`https://api.vercel.com${p}`,{headers:H});return r.json();}
for(let i=0;i<24;i++){
  const d=await get(`/v13/deployments/${url}`);
  const s=d.readyState||d.status;
  console.log(new Date().toISOString().slice(11,19), s);
  if(s==="READY"){console.log("LIVE:", "https://"+(d.alias?.[0]||url));break;}
  if(s==="ERROR"||s==="CANCELED"){
    console.log("BUILD FAILED. Fetching errors…");
    const ev=await get(`/v3/deployments/${d.id||d.uid}/events?builds=1&limit=100`);
    const lines=(Array.isArray(ev)?ev:ev.events||[]).map(e=>e.text||e.payload?.text).filter(Boolean);
    console.log(lines.slice(-25).join("\n"));
    break;
  }
  await new Promise(r=>setTimeout(r,8000));
}
