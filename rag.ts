import { INSTRUMENTS, KNOWLEDGE, NEWS } from './psx';

// ----------------------------------------------------------------------------
// Lightweight, dependency-free RAG store.
//
// "Embeddings" here are deterministic feature-hashed term-frequency vectors
// (L2-normalised); similarity is cosine. This needs no model download and no
// external vector DB, so the prototype runs anywhere. It is intentionally
// hidden behind buildRagStore()/RagStore so it can be swapped for real
// embeddings + a vector database later without touching the assistant.
// ----------------------------------------------------------------------------

const DIMS = 1024;

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function hashToken(tok: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < tok.length; i++) {
    h ^= tok.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % DIMS;
}

function embed(text: string): Float32Array {
  const v = new Float32Array(DIMS);
  for (const tok of tokenize(text)) v[hashToken(tok)] += 1;
  let norm = 0;
  for (let i = 0; i < DIMS; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIMS; i++) v[i] /= norm;
  return v;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < DIMS; i++) dot += a[i] * b[i];
  return dot; // both are L2-normalised
}

export interface RagHit {
  id: string;
  title: string;
  text: string;
  category: string;
  source?: string;
  timestamp?: string;
  deepLink?: string;
  symbols?: string[];
  score: number;
}

interface IndexedDoc extends Omit<RagHit, 'score'> {
  vector: Float32Array;
}

export interface RagStore {
  size: number;
  search(query: string, k?: number): RagHit[];
}

export function buildRagStore(): RagStore {
  const docs: IndexedDoc[] = [];
  const add = (d: Omit<IndexedDoc, 'vector'>) =>
    docs.push({ ...d, vector: embed(`${d.title} ${d.text}`) });

  // App help / FAQ / glossary / education / policy
  for (const k of KNOWLEDGE) {
    add({
      id: k.id,
      title: k.title,
      text: k.text,
      category: k.category,
      deepLink: k.deepLink,
    });
  }
  // News + corporate announcements (retrieved as UNTRUSTED data)
  for (const n of NEWS) {
    add({
      id: n.id,
      title: n.headline,
      text: n.summary,
      category: n.kind === 'ANNOUNCEMENT' ? 'announcement' : 'news',
      source: n.source,
      timestamp: n.publishedAt,
      symbols: n.symbols,
    });
  }
  // Company profile text
  for (const i of INSTRUMENTS) {
    add({
      id: `profile-${i.symbol}`,
      title: `${i.name} (${i.symbol}) — company profile`,
      text: `${i.name} trades on PSX in the ${i.sector} sector. ${i.profile} Shariah-compliant: ${i.shariahCompliant ? 'yes' : 'no'}. KMI-30 constituent: ${i.kmi30 ? 'yes' : 'no'}.`,
      category: 'profile',
      symbols: [i.symbol],
    });
  }

  console.log(
    `[RAG] indexed ${docs.length} docs (local hashing embeddings, cosine similarity)`,
  );

  return {
    size: docs.length,
    search(query: string, k = 4): RagHit[] {
      const qv = embed(query);
      return docs
        .map((d) => ({ doc: d, score: cosine(qv, d.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map(({ doc, score }) => ({
          id: doc.id,
          title: doc.title,
          text: doc.text,
          category: doc.category,
          source: doc.source,
          timestamp: doc.timestamp,
          deepLink: doc.deepLink,
          symbols: doc.symbols,
          score: Math.round(score * 1000) / 1000,
        }));
    },
  };
}

export const ragStore = buildRagStore();
