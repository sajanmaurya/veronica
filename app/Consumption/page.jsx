"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
const fields=[["calories","Calories","kcal"],["protein_g","Protein","g"],["total_sugar_g","Sugar","g"],["sodium_mg","Sodium","mg"]];
export default function ConsumptionPage(){
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [busy,setBusy]=useState("");
  async function load(){
    try{const r=await fetch("/api/consumption",{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Cannot load food log");setItems(data.items||[]);setError("")}
    catch(err){setError(err.message)}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  const today=useMemo(()=>items.filter(item=>new Date(item.consumedAt).toDateString()===new Date().toDateString()),[items]);
  const totals=useMemo(()=>Object.fromEntries(fields.map(([key])=>[key,today.reduce((sum,item)=>sum+(typeof item.nutrition?.[key]==="number"?item.nutrition[key]:0),0)])),[today]);
  const missing=useMemo(()=>fields.some(([key])=>today.some(item=>item.nutrition?.[key]==null)),[today]);
  async function remove(id){
    if(!window.confirm("Remove this consumption entry?"))return;
    setBusy(id);
    try{const r=await fetch("/api/consumption?id="+encodeURIComponent(id),{method:"DELETE"});if(!r.ok)throw Error("Delete failed");setItems(s=>s.filter(x=>x.id!==id))}
    catch(err){setError(err.message)}finally{setBusy("")}
  }
  return <main className="app-canvas min-h-screen px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="glass-panel space-y-2 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Manually recorded portions</p>
        <h1 className="text-3xl font-semibold text-slate-900">My food log</h1>
        <p className="text-sm text-slate-600">Only products you explicitly mark as eaten appear here. Values are estimates from packaging, not medical measurements.</p>
        <Link href="/dashboard/BarcodeScanning" className="inline-flex rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">Scan food to add a meal</Link>
      </section>
      {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      <section className="glass-panel space-y-4 p-5">
        <div><h2 className="text-xl font-bold text-slate-900">Today's recorded intake</h2><p className="text-xs text-slate-500">{today.length} entries{missing?" · Some nutrients were unavailable and totals may be incomplete":""}</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fields.map(([key,label,unit])=><div key={key} className="rounded-2xl border border-white/75 bg-white/75 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{Math.round(totals[key]*10)/10} <span className="text-xs">{unit}</span></p></div>)}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Recent meals</h2>
        {loading?<p className="text-sm">Loading food log...</p>:items.length===0?<p className="glass-panel p-5 text-sm text-slate-600">No food consumption recorded yet.</p>:
        items.map(item=><article key={item.id} className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-base font-semibold text-slate-900">{item.productName}</p><p className="text-xs text-slate-600">{item.portion} {item.unit} · {new Date(item.consumedAt).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{item.nutrition?.calories==null?"Calories unknown":`${item.nutrition.calories} kcal`}</p></div>
          <button type="button" disabled={busy===item.id} onClick={()=>remove(item.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{busy===item.id?"Removing...":"Remove"}</button>
        </article>)}
      </section>
    </div>
  </main>;
}
