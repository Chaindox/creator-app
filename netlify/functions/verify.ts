import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import {
  CHAIN_ID,
  SUPPORTED_CHAINS,
  isValid,
  verifyDocument,
} from "@trustvc/trustvc";
import crypto from 'crypto';

const authenticateApiKey = (event: HandlerEvent): boolean => {
  const apiKeyHeader = event.headers['x-api-key'];
  if (typeof apiKeyHeader !== 'string') {
    return false;
  }

  const envKey = process.env.API_KEY || '';
  const hash = (s: string) => crypto.createHash('sha256').update(s).digest();
  const headerHash = hash(apiKeyHeader);
  const envHash = hash(envKey);

  try {
    return crypto.timingSafeEqual(envHash, headerHash);
  } catch (e) {
    return false;
  }
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Authenticate API key
  if (!authenticateApiKey(event)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  try {
    const vc = JSON.parse(event.body || '{}');

    const CHAINID: CHAIN_ID = (process.env.NET as CHAIN_ID) ?? CHAIN_ID.xdc;
    const CHAININFO = SUPPORTED_CHAINS[CHAINID];
    const RPC_PROVIDER_URL = CHAININFO.rpcUrl!;

    const fragments = await verifyDocument(vc, RPC_PROVIDER_URL);

    const validity = isValid(fragments);
    const documentIntegrity = isValid(fragments, ["DOCUMENT_INTEGRITY"]);
    const documentStatus = isValid(fragments, ["DOCUMENT_STATUS"]);
    const issuerIdentity = isValid(fragments, ["ISSUER_IDENTITY"]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        VALIDITY: validity,
        DOCUMENT_INTEGRITY: documentIntegrity,
        DOCUMENT_STATUS: documentStatus,
        ISSUER_IDENTITY: issuerIdentity,
      }),
    };

  } catch (error) {
    console.error('Verification error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        VALIDITY: false,
        DOCUMENT_INTEGRITY: false,
        DOCUMENT_STATUS: false,
        ISSUER_IDENTITY: false,
      }),
    };
  }
};
