const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

/**
 * Upload a file buffer to Pinata (IPFS pinning service).
 * Returns the IPFS CID (hash).
 *
 * NOTE: In development / without Pinata keys, this falls back to a
 *       deterministic mock hash so the rest of the system still works.
 */
async function uploadToIPFS(fileBuffer, fileName, metadata = {}) {
  const apiKey    = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;

  if (!apiKey || !secretKey || apiKey === "your_pinata_api_key") {
    console.warn("⚠️  IPFS: Pinata keys not set — using mock hash");
    const mockHash = "Qm" + crypto.createHash("sha256")
      .update(fileBuffer)
      .digest("hex")
      .slice(0, 44);
    return { ipfsHash: mockHash, url: `https://ipfs.io/ipfs/${mockHash}` };
  }

  const blob = new Blob([fileBuffer]);
  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("pinataMetadata", JSON.stringify({ name: fileName, keyvalues: metadata }));
  form.append("pinataOptions",  JSON.stringify({ cidVersion: 1 }));

  // Timeout after 90 seconds to prevent hanging
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method:  "POST",
      headers: {
        pinata_api_key:        apiKey,
        pinata_secret_api_key: secretKey,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      console.error("Pinata upload error response:", err);
      throw new Error(`Pinata upload failed (${res.status}): ${err}`);
    }

    const data     = await res.json();
    const ipfsHash = data.IpfsHash;
    return { ipfsHash, url: `https://gateway.pinata.cloud/ipfs/${ipfsHash}` };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.error("Pinata upload timed out after 90 seconds");
      throw new Error("IPFS upload timed out. Please try again with a smaller file.");
    }
    throw err;
  }
}

/**
 * Upload a JSON object to IPFS.
 */
async function uploadJSONToIPFS(jsonObject, name) {
  const buffer = Buffer.from(JSON.stringify(jsonObject));
  return uploadToIPFS(buffer, `${name}.json`, { type: "json" });
}

module.exports = { uploadToIPFS, uploadJSONToIPFS };
