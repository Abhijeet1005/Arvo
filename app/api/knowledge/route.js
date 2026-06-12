import { NextResponse } from 'next/server';
import { getElevenLabs } from '@/lib/elevenlabs';
import { readStore, writeStore, getAgentId } from '@/lib/store';
import { syncAgent } from '@/lib/agent';

// Add a document to the agent's knowledge base (pasted text OR an uploaded file),
// then re-sync the agent so the document is attached.
export async function POST(req) {
  const agentId = await getAgentId();
  if (!agentId) {
    return NextResponse.json({ error: 'Create the agent first (step 1).' }, { status: 400 });
  }

  let el;
  try {
    el = getElevenLabs();
  } catch (e) {
    console.error('[knowledge] client init failed:', e);
    return NextResponse.json({ error: 'Service is not configured. Please try again later.' }, { status: 500 });
  }

  const ctype = req.headers.get('content-type') || '';

  try {
    let doc;
    let type;
    if (ctype.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const name = form.get('name') || (file && file.name) || 'Document';
      if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
      doc = await el.conversationalAi.knowledgeBase.documents.createFromFile({ file, name });
      type = 'file';
    } else {
      const { text, name } = await req.json().catch(() => ({}));
      if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
      doc = await el.conversationalAi.knowledgeBase.documents.createFromText({
        text,
        name: name || 'Document',
      });
      type = 'text';
    }

    const docId = doc.id || doc.documentId || doc.document_id;
    const docName = doc.name || 'Document';

    // Track in our store and re-sync so it attaches to the agent.
    const store = await readStore();
    const knowledgeBase = [...(store.knowledgeBase || []), { type, name: docName, id: docId }];
    await writeStore({ knowledgeBase });
    await syncAgent();

    return NextResponse.json({ ok: true, documentId: docId, name: docName });
  } catch (e) {
    console.error('[knowledge] upload failed:', e);
    return NextResponse.json({ error: 'Could not add the document. Please try again.' }, { status: 500 });
  }
}
