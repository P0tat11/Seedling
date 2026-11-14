module.exports = async function handler(req, res) {
  // Handle CORS preflight cleanly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ollamaApiKey =
    process.env.OLLAMA_API_KEY ||
    '5328c6d502ac457c9fd04bd5f5260460.TQy8arLIt0cE10Xvv8X67BMY';

  // 1. Try Ollama Cloud first
  try {
    const response = await fetch('https://ollama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ollamaApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json(data);
    }
    // If Ollama returns 402 (Payment Required) or another error, fall through to free backup
  } catch (err) {
    // Fall through to free backup
  }

  // 2. Optional Groq Free Tier backup if GROQ_API_KEY is set in Vercel
  if (process.env.GROQ_API_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: req.body?.messages || []
        })
      });
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        return res.status(200).json(groqData);
      }
    } catch (err) {}
  }

  // 3. Free zero-key OpenAI-compatible AI fallback (prevents 402 Payment Required errors)
  try {
    const freeRes = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: req.body?.messages || []
      })
    });

    if (freeRes.ok) {
      const freeData = await freeRes.json();
      return res.status(200).json(freeData);
    }
  } catch (error) {
    return res.status(502).json({ error: 'Upstream AI providers unavailable', details: error.message });
  }

  return res.status(502).json({ error: 'All AI providers returned non-OK responses' });
};
