import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";
export function requireUser(req,res) {
  try {
    const {userId}=getAuth(req);
    if(userId) return userId;
  } catch(error) { console.warn("Session verification failed:",error?.message); }
  res.status(401).json({error:"Please sign in to continue."});
  return null;
}
export async function limitUsage(userId,route,perHour,res){
  const now=Date.now(),windowStart=Math.floor(now/3600000),key=`${userId}:${route}:${windowStart}`;
  try{
    const usage=await prisma.apiUsage.upsert({
      where:{key},create:{key,count:1,expiresAt:new Date((windowStart+2)*3600000)},
      update:{count:{increment:1}}
    });
    if(usage.count>perHour) {
      res.setHeader("Retry-After",String(Math.max(1,Math.ceil(((windowStart+1)*3600000-now)/1000))));
      res.status(429).json({error:"Hourly request limit reached. Please try later."});
      return false;
    }
    return true;
  }catch(error){console.error("Rate limiter failed:",error);res.status(503).json({error:"Service temporarily unavailable."});return false}
}
export async function getTrustedProfile(userId){
  const p=await prisma.userProfile.findUnique({where:{userId}});
  return {diseases:p?.diseases||"",allergies:p?.allergies||"",dietaryPreferences:p?.dietaryPreferences||""};
}
