export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, destination, days, itinerary } = req.body;
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) return res.status(200).json({ ok: true });
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: 'hello@tripgenius.app', name: 'TripGenius' },
        subject: `Your ${days}-day itinerary for ${destination}`,
        content: [{ type: 'text/plain', value: `TripGenius Itinerary\n\n${destination} — ${days} days\n\n${itinerary}\n\nPlan more at tripgenius.vercel.app` }]
      })
    });
    return res.status(200).json({ ok: r.ok });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
