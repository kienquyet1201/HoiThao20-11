import { authHandler } from '../lib/auth.js';
import { nodeHandler } from '../lib/http.js';
export default nodeHandler(authHandler);
