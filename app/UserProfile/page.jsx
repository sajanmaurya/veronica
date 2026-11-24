"use client";

import { useEffect, useState } from "react";
import { readDeviceProfile, useUserProfile } from "@/context/UserProfileContext";
import { allergyChoices, allergyList, dietChoices, dietParts } from "@/lib/dietaryProfile.mjs";
import { toast } from "react-toastify";

function formValues(profile) {
  const { diet, other } = dietParts(profile.dietaryPreferences);
  const allergies = allergyList(profile.allergies);
  return { name: profile.name || "", email: profile.email || "", diseases: profile.diseases || "",
    diet, other, selected: allergies.filter(item => allergyChoices.includes(item)),
    custom: allergies.filter(item => !allergyChoices.includes(item)).join(", ") };
}

const choiceStyle = "flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white/60 px-3 py-2 text-sm has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50";

function ProfileForm({profile, saveProfile, signedIn}) {
  const [form, setForm] = useState(() => formValues(profile));
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState(null);
  useEffect(() => {
    if (signedIn && !profile.dietaryPreferences && !profile.allergies) {
      const old = readDeviceProfile();
      if (old?.dietaryPreferences || old?.allergies) setDevice(old);
    }
  }, [signedIn, profile.dietaryPreferences, profile.allergies]);
  function change(key, value) { setForm(prev => ({...prev, [key]: value})); }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const allergies = allergyList([...form.selected, form.custom].join(", ")).join(", ");
      await saveProfile({
        name: form.name.trim() || "Guest User", email: form.email.trim() || "guest@example.com",
        diseases: form.diseases.trim(), allergies,
        dietaryPreferences: [form.diet, form.other.trim()].filter(Boolean).join(", "),
      });
      setDevice(null);
      toast.success("Profile saved");
    } catch { toast.error("Could not save your profile. Please try again."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    {device && <button type="button" className="text-sm underline" onClick={() => {
      const {diet, other, selected, custom} = formValues(device);
      setForm(prev => ({...prev, diet, other, selected, custom}));
      setDevice(null);
    }}>Use diet and allergies previously saved on this device</button>}
    {[
      ["name", "Name", "text"], ["email", "Email", "email"], ["diseases", "Health conditions", "text"],
    ].map(([key, title, type]) => <label className="block text-sm font-semibold text-slate-700" key={key}>
      {title}<input type={type} maxLength={2000} className="glass-input mt-1 block"
        value={form[key]} onChange={event => change(key, event.target.value)} />
    </label>)}
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-slate-700">Dietary preference</legend>
      <div className="flex flex-wrap gap-2">
        {[[ "", "No preference" ], ...dietChoices].map(([value, label]) =>
          <label key={label} className={choiceStyle}>
            <input type="radio" name="diet" value={value} checked={form.diet === value}
              onChange={() => change("diet", value)} />{label}
          </label>)}
      </div>
      <p className="mt-2 text-xs text-slate-600">Veg allows dairy and excludes eggs. Vegan also excludes dairy and honey.</p>
    </fieldset>
    {form.other && <label className="block text-sm font-semibold text-slate-700">
      Other saved dietary preferences<input className="glass-input mt-1 block" value={form.other}
        onChange={event => change("other", event.target.value)} />
    </label>}
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-slate-700">Allergies</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allergyChoices.map(item => <label key={item} className={choiceStyle}>
          <input type="checkbox" checked={form.selected.includes(item)} onChange={event => {
            const checked = event.target.checked;
            setForm(prev => ({...prev, selected: checked ? [...prev.selected, item] : prev.selected.filter(v => v !== item)}));
          }} />{item}
        </label>)}
      </div>
      <label className="mt-3 block text-sm text-slate-700">Other allergies (separate with commas)
        <input className="glass-input mt-1 block" value={form.custom} maxLength={1800}
          onChange={event => change("custom", event.target.value)} />
      </label>
    </fieldset>
    <button disabled={saving} className="liquid-glass-button w-full py-4 text-base">
      {saving ? "Saving…" : "Save profile"}
    </button>
  </form>;
}

export default function UserProfile() {
  const context = useUserProfile();
  return <div className="app-canvas flex items-center justify-center">
    <section className="glass-panel w-full max-w-xl p-6 sm:p-8">
      <h1 className="mb-5 text-3xl font-semibold text-slate-900">Health profile</h1>
      {context.loading ? <p role="status">Loading profile…</p> : context.loadError ?
        <div role="alert">Could not load your profile. <button className="underline" onClick={context.retry}>Try again</button></div>
        : <ProfileForm {...context} />}
    </section>
  </div>;
}
