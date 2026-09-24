"use client";

import { createContext, useContext, useEffect, useState } from "react";

const UserProfileContext = createContext(null);

export const UserProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState({
    userId: "guest-user",
    name: "Guest User",
    email: "guest@example.com",
    diseases: "",
    allergies: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedProfile = localStorage.getItem("safebite-profile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (err) {
        console.error("Failed to parse saved profile:", err);
      }
    }
    setLoading(false);
  }, []);

  return (
    <UserProfileContext.Provider value={{ profile, setProfile, loading }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => useContext(UserProfileContext);
