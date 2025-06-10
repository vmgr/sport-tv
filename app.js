const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { ADDON_PORT, AVAILABLE_STREAM_PROVIDERS } = require('./config'); 
const { initImageMaps } = require('./image_manager');
const { getGroupedEvents, fetchAllEvents } = require('./event_manager');

const streamProviders = require('./servers/stream_providers');

let builder;

function defineCatalogHandler() {
    builder.defineCatalogHandler(async ({ type, id, extra }) => {
        const statusFilter = extra.estado || 'Todos';
        const categoryFilter = extra.categoria || 'Todas';

        if (id === 'sportslive_events_direct' && type === 'tv') {

            const groupedEvents = await getGroupedEvents(statusFilter, categoryFilter); 

            const metas = groupedEvents.map(eventGroup => ({
                id: `sportslive:${eventGroup.id}`,
                type: 'tv',
                name: eventGroup.title,
                poster: eventGroup.poster,
                description: eventGroup.description,
                posterShape: 'tv',
                background: eventGroup.background,
                releaseInfo: `${eventGroup.time} - ${eventGroup.displayStatus}`, 
            }));
            return Promise.resolve({ metas });
        }
        return Promise.resolve({ metas : [] });
    });
}

function defineMetaHandler() {
    builder.defineMetaHandler(async ({ type, id }) => { 
        if (type === 'tv' && id.startsWith('sportslive:')) {
            const eventGroupId = id.replace('sportslive:', '');
            
            const groupedEvents = await getGroupedEvents('Todos', 'Todas'); 

            const eventGroup = groupedEvents.find(group => group.id === eventGroupId);

            if (eventGroup) { 
                const meta = {
                    id: id,
                    type: 'tv',
                    name: eventGroup.title,
                    poster: eventGroup.poster, 
                    background: eventGroup.background,
                    description: eventGroup.description,
                    releaseInfo: `${eventGroup.time} - ${eventGroup.displayStatus}`, 
                    posterShape: 'tv',
                };
                return Promise.resolve({ meta: meta });
            }
        }
        return Promise.resolve({ meta : null });
    });
}



function defineStreamHandler() {
    builder.defineStreamHandler(async function(args) {
        if (args.type === 'tv' && args.id.startsWith('sportslive:')) {
            const eventGroupId = args.id.replace('sportslive:', '');
            
            const groupedEvents = await getGroupedEvents('Todos', 'Todas'); 
            const eventGroup = groupedEvents.find(group => group.id === eventGroupId);

            if (!eventGroup) {
                return Promise.resolve({ streams: [] });
            }

            if (eventGroup.displayStatus === 'FINALIZADO') { 
                return Promise.resolve({ streams: [] }); 
            }

            if (eventGroup.links && eventGroup.links.length > 0) {
                const streams = [];

                const userConfig = args.extra.config || {};
                const enabledProviders = userConfig.enabledProviders && userConfig.enabledProviders.length > 0
                                                ? userConfig.enabledProviders
                                                : AVAILABLE_STREAM_PROVIDERS.map(p => p.id);

                let optionCounter = 1;

                for (let i = 0; i < eventGroup.links.length; i++) {
                    const link = eventGroup.links[i];
                    
                    const urlObj = new URL(link);
                    let streamNameFromLink = urlObj.searchParams.get('stream') || `Canal Desconocido`; 
                    
                    streamNameFromLink = streamNameFromLink.replace(/_/g, ' ').toUpperCase();

                    for (const providerId in streamProviders) {
                        if (enabledProviders.includes(providerId)) {
                            const getProviderUrl = streamProviders[providerId];
                            try {
                                const decipheredUrl = await getProviderUrl(link);
                                if (decipheredUrl) {
                                    let providerName = providerId;
                                    if (providerId === 'streamtp') providerName = 'StreamTP';
                                    if (providerId === 'la12hd') providerName = 'La12HD';
                                    if (providerId === '1envivo') providerName = '1EnVivo';

                                    streams.push({
                                        url: decipheredUrl,
                                        title: `${streamNameFromLink} (Opción ${optionCounter})\nDesde ${providerName}`
                                    });
                                    optionCounter++; 
                                }
                            } catch (error) {
                                console.error(`[ADDON] Error al descifrar por ${providerId} para ${eventGroup.title} (enlace ${i+1}, ${link}):`, error.message);
                            }
                        }
                    }
                }
                return Promise.resolve({ streams: streams });
            } else {
                return Promise.resolve({ streams: [] });
            }
        }
        return Promise.resolve({ streams: [] });
    });
}



Promise.all([
    initImageMaps(),
    fetchAllEvents() 
])
.then(([_, allEventsData]) => { 
    const categoriesSet = new Set(allEventsData.map(event => event.category).filter(Boolean));
    uniqueCategories = Array.from(categoriesSet).sort(); 
    
    
    builder = addonBuilder({
        id: 'com.stremio.sports.live.addon',
        version: '1.0.0',
        name: 'Sports Live',
        description: 'Eventos deportivos en vivo y programados.', 

        types: ['tv'],
        resources: ['catalog', 'meta', 'stream'],
        idPrefixes: ['sportslive:'],

        catalogs: [
            {
                id: 'sportslive_events_direct',
                name: 'Eventos Deportivos',
                type: 'tv',
                extra: [
                    {
                        name: 'estado',
                        options: ['Todos', 'En vivo', 'Pronto', 'Finalizados'],
                        isRequired: false,
                        default: 'Todos'
                    },
                    { 
                        name: 'categoria',
                        options: ['Todas', ...uniqueCategories],
                        isRequired: false,
                        default: 'Todas'
                    }
                ]
            }
        ],

        behaviorHints: {
            configurable: true, 
        },
    });

    defineCatalogHandler();
    defineMetaHandler();
    defineStreamHandler();


    const manifest = builder.getInterface().manifest;

    serveHTTP(builder.getInterface(), {
        port: ADDON_PORT,
        middleware: (req, res, next) => {
            next(); 
        }
    });
})
.catch(err => {
    console.error(`[ADDON] ¡ERROR CRÍTICO! El addon no se pudo iniciar porque no se pudieron cargar todos los mapas de imágenes o el HTML de la homepage.`, err);
    process.exit(1);
});
