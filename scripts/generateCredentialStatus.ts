import { createCredentialStatusPayload, StatusList } from "@trustvc/trustvc/w3c/credential-status";
import { signCredential } from "@trustvc/trustvc/w3c/vc";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function createChaindoxStatusList() {
    try {
        console.log("🚀 Creating Chaindox Credential Status List...\n");

        const rawKeypair = process.env.DID_KEY_PAIRS;
        if (!rawKeypair) throw new Error('DID_KEY_PAIRS environment variable is not set');
        const keypair = JSON.parse(rawKeypair.replace(/\\(?=["])/g, ''));

        const hostingUrl = "https://chaindox.com/credentials/status/1";
        const credentialStatus = new StatusList({ length: 131072 });
        const purpose = "revocation";
        const encodedList = await credentialStatus.encode();
        console.log("✅ Encoded status list");

        const credentialSubject = {
            id: `${hostingUrl}#list`,
            type: "BitstringStatusList",
            statusPurpose: purpose,
            encodedList,
        } as const;

        const options = {
            id: hostingUrl,
            credentialSubject: credentialSubject,
        };

        console.log("\n📝 Creating credential status payload...");
        const credentialStatusVC = await createCredentialStatusPayload(
            options,
            keypair,
            'BitstringStatusListCredential',
            'ecdsa-sd-2023'
        );

        const { signed, error } = await signCredential(credentialStatusVC, keypair);
        if (error) {
            throw new Error(`Signing failed: ${error}`);
        }

        console.log("✅ Credential Status VC signed successfully!");

        const filename = 'chaindox-status-list-1.json';
        fs.writeFileSync(filename, JSON.stringify(signed, null, 2));
        fs.writeFileSync('chaindox-status-list-1-readable.json', JSON.stringify(signed, null, 2));

        return signed
    } catch (error) {
        throw error
    }
}

createChaindoxStatusList()
    .then(() => {
        console.log("\n✨ Script completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Script failed:", error);
        process.exit(1);
    });