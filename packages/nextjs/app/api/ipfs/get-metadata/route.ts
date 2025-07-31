import { getNFTMetadataFromIPFS } from "~~/utils/simpleNFT/ipfs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || !body.ipfsHash) {
      return Response.json({ error: "Missing ipfsHash in request body" }, { status: 400 });
    }

    const { ipfsHash } = body;
    const res = await getNFTMetadataFromIPFS(ipfsHash);
    return Response.json(res);
  } catch (error) {
    console.log("Error getting metadata from ipfs", error);
    return Response.json({ error: "Error getting metadata from ipfs" }, { status: 500 });
  }
}
