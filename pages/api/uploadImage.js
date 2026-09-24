import fs from "fs";
import formidable from "formidable";
import { createWorker } from "tesseract.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024,
      filter: ({ mimetype }) => !!mimetype && mimetype.startsWith("image/"),
    });

    const [fields, files] = await form.parse(req);
    const uploadedImage = files.image;
    const imageFile = Array.isArray(uploadedImage) ? uploadedImage[0] : uploadedImage;

    if (!imageFile) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const imagePath = imageFile.filepath || imageFile.path;

    if (!imagePath || !fs.existsSync(imagePath)) {
      return res.status(400).json({ error: "Uploaded image file is invalid" });
    }

    const worker = await createWorker("eng");
    const { data } = await worker.recognize(imagePath);
    await worker.terminate();

    const extractedText = data?.text || "";

    if (!extractedText.trim()) {
      return res.status(400).json({
        success: false,
        error: "No readable text found in the image. Please upload a clearer product label.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Text extracted successfully",
      extractedText,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
