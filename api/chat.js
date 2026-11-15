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

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
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
      if (data?.choices?.[0]?.message?.content) {
        return res.status(200).json(data);
      }
    }
  } catch (err) {}

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
          messages
        })
      });
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        if (groqData?.choices?.[0]?.message?.content) {
          return res.status(200).json(groqData);
        }
      }
    } catch (err) {}
  }

  // 3. Free zero-key Pollinations OpenAI-compatible & Text endpoints
  try {
    const polyRes = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        messages
      })
    });
    if (polyRes.ok) {
      const polyData = await polyRes.json();
      const content = polyData?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: content.trim() } }]
        });
      }
    }
  } catch (err) {}

  try {
    const freeRes = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: 'openai',
        private: true
      })
    });

    if (freeRes.ok) {
      const textReply = await freeRes.text();
      if (textReply && textReply.trim() && !textReply.includes('IMPORTANT NOTICE')) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: textReply.trim() } }]
        });
      }
    }
  } catch (err) {}

  // 4. Fast Pollinations GET fallback
  try {
    const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const prompt = encodeURIComponent(`${sysMsg}\n\nUser: ${lastUserMsg}\nAssistant:`);
    const getRes = await fetch(`https://text.pollinations.ai/${prompt}?model=openai`);
    if (getRes.ok) {
      const getText = await getRes.text();
      if (getText && getText.trim() && !getText.includes('IMPORTANT NOTICE')) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: getText.trim() } }]
        });
      }
    }
  } catch (err) {}

  // 5. Return 200 with empty choice so frontend seamlessly uses its conversational smart coach
  return res.status(200).json({
    choices: [{ message: { role: 'assistant', content: '' } }]
  });
};
