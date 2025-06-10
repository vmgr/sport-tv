const getStreamTpUrl = require('./streamtp');
const getLa12HdUrl = require('./la12hd');
const get1EnVivoUrl = require('./1envivo');
module.exports = {
    streamtp: getStreamTpUrl,
    la12hd: getLa12HdUrl,
    '1envivo': get1EnVivoUrl, 
};
