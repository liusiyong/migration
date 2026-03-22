import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];

  if (!files || files.length < 2) {
    return NextResponse.json(
      { error: 'Please upload at least 2 bot files.' },
      { status: 400 }
    );
  }

  const uploadDir = path.join(process.cwd(), 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const savedFiles: { name: string; path: string }[] = [];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._() -]/g, '_');
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    savedFiles.push({ name: file.name, path: filePath });
  }

  return NextResponse.json({ files: savedFiles });
}
