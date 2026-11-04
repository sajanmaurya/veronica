import { prisma } from "@/app/utils/prisma";
import { requireUser } from "@/lib/apiAuth";
const safe=(value,max=500)=>typeof value==="string"?value.trim().slice(0,max):"";
export default async function profileHandler(req,res){
  const userId=requireUser(req,res);if(!userId)return;
  try{
    if(req.method==="GET") {
      const p=await prisma.userProfile.findUnique({where:{userId}});
      return res.status(200).json(p||{userId,name:"",email:"",diseases:"",allergies:"",dietaryPreferences:""});
    }
    if(req.method==="POST"){
      const {name,email,diseases,allergies,dietaryPreferences}=req.body||{};
      if([name,email,diseases,allergies,dietaryPreferences].some(v=>v!=null&&typeof v!=="string"))return res.status(400).json({error:"Invalid fields."});
      const data={name:safe(name,120),email:safe(email,254),diseases:safe(diseases),allergies:safe(allergies),dietaryPreferences:safe(dietaryPreferences)};
      const p=await prisma.userProfile.upsert({where:{userId},update:data,create:{userId,...data}});
      return res.status(200).json(p);
    }
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({error:"Method not allowed."});
  }catch(error){console.error("Profile API error:",error);return res.status(500).json({error:"Profile unavailable."})}
}
