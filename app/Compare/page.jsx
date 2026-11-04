"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {normalizePer100} from "@/lib/foodMath.mjs";
const fields=[["calories","Calories","kcal",false],["total_sugar_g","Sugar","g",false],["saturated_fat_g","Saturated fat","g",false],["sodium_mg","Sodium","mg",false],["fiber_g","Fiber","g",true],["protein_g","Protein","g",true]];
export default function ComparePage(){
  const [items,setItems]=useState([]),[left,setLeft]=useState(""),[right,setRight]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    fetch("/api/previousSearches/products",{cache:"no-store"})
      .then(async r=>{if(!r.ok)throw Error("Sign in to compare your saved scans");return r.json()})
      .then(rows=>{if(!active)return;const unique=(Array.isArray(rows)?rows:[]).filter(r=>r.aiData?.nutrition).slice(0,100);setItems(unique);setLeft(unique[0]?.id||"");setRight(unique[1]?.id||"")})
      .catch(e=>{if(active)setError(e.message)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);
  const a=useMemo(()=>items.find(v=>v.id===left),[items,left]),b=useMemo(()=>items.find(v=>v.id===right),[items,right]);
  const leftValues=normalizePer100(a?.aiData?.nutrition),rightValues=normalizePer100(b?.aiData?.nutrition);
  const comparable=a&&b&&a.id!==b.id&&leftValues&&rightValues&&leftValues.basis===rightValues.basis;
  return <main className="app-canvas min-h-screen px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="glass-panel space-y-3 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Evidence-first choices</p>
        <h1 className="text-3xl font-semibold text-slate-900">Compare food products</h1>
        <p className="text-sm text-slate-600">Choose two saved scans. Values are normalized to a common 100 g or 100 ml basis. Missing values are never treated as zero.</p>
        <Link href="/dashboard/BarcodeScanning" className="inline-flex rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">Scan another product</Link>
      </div>
      {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
      {loading?<p className="text-sm text-slate-500">Loading saved products...</p>:items.length<2?<p className="glass-panel p-5 text-sm text-slate-700">Scan at least two different products to compare them.</p>:
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          {[[left,setLeft,"First product"],[right,setRight,"Second product"]].map(([value,change,label])=><label key={label} className="glass-panel p-4 text-xs font-bold text-slate-700">{label}
            <select className="glass-input mt-2 w-full" value={value} onChange={e=>change(e.target.value)}>{items.map(x=><option key={x.id} value={x.id}>{x.productName||"Unknown product"} · {new Date(x.createdAt).toLocaleDateString()}</option>)}</select>
          </label>)}
        </div>
        {!comparable?<p className="glass-panel p-5 text-sm text-amber-800">These products cannot be compared reliably. Choose different records with a known serving size and matching per-100-g or per-100-ml basis.</p>:
        <section className="glass-panel overflow-x-auto p-4 sm:p-6">
          <h2 className="text-xl font-bold text-slate-900">Nutrition comparison <span className="text-sm font-normal text-slate-600">({leftValues.basis==="per_100g"?"per 100 g":"per 100 ml"})</span></h2>
          <table className="mt-4 w-full min-w-[440px] text-left text-xs sm:text-sm">
            <thead><tr className="border-b border-slate-300 text-slate-600"><th className="py-3">Nutrient</th><th className="py-3">{a.productName}</th><th className="py-3">{b.productName}</th></tr></thead>
            <tbody>{fields.map(([key,label,unit,isHigherBetter])=>{
              const x=leftValues.values[key],y=rightValues.values[key];
              const status=(mine,other)=>mine===null||other===null||mine===other?"":(isHigherBetter?mine>other:mine<other)?"font-bold text-emerald-800":"text-slate-700";
              return <tr key={key} className="border-b border-white/60">
                <th className="py-3 font-semibold text-slate-800">{label}</th>
                <td className={"py-3 "+status(x,y)}>{x===null?"Unknown":`${x} ${unit}`}</td>
                <td className={"py-3 "+status(y,x)}>{y===null?"Unknown":`${y} ${unit}`}</td>
              </tr>;
            })}</tbody>
          </table>
          <p className="mt-4 text-xs text-slate-600">Green highlights are simple nutrient comparisons, not an overall health verdict. Compare serving sizes, product categories, allergens, and complete nutritional information too.</p>
          {[a,b].some(x=>x.aiData?.nutrition_validation?.status==="needs_verification"||x.aiData?.nutrition_source==="unavailable")&&<p className="mt-2 text-xs font-semibold text-amber-700">One or both products need label verification before relying on these figures.</p>}
        </section>}
      </>}
    </div>
  </main>;
}
