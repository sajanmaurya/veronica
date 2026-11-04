import {S3Client,GetObjectCommand} from "@aws-sdk/client-s3";
import {prisma} from "@/app/utils/prisma";
import {requireUser} from "@/lib/apiAuth";
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  const userId=requireUser(req,res);if(!userId)return;
  const key=req.query.key;
  if(typeof key!=="string"||key.length>250||!key.split("/").includes(userId))return res.status(400).json({error:"Invalid image"});
  try{
    const path="/api/storage/image?key="+encodeURIComponent(key);
    const record=await prisma.productSearch.findFirst({where:{userId,OR:[{imageFrontUrl:path},{imageNutritionImage:path}]},select:{id:true}});
    if(!record)return res.status(404).json({error:"Image not found"});
    const client=new S3Client({endpoint:process.env.AWS_ENDPOINT_URL_S3,region:process.env.AWS_REGION||"us-east-2",forcePathStyle:true,credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY}});
    const obj=await client.send(new GetObjectCommand({Bucket:process.env.NEON_STORAGE_BUCKET,Key:key}));
    if(!["image/webp","image/jpeg","image/png"].includes(obj.ContentType))return res.status(415).end();
    const bytes=await obj.Body.transformToByteArray();
    res.setHeader("Content-Type",obj.ContentType);
    res.setHeader("Cache-Control","private, max-age=60");
    return res.status(200).send(Buffer.from(bytes));
  }catch(error){console.error("Private image unavailable",error);return res.status(404).json({error:"Image unavailable"});}
}
