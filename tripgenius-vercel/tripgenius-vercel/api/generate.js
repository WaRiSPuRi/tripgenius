export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { destination, days, budget, vibe, notes, quizAnswers, regenerateDay, cities, mode, currentLocation, currentTime, spentSoFar } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    const weatherKey = process.env.WEATHER_API_KEY;

    const quizContext = quizAnswers ? `\nTraveller profile: Pace: ${quizAnswers.pace} | Accommodation: ${quizAnswers.accommodation} | Food: ${quizAnswers.food} | Social: ${quizAnswers.social} | Priority: ${quizAnswers.priority}` : '';
    const destList = cities && cities.length > 1 ? cities.join(' → ') : destination;

    let prompt;
    if (mode === 'nowmode') {
      prompt = `You are a real-time travel guide. The traveller is currently in ${destination} at ${currentTime}. They have spent $${spentSoFar || 0} today out of their $${budget} daily budget.
Give them:
1. WHAT TO DO RIGHT NOW — specific activity based on the time
2. WHERE TO EAT NEXT — best meal option for this time of day with price estimate
3. NEXT 3 HOURS — a mini plan
4. LOCAL TIP — one thing most tourists don't know
5. HONEST WARNING — one thing to avoid right now
Be specific and time-aware. Format clearly with these exact headings.`;
    } else if (regenerateDay) {
      prompt = `Regenerate ONLY Day ${regenerateDay.dayNum} of a ${days}-day trip to ${destList}. Budget: $${budget}/day. Vibe: ${vibe}. Notes: ${notes || 'none'}.${quizContext}
Provide a completely fresh plan with morning/lunch/afternoon/dinner/evening/honest warning/hidden gem.
Format: DAY ${regenerateDay.dayNum}: [new title]\n[content]`;
    } else {
      prompt = `You are an expert travel planner. Create a ${days}-day itinerary for ${destList}.
Budget: $${budget}/day. Vibe: ${vibe}. Notes: ${notes || 'none'}.${quizContext}
For EACH day:
- Morning activity with time
- Lunch with cuisine and cost
- Afternoon activity
- Dinner with cost
- Evening suggestion
- HONEST WARNING: one thing tourists get wrong
- Hidden gem tip
- LOCATIONS: Place1 | Place2 | Place3

After all days add:
PACKING LIST:
15 essential items grouped by category.

PHRASEBOOK:
10 essential phrases in the local language with translation and pronunciation.

GETTING AROUND:
Transport tips, key apps, average costs.

Format days EXACTLY as:
DAY 1: [title]
[content]`;
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 3500, messages: [{ role: 'user', content: prompt }] })
    });
    const groqData = await groqRes.json();
    if (!groqRes.ok) return res.status(groqRes.status).json({ error: groqData.error?.message || 'API error' });
    const text = groqData.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('No response');

    let images = [];
    if (unsplashKey) {
      try {
        const imgRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent((cities?.[0]||destination)+' travel')}&per_page=6&orientation=landscape`, { headers: { Authorization: `Client-ID ${unsplashKey}` } });
        const imgData = await imgRes.json();
        images = (imgData.results||[]).map(img => ({ url: img.urls.regular, thumb: img.urls.small, alt: img.alt_description||destination, credit: img.user.name, creditLink: img.user.links.html }));
      } catch(e) {}
    }

    let weather = null;
    if (weatherKey && destination) {
      try {
        const wRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(destination)}&appid=${weatherKey}&units=metric&cnt=56`);
        const wData = await wRes.json();
        if (wData.list) {
          const seen = new Set();
          weather = wData.list.filter(d => { const day = new Date(d.dt*1000).toDateString(); if(seen.has(day)) return false; seen.add(day); return true; }).slice(0,7).map(d => ({ date: new Date(d.dt*1000).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}), temp: Math.round(d.main.temp), desc: d.weather[0].description, icon: d.weather[0].icon }));
        }
      } catch(e) {}
    }

    return res.status(200).json({ text, images, weather });
  } catch(err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
