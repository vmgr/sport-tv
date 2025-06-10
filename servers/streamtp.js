const https = require('https');
const { URL } = require('url');

function getStreamtpUrl(pageUrl) {
    return new Promise((resolve, reject) => {
        const urlObject = new URL(pageUrl);
        const targetHostname = urlObject.hostname;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8,en-US;q=0.7',
                'Referer': `https://${targetHostname}/`,
            }
        };

        https.get(pageUrl, options, (res) => {
            let htmlString = '';
            if (res.statusCode !== 200) {
                let errorBody = '';
                res.on('data', (chunk) => { errorBody += chunk; });
                res.on('end', () => {
                    reject(new Error(`[StreamTP] Error al obtener la URL: ${res.statusCode} ${res.statusMessage}\nCuerpo de la respuesta (si lo hay): ${errorBody}`));
                });
                return;
            }
            res.setEncoding('utf8');
            res.on('data', (chunk) => { htmlString += chunk; });
            res.on('end', () => {
                try {
                    const mainLogicRegex = /var\s+playbackURL\s*=\s*"",\s*(\w+)\s*=\s*\[\][^;]*;\s*\1\s*=\s*(\[\[[\s\S]*?\]\]);/;
                    const mainMatch = htmlString.match(mainLogicRegex);

                    if (!mainMatch || !mainMatch[1] || !mainMatch[2]) {
                        reject(new Error(`[StreamTP] No se pudo encontrar la estructura del array de datos o su nombre mediante Regex.`));
                        return;
                    }
                    const capturedArrayVariableName = mainMatch[1];
                    const dataArrayString = mainMatch[2];

                    const kFunctionsRegex = /var\s+k\s*=\s*(\w+)\s*\(\s*\)\s*\+\s*(\w+)\s*\(\s*\);/;
                    const kMatch = htmlString.match(kFunctionsRegex);

                    if (!kMatch || !kMatch[1] || !kMatch[2]) {
                        reject(new Error(`[StreamTP] No se pudieron encontrar los nombres de las funciones para 'k' mediante Regex.`));
                        return;
                    }
                    const capturedK1FunctionName = kMatch[1];
                    const capturedK2FunctionName = kMatch[2];

                    const k1FunctionRegex = new RegExp(`function\\s+${capturedK1FunctionName}\\s*\\(\\s*\\)\\s*\\{\\s*return\\s*(\\d+);?\\s*\\}`);
                    const k1ValMatch = htmlString.match(k1FunctionRegex);

                    if (!k1ValMatch || !k1ValMatch[1]) {
                        reject(new Error(`[StreamTP] No se pudo encontrar el valor de retorno para la función '${capturedK1FunctionName}'.`));
                        return;
                    }
                    const k1 = parseInt(k1ValMatch[1], 10);

                    const k2FunctionRegex = new RegExp(`function\\s+${capturedK2FunctionName}\\s*\\(\\s*\\)\\s*\\{\\s*return\\s*(\\d+);?\\s*\\}`);
                    const k2ValMatch = htmlString.match(k2FunctionRegex);

                    if (!k2ValMatch || !k2ValMatch[1]) {
                        reject(new Error(`[StreamTP] No se pudo encontrar el valor de retorno para la función '${capturedK2FunctionName}'.`));
                        return;
                    }
                    const k2 = parseInt(k2ValMatch[1], 10);

                    let dataArray;
                    try {
                        dataArray = new Function('return ' + dataArrayString)();
                    } catch (e) {
                        reject(new Error(`[StreamTP] No se pudo parsear el array (nombre dinámico: ${capturedArrayVariableName}): ${e.message}\nString era: ${dataArrayString.substring(0, 200)}...`));
                        return;
                    }

                    const k = k1 + k2;
                    if (k === 0 && (k1 === 0 && k2 === 0) ) {
                        reject(new Error(`[StreamTP] Los valores parseados para k (k1=${k1}, k2=${k2}) resultaron en k=0, lo cual es probablemente incorrecto.`));
                        return;
                    }

                    dataArray.sort((a, b) => a[0] - b[0]);

                    let playbackURL = "";
                    dataArray.forEach(e => {
                        if (Array.isArray(e) && e.length >= 2 && typeof e[1] === 'string') {
                            let v = e[1];
                            let decoded_v_buffer = Buffer.from(v, 'base64');
                            let decoded_v_string = decoded_v_buffer.toString('latin1');
                            let digits_only = decoded_v_string.replace(/\D/g, '');

                            if (digits_only) {
                                playbackURL += String.fromCharCode(parseInt(digits_only) - k);
                            }
                        }
                    });

                    resolve(playbackURL);

                } catch (error) {
                    reject(new Error(`[StreamTP] Error durante el parseo o descifrado: ${error.message}\nStack: ${error.stack}`));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`[StreamTP] Error en la solicitud HTTPS: ${err.message}`));
        });
    });
}

module.exports = getStreamtpUrl;