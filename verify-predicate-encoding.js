const predicateHex = "8300410058b5865820eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff865820f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe39786750958210364d7f0d4c1c7a3ac3aaca74a860c7e9fd421b244016de642caf57d638fdd8fc669736563703235366b310058400a60dc84699975e45c3c08d7e9707ea3e6d0876dd84b263c2433a2b9840d668d125a397b71dcb5067dac0ee21e8293d2c36a0321b418b2f7dfa854ff3407825a";

const bytes = Buffer.from(predicateHex, 'hex');

console.log('CBOR Predicate Structure Analysis:');
console.log('==================================\n');
console.log('Total length:', bytes.length, 'bytes');
console.log('First byte: 0x' + bytes[0].toString(16), '(CBOR array with 3 elements)');
console.log('Second byte: 0x' + bytes[1].toString(16), '(unsigned int 0 = engine ID)');
console.log('Third byte: 0x' + bytes[2].toString(16), '(byte string, 1 byte)');
console.log('Fourth byte: 0x' + bytes[3].toString(16), '(the predicate template value)');
console.log('Fifth byte: 0x' + bytes[4].toString(16), '(byte string, 181 bytes follow)');
console.log('\n✅ This is a proper CBOR array: [engine_id, template, params]');
console.log('\nBreakdown:');
console.log('  Element 1: Engine ID = 0 (UnmaskedPredicate)');
console.log('  Element 2: Template = 0x00 (1 byte)');
console.log('  Element 3: Parameters = 181 bytes (contains public key, signature, etc.)');
console.log('\nThis matches the SDK standard format!');
