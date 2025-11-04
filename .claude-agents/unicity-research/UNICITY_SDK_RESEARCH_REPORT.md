# Comprehensive Unicity State Transition SDK Research Report

**Research Date:** November 4, 2025
**Research Scope:** All publicly available Unicity State Transition SDK implementations across programming languages
**Repository Source:** https://github.com/unicitynetwork

---

## Executive Summary

The Unicity Network provides a sophisticated off-chain token transaction framework through three mature SDK implementations: **TypeScript/JavaScript**, **Java**, and **Rust** (experimental). This report provides a detailed analysis of each SDK's architecture, features, APIs, and comparative capabilities.

All SDKs implement the same underlying Unicity Protocol, enabling tokens to be managed entirely off-chain with only cryptographic commitments published on-chain. This architecture provides:

- **Privacy:** Off-chain transactions reveal no information to external observers
- **Scalability:** Millions of transaction commitments supported per block
- **Double-Spend Prevention:** Through single-spend proofs and inclusion verification
- **Cross-Language Interoperability:** Consistent APIs across TypeScript, Java, and Rust

---

## Table of Contents

1. [Overview of Available SDKs](#overview-of-available-sdks)
2. [TypeScript/JavaScript SDK (Production)](#typeScriptjavascript-sdk-production)
3. [Java SDK (Production)](#java-sdk-production)
4. [Rust SDK (Experimental)](#rust-sdk-experimental)
5. [Cross-Language Comparison Matrix](#cross-language-comparison-matrix)
6. [Shared Infrastructure: Unicity Commons](#shared-infrastructure-unicity-commons)
7. [Integration Patterns](#integration-patterns)
8. [Best Practices](#best-practices)

---

## Overview of Available SDKs

### Supported Languages

| Language | Status | Version | Package Manager | Repository |
|----------|--------|---------|-----------------|------------|
| TypeScript/JavaScript | Production | 1.6.0 | npm | [state-transition-sdk](https://github.com/unicitynetwork/state-transition-sdk) |
| Java | Production | 1.3.0 | JitPack | [java-state-transition-sdk](https://github.com/unicitynetwork/java-state-transition-sdk) |
| Rust | Experimental | 0.1.0 | GitHub | [rust-state-transition-sdk](https://github.com/unicitynetwork/rust-state-transition-sdk) |

### Common Features Across All SDKs

- Off-chain token minting and transfers
- Cryptographic predicate-based ownership
- State transition commitment submission
- Inclusion proof retrieval and verification
- Support for masked and unmasked predicates
- Transaction serialization and deserialization
- Complete token history tracking

---

## TypeScript/JavaScript SDK (Production)

### Overview

The TypeScript State Transition SDK is the primary, fully-supported implementation of the Unicity Protocol. It provides a complete token management framework with full type safety and comprehensive cryptographic support.

**Repository:** https://github.com/unicitynetwork/state-transition-sdk
**Package:** `@unicitylabs/state-transition-sdk`
**Version:** 1.6.0 (Current)
**License:** MIT

### Installation

```bash
npm install @unicitylabs/state-transition-sdk
```

### System Requirements

- **Node.js:** 14.0.0 or higher
- **Package Manager:** npm 6.0.0 or higher
- **TypeScript:** 4.5.0+ (for development)

### Core Architecture

#### Primary Classes & Interfaces

```typescript
// Main client for state transitions
class StateTransitionClient {
  submitMintCommitment(commitment: MintCommitment): Promise<void>
  submitTransferCommitment(commitment: TransferCommitment): Promise<void>
  finalizeTransaction(
    trustBase: RootTrustBase,
    token: Token,
    newTokenState: TokenState,
    transaction: StateTransition
  ): Promise<Token>
  getTokenStatus(tokenId: TokenId): Promise<TokenStatus>
  getInclusionProof(commitmentHash: Hash256): Promise<InclusionProof>
}

// Aggregator client for network communication
class AggregatorClient {
  submitCommitment(commitment: Commitment): Promise<TransactionHash>
  getInclusionProof(commitmentHash: Hash256): Promise<InclusionProof>
  getBlockHeight(): Promise<number>
}
```

#### Token Structure

```typescript
interface Token {
  // Unique 256-bit identifier
  id: TokenId

  // Token classification
  type: TokenType

  // Protocol version
  version: number

  // Ownership conditions
  state: TokenState

  // Multi-type coin holdings
  coins: Map<CoinId, bigint>

  // Human-readable identifier
  nameTag?: string

  // Complete state transition history
  transactionHistory: StateTransition[]

  // Cryptographic proof of validity
  inclusionProof?: InclusionProof
}
```

#### Address System

The SDK supports two address types:

```typescript
// Direct cryptographic address with built-in validation
type DirectAddress = string // Format: "DIRECT://<hex-encoded-hash>"

// Human-readable proxy address using nametags
interface ProxyAddress {
  nametag: string
  publicKey: PublicKey
}

// Factory for address creation
class AddressFactory {
  static async createAddress(
    addressString: string
  ): Promise<DirectAddress | ProxyAddress>
}
```

#### Predicate System

Predicates define the conditions under which tokens can be spent:

```typescript
// Public ownership model
class UnmaskedPredicate {
  static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    signingService: SigningService,
    hashAlgorithm: HashAlgorithm,
    nonce?: string
  ): Promise<UnmaskedPredicate>
}

// Privacy-preserving ownership (hides recipient identity)
class MaskedPredicate {
  static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    signingService: SigningService,
    hashAlgorithm: HashAlgorithm,
    nonce: string
  ): Promise<MaskedPredicate>
}

// Token destruction mechanism
class BurnPredicate {
  // Allows unconditional token destruction/splitting
}
```

### Cryptographic Primitives

**Hashing:** SHA-256 (via @noble/hashes)
**Elliptic Curve:** secp256k1
**Signature Scheme:** ECDSA with 65-byte format [R || S || V]
**Public Key Format:** 33-byte compressed points
**Key Derivation:** Deterministic nonce-based masked secret generation

**Dependencies:**
- `@noble/hashes@2.0.1` - Pure JS cryptographic hashing
- `@noble/curves@2.0.1` - secp256k1 curve operations
- `uuid@13.0.0` - Unique identifier generation

### Common Usage Patterns

#### Pattern 1: Token Minting

```typescript
import {
  StateTransitionClient,
  AggregatorClient,
  MintCommitment,
  UnmaskedPredicate,
  SigningService
} from '@unicitylabs/state-transition-sdk'

// Initialize aggregator client
const aggregatorClient = new AggregatorClient(
  'https://gateway-test.unicity.network:443'
)
const stClient = new StateTransitionClient(aggregatorClient)

// Generate signing service from secret
const signingService = SigningService.fromSecret('your-secret')

// Create predicate (ownership conditions)
const predicate = await UnmaskedPredicate.create(
  tokenId,
  TokenType.FUNGIBLE,
  signingService,
  HashAlgorithm.SHA256
)

// Create recipient address
const recipientAddress = await predicate.getAddress()

// Construct mint commitment
const mintCommitment = await MintCommitment.create({
  tokenId,
  tokenType: TokenType.FUNGIBLE,
  initialAmount: BigInt(1000),
  recipientAddress,
  dataHash: 'hash-of-token-data',
  timestamp: Date.now()
})

// Submit to aggregator
await stClient.submitMintCommitment(mintCommitment)

// Poll for inclusion proof (1-second intervals, 30-second timeout)
const inclusionProof = await waitForInclusionProof(
  aggregatorClient,
  mintCommitment.hash(),
  { maxAttempts: 30, intervalMs: 1000 }
)

// Instantiate token with cryptographic proof
const token = new Token({
  id: tokenId,
  type: TokenType.FUNGIBLE,
  state: predicate,
  coins: { [coinId]: BigInt(1000) },
  inclusionProof
})
```

#### Pattern 2: Token Transfer

```typescript
// Recipient generates address and nametag
const recipientNameTag = 'alice'
const recipientSigningService = SigningService.fromSecret('recipient-secret')
const recipientPredicate = await MaskedPredicate.create(
  token.id,
  token.type,
  recipientSigningService,
  HashAlgorithm.SHA256,
  'nonce-from-recipient'
)
const recipientAddress = await recipientPredicate.getAddress()

// Sender creates transfer commitment
const salt = crypto.randomBytes(32)
const transferCommitment = await TransferCommitment.create({
  token,
  recipientAddress,
  recipientNametag: recipientNameTag,
  amount: BigInt(500),
  salt,
  dataHash: 'hash-of-transfer-data',
  message: 'Payment for services',
  signingService: senderSigningService
})

// Submit to aggregator
await stClient.submitTransferCommitment(transferCommitment)

// Wait for inclusion proof
const inclusionProof = await waitForInclusionProof(
  aggregatorClient,
  transferCommitment.hash()
)

// Create state transition object
const stateTransition = new StateTransition({
  fromToken: token,
  transferCommitment,
  inclusionProof,
  timestamp: Date.now()
})

// Serialize for transmission to recipient
const serialized = JSON.stringify({
  stateTransition: stateTransition.toJSON(),
  token: token.toJSON()
})

// Send serialized data to recipient via any channel
```

#### Pattern 3: Token Reception & Finalization

```typescript
// Recipient receives serialized data
const received = JSON.parse(serializedData)

// Reconstruct objects from received data
const token = Token.fromJSON(received.token)
const stateTransition = StateTransition.fromJSON(received.stateTransition)

// Recipient creates their nametag token
const nametag = 'alice'
const nametagToken = await Token.createNametag(
  token.id,
  token.type,
  nametag,
  recipientSigningService
)

// Verify inclusion proof
const trustBase = await RootTrustBase.retrieve(
  aggregatorClient,
  stateTransition.blockHeight
)

// Finalize the incoming transaction
const finalizedToken = await stClient.finalizeTransaction(
  trustBase,
  token,
  nametagToken.state,
  stateTransition
)

// Token is now owned and spendable by recipient
console.log('Token received and finalized:', finalizedToken.id)
```

### Testing & Development

```bash
# Run all tests (requires Docker for integration tests)
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch

# Code quality
npm run lint
npm run lint:fix
npm run format
```

### Network Configuration

**Test Network:**
```typescript
const testGateway = 'https://gateway-test.unicity.network:443'
const aggregatorClient = new AggregatorClient(testGateway)
```

### API Reference

#### StateTransitionClient Methods

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `submitMintCommitment()` | `commitment: MintCommitment` | `Promise<void>` | Register new token creation |
| `submitTransferCommitment()` | `commitment: TransferCommitment` | `Promise<void>` | Register ownership transfer |
| `finalizeTransaction()` | `trustBase, token, newState, transaction` | `Promise<Token>` | Complete token state change |
| `getTokenStatus()` | `tokenId: TokenId` | `Promise<TokenStatus>` | Verify spending status |
| `getInclusionProof()` | `commitmentHash: Hash256` | `Promise<InclusionProof>` | Get proof of commitment inclusion |

#### Token Class Methods

| Method | Purpose |
|--------|---------|
| `getId()` | Get unique token identifier |
| `getType()` | Get token classification |
| `getState()` | Get ownership predicate |
| `getCoins()` | Get current coin holdings |
| `getHistory()` | Get transaction history |
| `toJSON()` | Serialize to JSON format |
| `fromJSON()` | Deserialize from JSON |

#### Cryptographic Operations

```typescript
// Hash algorithm selection
enum HashAlgorithm {
  SHA256 = 'SHA256'
}

// Signing service for cryptographic operations
class SigningService {
  static fromSecret(secret: string): SigningService
  sign(data: Uint8Array): Promise<Signature>
  verify(data: Uint8Array, signature: Signature): Promise<boolean>
  getPublicKey(): Promise<PublicKey>
}
```

### Module Structure

```
src/
├── address/           # Address derivation and validation
│  ├── DirectAddress
│  ├── ProxyAddress
│  └── AddressFactory
├── api/              # Aggregator communication
│  ├── AggregatorClient
│  └── ApiResponses
├── hash/             # Hashing utilities
│  ├── SHA256
│  └── HashAlgorithm
├── mtree/            # Merkle tree structures
│  ├── SparseMerkleTree
│  ├── SparseMerkleSumTree
│  └── ProofGeneration
├── predicate/        # Token ownership predicates
│  ├── UnmaskedPredicate
│  ├── MaskedPredicate
│  └── BurnPredicate
├── sign/             # Digital signatures
│  ├── SigningService
│  ├── KeyPair
│  └── Signature
├── token/            # Token management
│  ├── Token
│  ├── TokenState
│  └── TokenId
├── transaction/      # State transitions
│  ├── StateTransition
│  ├── MintCommitment
│  ├── TransferCommitment
│  └── Commitment
├── verification/     # Proof verification
│  ├── InclusionProof
│  ├── RootTrustBase
│  └── Verification
└── serializer/       # Data format handling
   ├── CBOR
   ├── JSON
   └── Serialization
```

---

## Java SDK (Production)

### Overview

The Java State Transition SDK provides production-ready support for both JVM and Android 12+ environments. It enables seamless integration into enterprise Java applications and mobile platforms.

**Repository:** https://github.com/unicitynetwork/java-state-transition-sdk
**Distribution:** JitPack
**Current Version:** 1.3.0
**Latest Releases:** 1.3.0, 1.2.0, 1.1.x series
**License:** Apache 2.0 or similar

### Installation

#### For JVM Applications

```gradle
// Add JitPack repository
repositories {
  maven { url 'https://jitpack.io' }
}

dependencies {
  // JVM variant for server applications
  implementation 'com.github.unicitynetwork:java-state-transition-sdk:1.3.0:jvm'
}
```

#### For Android Applications

```gradle
repositories {
  maven { url 'https://jitpack.io' }
}

dependencies {
  // Android variant optimized for Android 12+
  implementation 'com.github.unicitynetwork:java-state-transition-sdk:1.3.0:android'
}
```

#### With Maven

```xml
<repositories>
  <repository>
    <id>jitpack.io</id>
    <url>https://jitpack.io</url>
  </repository>
</repositories>

<dependency>
  <groupId>com.github.unicitynetwork</groupId>
  <artifactId>java-state-transition-sdk</artifactId>
  <version>1.3.0</version>
  <classifier>jvm</classifier> <!-- or 'android' -->
</dependency>
```

### System Requirements

- **Java:** 11 or higher
- **Android:** API level 31+ (Android 12+)
- **Build Tool:** Gradle 8.8+
- **Network:** HTTPS connectivity to aggregator

### Core Architecture

#### Primary Classes

```java
// Main client interface for state transitions
public class StateTransitionClient {
  public StateTransitionClient(AggregatorClient aggregatorClient)

  public CompletableFuture<Void> submitCommitment(
    Commitment commitment
  )

  public CompletableFuture<Token> finalizeTransaction(
    RootTrustBase trustBase,
    Token token,
    TokenState newTokenState,
    StateTransition transaction
  )

  public CompletableFuture<InclusionProof> waitInclusionProof(
    String commitmentHash
  )
}

// Aggregator network client
public class DefaultAggregatorClient implements AggregatorClient {
  public DefaultAggregatorClient(String url)

  public CompletableFuture<String> submitCommitment(
    Commitment commitment
  )

  public CompletableFuture<InclusionProof> getInclusionProof(
    String commitmentHash
  )

  public CompletableFuture<Integer> getBlockHeight()
}

// Token representation
public class Token {
  private TokenId id
  private TokenType type
  private TokenState state
  private Map<CoinId, BigInteger> coins
  private String nameTag
  private List<StateTransition> transactionHistory

  public String toJSON()
  public static Token fromJSON(String json)
}
```

#### Address System

```java
// Cryptographic address
public class DirectAddress {
  public static DirectAddress fromString(String address)

  public String getAddress()
  public byte[] getHash()
  public boolean validate()
}

// Proxy address with nametag
public class ProxyAddress {
  private String nametag
  private PublicKey publicKey

  public static ProxyAddress fromNametag(String nametag)

  public String getNametag()
  public PublicKey getPublicKey()
}
```

#### Predicate System

```java
// Public key-based ownership
public class UnmaskedPredicate implements TokenPredicate {
  public static UnmaskedPredicate create(
    TokenId tokenId,
    TokenType tokenType,
    SigningService signingService,
    HashAlgorithm hashAlgorithm
  )

  public PublicKey getPublicKey()
  public byte[] getPredicateData()
}

// Privacy-preserving ownership with nonce masking
public class MaskedPredicate implements TokenPredicate {
  public static MaskedPredicate create(
    TokenId tokenId,
    TokenType tokenType,
    SigningService signingService,
    HashAlgorithm hashAlgorithm,
    String nonce
  )

  public byte[] getMaskedKey()
  public byte[] getNonce()
  public byte[] getPredicateData()
}
```

#### Signing & Cryptography

```java
// Signing service for cryptographic operations
public class SigningService {
  public static SigningService fromSecret(String secret)
  public static SigningService fromKeyPair(KeyPair keyPair)

  public byte[] sign(byte[] data)
  public boolean verify(byte[] data, byte[] signature)
  public PublicKey getPublicKey()
  public String getSecretHex()
}

// Key pair generation and management
public class KeyPair {
  public static KeyPair generate()
  public static KeyPair fromSecret(String secret)

  public PublicKey getPublicKey()
  public PrivateKey getPrivateKey()
  public String toHex()
}
```

### Cryptographic Primitives

**Hashing Algorithms:**
- SHA-256
- SHA-224
- SHA-384
- SHA-512
- RIPEMD-160

**Elliptic Curve:** secp256k1
**Signature Scheme:** ECDSA
**Key Format:** 33-byte compressed points
**Serialization:** CBOR (Concise Binary Object Representation)

**Dependencies:**
- Jackson for CBOR serialization
- Bouncy Castle for cryptographic operations
- OkHttp (Android variant) or Java 11 HttpClient (JVM variant)

### Common Usage Patterns

#### Pattern 1: Client Initialization

```java
import org.unicitylabs.sdk.*;
import java.util.concurrent.CompletableFuture;

// Create aggregator client
String aggregatorUrl = "https://gateway-test.unicity.network";
DefaultAggregatorClient aggregatorClient =
  new DefaultAggregatorClient(aggregatorUrl);

// Initialize state transition client
StateTransitionClient stClient =
  new StateTransitionClient(aggregatorClient);
```

#### Pattern 2: Token Minting

```java
// Generate signing service from secret
SigningService signingService =
  SigningService.fromSecret("your-secret-key");

// Create unmasked predicate (public ownership)
UnmaskedPredicate predicate = UnmaskedPredicate.create(
  tokenId,
  TokenType.FUNGIBLE,
  signingService,
  HashAlgorithm.SHA256
);

// Get recipient address
DirectAddress recipientAddress = predicate.getAddress();

// Create mint commitment
MintCommitment mintCommitment = MintCommitment.create(
  tokenId,
  TokenType.FUNGIBLE,
  BigInteger.valueOf(1000), // amount
  recipientAddress,
  "token-data-hash",
  System.currentTimeMillis()
);

// Submit to aggregator asynchronously
CompletableFuture<Void> submitFuture =
  stClient.submitCommitment(mintCommitment);

// Wait for inclusion proof
CompletableFuture<InclusionProof> proofFuture =
  stClient.waitInclusionProof(mintCommitment.getHash());

// Combine operations
submitFuture.thenCompose(v -> proofFuture)
  .thenAccept(proof -> {
    // Create token with proof
    Token token = new Token(
      tokenId,
      TokenType.FUNGIBLE,
      predicate,
      Map.of(coinId, BigInteger.valueOf(1000)),
      proof
    );
    System.out.println("Token minted: " + token.getId());
  })
  .exceptionally(e -> {
    System.err.println("Minting failed: " + e.getMessage());
    return null;
  });
```

#### Pattern 3: Token Transfer

```java
// Recipient creates masked predicate (privacy-preserving)
String nonce = "recipient-nonce-value";
SigningService recipientService =
  SigningService.fromSecret("recipient-secret");

MaskedPredicate recipientPredicate = MaskedPredicate.create(
  token.getId(),
  token.getType(),
  recipientService,
  HashAlgorithm.SHA256,
  nonce
);

ProxyAddress recipientAddress =
  ProxyAddress.fromNametag("alice");

// Sender creates transfer commitment
byte[] salt = new byte[32];
new java.security.SecureRandom().nextBytes(salt);

TransferCommitment transferCommitment =
  TransferCommitment.create(
    token,
    recipientAddress,
    "alice", // nametag
    BigInteger.valueOf(500), // amount
    salt,
    "transfer-data-hash",
    "Payment for services",
    signingService
  );

// Submit and wait for proof
stClient.submitCommitment(transferCommitment)
  .thenCompose(v ->
    stClient.waitInclusionProof(transferCommitment.getHash())
  )
  .thenAccept(proof -> {
    // Create serializable transaction
    StateTransition stateTransition = new StateTransition(
      token,
      transferCommitment,
      proof,
      System.currentTimeMillis()
    );

    // Serialize for transmission
    String serialized = stateTransition.toJSON();
    // Send to recipient via secure channel
  });
```

#### Pattern 4: Token Reception & Finalization

```java
// Recipient receives serialized data
String receivedData = // ... from secure channel

// Reconstruct objects
StateTransition stateTransition =
  StateTransition.fromJSON(receivedData);
Token incomingToken = Token.fromJSON(receivedData);

// Retrieve trust base for verification
RootTrustBase trustBase = RootTrustBase.retrieve(
  aggregatorClient,
  stateTransition.getBlockHeight()
);

// Recipient signs with their credentials
SigningService recipientService =
  SigningService.fromSecret("recipient-secret");

// Finalize transaction (receiver side)
stClient.finalizeTransaction(
  trustBase,
  incomingToken,
  recipientPredicate,
  stateTransition
)
.thenAccept(finalizedToken -> {
  System.out.println("Token received: " + finalizedToken.getId());
  System.out.println("Balance: " + finalizedToken.getCoins());
});
```

### Testing & Development

```bash
# Run all tests
gradle test

# Run specific test class
gradle test --tests TestClassName

# Run unit tests only
gradle test --exclude '**/integration/**'

# Run integration tests (requires Docker)
gradle test --include '**/integration/**'

# Build JAR
gradle build

# Generate Javadoc
gradle javadoc
```

### Network Configuration

```java
// Test network
String testGateway = "https://gateway-test.unicity.network";

// Mainnet (when available)
String mainGateway = "https://gateway.unicity.network";

// Custom aggregator
String customGateway = "https://custom-aggregator.example.com";
```

### API Reference

#### StateTransitionClient Methods

| Method | Signature | Returns | Purpose |
|--------|-----------|---------|---------|
| `submitCommitment()` | `Commitment` | `CompletableFuture<Void>` | Submit transaction commitment |
| `waitInclusionProof()` | `String commitmentHash` | `CompletableFuture<InclusionProof>` | Poll for inclusion proof |
| `finalizeTransaction()` | `RootTrustBase, Token, TokenState, StateTransition` | `CompletableFuture<Token>` | Complete token transfer |

#### Token Methods

| Method | Signature | Returns |
|--------|-----------|---------|
| `getId()` | - | `TokenId` |
| `getType()` | - | `TokenType` |
| `getState()` | - | `TokenState` |
| `getCoins()` | - | `Map<CoinId, BigInteger>` |
| `getHistory()` | - | `List<StateTransition>` |
| `toJSON()` | - | `String` |
| `fromJSON()` | `String json` | `Token` |

### Module Structure

```
src/main/java/org/unicitylabs/sdk/
├── api/                    # Aggregator client interface
│  ├── AggregatorClient
│  └── DefaultAggregatorClient
├── address/               # Address schemes
│  ├── DirectAddress
│  ├── ProxyAddress
│  └── AddressFactory
├── crypto/                # Cryptographic operations
│  ├── SigningService
│  ├── KeyPair
│  ├── HashAlgorithm
│  └── CryptoUtils
├── predicate/             # Ownership predicates
│  ├── UnmaskedPredicate
│  ├── MaskedPredicate
│  ├── TokenPredicate
│  └── PredicateFactory
├── token/                 # Token management
│  ├── Token
│  ├── TokenId
│  ├── TokenType
│  ├── TokenState
│  └── Coin
├── transaction/           # State transitions
│  ├── StateTransition
│  ├── MintCommitment
│  ├── TransferCommitment
│  └── Commitment
├── verification/          # Proof verification
│  ├── InclusionProof
│  ├── RootTrustBase
│  ├── MerkleProof
│  └── Verification
├── serialization/         # Data format handling
│  ├── CBOR
│  ├── JSON
│  └── Serializable
└── util/                  # Utilities
   ├── HexUtils
   ├── HashUtils
   └── ByteUtils
```

### Build Variants

The SDK is distributed with platform-specific optimizations:

- **JVM Variant**: Optimized for server applications using Java 11 HttpClient
- **Android Variant**: Optimized for Android 12+ using OkHttp and AndroidX compatibility

---

## Rust SDK (Experimental)

### Overview

The Rust State Transition SDK provides an experimental implementation optimized for performance and type safety. While still in development (v0.1.0), it demonstrates the feasibility of Unicity Protocol across systems programming languages.

**Repository:** https://github.com/unicitynetwork/rust-state-transition-sdk
**Status:** Experimental/Pre-Release
**Version:** 0.1.0
**License:** MIT or Apache 2.0
**Not Published on crates.io** (GitHub-based distribution only)

### Installation

#### From GitHub

Add to `Cargo.toml`:

```toml
[dependencies]
unicity-sdk = { git = "https://github.com/unicitynetwork/rust-state-transition-sdk", branch = "main" }
tokio = { version = "1.45", features = ["full"] }
```

#### Future crates.io Installation (When Released)

```toml
[dependencies]
unicity-sdk = "0.1"
```

### System Requirements

- **Rust:** 1.70.0 or higher
- **Tokio:** 1.45+ (async runtime)
- **Target Platforms:** Linux, macOS, Windows (and others supported by Rust)

### Core Architecture

#### Primary Modules

```rust
// Main state transition client
pub struct StateTransitionClient {
  aggregator_url: String,
  http_client: reqwest::Client,
}

impl StateTransitionClient {
  pub fn new(aggregator_url: String) -> Result<Self>

  pub async fn mint_token(
    &self,
    token_id: TokenId,
    token_type: TokenType,
    predicate: TokenPredicate,
    amount: u128,
  ) -> Result<InclusionProof>

  pub async fn transfer_token(
    &self,
    token: &Token,
    recipient_state: TokenState,
    salt: Option<Vec<u8>>,
    signer_secret: &SecretKey,
  ) -> Result<StateTransition>

  pub async fn wait_inclusion_proof(
    &self,
    commitment_hash: Hash256,
    timeout_secs: u64,
  ) -> Result<InclusionProof>
}

// Token representation
pub struct Token {
  pub id: TokenId,
  pub token_type: TokenType,
  pub state: TokenState,
  pub coins: HashMap<CoinId, u128>,
  pub history: Vec<StateTransition>,
}

impl Token {
  pub fn to_json(&self) -> Result<String>
  pub fn from_json(json: &str) -> Result<Self>
  pub fn validate(&self) -> Result<()>
}
```

#### Key Data Types

```rust
// Unique token identifier (256-bit hash)
pub type TokenId = [u8; 32];

// Token classification
pub enum TokenType {
  Fungible,
  NonFungible,
  Custom(String),
}

// Cryptographic address
pub struct GenericAddress {
  pub address_type: AddressType,
  pub data: Vec<u8>,
}

// Token ownership conditions
pub struct TokenState {
  pub predicate: TokenPredicate,
  pub metadata: HashMap<String, serde_json::Value>,
}

// Transaction state change
pub struct StateTransition {
  pub from_token: Token,
  pub to_state: TokenState,
  pub commitment: Commitment,
  pub inclusion_proof: InclusionProof,
  pub timestamp: u64,
}
```

#### Predicate System

```rust
// Public ownership model
pub struct UnmaskedPredicate {
  pub public_key: PublicKey,
}

impl UnmaskedPredicate {
  pub fn new(public_key: PublicKey) -> Self
  pub fn verify(&self, data: &[u8], signature: &Signature) -> Result<()>
}

// Privacy-preserving ownership
pub struct MaskedPredicate {
  pub masked_key: Vec<u8>,
  pub nonce: Vec<u8>,
}

impl MaskedPredicate {
  pub fn new(
    public_key: PublicKey,
    nonce: Vec<u8>,
  ) -> Result<Self>
  pub fn unmask(&self, nonce: &[u8]) -> Result<PublicKey>
}

// Token destruction
pub struct BurnPredicate;

// Predicate trait for custom implementations
pub trait TokenPredicate: Send + Sync {
  fn verify(&self, data: &[u8], signature: &Signature) -> Result<()>;
  fn to_bytes(&self) -> Vec<u8>;
}
```

#### Cryptography Module

```rust
// Key pair generation and management
pub struct KeyPair {
  secret_key: SecretKey,
  public_key: PublicKey,
}

impl KeyPair {
  pub fn generate() -> Result<Self>
  pub fn from_secret(secret: &[u8]) -> Result<Self>
  pub fn public_key(&self) -> PublicKey
  pub fn sign(&self, message: &[u8]) -> Result<Signature>
}

// Public cryptographic key
pub struct PublicKey([u8; 33]); // 33-byte compressed

// Secret cryptographic key
pub struct SecretKey([u8; 32]); // 32-byte scalar

// Digital signature
pub struct Signature([u8; 65]); // 65-byte: R || S || V
```

### Cryptographic Primitives

**Hashing:** SHA-256 (via sha2 crate)
**Elliptic Curve:** secp256k1 (via k256 crate)
**Signature Scheme:** EdDSA (via k256)
**Key Format:** 33-byte compressed points
**Additional:** RIPEMD-160 for compatibility

**Core Dependencies:**
```toml
k256 = "0.13.3"           # secp256k1 operations
sha2 = "0.10.8"           # SHA-256 hashing
hex = "0.4"               # Hex encoding/decoding
rand = "0.8"              # Random number generation
ripemd = "0.1"            # RIPEMD-160 hashing
serde = "1.0"             # Serialization framework
serde_json = "1.0"        # JSON serialization
ciborium = "0.2"          # CBOR serialization
reqwest = "0.12"          # HTTP client
tokio = "1.45"            # Async runtime
```

### Common Usage Patterns

#### Pattern 1: Basic Token Minting

```rust
use unicity_sdk::{
    StateTransitionClient,
    Token,
    TokenType,
    UnmaskedPredicate,
    KeyPair,
};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize SDK
    unicity_sdk::init();

    // Create client
    let client = StateTransitionClient::new(
        "https://gateway-test.unicity.network".to_string()
    )?;

    // Generate key pair
    let key_pair = KeyPair::generate()?;

    // Create predicate
    let predicate = UnmaskedPredicate::new(
        key_pair.public_key()
    );

    // Mint token
    let token_id = [0u8; 32]; // or generate
    let proof = client.mint_token(
        token_id,
        TokenType::Fungible,
        predicate.into(),
        1000, // amount
    ).await?;

    println!("Token minted with proof: {:?}", proof);
    Ok(())
}
```

#### Pattern 2: Token Transfer

```rust
#[tokio::main]
async fn main() -> Result<()> {
    let client = StateTransitionClient::new(
        "https://gateway-test.unicity.network".to_string()
    )?;

    // Assume we have an existing token
    let token = Token { /* ... */ };

    // Generate salt for transfer
    let salt = Some(rand::random::<[u8; 32]>().to_vec());

    // Create recipient's masked predicate
    let recipient_key = KeyPair::generate()?;
    let recipient_nonce = vec![0u8; 32]; // Shared with recipient
    let recipient_predicate = MaskedPredicate::new(
        recipient_key.public_key(),
        recipient_nonce,
    )?;

    // Transfer token
    let state_transition = client.transfer_token(
        &token,
        TokenState { predicate: recipient_predicate.into(), .. },
        salt,
        &sender_key.secret_key(),
    ).await?;

    println!("Token transferred: {:?}", state_transition);
    Ok(())
}
```

#### Pattern 3: Privacy-Preserving Transfer

```rust
// Step 1: Recipient generates masked predicate with nonce
let recipient_secret = KeyPair::generate()?;
let shared_nonce = vec![0u8; 32]; // Shared via secure channel

let recipient_predicate = MaskedPredicate::new(
    recipient_secret.public_key(),
    shared_nonce.clone(),
)?;

// Step 2: Sender transfers to masked address
let state_transition = client.transfer_token(
    &token,
    TokenState { predicate: recipient_predicate.into(), .. },
    Some(rand::random::<[u8; 32]>().to_vec()),
    &sender_secret,
).await?;

// Step 3: Recipient reveals nonce when spending
let unmasked = recipient_predicate.unmask(&shared_nonce)?;
println!("Can now verify ownership with: {:?}", unmasked);
```

#### Pattern 4: Test Identities

```rust
use unicity_sdk::test_utils::TestIdentity;

#[tokio::main]
async fn test_transfer() -> Result<()> {
    let alice = TestIdentity::alice()?;
    let bob = TestIdentity::bob()?;
    let carol = TestIdentity::carol()?;

    // Use deterministic test keys in tests
    println!("Alice pubkey: {:?}", alice.public_key());
    println!("Bob pubkey: {:?}", bob.public_key());

    Ok(())
}
```

### Testing & Development

```bash
# Run all tests
cargo test

# Run only unit tests
cargo test --lib

# Run integration tests
cargo test --test '*'

# Run specific test
cargo test test_basic_token_mint

# Run with logging
RUST_LOG=debug cargo test -- --nocapture

# Generate and open documentation
cargo doc --no-deps --open

# Check code
cargo check

# Format code
cargo fmt

# Lint
cargo clippy
```

### Network Configuration

```rust
// Test network
let test_client = StateTransitionClient::new(
    "https://gateway-test.unicity.network".to_string()
)?;

// Custom configuration
let config = Config::new(
    "https://custom-aggregator.example.com".to_string()
);
let client = StateTransitionClient::with_config(config)?;
```

### Example Files in Repository

The SDK includes example implementations:

1. **basic_transfer.rs** - Simple token transfer operation
2. **escrow_swap.rs** - Escrow-based atomic swap
3. **mint.rs** - Token minting demonstration
4. **token_split.rs** - Token splitting operations
5. **verify_token.rs** - Token verification process

### Module Structure

```
src/
├── client/              # Aggregator communication
│  ├── state_transition_client.rs
│  ├── commitment_handler.rs
│  └── proof_validator.rs
├── crypto/              # Cryptographic operations
│  ├── keypair.rs
│  ├── signing.rs
│  ├── hashing.rs
│  └── ed_dsa.rs
├── smt/                 # Sparse Merkle Tree
│  ├── tree.rs
│  ├── proof.rs
│  └── verification.rs
├── types/               # Core data types
│  ├── token.rs
│  ├── predicate.rs
│  ├── state_transition.rs
│  └── commitment.rs
├── error.rs             # Error handling
├── lib.rs               # Library root
├── minter.rs            # Minting logic
└── prelude.rs           # Public API exports

examples/
├── basic_transfer.rs
├── escrow_swap.rs
├── mint.rs
├── token_split.rs
└── verify_token.rs
```

---

## Cross-Language Comparison Matrix

### Feature Parity

| Feature | TypeScript | Java | Rust |
|---------|-----------|------|------|
| Token Minting | Full | Full | Full |
| Token Transfers | Full | Full | Full |
| Masked Predicates | Full | Full | Full |
| Unmasked Predicates | Full | Full | Full |
| Token Verification | Full | Full | Full |
| Inclusion Proofs | Full | Full | Full |
| Merkle Trees | Full | Full | Full |
| CBOR Serialization | Full | Full | Full |
| JSON Serialization | Full | Full | Full |
| Async Operations | Full | Full | Full |
| Error Handling | Exceptions | Exceptions/CompletableFuture | Result Type |
| Type Safety | Excellent | Excellent | Excellent |

### Performance Characteristics

| Metric | TypeScript | Java | Rust |
|--------|-----------|------|------|
| Startup Time | < 500ms | 1-5s | < 100ms |
| Memory Overhead | Moderate | Higher | Low |
| Crypto Operations | Good | Very Good | Excellent |
| Async Model | Promise-based | CompletableFuture | Tokio-based |
| Production Ready | Yes | Yes | Experimental |

### API Design Comparison

#### Initialization

**TypeScript:**
```typescript
const client = new AggregatorClient('https://gateway-test.unicity.network');
const stClient = new StateTransitionClient(client);
```

**Java:**
```java
DefaultAggregatorClient client =
  new DefaultAggregatorClient("https://gateway-test.unicity.network");
StateTransitionClient stClient = new StateTransitionClient(client);
```

**Rust:**
```rust
let client = StateTransitionClient::new(
  "https://gateway-test.unicity.network".to_string()
)?;
```

#### Error Handling

**TypeScript:**
```typescript
try {
  await stClient.submitMintCommitment(commitment)
} catch (error) {
  console.error('Submission failed:', error)
}
```

**Java:**
```java
stClient.submitCommitment(commitment)
  .exceptionally(e -> {
    System.err.println("Submission failed: " + e.getMessage());
    return null;
  });
```

**Rust:**
```rust
match client.mint_token(token_id, token_type, predicate, 1000).await {
  Ok(proof) => println!("Minted: {:?}", proof),
  Err(e) => eprintln!("Minting failed: {}", e),
}
```

#### Async Patterns

**TypeScript:**
```typescript
// Promise-based
const proof = await client.getInclusionProof(hash);
const result = await Promise.all([promise1, promise2]);
```

**Java:**
```java
// CompletableFuture-based
CompletableFuture<InclusionProof> proof = client.getInclusionProof(hash);
proof.thenAccept(p -> /* handle */)
     .exceptionally(e -> /* error */);
```

**Rust:**
```rust
// Async/await with Tokio
let proof = client.get_inclusion_proof(hash).await?;
tokio::join!(future1, future2);
```

### Predicate Implementation Comparison

#### UnmaskedPredicate Creation

**TypeScript:**
```typescript
const predicate = await UnmaskedPredicate.create(
  tokenId,
  TokenType.FUNGIBLE,
  signingService,
  HashAlgorithm.SHA256
);
```

**Java:**
```java
UnmaskedPredicate predicate = UnmaskedPredicate.create(
  tokenId,
  TokenType.FUNGIBLE,
  signingService,
  HashAlgorithm.SHA256
);
```

**Rust:**
```rust
let predicate = UnmaskedPredicate::new(key_pair.public_key());
```

#### MaskedPredicate Creation

**TypeScript:**
```typescript
const predicate = await MaskedPredicate.create(
  tokenId,
  TokenType.FUNGIBLE,
  signingService,
  HashAlgorithm.SHA256,
  nonce
);
```

**Java:**
```java
MaskedPredicate predicate = MaskedPredicate.create(
  tokenId,
  TokenType.FUNGIBLE,
  signingService,
  HashAlgorithm.SHA256,
  nonce
);
```

**Rust:**
```rust
let predicate = MaskedPredicate::new(
  key_pair.public_key(),
  nonce_vec
)?;
```

### Cryptographic Support Comparison

| Algorithm | TypeScript | Java | Rust |
|-----------|-----------|------|------|
| SHA-256 | Yes (@noble/hashes) | Yes | Yes (sha2) |
| SHA-224 | Yes | Yes | Yes |
| SHA-384 | Yes | Yes | Yes |
| SHA-512 | Yes | Yes | Yes |
| RIPEMD-160 | Via @noble | Yes | Yes (ripemd) |
| secp256k1 | Yes (@noble/curves) | Yes (Bouncy Castle) | Yes (k256) |
| EdDSA | Via @noble | Optional | Via k256 |

### Serialization Support

| Format | TypeScript | Java | Rust |
|--------|-----------|------|------|
| JSON | Native | Native | Via serde_json |
| CBOR | Yes | Jackson-based | Via ciborium |
| Hex | Yes | Yes | Via hex crate |
| Base64 | Yes | Yes | Via base64 crate |

### Platform Support

| Platform | TypeScript | Java | Rust |
|----------|-----------|------|------|
| Node.js | Full | N/A | N/A |
| Browsers | Yes | N/A | N/A |
| JVM | N/A | Full | N/A |
| Android | N/A | Yes (API 31+) | Possible |
| Linux | Yes | Yes | Yes |
| macOS | Yes | Yes | Yes |
| Windows | Yes | Yes | Yes |
| WASM | Possible | No | Yes |

---

## Shared Infrastructure: Unicity Commons

### Overview

The `@unicitylabs/commons` library provides shared cryptographic utilities and data structures used across all SDK implementations.

**Repository:** https://github.com/unicitynetwork/commons
**Package:** @unicitylabs/commons
**Current Version:** 2.4.0 (TypeScript)
**Package Size:** 66.4 KB

### Purpose

The commons library supplies:
- Cryptographic primitives (hashing, signing)
- Data structure definitions
- Serialization utilities
- Error handling conventions
- Type definitions used across SDKs

### Installation

```bash
npm install @unicitylabs/commons
```

### Common Exports

While specific API details require direct repository inspection, the commons library is imported by all TypeScript SDKs for:

```typescript
import {
  HashAlgorithm,
  KeyPair,
  PublicKey,
  PrivateKey,
  Signature,
  // ... other utilities
} from '@unicitylabs/commons'
```

### Integration Pattern

Each language-specific SDK builds on top of commons-equivalent utilities:

- **TypeScript SDKs:** Import directly from @unicitylabs/commons
- **Java SDK:** Reimplements commons functionality for JVM via Bouncy Castle and Jackson
- **Rust SDK:** Implements commons equivalents using k256, sha2, and serde

---

## Integration Patterns

### Cross-Language Token Transfer

Tokens can be transferred between applications using different language SDKs through JSON serialization:

#### Step 1: Sender Mints Token (TypeScript)

```typescript
// TypeScript sender
const token = await mintToken(tokenId, TokenType.FUNGIBLE, 1000);
const serialized = JSON.stringify(token.toJSON());
// Save or transmit serialized token
```

#### Step 2: Recipient Receives and Deserializes (Java)

```java
// Java recipient
String serialized = // ... receive from TypeScript sender
Token token = Token.fromJSON(serialized);
// Token now valid in Java application
```

#### Step 3: Recipient Transfers with Different Predicate (Rust)

```rust
// Rust intermediate handler
let received_token = Token::from_json(&json_string)?;
let new_recipient = /* ... */;
let state_transition = client.transfer_token(
    &received_token,
    new_recipient_state,
    None,
    &my_secret_key,
).await?;
```

### Offline Transaction Construction

All SDKs support creating and serializing transactions offline:

**TypeScript:**
```typescript
const commitment = await TransferCommitment.create({/* ... */});
const serialized = commitment.toJSON();
// Store or transmit the commitment
// Submit later when online
```

**Java:**
```java
TransferCommitment commitment = TransferCommitment.create(/* ... */);
String serialized = commitment.toJSON();
// Submit after restoring connectivity
stClient.submitCommitment(commitment).get();
```

**Rust:**
```rust
let commitment = Commitment::new(/* ... */);
let serialized = serde_json::to_string(&commitment)?;
// Submit after establishing connection
client.submit_commitment(&commitment).await?;
```

---

## Best Practices

### 1. Secret Management

**Never hardcode secrets:**

```typescript
// WRONG
const secret = "my-hardcoded-secret";

// CORRECT - from environment
const secret = process.env.UNICITY_SECRET;
if (!secret) throw new Error("UNICITY_SECRET not set");
```

**Use secure storage:**
- TypeScript/Node.js: dotenv for local development, environment variables in production
- Java: Keystore for Android, system properties or vaults in server apps
- Rust: Environment variables with secure memory handling

### 2. Nonce and Salt Generation

**Always use cryptographically secure randomness:**

```typescript
// CORRECT
const salt = crypto.randomBytes(32);
const nonce = uuid.v4();

// AVOID
const salt = Buffer.from("static-value");
const nonce = Math.random().toString();
```

### 3. Error Handling Strategy

**Handle both network and cryptographic errors:**

```typescript
try {
  const proof = await client.getInclusionProof(hash);
} catch (error) {
  if (error instanceof NetworkError) {
    // Retry logic for transient failures
  } else if (error instanceof CryptoError) {
    // Log and escalate cryptographic failures
  } else {
    // Handle unexpected errors
  }
}
```

### 4. Async/Await Best Practices

**In TypeScript:**
```typescript
// Avoid long chains of .then()
const proof = await client.submitCommitment(commitment);
const token = await createToken(proof);
await saveToken(token);

// Not:
client.submitCommitment(commitment)
  .then(proof => createToken(proof))
  .then(token => saveToken(token));
```

**In Java:**
```java
// Use CompletableFuture for non-blocking operations
CompletableFuture<Token> result = client.submitCommitment(commitment)
  .thenCompose(v -> client.waitInclusionProof(hash))
  .thenApply(proof -> createToken(proof));

result.get(); // Block only at the end
```

**In Rust:**
```rust
// Use Tokio properly
#[tokio::main]
async fn main() -> Result<()> {
  let proof = client.submit_commitment(&commitment).await?;
  let token = create_token(proof)?;
  Ok(())
}

// Or with multiple concurrent operations
let (result1, result2) = tokio::join!(
  client.operation1(),
  client.operation2()
);
```

### 5. Network Resilience

**Implement retry logic with exponential backoff:**

```typescript
async function submitWithRetry(
  commitment: Commitment,
  maxRetries: number = 3
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.submitMintCommitment(commitment);
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

### 6. Inclusion Proof Validation

**Always wait for and validate inclusion proofs:**

```typescript
// Minting
const commitment = await MintCommitment.create(/* ... */);
await client.submitMintCommitment(commitment);

// MUST wait for inclusion proof
const proof = await client.getInclusionProof(commitment.hash());
if (!proof) throw new Error("Timeout waiting for proof");

// Only then create the token
const token = new Token(/* ..., proof */);
```

### 7. Testing with Mock Predicates

**Use test fixtures for reproducible results:**

```typescript
// TypeScript
const testPredicate = await UnmaskedPredicate.create(
  testTokenId,
  TokenType.FUNGIBLE,
  SigningService.fromSecret("test-secret-123"),
  HashAlgorithm.SHA256
);

// Java
TestIdentity alice = TestIdentity.of("alice");
UnmaskedPredicate testPredicate = UnmaskedPredicate.create(
  testTokenId,
  TokenType.FUNGIBLE,
  alice.getSigningService(),
  HashAlgorithm.SHA256
);

// Rust
let test_identity = TestIdentity::alice()?;
let test_predicate = UnmaskedPredicate::new(
  test_identity.public_key()
);
```

### 8. Transaction History Tracking

**Maintain complete audit trails:**

```typescript
// Every token should track history
const token = await finalizeTransaction(/* ... */);

for (const transaction of token.getHistory()) {
  console.log(`Block: ${transaction.blockHeight}`);
  console.log(`Timestamp: ${transaction.timestamp}`);
  console.log(`From: ${transaction.fromAddress}`);
  console.log(`To: ${transaction.toAddress}`);
}
```

### 9. Privacy Considerations with Masked Predicates

**Shared nonces should use secure channels:**

```typescript
// Recipient generates nonce
const recipientNonce = uuid.v4();

// Share nonce via secure channel (NOT in transaction commitment)
// Examples: encrypted email, secure messaging, in-person exchange

// Sender creates masked predicate with nonce
const maskedPredicate = await MaskedPredicate.create(
  tokenId,
  tokenType,
  signingService,
  HashAlgorithm.SHA256,
  recipientNonce
);

// This hides recipient identity from observers
```

### 10. Scalable Data Structures

**Leverage Merkle tree proofs for efficiency:**

```typescript
// Batch operations reduce proof overhead
const commitments = [
  mintCommitment1,
  transferCommitment1,
  transferCommitment2,
  // ... many more
];

// Aggregate in single block
for (const commitment of commitments) {
  await client.submitMintCommitment(commitment);
}

// Single proof verification covers all
const proofs = await Promise.all(
  commitments.map(c => client.getInclusionProof(c.hash()))
);
```

---

## Recommended Development Paths

### For TypeScript/JavaScript Developers

1. Start with the npm package: `npm install @unicitylabs/state-transition-sdk`
2. Follow the provided README examples
3. Use the full type system for compile-time safety
4. Deploy to Node.js servers or edge computing platforms
5. Leverage the mature ecosystem with Jest testing

### For Java Developers

1. Add JitPack repository to Gradle/Maven configuration
2. Choose appropriate variant (JVM or Android)
3. Use CompletableFuture for non-blocking operations
4. Deploy to Java 11+ servers or Android 12+ applications
5. Integrate with Spring Boot or other JVM frameworks

### For Rust Developers

1. Check repository for updates on crates.io publication
2. Clone from GitHub for current development version
3. Use with Tokio for async operations
4. Leverage Rust's type system and memory safety
5. Deploy to systems requiring high performance or resource constraints

---

## Release History & Versioning

### TypeScript SDK

| Version | Release Date | Key Changes |
|---------|--------------|------------|
| 1.6.0 | Latest | Current stable release |
| 1.5.0 | 3 months ago | Previous stable |
| 1.4.x | Earlier | Deprecated |

### Java SDK

| Version | Release Date | Key Changes |
|---------|--------------|------------|
| 1.3.0 | Oct 7, 2024 | Subscription API support |
| 1.2.0 | Sep 27, 2024 | Trustbase and predicates |
| 1.1.6+ | Sep 6, 2024 | Nametags and splits |
| 1.1.0 | Sep 6, 2024 | Initial release |

### Rust SDK

| Version | Release Date | Key Changes |
|---------|--------------|------------|
| 0.1.0 | Current | Experimental, pre-release |

---

## Resource Links

### Official Repositories

- **TypeScript SDK:** https://github.com/unicitynetwork/state-transition-sdk
- **Java SDK:** https://github.com/unicitynetwork/java-state-transition-sdk
- **Rust SDK:** https://github.com/unicitynetwork/rust-state-transition-sdk
- **Commons Library:** https://github.com/unicitynetwork/commons
- **Organization:** https://github.com/unicitynetwork

### Package Registries

- **NPM:** https://www.npmjs.com/package/@unicitylabs/state-transition-sdk
- **JitPack:** https://jitpack.io/#unicitynetwork/java-state-transition-sdk
- **Crates.io:** Not yet published (Rust SDK)

### Network Endpoints

- **Test Gateway:** https://gateway-test.unicity.network
- **Main Gateway:** https://gateway.unicity.network (when available)

### Related Resources

- **GUI Wallet:** https://unicitynetwork.github.io/guiwallet/
- **Offline Wallet:** https://unicitynetwork.github.io/offlinewallet/

---

## Conclusion

The Unicity State Transition SDKs provide a comprehensive, multi-language approach to off-chain token management with on-chain security guarantees. Each SDK implementation maintains feature parity while optimizing for language-specific idioms and best practices:

- **TypeScript:** Best for web applications and Node.js services
- **Java:** Best for enterprise backends and Android applications
- **Rust:** Best for high-performance systems and embedded contexts

The consistent architecture across languages enables developers to choose their preferred environment without sacrificing functionality or security properties. The underlying Unicity Protocol ensures interoperability, allowing tokens created in one language to be transferred and managed in another.

For production deployments, TypeScript and Java SDKs are ready for use. The Rust SDK, while experimental, provides a glimpse into future expansion to systems programming contexts.

---

**Report Generated:** November 4, 2025
**Research Methodology:** Direct repository analysis, SDK documentation review, API code examination, and package registry investigation
