"use client";
import {useEffect,useState} from "react";
import {toast} from "react-toastify";
import {useUserProfile} from "@/context/UserProfileContext";
export default function UserProfile(){
  const {profile,setProfile,loading}=useUserProfile();
  const [fields,setFields]=useState({name:"",email:"",diseases:"",allergies:"",dietaryPreferences:""});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{setFields({name:profile.name||"",email:profile.email||"",diseases:profile.diseases||"",allergies:profile.allergies||"",dietaryPreferences:profile.dietaryPreferences||""})},[profile]);
  async function save(e){
    e.preventDefault();setSaving(true);
    try{
      const r=await fetch("/api/auth/userProfile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(fields)});
      const data=await r.json();
      if(!r.ok)throw Error(data.error||"Save failed");
      setProfile(data);localStorage.removeItem("veronica-profile");toast.success("Profile saved");
    }catch(error){toast.error(error.message)}finally{setSaving(false)}
  }
  const labels=[["name","Name"],["email","Email"],["diseases","Health conditions (optional)"],["allergies","Allergies (optional)"],["dietaryPreferences","Dietary preferences"]];
  return <main className="app-canvas flex items-center justify-center p-5">
    <form onSubmit={save} className="glass-panel w-full max-w-xl space-y-5 p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Private health profile</h1>
      <p className="text-sm text-slate-600">Only add health details you choose to share. Information is for food guidance, not medical advice.</p>
      {labels.map(([key,label])=><label key={key} className="block text-sm font-semibold text-slate-700">{label}
        <input className="glass-input mt-2 block w-full" type={key==="email"?"email":"text"} value={fields[key]} maxLength={key==="email"?254:500} onChange={e=>setFields(f=>({...f,[key]:e.target.value}))}/>
      </label>)}
      <button disabled={saving||loading} className="liquid-glass-button w-full py-3">{saving?"Saving...":"Save profile"}</button>
    </form>
  </main>
}
