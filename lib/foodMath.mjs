// Shared, testable nutrition math. Never interpret missing numbers as zero.
export const NUTRIENTS=["calories","total_fat_g","saturated_fat_g","carbohydrates_g","total_sugar_g","added_sugar_g","protein_g","fiber_g","sodium_mg"];
export function finiteValue(value){
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0&&n<=100000?n:null;
}
export function parseServing(value){
  const match=String(value||"").replace(/,/g,"").match(/(\d+(?:\.\d+)?)\s*(g|grams?|ml|millilit(?:er|re)s?)\b/i);
  if(!match)return null;
  const size=Number(match[1]);
  if(!Number.isFinite(size)||size<=0)return null;
  return {size,unit:/^g/i.test(match[2])?"g":"ml"};
}
export function normalizePer100(nutrition){
  if(!nutrition||typeof nutrition!=="object")return null;
  let basis=nutrition.label_basis;
  let factor=1;
  if(basis==="per_serving"){
    const serving=parseServing(nutrition.serving_size);
    if(!serving)return null;
    factor=100/serving.size;
    basis=serving.unit==="g"?"per_100g":"per_100ml";
  }
  if(!["per_100g","per_100ml"].includes(basis))return null;
  const values={};
  for(const key of NUTRIENTS) {
    const n=finiteValue(nutrition[key]);
    values[key]=n===null?null:Math.round(n*factor*100)/100;
  }
  return {basis,values};
}
export function scaleConsumption(nutrition,portion,unit){
  const amount=finiteValue(portion);
  if(amount===null||amount<=0||amount>5000)return null;
  const basis=nutrition?.label_basis;
  let multiplier;
  if(basis==="per_100g"&&unit==="g")multiplier=amount/100;
  else if(basis==="per_100ml"&&unit==="ml")multiplier=amount/100;
  else if(basis==="per_serving"&&unit==="servings")multiplier=amount;
  else return null;
  const result={};
  let count=0;
  for(const key of NUTRIENTS){
    const v=finiteValue(nutrition[key]);
    result[key]=v===null?null:Math.round(v*multiplier*100)/100;
    if(v!==null)count++;
  }
  return count>=2 ? result : null;
}
export function scoreEvidence(nutrition){
  const normalized=normalizePer100(nutrition);
  if(!normalized)return [];
  const {basis,values:v}=normalized;
  const out=[];
  const add=(label,key,flag,reason,unit)=>{if(v[key]!==null)out.push({label,value:v[key],unit,flag,reason})};
  if(basis==="per_100g"){
    if(v.total_sugar_g!==null)add("Total sugar","total_sugar_g",v.total_sugar_g>22.5?"high":v.total_sugar_g<=5?"low":"moderate","Sugar per 100 g","g");
    if(v.saturated_fat_g!==null)add("Saturated fat","saturated_fat_g",v.saturated_fat_g>5?"high":v.saturated_fat_g<=1.5?"low":"moderate","Saturated fat per 100 g","g");
    if(v.sodium_mg!==null)add("Sodium","sodium_mg",v.sodium_mg>600?"high":v.sodium_mg<=120?"low":"moderate","Sodium per 100 g","mg");
    if(v.fiber_g!==null)add("Fiber","fiber_g",v.fiber_g>=6?"positive":"informational","Fiber per 100 g","g");
    if(v.protein_g!==null)add("Protein","protein_g",v.protein_g>=10?"positive":"informational","Protein per 100 g","g");
  }else if(basis==="per_100ml"){
    if(v.total_sugar_g!==null)add("Total sugar","total_sugar_g",v.total_sugar_g>11.25?"high":v.total_sugar_g<=2.5?"low":"moderate","Sugar per 100 ml","g");
    if(v.sodium_mg!==null)add("Sodium","sodium_mg",v.sodium_mg>300?"high":v.sodium_mg<=60?"low":"moderate","Sodium per 100 ml","mg");
  }
  return out;
}
