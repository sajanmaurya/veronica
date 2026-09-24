"use client";

import { useEffect, useState } from "react";
import { useUserProfile } from "@/context/UserProfileContext";
import { toast } from "react-toastify";

const UserProfile = () => {
  const { profile, setProfile } = useUserProfile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [diseases, setDiseases] = useState("");
  const [allergies, setAllergies] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email || "");
      setDiseases(profile.diseases || "");
      setAllergies(profile.allergies || "");
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      const updatedProfile = {
        ...profile,
        name: name.trim() || "Guest User",
        email: email.trim() || "guest@example.com",
        diseases,
        allergies,
      };

      localStorage.setItem("veronica-profile", JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-88px)] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef7f4_100%)] p-4 sm:p-6">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.10)] backdrop-blur-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white shadow-lg shadow-emerald-200">
            ♥
          </div>
          <h2 className="text-3xl font-black text-slate-800">Health Profile</h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Diseases</label>
            <input
              type="text"
              value={diseases}
              onChange={(e) => setDiseases(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              placeholder="e.g. Diabetes, Hypertension"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Allergies</label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              placeholder="e.g. Peanuts, Gluten"
            />
          </div>

          <button
            onClick={handleSave}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-lg font-semibold text-white shadow-[0_15px_30px_rgba(59,130,246,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(59,130,246,0.4)]"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
