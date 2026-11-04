import {prisma} from "@/app/utils/prisma";
import {requireUser,limitUsage} from "@/lib/apiAuth";
import {scaleConsumption} from "@/lib/foodMath.mjs";
export default async function handler(req,res) {
  const userId=requireUser(req,res);if(!userId)return;
  try{
    if(req.method==="GET"){
      const items=await prisma.foodConsumption.findMany({where:{userId},orderBy:{consumedAt:"desc"},take:200});
      res.setHeader("Cache-Control","private, no-store");
      return res.status(200).json({items});
    }
    if(req.method==="POST"){
      if(!(await limitUsage(userId,"food-log",200,res)))return;
      const {productName,nutrition,portion,unit}=req.body||{};
      if(typeof productName!=="string"||productName.trim().length<1||productName.length>160)return res.status(400).json({error:"Invalid product name"});
      if(!["g","ml","servings"].includes(unit))return res.status(400).json({error:"Invalid portion unit"});
      const values=scaleConsumption(nutrition,portion,unit);
      if(!values)return res.status(400).json({error:"Nutrition basis is missing or inconsistent with the portion. Verify the label first."});
      await prisma.userProfile.upsert({where:{userId},update:{},create:{userId,name:"",email:""}});
      const item=await prisma.foodConsumption.create({data:{userId,productName:productName.trim(),portion:Number(portion),unit,nutrition:values}});
      return res.status(201).json({item});
    }
    if(req.method==="DELETE"){
      const id=req.query.id;
      if(typeof id!=="string"||id.length>80)return res.status(400).json({error:"Invalid log entry"});
      const result=await prisma.foodConsumption.deleteMany({where:{id,userId}});
      return res.status(result.count?200:404).json({deleted:result.count});
    }
    res.setHeader("Allow","GET, POST, DELETE");
    return res.status(405).json({error:"Method not allowed"});
  }catch(error){console.error("Food log request failed:",error);return res.status(500).json({error:"Food log temporarily unavailable"})}
}
