import 'dotenv/config';

const TAVILY_API_ENDPOINT = 'https://api.tavily.com/search';

/**
 * Executes a web search using the Tavily AI Search API.
 * 
 * @param {string} query - The search query or research question.
 * @param {object} options - Search options (search_depth, max_results, include_answer, etc.)
 * @returns {Promise<{ query: string, answer: string, results: Array<{ title: string, url: string, content: string, score: number }> }>}
 */
export async function searchWeb(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey || apiKey === 'your_tavily_api_key_here') {
    throw new Error('TAVILY_API_KEY is not configured in backend environment.');
  }

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('Query parameter must be a non-empty string.');
  }

  const payload = {
    api_key: apiKey,
    query: query.trim(),
    search_depth: options.searchDepth || 'basic', // 'basic' or 'advanced'
    include_answer: options.includeAnswer !== false,
    include_images: options.includeImages || false,
    include_raw_content: options.includeRawContent || false,
    max_results: options.maxResults || 5
  };

  if (options.includeDomains && Array.isArray(options.includeDomains)) {
    payload.include_domains = options.includeDomains;
  }
  if (options.excludeDomains && Array.isArray(options.excludeDomains)) {
    payload.exclude_domains = options.excludeDomains;
  }

  const startTime = Date.now();

  const response = await fetch(TAVILY_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Tavily API responded with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const durationMs = Date.now() - startTime;

  const results = (data.results || []).map((item) => ({
    title: item.title || 'Untitled Web Source',
    url: item.url,
    content: item.content || '',
    score: item.score ? Number(item.score.toFixed(3)) : null,
    publishedDate: item.published_date || null
  }));

  return {
    query: data.query || query,
    answer: data.answer || null,
    results,
    images: data.images || [],
    durationMs
  };
}

/**
 * Conducts structured web research on a specific topic.
 * Formats the findings into research context with cited sources.
 * 
 * @param {string} topic - The subject/question to investigate.
 * @param {object} options - Search depth and result limits.
 * @returns {Promise<{ topic: string, summaryAnswer: string, sources: Array, contextSnippet: string }>}
 */
export async function conductResearch(topic, options = {}) {
  console.log(`[TavilyService] Conducting web research on: "${topic}"...`);
  const searchResult = await searchWeb(topic, {
    searchDepth: options.searchDepth || 'basic',
    maxResults: options.maxResults || 5,
    includeAnswer: true,
    ...options
  });

  // Prepare a formatted context snippet for the LLM
  const contextSnippet = searchResult.results
    .map((res, index) => {
      return `[Source ${index + 1}: ${res.title}]\nURL: ${res.url}\nExcerpt:\n${res.content}\n`;
    })
    .join('\n---\n');

  const sources = searchResult.results.map((res, idx) => ({
    id: `src-${idx + 1}`,
    title: res.title,
    url: res.url,
    snippet: res.content.length > 200 ? `${res.content.slice(0, 197)}...` : res.content,
    score: res.score
  }));

  console.log(`[TavilyService] Retrieved ${sources.length} cited sources (${searchResult.durationMs}ms)`);

  return {
    topic,
    summaryAnswer: searchResult.answer,
    sources,
    contextSnippet,
    durationMs: searchResult.durationMs
  };
}

export default {
  searchWeb,
  conductResearch
};
