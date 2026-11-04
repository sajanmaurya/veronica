"use client";
import {useEffect} from "react";
import {useUser} from "@clerk/nextjs";
import {useUserProfile,emptyProfile} from "@/context/UserProfileContext";
export default function ProfileSync(){
  const {user,isLoaded}=useUser();
  const {setProfile,setLoading}=useUserProfile();
  useEffect(()=>{
    if(!isLoaded)return;
    let active=true;
    if(!user){setProfile(emptyProfile);setLoading(false);return;}
    setLoading(true);
    fetch("/api/auth/userProfile",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw Error("Could not retrieve profile");return r.json()})
      .then(data=>{if(active)setProfile({...emptyProfile,...data})})
      .catch(()=>{if(active)setProfile(emptyProfile)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[user?.id,isLoaded,setProfile,setLoading]);
  return null;
}
