"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const UserProfileContext = createContext(null);
const defaults = {name: "", email: "", diseases: "", allergies: "", dietaryPreferences: ""};
const localKey = "veronica-profile";

export function readDeviceProfile() {
  try { return JSON.parse(localStorage.getItem(localKey)); }
  catch { return null; }
}

function ProfileSession({ userId, ready, children }) {
  const [profile, setProfile] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        let saved;
        if (userId) {
          const response = await fetch("/api/auth/userProfile", {cache: "no-store", signal: controller.signal});
          if (!response.ok) throw new Error("Profile unavailable");
          saved = await response.json();
        } else saved = readDeviceProfile();
        if (!controller.signal.aborted) setProfile({...defaults, ...saved});
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [ready, userId, attempt]);

  async function saveProfile(fields) {
    if (!ready || loading || loadError) throw new Error("Load your profile before saving.");
    let saved = fields;
    if (userId) {
      const response = await fetch("/api/auth/userProfile", {method: "POST",
        headers: {"Content-Type": "application/json"}, body: JSON.stringify(fields)});
      if (!response.ok) throw new Error("Could not save your profile.");
      saved = await response.json();
    } else localStorage.setItem(localKey, JSON.stringify(fields));
    setProfile({...defaults, ...saved});
  }
  return <UserProfileContext.Provider value={{profile, saveProfile, loading, loadError,
    signedIn: Boolean(userId), retry: () => setAttempt(n => n + 1)}}>{children}</UserProfileContext.Provider>;
}

function AccountProfile({ children }) {
  const {isLoaded, userId} = useAuth();
  return <ProfileSession key={isLoaded ? userId || "guest" : "loading"} userId={userId}
    ready={isLoaded}>{children}</ProfileSession>;
}
export function UserProfileProvider({ clerkEnabled, children }) {
  return clerkEnabled ? <AccountProfile>{children}</AccountProfile> :
    <ProfileSession ready>{children}</ProfileSession>;
}
export const useUserProfile = () => useContext(UserProfileContext);
