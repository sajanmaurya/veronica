// Reduce large images for vision AI while preserving readable label text.
export async function prepareFoodImage(file){
  const LIMIT=3.2*1024*1024;
  if(!file||!file.type?.startsWith("image/"))throw Error("Choose an image.");
  if(file.size<=LIMIT&&["image/jpeg","image/png","image/webp"].includes(file.type))return file;
  if(typeof createImageBitmap!=="function")throw Error("Cannot compress on this device. Please select a smaller image.");
  const bitmap=await createImageBitmap(file);
  try{
    let maxDimension=2400;
    for(let pass=0;pass<3;pass++){
      const factor=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));
      const ctx=canvas.getContext("2d");if(!ctx)throw Error("Could not process this image.");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const quality of [0.88,0.76,0.64]){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
        if(blob&&blob.size<=LIMIT)return new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
      }
      maxDimension=Math.round(maxDimension*0.75);
    }
    throw Error("Image is too large. Crop to the label and try again.");
  }finally{bitmap.close()}
}
