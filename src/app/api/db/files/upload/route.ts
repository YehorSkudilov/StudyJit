// Create this at: app/api/db/files/test-upload/route.ts
// This is a simplified route to debug the FormData issue

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  console.log("🔍 === UPLOAD DEBUG START ===");
  
  try {
    // Log headers
    console.log("📋 Headers:");
    req.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    // Check content type
    const contentType = req.headers.get("content-type");
    console.log("\n📦 Content-Type:", contentType);

    if (!contentType?.includes("multipart/form-data")) {
      console.log("❌ Invalid content type");
      return NextResponse.json(
        { error: "Invalid content type", received: contentType },
        { status: 400 }
      );
    }

    // Try to parse FormData
    console.log("\n🔄 Attempting to parse FormData...");
    let formData: FormData;
    
    try {
      formData = await req.formData();
      console.log("✅ FormData parsed successfully");
    } catch (parseError: any) {
      console.error("❌ FormData parse error:", parseError);
      return NextResponse.json(
        { 
          error: "Failed to parse FormData", 
          details: parseError.message,
          stack: parseError.stack 
        },
        { status: 400 }
      );
    }

    // Log FormData contents
    console.log("\n📝 FormData entries:");
    const entries: Array<[string, any]> = [];
    for (const [key, value] of formData.entries()) {
      entries.push([key, value]);
      if (value instanceof File) {
        console.log(`  ${key}: File(name="${value.name}", size=${value.size}, type="${value.type}")`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }

    // Get the file
    const file = formData.get("file");
    console.log("\n🎯 File field:", file);

    if (!file) {
      console.log("❌ No file found in FormData");
      return NextResponse.json(
        { 
          error: "No file uploaded",
          formDataKeys: entries.map(([key]) => key)
        },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      console.log("❌ File field is not a File instance");
      return NextResponse.json(
        { error: "Invalid file type", receivedType: typeof file },
        { status: 400 }
      );
    }

    console.log("✅ File validated successfully");
    console.log(`   Name: ${file.name}`);
    console.log(`   Size: ${file.size} bytes`);
    console.log(`   Type: ${file.type}`);

    console.log("\n🔍 === UPLOAD DEBUG END ===");

    return NextResponse.json({ 
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error: any) {
    console.error("\n💥 Unexpected error:", error);
    console.error("Stack:", error.stack);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}