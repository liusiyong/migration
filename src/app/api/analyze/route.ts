import { NextRequest, NextResponse } from 'next/server';
import { analyzeBot } from '@/lib/analyze';
import { BotFile } from '@/lib/types';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  let botData: BotFile;
  try {
    const text = await file.text();
    botData = JSON.parse(text) as BotFile;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON file. Could not parse bot file.' }, { status: 400 });
  }

  const result = analyzeBot(botData, file.name);
  return NextResponse.json({ result });
}
