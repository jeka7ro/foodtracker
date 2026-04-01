import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const IIKO_BASE = 'https://api-eu.iiko.services/api/1';

app.post('/api/iiko/*', async (req, res) => {
    const endpoint = req.params[0];
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const response = await fetch(`${IIKO_BASE}/${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(3005, () => console.log('🚀 Gateway-ul de iiko (Proxy) a pornit pe portul 3005 fara probleme de CORS!'));
