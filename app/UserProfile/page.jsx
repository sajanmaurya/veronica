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
  const [dietaryPreferences, setDietaryPreferences] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email || "");
      setDiseases(profile.diseases || "");
      setAllergies(profile.allergies || "");
      setDietaryPreferences(profile.dietaryPreferences || "");
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
        dietaryPreferences,
      };

      localStorage.setItem("veronica-profile", JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  return (
    <div className="app-canvas flex items-center justify-center">
      <div className="glass-panel w-full max-w-xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 via-lime-400 to-emerald-600 text-2xl font-bold text-white shadow-lg shadow-emerald-900/15">
            ♥
          </div>
          <h2 className="text-3xl font-semibold tracking-[-.04em] text-slate-900">Health Profile</h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input mt-1 block"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input mt-1 block"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Diseases</label>
            <input
              type="text"
              value={diseases}
              onChange={(e) => setDiseases(e.target.value)}
              className="glass-input mt-1 block"
              placeholder="e.g. Diabetes, Hypertension"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Dietary preferences</label>
            <input
              type="text"
              value={dietaryPreferences}
              onChange={(e) => setDietaryPreferences(e.target.value)}
              className="glass-input mt-1 block"
              placeholder="e.g. Vegetarian, Vegan, Gluten-free"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Allergies</label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="glass-input mt-1 block"
              placeholder="e.g. Peanuts, Gluten"
            />
          </div>

          <button
            onClick={handleSave}
            className="glass-button-primary mt-2 w-full py-4 text-base"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
