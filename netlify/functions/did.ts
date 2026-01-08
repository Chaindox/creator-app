import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const didJson = {
  "id": "did:web:chaindox.com",
  "verificationMethod": [
    {
      "type": "Multikey",
      "id": "did:web:chaindox.com#keys-1",
      "controller": "did:web:chaindox.com",
      "publicKeyMultibase": "zDnaenmdBnFMFNemLUFWJy52TPLxagFzHLp6wpYEy2wXStM3J"
    }
  ],
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "authentication": [
    "did:web:chaindox.com#keys-1"
  ],
  "assertionMethod": [
    "did:web:chaindox.com#keys-1"
  ],
  "capabilityInvocation": [
    "did:web:chaindox.com#keys-1"
  ],
  "capabilityDelegation": [
    "did:web:chaindox.com#keys-1"
  ]
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
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

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(didJson),
  };
};
