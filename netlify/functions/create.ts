import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import {
  CHAIN_ID,
  encrypt,
  getTokenId,
  SUPPORTED_CHAINS,
  DocumentBuilder,
  W3CTransferableRecordsConfig,
} from "@trustvc/trustvc";
import { TradeTrustToken__factory } from "@trustvc/trustvc/token-registry-v5/contracts";
import { CredentialSubjects } from "@trustvc/trustvc/w3c/vc";
import crypto from 'crypto';
import { ethers, Wallet } from "ethers";

const SUPPORTED_DOCUMENT: {
  [key: string]: string;
} = {
  SAMPLE: "https://chaindox.com/contexts/chaindox-sample-document.json",
  BILL_OF_LADING: "https://chaindox.com/contexts/bol-context.json",
  CERTIFICATE_OF_ORIGIN: "https://chaindox.com/contexts/coo-context.json",
  INVOICE: "https://chaindox.com/contexts/invoice-context.json",
  WAREHOUSE_RECEIPT: "https://chaindox.com/contexts/warehouse-context.json",
  ELECTRONIC_PROMISSORY_NOTE: "https://chaindox.com/contexts/electronic.json"
};

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
    // Extract documentId from path
    const pathMatch = event.path.match(/\/create\/([^\/]+)/);
    if (!pathMatch) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Document ID required' }),
      };
    }

    let documentId = pathMatch[1].toUpperCase();

    // Validate documentId
    if (!SUPPORTED_DOCUMENT[documentId]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Document not supported' }),
      };
    }

    const { credentialSubject, owner, holder, remarks } = JSON.parse(event.body || '{}') as {
      credentialSubject: CredentialSubjects,
      owner: string,
      holder: string,
      remarks: string
    };

    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error('Wallet private key not found in environment variables');
    }

    if (!process.env.DID_KEY_PAIRS) {
      throw new Error('DID key pairs not found in environment variables');
    }

    if (!process.env.TOKEN_REGISTRY_ADDRESS) {
      throw new Error('Token registry address not found in environment variables');
    }

    // Get environment variables
    const SYSTEM_TOKEN_REGISTRY_ADDRESS = process.env.TOKEN_REGISTRY_ADDRESS;
    const CHAINID: CHAIN_ID = process.env.NET as CHAIN_ID ?? CHAIN_ID.xdc;
    const CHAININFO = SUPPORTED_CHAINS[CHAINID];
    const RPC_PROVIDER_URL = CHAININFO.rpcUrl!

    console.log('Chain ID:', CHAINID);
    console.log('RPC URL:', RPC_PROVIDER_URL);
    console.log('Token Registry:', SYSTEM_TOKEN_REGISTRY_ADDRESS);

    // Remove escaped characters before parsing
    const cleanedJsonString = process.env.DID_KEY_PAIRS.replace(/\\(?=["])/g, '');
    const DID_KEY_PAIRS = JSON.parse(cleanedJsonString);

    // Prepare the document
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 3);
    const credentialStatus: W3CTransferableRecordsConfig = {
      chain: CHAININFO.currency,
      chainId: Number(CHAINID),
      tokenRegistry: SYSTEM_TOKEN_REGISTRY_ADDRESS,
      rpcProviderUrl: RPC_PROVIDER_URL
    };

    // create a base document with the required context
    const baseDocument = {
      "@context": [
        SUPPORTED_DOCUMENT[documentId],
        "https://trustvc.io/context/attachments-context.json",
      ]
    };

    const document = new DocumentBuilder(baseDocument);

    // Add tranferable record configuration
    document.credentialStatus(credentialStatus);
    // Add the actual document content/data about the asset
    document.credentialSubject(credentialSubject);
    // Set when this document expires
    document.expirationDate(expirationDate);
    // Define how the document should be rendered visually (template and renderer)
    document.renderMethod({
      id: "https://generic-templates.tradetrust.io",
      type: "EMBEDDED_RENDERER",
      templateName: documentId
    });

    // Sign the document
    const signedW3CDocument = await document.sign(DID_KEY_PAIRS);

    // Issue the document on chain:
    const tokenId = getTokenId(signedW3CDocument!);
    const unconnectedWallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);
    let provider;
    if (ethers.version.startsWith('6.')) {
      provider = new (ethers as any).JsonRpcProvider(CHAININFO.rpcUrl);
    } else if (ethers.version.includes('/5.')) {
      provider = new (ethers as any).providers.JsonRpcProvider(CHAININFO.rpcUrl);
    }
    const wallet = unconnectedWallet.connect(provider);
    const tokenRegistry = new ethers.Contract(
      SYSTEM_TOKEN_REGISTRY_ADDRESS,
      TradeTrustToken__factory.abi,
      wallet
    );

    // Encrypt remarks
    const encryptedRemarks = remarks ? `0x${encrypt(remarks, signedW3CDocument.id).replace(/^0x/, '')}` : '0x';

    // mint the document
    try {
      await tokenRegistry.mint.staticCall(owner, holder, tokenId, encryptedRemarks);
    } catch (error) {
      console.error(error);
      throw new Error('Failed to mint token');
    }

    let tx;
    // query gas station
    if (CHAININFO.gasStation) {
      const gasFees = await CHAININFO.gasStation();
      console.log('gasFees', gasFees);

      tx = await tokenRegistry.mint(owner, holder, tokenId, encryptedRemarks, {
        maxFeePerGas: gasFees!.maxFeePerGas?.toBigInt() ?? 0,
        maxPriorityFeePerGas: gasFees!.maxPriorityFeePerGas?.toBigInt() ?? 0,
      });
    } else {
      tx = await tokenRegistry.mint(owner, holder, tokenId, encryptedRemarks);
    }

    // Long polling for the transaction to be mined
    const receipt = await tx.wait()
    console.log(`Document ${documentId} minted on tx hash ${receipt?.hash}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ signedW3CDocument }),
    };

  } catch (error) {
    console.error('Create error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: {
          message: 'Internal server error',
          ...(process.env.NODE_ENV === 'development' ? { details: String(error) } : {})
        }
      }),
    };
  }
};
