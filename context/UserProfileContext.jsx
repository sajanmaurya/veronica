"use client";
import { createContext,useContext,useState } from "react";
const ProfileContext=createContext(null);
export const emptyProfile={name:"",email:"",diseases:"",allergies:"",dietaryPreferences:""};
export function UserProfileProvider({children}){
  const [profile,setProfile]=useState(emptyProfile);
  const [loading,setLoading]=useState(true);
  return <ProfileContext.Provider value={{profile,setProfile,loading,setLoading}}>{children}</ProfileContext.Provider>;
}
export const useUserProfile=()=>useContext(ProfileContext);
