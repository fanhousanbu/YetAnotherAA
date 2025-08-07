import { bls12_381 } from '@noble/curves/bls12-381.js';
import { hexToBytes } from '@noble/curves/abstract/utils.js';

async function main() {

    // private keys are 32 bytes
    const privateKey = hexToBytes('67d53f170b908cabb9eb326c3c337762d59289a8fec79f7bc9254b584b73265c');
    // const privKey = bls12_381.utils.randomPrivateKey();

    // Long signatures (G2), short public keys (G1)
    const blsl = bls12_381.longSignatures;
    const publicKey = blsl.getPublicKey(privateKey);
    // Sign msg with custom (Ethereum) DST
    const msg = new TextEncoder().encode('hello');
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    const msgp = blsl.hash(msg, DST);
    const signature = blsl.sign(msgp, privateKey);
    const isValid = blsl.verify(signature, msgp, publicKey);
    console.log({ publicKey, signature, isValid });

    // Short signatures (G1), long public keys (G2)
    const blss = bls12_381.shortSignatures;
    const publicKey2 = blss.getPublicKey(privateKey);
    const msgp2 = blss.hash(new TextEncoder().encode('hello'), 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_')
    const signature2 = blss.sign(msgp2, privateKey);
    const isValid2 = blss.verify(signature2, msgp2, publicKey);
    console.log({ publicKey2, signature2, isValid2 });

    // Aggregation
    const aggregatedKey = bls12_381.longSignatures.aggregatePublicKeys([
        bls12_381.utils.randomPrivateKey(),
        bls12_381.utils.randomPrivateKey(),
    ]);
}

main().catch(console.error);
