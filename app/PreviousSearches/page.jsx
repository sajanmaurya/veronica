"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
export default function PreviousSearchesPage(){
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [query,setQuery]=useState(""),[period,setPeriod]=useState("all"),[deleting,setDeleting]=useState("");
  async function remove(id){
    if(!window.confirm("Delete this saved scan?"))return;
    setDeleting(id);
    try{const r=await fetch("/api/previousSearches/products?id="+encodeURIComponent(id),{method:"DELETE"});if(!r.ok)throw Error("Cannot delete scan");setItems(list=>list.filter(x=>x.id!==id))}
    catch(e){setError(e.message)}finally{setDeleting("")}
  }
  useEffect(()=>{
    let active=true;
    fetch("/api/previousSearches/products",{cache:"no-store"})
      .then(async r=>{if(!r.ok)throw Error(r.status===401?"Please sign in to see your history.":"History unavailable.");return r.json()})
      .then(data=>{if(active)setItems(Array.isArray(data)?data:[])})
      .catch(err=>{if(active)setError(err.message)})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[]);
  const visible=useMemo(()=>items.filter(item=>{
    if(!String(item.productName||"").toLowerCase().includes(query.toLowerCase().trim()))return false;
    if(period==="all")return true;
    const time=new Date(item.createdAt).getTime();
    return Number.isFinite(time)&&Date.now()-time<Number(period)*86400000;
  }),[items,query,period]);
  return <main className="app-canvas min-h-screen px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="glass-panel space-y-3 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your analyzed products</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Scan history</h1>
        <p className="text-sm text-slate-600">These are products you scanned, not foods you ate. Consumption totals are recorded separately.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/Compare" className="liquid-glass-button rounded-xl px-4 py-2 text-xs font-semibold">Compare two products</Link>
          <Link href="/Consumption" className="rounded-xl border border-slate-300 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-800">View food log</Link>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">Search products
          <input className="glass-input mt-1 w-full" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by product name"/>
        </label>
        <label className="text-xs font-semibold text-slate-700">Time period
          <select className="glass-input mt-1 w-full" value={period} onChange={e=>setPeriod(e.target.value)}>
            <option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
          </select>
        </label>
      </div>
      {loading?<p className="text-sm text-slate-600">Loading history...</p>:error?<p role="alert" className="text-sm text-rose-700">{error}</p>:visible.length===0?<p className="glass-panel p-5 text-sm text-slate-600">No matching scans. Analyze a product first.</p>:
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map(item=>{
          const ai=item.aiData||{};
          return <article key={item.id} className="glass-panel space-y-3 p-4">
            <div className="flex items-start gap-3">
              {item.imageFrontUrl ? <img src={item.imageFrontUrl} alt="" loading="lazy" className="h-16 w-16 rounded-xl bg-white object-contain"/>:<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-xl">🥗</div>}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">{item.productName||"Unknown product"}</h2>
                <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-600">Score: {ai.rating_verified===false||ai.rating==null?"Not verified":`${ai.rating}/10`}</p>
              </div>
            </div>
            <details className="rounded-xl border border-white/80 bg-white/60 p-3 text-sm text-slate-700">
              <summary className="cursor-pointer font-semibold">View analysis details</summary>
              <p className="mt-2 text-xs leading-5">{ai.summary||"No analysis summary available."}</p>
              <p className="mt-2 text-xs">Nutrition source: {ai.nutrition_source||"Unknown"}</p>
              <p className="mt-1 text-xs">Ingredients source: {ai.ingredients_source||"Unknown"}</p>
            </details>
            <button type="button" onClick={()=>remove(item.id)} disabled={deleting===item.id} className="rounded-lg border border-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700">{deleting===item.id?"Removing...":"Delete scan"}</button>
          </article>;
        })}
      </div>}
    </div>
  </main>;
}
