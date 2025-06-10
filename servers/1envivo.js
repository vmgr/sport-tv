const axios = require('axios');
const { URL } = require('url');
const http = require('http');
const https = require('https');

async function get1EnVivoUrl(originalEventLink) {
    try {
        const parsedOriginalUrl = new URL(originalEventLink);
        const streamName = parsedOriginalUrl.searchParams.get('stream');

        if (!streamName) {
            return null;
        }

        const urlDePeticion = `https://envivo1.com/canal.php?stream=${streamName}`;
        const referer = 'https://librefutboltv.su/';
        const origin = 'https://librefutboltv.su/';

        const response = await axios.get(urlDePeticion, {
            headers: {
                'Referer': referer,
                'Origin': origin,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
            },
            httpAgent: new http.Agent({ family: 4 }),
            httpsAgent: new https.Agent({ family: 4 })
        });

        const html = response.data;
        const regex = /var playbackURL = "(.*?)"/;
        const match = html.match(regex);

        if (match && match[1]) {
            const m3u8Link = match[1];
            return m3u8Link;
        } else {
            return null;
        }

    } catch (error) {
        console.error(`[1EnVivo] Error al obtener el código fuente de ${originalEventLink} para 1envivo.com:`, error.message);
        if (error.response) {
            console.error('[1EnVivo] Status:', error.response.status);
        }
        return null;
    }
}

module.exports = get1EnVivoUrl;