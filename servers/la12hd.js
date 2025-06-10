const axios = require('axios');
const { URL } = require('url'); 
const http = require('http');   
const https = require('https'); 

async function getLa12HdUrl(originalEventLink) {
    try {
        const parsedOriginalUrl = new URL(originalEventLink);
        const streamName = parsedOriginalUrl.searchParams.get('stream');

        if (!streamName) {
            console.warn(`[La12HD] No se encontró el parámetro 'stream' en el enlace original: ${originalEventLink}. No se puede construir la URL de la12hd.com.`);
            return null;
        }

        const urlDePeticion = `https://la12hd.com/vivo/canales.php?stream=${streamName}`;
        
        const referer = `https://la12hd.com/`; 
        const origin = `https://la12hd.com`; 
        
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
        console.error(`[La12HD] Error al obtener o descifrar el código fuente de ${originalEventLink} para la12hd.com:`, error.message);
        if (error.response) {
            console.error('[La12HD] Status:', error.response.status);
        }
        return null;
    }
}

module.exports = getLa12HdUrl;