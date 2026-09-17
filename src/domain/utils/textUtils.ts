export function normalizeText(text: string): string {
  if (!text) return "";
  
  // Remove accents
  let normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Lowercase
  normalized = normalized.toLowerCase();
  
  // Remove punctuation and special characters
  normalized = normalized.replace(/[^\w\s]/gi, ' ');
  
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "um", "uma", "uns", "umas", "que", "e", "ou", "mas",
  "como", "se", "isso", "isto", "aquilo", "este", "esta", "esse", "essa", "tem", "nao",
  "sim", "mais", "muito", "pouco", "sao", "foi", "era", "ser", "estar", "fazer", "ter",
  "sobre", "entre", "quando", "onde", "quem", "qual", "quais", "meu", "minha", "seu", "sua"
]);

export function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ');
  
  const keywords = words.filter(word => {
    return word.length > 3 && !STOPWORDS.has(word);
  });
  
  // Remove duplicates and sort
  return Array.from(new Set(keywords)).sort();
}

export function generateTopicHash(text: string): string {
  const keywords = extractKeywords(text);
  // Take top 5 keywords to form a hash/topic name
  return keywords.slice(0, 5).join(' ');
}

export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
