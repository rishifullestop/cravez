import NodeCache from 'node-cache';

// Create a global cache instance with default options (TTL 0 = never expire)
const myCache = new NodeCache({ stdTTL: 0, checkperiod: 600 });

export default myCache;
