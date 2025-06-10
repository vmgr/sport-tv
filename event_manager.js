const fetch = require('node-fetch');
const { EVENTS_JSON_URL, SOURCE_TIMEZONE_OFFSET_HOURS, TIMEZONE_OFFSET_HOURS } = require('./config');
const { getPosterImage, getBackgroundImage } = require('./image_manager');

async function fetchAllEvents() {
    try {
        const response = await fetch(EVENTS_JSON_URL);
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('[EventManager] Error al obtener los eventos del JSON:', error);
        return [];
    }
}

async function getGroupedEvents(statusFilter = 'Todos') {
    const allEvents = await fetchAllEvents();
    let relevantEvents = [];

    if (statusFilter === 'En vivo') {
        relevantEvents = allEvents.filter(event =>
            event.status && event.status.toLowerCase() === 'en vivo'
        );
    } else if (statusFilter === 'Pronto') {
        relevantEvents = allEvents.filter(event =>
            event.status && event.status.toLowerCase() === 'pronto'
        );
    } else if (statusFilter === 'Finalizados') {
        relevantEvents = allEvents.filter(event =>
            event.status && event.status.toLowerCase() === 'finalizado'
        );
    } else {
        relevantEvents = allEvents.filter(event =>
            event.status && (
                event.status.toLowerCase() === 'en vivo' ||
                event.status.toLowerCase() === 'pronto' ||
                event.status.toLowerCase() === 'finalizado'
            )
        );
    }

    const groupedEvents = new Map();

    relevantEvents.forEach(event => {
        const eventId = `${event.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}_${event.time ? event.time.replace(/[^a-zA-Z0-9]/g, '') : 'no_time'}`;
        const groupKey = eventId;

        let adjustedTime = 'Hora no disponible';

        if (event.time) {
            try {
                let eventDateTime;

                if (event.time.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                    const [hours, minutes, seconds = 0] = event.time.split(':').map(Number);

                    const todayUtc = new Date(Date.UTC(
                        new Date().getUTCFullYear(),
                        new Date().getUTCMonth(),
                        new Date().getUTCDate(),
                        hours, minutes, seconds
                    ));

                    eventDateTime = new Date(todayUtc.getTime() - (SOURCE_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000));

                } else {
                    eventDateTime = new Date(event.time);
                }

                if (!isNaN(eventDateTime.getTime())) {
                    const adjustedDateTimeMs = eventDateTime.getTime() + (TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
                    const adjustedDateTime = new Date(adjustedDateTimeMs);

                    adjustedTime = adjustedDateTime.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });

                } else {
                    console.warn(`[EventManager] No se pudo parsear "${event.time}" como una fecha/hora válida. Mostrando el string original.`);
                    adjustedTime = event.time;
                }

            } catch (e) {
                console.error(`[EventManager] Excepción al procesar la fecha/hora para "${event.title}" ("${event.time}"):`, e.message);
                adjustedTime = event.time || 'Error de fecha/hora';
            }
        }

        const displayStatus = event.status ? event.status.toUpperCase() : 'DESCONOCIDO';

        let newDescription = `Disfruta de ${event.title}`;
        if (displayStatus === 'EN VIVO') {
            newDescription += ` en vivo.`;
        } else if (displayStatus === 'PROXIMO') {
            newDescription += `. Comienza a las ${adjustedTime}.`;
        } else if (displayStatus === 'FINALIZADO') {
            newDescription += `. Finalizado a las ${adjustedTime}.`;
        } else {
            newDescription += `. Estado: ${displayStatus}.`;
        }

        if (!groupedEvents.has(groupKey)) {
            const posterImage = getPosterImage(event.title, event.status);
            const backgroundImage = getBackgroundImage(event.title);

            groupedEvents.set(groupKey, {
                id: eventId,
                title: event.title,
                time: adjustedTime,
                category: event.category,
                description: newDescription,
                displayStatus: displayStatus,
                poster: posterImage,
                background: backgroundImage,
                links: []
            });
        }
        groupedEvents.get(groupKey).links.push(event.link);
    });

    return Array.from(groupedEvents.values());
}

module.exports = {
    getGroupedEvents
};