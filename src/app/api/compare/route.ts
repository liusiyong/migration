import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { compareBots } from '@/lib/compare';
import { BotFile, ComparisonResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const fileNames: string[] = body.files;

  if (!fileNames || fileNames.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 files are required for comparison.' },
      { status: 400 }
    );
  }

  const uploadDir = path.join('/tmp', 'uploads');

  // Read and parse all bot files
  const bots: { name: string; data: BotFile }[] = [];

  for (const fileName of fileNames) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._() -]/g, '_');
    const filePath = path.join(uploadDir, safeName);
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as BotFile;
    bots.push({ name: fileName, data });
  }

  // Compare each pair
  const results: ComparisonResult[] = [];
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const result = compareBots(
        bots[i].data,
        bots[j].data,
        bots[i].name,
        bots[j].name
      );
      results.push(result);
    }
  }

  return NextResponse.json({ results });
}
