export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DATABASE_ID;

  if (!token || !dbId) {
    return res.status(500).json({ error: 'Missing env variables' });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          or: [
            { property: 'Statut', select: { equals: 'Live' } },
            { property: 'Statut', select: { equals: 'À ouvrir' } },
          ]
        },
        page_size: 100,
      }),
    });

    const data = await response.json();

    if (!data.results) {
      return res.status(500).json({ error: 'Notion API error', details: data });
    }

    const roles = data.results.map(page => {
      const p = page.properties;
      return {
        r:       p['Rôle']?.title?.[0]?.plain_text || '',
        rec:     p['Recruteur']?.select?.name || '',
        pts:     p['Points capacité']?.number || 0,
        st:      p['Statut']?.select?.name || '',
        pip:     p['Statut pipeline']?.select?.name || null,
        ca:      p['Candidats actifs']?.number || null,
        mi:      p['Candidats Manager Interview']?.number || 0,
        ps:      p['Phone Screens planifiés (14j)']?.number || null,
        sl:      p['Shortlist produite']?.checkbox || false,
        comment: p['Commentaire / Risque']?.rich_text?.[0]?.plain_text || null,
        open:    p['Date ouverture']?.date?.start
                   ? new Date(p['Date ouverture'].date.start).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })
                   : null,
      };
    }).filter(r => r.r && r.rec);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(roles);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
