// Simple IPFS client using fetch instead of kubo-rpc-client
const PROJECT_ID = "2GajDLTC6y04qsYsoDRq9nGmWwK";
const PROJECT_SECRET = "48c62c6b3f82d2ecfa2cbe4c90f97037";
const PROJECT_ID_SECRECT = `${PROJECT_ID}:${PROJECT_SECRET}`;

export const ipfsClient = {
  async add(data: string) {
    const formData = new FormData();
    const blob = new Blob([data], { type: "application/json" });
    formData.append("file", blob, "metadata.json");

    const response = await fetch("https://ipfs.infura.io:5001/api/v0/add", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(PROJECT_ID_SECRECT).toString("base64")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  async *get(ipfsHash: string) {
    console.log(`Attempting to fetch IPFS hash: ${ipfsHash}`);

    // Clean the hash - remove any prefixes or extra characters
    const cleanHash = ipfsHash
      .replace(/^ipfs:\/\//, "")
      .replace(/^\/ipfs\//, "")
      .trim();
    console.log(`Cleaned hash: ${cleanHash}`);

    // Validate hash format
    if (!cleanHash || cleanHash.length < 10) {
      console.log(`Invalid IPFS hash detected: "${ipfsHash}" - this suggests the NFT was minted with an invalid URI`);
      return; // Return empty instead of throwing error
    }

    // Try multiple gateways
    const gateways = [
      `https://ipfs.io/ipfs/${cleanHash}`,
      `https://gateway.pinata.cloud/ipfs/${cleanHash}`,
      `https://cloudflare-ipfs.com/ipfs/${cleanHash}`,
    ];

    for (const gateway of gateways) {
      try {
        console.log(`Trying gateway: ${gateway}`);
        const response = await fetch(gateway);

        if (response.ok) {
          const text = await response.text();
          console.log(`Successfully fetched from: ${gateway}, length: ${text.length}`);
          yield new TextEncoder().encode(text);
          return;
        } else {
          console.log(`Gateway ${gateway} returned: ${response.status} - ${response.statusText}`);
        }
      } catch (error) {
        console.log(`Gateway ${gateway} failed:`, error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(`IPFS download failed: All gateways failed for hash: ${cleanHash}`);
  },
};

export async function getNFTMetadataFromIPFS(ipfsHash: string) {
  for await (const file of ipfsClient.get(ipfsHash)) {
    // The file is of type unit8array so we need to convert it to string
    const content = new TextDecoder().decode(file);
    // Remove any leading/trailing whitespace
    const trimmedContent = content.trim();
    // Find the start and end index of the JSON object
    const startIndex = trimmedContent.indexOf("{");
    const endIndex = trimmedContent.lastIndexOf("}") + 1;
    // Extract the JSON object string
    const jsonObjectString = trimmedContent.slice(startIndex, endIndex);
    try {
      const jsonObject = JSON.parse(jsonObjectString);
      return jsonObject;
    } catch (error) {
      console.log("Error parsing JSON:", error);
      return undefined;
    }
  }
}
