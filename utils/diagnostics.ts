// Quick debug: Check if CSV server is reachable and returning data
export async function testApiConnection() {
  console.log('[API Test] Starting connection check...');
  try {
    const response = await fetch('/api/board', { method: 'GET' });
    console.log('[API Test] Response status:', response.status);
    
    if (!response.ok) {
      console.error('[API Test] Server error:', response.statusText);
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const data = await response.json();
    console.log('[API Test] Data received:', data);
    console.log('[API Test] Number of groups:', data.groups?.length || 0);
    const totalItems = data.groups?.reduce((sum: number, g: any) => sum + (g.items?.length || 0), 0) || 0;
    console.log('[API Test] Total items:', totalItems);
    
    if (totalItems === 0) {
      console.warn('[API Test] No items found in CSV! Check maternal_data.csv location and format.');
    }
    
    return { success: true, groups: data.groups?.length || 0, items: totalItems };
  } catch (error) {
    console.error('[API Test] Connection failed:', error);
    return { success: false, error: String(error) };
  }
}

// Check Gemini API availability
export function testGeminiKey() {
  const hasKey = !!process.env.GEMINI_API_KEY || !!process.env.API_KEY;
  console.log('[Gemini Test] API Key available:', hasKey);
  if (!hasKey) {
    console.warn('[Gemini Test] No API key found. Clinical diagnostics will not work. Set GEMINI_API_KEY in .env.local');
  }
  return hasKey;
}
