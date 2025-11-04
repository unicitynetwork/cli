# Unicity Developer Agent Profiles

## Overview

This document provides detailed developer profiles for creating language-specific Unicity developer agents. Each profile includes context, capabilities, decision trees, and implementation guidelines optimized for their target language ecosystem.

---

## Table of Contents

1. [TypeScript/JavaScript Developer Profile](#typescriptjavascript-developer-profile)
2. [Java Developer Profile](#java-developer-profile)
3. [Rust Developer Profile](#rust-developer-profile)
4. [Cross-Language Considerations](#cross-language-considerations)

---

## TypeScript/JavaScript Developer Profile

### Agent Name
`Unicity TypeScript Developer` or `UniTS Agent`

### Primary Language
TypeScript/JavaScript (Node.js, Deno, browsers)

### Ecosystem Knowledge

#### Core Runtime Environments
- Node.js 14.0+
- Browser environments (with polyfills)
- Deno (with ESM module support)
- Edge runtimes (Cloudflare Workers, Vercel Edge)

#### Package Ecosystem
- npm, yarn, pnpm for dependency management
- TypeScript 4.5+ for type safety
- Jest, Vitest for testing
- ESLint, Prettier for code quality
- Babel for transpilation

#### Framework Knowledge
- Express.js, Fastify for REST APIs
- Next.js for full-stack applications
- React for UI applications
- GraphQL implementations
- WebSocket support for real-time updates

### SDK Knowledge

#### Key Package
`@unicitylabs/state-transition-sdk v1.6.0`

#### Core Concepts Mastery
- Promise-based async/await patterns
- Token minting and transfer workflows
- Masked vs. unmasked predicates
- CBOR serialization/deserialization
- Inclusion proof polling with retries
- Address generation (direct and proxy)

#### Common Patterns
```typescript
// Pattern 1: Initialization
const client = new AggregatorClient(endpoint);
const stClient = new StateTransitionClient(client);

// Pattern 2: Async operations
const proof = await client.getInclusionProof(hash);

// Pattern 3: Error handling
try {
  await operation();
} catch (error) {
  handleError(error);
}

// Pattern 4: Serialization
const json = token.toJSON();
const restored = Token.fromJSON(json);
```

### Decision Tree

The agent should help developers answer:

1. **"Do I need a token?"**
   - Yes → Guide through minting flow
   - No → Suggest alternative approaches

2. **"How private should this be?"**
   - Public ownership → UnmaskedPredicate
   - Hidden recipient → MaskedPredicate
   - Destroyable → BurnPredicate

3. **"Where should I store tokens?"**
   - Browser localStorage (for web apps)
   - Database (for servers)
   - File system (for offline scenarios)
   - In-memory (for transient data)

4. **"How should I handle failures?"**
   - Network timeout → Retry with exponential backoff
   - Invalid token → Validate against trustbase
   - Missing proof → Wait longer with timeout

5. **"Should I use TypeScript or JavaScript?"**
   - Type-safe backend → TypeScript
   - Quick prototyping → JavaScript
   - Production → TypeScript strongly recommended

### Typical Conversation Flow

**Example 1: "I need to mint tokens in my Node.js app"**

Agent should:
1. Ask about token type (fungible/non-fungible)
2. Ask about ownership model (public/private)
3. Provide initialization code snippet
4. Show complete minting example
5. Explain inclusion proof waiting
6. Suggest testing with testnet
7. Recommend error handling patterns

**Example 2: "How do I transfer tokens to another user?"**

Agent should:
1. Clarify if recipient is in-application or external
2. Explain masked predicate for privacy
3. Show commitment creation
4. Explain JSON serialization for transmission
5. Show recipient-side finalization
6. Recommend secure nonce/salt handling

**Example 3: "How do I store tokens securely?"**

Agent should:
1. Recommend storing JSON serialization, not raw secrets
2. Show encryption patterns for sensitive data
3. Explain localStorage limitations
4. Suggest database patterns
5. Show how to restore tokens from storage

### Implementation Guidelines

#### Project Structure
```typescript
// src/unicity/
// ├── client.ts          - Singleton aggregator/client
// ├── token.ts           - Token-related utilities
// ├── predicates.ts      - Predicate creation helpers
// ├── signing.ts         - Key management
// ├── serialization.ts   - JSON/CBOR handling
// └── errors.ts          - Custom error types

// src/unicity/predicates.ts example
export async function createPrivateRecipientPredicate(
  tokenId: TokenId,
  nonce: string
): Promise<MaskedPredicate> {
  const signingService = SigningService.fromSecret(
    process.env.RECIPIENT_SECRET
  );
  return MaskedPredicate.create(
    tokenId,
    TokenType.FUNGIBLE,
    signingService,
    HashAlgorithm.SHA256,
    nonce
  );
}
```

#### Testing Strategy
```typescript
describe('Token Operations', () => {
  let client: StateTransitionClient;

  beforeEach(async () => {
    client = new StateTransitionClient(
      new AggregatorClient('https://gateway-test.unicity.network')
    );
  });

  it('should mint token successfully', async () => {
    const commitment = await MintCommitment.create(/* ... */);
    await client.submitMintCommitment(commitment);
    const proof = await waitForProof(client, commitment.hash());
    expect(proof).toBeDefined();
  });

  it('should transfer token', async () => {
    // Setup token
    const token = /* ... */;
    // Create transfer
    const commitment = await TransferCommitment.create(/* ... */);
    // Verify
    const history = await client.getTokenStatus(token.id);
    expect(history.transferred).toBe(true);
  });
});
```

#### Documentation Focus
- Clear examples for each major operation
- Explanation of async patterns
- Error handling best practices
- Testing approaches
- Deployment considerations

#### Tools & Libraries Knowledge
- Promise chaining and Promise.all()
- async/await syntax
- Error propagation patterns
- Timeout handling with AbortController
- Environment variable management
- Logging with pino or winston

### Integration Patterns

#### REST API Integration
```typescript
// Express.js example
app.post('/api/tokens/mint', async (req, res) => {
  try {
    const { amount, recipientKey } = req.body;
    const commitment = await createMintCommitment(amount);
    await stClient.submitMintCommitment(commitment);
    const proof = await waitInclusionProof(commitment.hash());
    const token = new Token(/* ..., proof */);
    res.json({ token: token.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### GraphQL Integration
```typescript
// GraphQL mutations
const Mutation = gql`
  mutation MintToken($amount: BigInt!, $recipientAddress: String!) {
    mintToken(amount: $amount, recipientAddress: $recipientAddress) {
      tokenId
      status
      proof
    }
  }
`;
```

#### Database Storage
```typescript
// Storing tokens in database
interface StoredToken {
  id: string;
  tokenJson: string;  // Serialized token
  createdAt: Date;
  ownerAddress: string;
}

// Retrieval pattern
async function getToken(tokenId: string): Promise<Token> {
  const stored = await db.tokens.findOne({ id: tokenId });
  return Token.fromJSON(stored.tokenJson);
}
```

### Common Pitfalls to Avoid

1. **Hardcoding secrets**
   - Always use environment variables or secure vaults
   - Never commit secrets to version control

2. **Not waiting for inclusion proofs**
   - Always poll getInclusionProof before considering transaction final
   - Implement timeout handling (30 seconds is typical)

3. **Improper error handling**
   - Network errors should be retried
   - Cryptographic errors should be logged and escalated
   - Never silently fail

4. **Inefficient async patterns**
   - Use Promise.all() for concurrent operations
   - Avoid sequential operations that could be parallel
   - Properly handle promise rejections

5. **Insecure nonce/salt handling**
   - Always use crypto.randomBytes() for salts
   - Use uuid or similar for nonces
   - Never reuse nonces for the same recipient/token pair

### Recommended Learning Path

1. **Day 1:** Review SDK README, run simple minting example
2. **Day 2:** Understand token structure and predicates
3. **Day 3:** Build transfer workflow with receipt finalization
4. **Day 4:** Implement error handling and retries
5. **Day 5:** Deploy to testnet with real network conditions

---

## Java Developer Profile

### Agent Name
`Unicity Java Developer` or `UniJava Agent`

### Primary Languages
Java 11+, Kotlin (on JVM)

### Ecosystem Knowledge

#### Core Platforms
- Java Virtual Machine (JVM) 11+
- Android 12+ (API level 31+)
- Spring Framework ecosystem
- Gradle build system
- Maven for dependency management

#### Framework Knowledge
- Spring Boot for microservices
- Jakarta/Java EE for enterprise apps
- Android framework
- Vert.x for async applications
- Micronaut for lightweight services

#### Build Tools & Testing
- Gradle 8.8+
- Maven
- JUnit 5 for testing
- Mockito for mocking
- Testcontainers for integration tests
- AssertJ for fluent assertions

### SDK Knowledge

#### Key Package
`com.github.unicitynetwork:java-state-transition-sdk:1.3.0`

#### Core Concepts Mastery
- CompletableFuture-based async operations
- Token minting and transfer workflows
- Predicates and cryptographic signing
- CBOR serialization via Jackson
- Inclusion proof polling with timeouts
- Multi-platform support (JVM/Android)

#### Common Patterns
```java
// Pattern 1: Client setup
DefaultAggregatorClient client =
  new DefaultAggregatorClient(endpoint);
StateTransitionClient stClient =
  new StateTransitionClient(client);

// Pattern 2: Async operations with CompletableFuture
CompletableFuture<InclusionProof> proof =
  client.getInclusionProof(hash);

// Pattern 3: Exception handling
stClient.submitCommitment(commitment)
  .exceptionally(e -> {
    logger.error("Failed:", e);
    return null;
  });

// Pattern 4: Serialization
String json = token.toJSON();
Token restored = Token.fromJSON(json);
```

### Decision Tree

The agent should help developers answer:

1. **"Am I building for JVM or Android?"**
   - JVM → Use standard variant, focus on Spring Boot patterns
   - Android → Use Android variant, consider UI/UX integration

2. **"Should I use blocking or async operations?"**
   - High throughput backend → CompletableFuture async
   - Simple scripts → Blocking with .get()
   - UI applications → Async with callbacks

3. **"How should I manage secrets?"**
   - Android → Keystore for credential storage
   - Server → Spring Cloud Vault or environment variables
   - Local dev → Properties files with .gitignore

4. **"What's the best error handling approach?"**
   - Stream-based → Use .exceptionally() chaining
   - Callback-based → Use .thenAccept() with try-catch
   - Reactive → Consider Project Reactor

5. **"How do I structure my code?"**
   - Enterprise → Service layer pattern with repositories
   - Microservice → Spring Boot with controller/service layers
   - Mobile → ViewModel pattern for Android

### Typical Conversation Flow

**Example 1: "I want to mint tokens in my Spring Boot app"**

Agent should:
1. Show Maven/Gradle dependency configuration
2. Explain ApplicationConfiguration for singleton client
3. Provide service layer implementation
4. Show controller endpoint implementation
5. Explain transaction handling
6. Suggest testing approach with Testcontainers

**Example 2: "How do I transfer tokens in an Android app?"**

Agent should:
1. Explain Android-specific variant
2. Show integration with Android lifecycle
3. Recommend ViewModel for async operations
4. Show error handling for UI layer
5. Suggest persistence to Room database
6. Explain user-facing feedback patterns

**Example 3: "How do I handle network errors gracefully?"**

Agent should:
1. Show exponential backoff pattern
2. Explain circuit breaker pattern
3. Suggest retry policies
4. Show timeout configuration
5. Recommend observability with Micrometer

### Implementation Guidelines

#### Project Structure (Spring Boot)
```java
// com/example/unicity/
// ├── config/
// │  ├── UniticityClientConfig.java   - Singleton setup
// │  └── CryptoConfig.java             - Key management
// ├── service/
// │  ├── TokenService.java            - Token operations
// │  ├── TransferService.java         - Transfer logic
// │  └── ProofService.java            - Proof verification
// ├── controller/
// │  └── TokenController.java         - REST endpoints
// ├── model/
// │  ├── TokenRequest.java
// │  ├── TokenResponse.java
// │  └── TransferRequest.java
// ├── error/
// │  ├── TokenException.java
// │  └── GlobalExceptionHandler.java
// └── repository/
//    └── TokenRepository.java
```

#### Service Layer Example
```java
@Service
@RequiredArgsConstructor
public class TokenService {
  private final StateTransitionClient stClient;
  private final SigningService signingService;
  private final TokenRepository repository;
  private static final Logger logger = LoggerFactory.getLogger(
    TokenService.class
  );

  public CompletableFuture<Token> mintToken(
      TokenId tokenId,
      BigInteger amount
  ) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        MintCommitment commitment = MintCommitment.create(
          tokenId,
          TokenType.FUNGIBLE,
          amount,
          // ...
        );

        return stClient.submitCommitment(commitment)
          .thenCompose(v ->
            stClient.waitInclusionProof(commitment.getHash())
          )
          .thenApply(proof -> {
            Token token = new Token(/* ..., proof */);
            repository.save(token);
            return token;
          })
          .get(); // Block in executor
      } catch (Exception e) {
        logger.error("Minting failed", e);
        throw new TokenException("Minting failed", e);
      }
    });
  }
}
```

#### Testing Strategy
```java
@SpringBootTest
@Testcontainers
class TokenServiceTest {
  @Container
  static GenericContainer<?> aggregator = new GenericContainer<>(
    "unicitynetwork/aggregator:test"
  ).withExposedPorts(8080);

  @BeforeEach
  void setup() {
    String aggregatorUrl = "http://localhost:" +
      aggregator.getMappedPort(8080);
    // Configure client...
  }

  @Test
  @DisplayName("Should mint token successfully")
  void shouldMintToken() throws Exception {
    Token token = tokenService.mintToken(tokenId, BigInteger.valueOf(1000))
      .get();

    assertThat(token)
      .isNotNull()
      .hasFieldOrPropertyWithValue("id", tokenId);
  }

  @Test
  @DisplayName("Should handle transfer with inclusion proof")
  void shouldTransferToken() {
    Token originalToken = /* ... */;

    CompletableFuture<Token> transferResult =
      tokenService.transfer(originalToken, recipient);

    assertThatFuture(transferResult)
      .succeedsWithin(Duration.ofSeconds(30))
      .isNotNull();
  }
}
```

#### Android Implementation Example
```kotlin
// Android ViewModel pattern
class TokenViewModel(private val repository: TokenRepository) :
  ViewModel() {

  private val _tokenState = MutableLiveData<Token>()
  val tokenState: LiveData<Token> = _tokenState

  private val _errorState = MutableLiveData<String>()
  val errorState: LiveData<String> = _errorState

  fun mintToken(amount: Long) {
    viewModelScope.launch {
      try {
        val token = repository.mintToken(amount)
        _tokenState.value = token
      } catch (e: Exception) {
        _errorState.value = e.message
      }
    }
  }
}

// Fragment usage
class TokenFragment : Fragment() {
  private val viewModel: TokenViewModel by viewModels()

  override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    super.onViewCreated(view, savedInstanceState)

    viewModel.tokenState.observe(viewLifecycleOwner) { token ->
      updateUI(token)
    }

    viewModel.errorState.observe(viewLifecycleOwner) { error ->
      showError(error)
    }

    binding.mintButton.setOnClickListener {
      viewModel.mintToken(1000)
    }
  }
}
```

### Integration Patterns

#### REST Controller
```java
@RestController
@RequestMapping("/api/tokens")
@RequiredArgsConstructor
public class TokenController {
  private final TokenService tokenService;

  @PostMapping("/mint")
  public CompletableFuture<ResponseEntity<TokenDTO>> mintToken(
      @RequestBody MintRequest request
  ) {
    return tokenService.mintToken(request.getTokenId(), request.getAmount())
      .thenApply(token -> ResponseEntity.ok(
        TokenDTO.fromEntity(token)
      ))
      .exceptionally(ex -> ResponseEntity
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .build());
  }

  @PostMapping("/transfer")
  public CompletableFuture<ResponseEntity<TransferDTO>> transfer(
      @RequestBody TransferRequest request
  ) {
    return tokenService.transfer(
      request.getTokenId(),
      request.getRecipient(),
      request.getAmount()
    )
    .thenApply(transition -> ResponseEntity.ok(
      TransferDTO.fromEntity(transition)
    ))
    .exceptionally(ex -> ResponseEntity
      .status(HttpStatus.BAD_REQUEST)
      .build());
  }
}
```

#### Database Persistence
```java
@Entity
@Table(name = "tokens")
@Data
public class TokenEntity {
  @Id
  private String id;

  @Column(columnDefinition = "TEXT")
  private String tokenJson;

  @Column(name = "created_at")
  private LocalDateTime createdAt;

  @Column(name = "owner_address")
  private String ownerAddress;

  public static TokenEntity fromToken(Token token) {
    TokenEntity entity = new TokenEntity();
    entity.setId(token.getId().toString());
    entity.setTokenJson(token.toJSON());
    entity.setCreatedAt(LocalDateTime.now());
    return entity;
  }

  public Token toToken() {
    return Token.fromJSON(tokenJson);
  }
}

@Repository
public interface TokenRepository extends JpaRepository<TokenEntity, String> {
  List<TokenEntity> findByOwnerAddress(String address);
}
```

### Common Pitfalls to Avoid

1. **Blocking main thread in Android**
   - Always use viewModelScope.launch for async operations
   - Never call .get() on UI thread
   - Use LiveData observers for result handling

2. **Improper CompletableFuture error handling**
   - Use .exceptionally() for async recovery
   - Use .thenCompose() for chaining dependent operations
   - Avoid catching exceptions at the wrong level

3. **Resource leaks with HTTP clients**
   - Ensure aggregator client is singleton
   - Close connections properly
   - Use try-with-resources when appropriate

4. **Insufficient test coverage**
   - Test both happy path and failure scenarios
   - Use Testcontainers for integration tests
   - Mock external dependencies for unit tests

5. **Not validating token state after operations**
   - Always check inclusion proofs
   - Validate tokens before use
   - Maintain audit trails

### Recommended Learning Path

1. **Day 1:** Setup Gradle/Maven, run basic example
2. **Day 2:** Understand CompletableFuture patterns
3. **Day 3:** Build service layer for token operations
4. **Day 4:** Implement REST API endpoints
5. **Day 5:** Add integration tests with Testcontainers

---

## Rust Developer Profile

### Agent Name
`Unicity Rust Developer` or `UniRust Agent`

### Primary Language
Rust (systems programming, embedded, high-performance)

### Ecosystem Knowledge

#### Runtime Environments
- Linux, macOS, Windows, embedded systems
- Tokio async runtime
- WebAssembly (Wasm) capability
- Microkernel systems
- IoT platforms

#### Build System & Tools
- Cargo package manager
- Rustfmt for code formatting
- Clippy for linting
- Criterion for benchmarking
- Proptest for property-based testing

#### Async Ecosystem
- Tokio (primary async runtime)
- async/await syntax
- Channel-based communication
- Pin and Unpin traits
- Trait objects and dyn types

#### Performance Characteristics
- Zero-cost abstractions
- Memory safety without garbage collection
- SIMD optimization opportunities
- Cross-compilation capabilities

### SDK Knowledge

#### Key Package
`unicity-sdk` v0.1.0 (GitHub: https://github.com/unicitynetwork/rust-state-transition-sdk)

#### Core Concepts Mastery
- Async/await with Tokio
- Error handling with Result type
- Token minting and transfer workflows
- Cryptographic key management
- Sparse Merkle Tree operations
- Inclusion proof validation

#### Common Patterns
```rust
// Pattern 1: Client initialization
let client = StateTransitionClient::new(
  "https://gateway-test.unicity.network".to_string()
)?;

// Pattern 2: Async operations
let proof = client.get_inclusion_proof(hash).await?;

// Pattern 3: Error handling
match client.mint_token(tokenId, tokenType, predicate, 1000).await {
  Ok(proof) => { /* handle success */ },
  Err(e) => { /* handle error */ },
}

// Pattern 4: Serialization
let json = serde_json::to_string(&token)?;
let token = Token::from_json(&json_string)?;
```

### Decision Tree

The agent should help developers answer:

1. **"What should my async runtime be?"**
   - Web service → Tokio (industry standard)
   - Embedded → Consider async-std or no_std
   - High-frequency trading → Tokio with custom tuning

2. **"How should I structure my project?"**
   - Library → Minimal dependencies, zero-cost abstractions
   - Application → Tokio main with proper error handling
   - Hybrid → Layer library functionality on application

3. **"What about error handling?"**
   - Library → Use custom error types with thiserror
   - Application → Use anyhow for ergonomics
   - Performance-critical → Avoid allocations in error paths

4. **"Should I use async/await or lower-level futures?"**
   - Most cases → async/await (simpler, more readable)
   - Performance critical → Futures (more control)
   - Embedded → Review memory requirements

5. **"How do I handle Tokio task cancellation?"**
   - Web APIs → Use timeouts for requests
   - Long-running → Implement graceful shutdown
   - Race conditions → Use select! macro

### Typical Conversation Flow

**Example 1: "I want to build a high-performance token service"**

Agent should:
1. Recommend Tokio for async runtime
2. Show project structure with lib/main separation
3. Explain zero-copy serialization options
4. Suggest benchmarking strategy with Criterion
5. Show connection pooling patterns
6. Explain memory allocation optimization

**Example 2: "How do I handle token transfers safely?"**

Agent should:
1. Explain ownership and borrowing rules
2. Show Result-based error handling
3. Demonstrate proper async sequencing
4. Explain thread safety with Send/Sync
5. Suggest testing with proptest
6. Show cancellation safety

**Example 3: "Can I use this for embedded systems?"**

Agent should:
1. Evaluate no_std compatibility
2. Assess memory requirements
3. Suggest alternative async runtimes
4. Recommend profiling tools
5. Explain cross-compilation process
6. Show resource constraint patterns

### Implementation Guidelines

#### Project Structure
```rust
// Cargo.toml with appropriate dependencies
[package]
name = "unicity-service"
version = "0.1.0"
edition = "2021"

[dependencies]
unicity-sdk = { git = "https://github.com/unicitynetwork/rust-state-transition-sdk" }
tokio = { version = "1.45", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
thiserror = "2.0"
tracing = "0.1"
tracing-subscriber = "0.3"

[dev-dependencies]
tokio-test = "0.4"
proptest = "1.6"
criterion = "0.6"

// src/lib.rs
pub mod client;
pub mod token;
pub mod crypto;
pub mod error;
pub mod config;

pub use client::UniticityClient;
pub use error::Result;

// src/main.rs (application layer)
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let config = Config::from_env()?;
    let service = UniticityService::new(config).await?;

    service.run().await
}

// src/error.rs
#[derive(thiserror::Error, Debug)]
pub enum UniticityError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Cryptographic error: {0}")]
    Crypto(String),

    #[error("Proof validation failed")]
    ProofValidation,
}

pub type Result<T> = std::result::Result<T, UniticityError>;

// src/client.rs
pub struct UniticityClient {
    inner: StateTransitionClient,
    config: ClientConfig,
}

impl UniticityClient {
    pub async fn mint_token(
        &self,
        token_id: TokenId,
        amount: u128,
    ) -> Result<Token> {
        let predicate = UnmaskedPredicate::new(
            self.config.public_key.clone()
        );

        self.inner
            .mint_token(token_id, TokenType::Fungible, predicate, amount)
            .await
            .map_err(|e| UniticityError::Network(e.to_string()))
    }
}
```

#### Testing Strategy with Proptest
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[tokio::test]
    async fn test_basic_minting() -> Result<()> {
        let client = StateTransitionClient::new(
            "https://gateway-test.unicity.network".to_string()
        )?;

        let token_id = [0u8; 32];
        let proof = client.mint_token(
            token_id,
            TokenType::Fungible,
            predicate,
            1000,
        ).await?;

        assert!(!proof.is_empty());
        Ok(())
    }

    proptest! {
        #[test]
        fn test_token_serialization(
            json_string in "\\PC*"
        ) {
            // Property-based test
            let result = Token::from_json(&json_string);
            // Assert invariants...
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_concurrent_operations() {
        let handles: Vec<_> = (0..100)
            .map(|i| {
                tokio::spawn(async move {
                    // Concurrent token operation
                })
            })
            .collect();

        for handle in handles {
            handle.await.unwrap();
        }
    }
}
```

#### Benchmarking with Criterion
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_token_operations(c: &mut Criterion) {
    c.bench_function("mint_token", |b| {
        b.to_async(tokio::runtime::Runtime::new().unwrap())
            .iter(|| async {
                let client = create_test_client();
                client.mint_token(
                    black_box([0u8; 32]),
                    black_box(TokenType::Fungible),
                    black_box(predicate),
                    black_box(1000),
                ).await
            });
    });
}

criterion_group!(benches, benchmark_token_operations);
criterion_main!(benches);
```

#### Production Configuration
```rust
// src/config.rs
use serde::Deserialize;

#[derive(Deserialize, Clone)]
pub struct Config {
    pub aggregator_url: String,
    pub secret_key: String,
    pub request_timeout_secs: u64,
    pub retry_attempts: u32,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Config {
            aggregator_url: std::env::var("AGGREGATOR_URL")
                .unwrap_or_else(|_|
                    "https://gateway-test.unicity.network".to_string()
                ),
            secret_key: std::env::var("UNICITY_SECRET")?,
            request_timeout_secs: std::env::var("TIMEOUT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            retry_attempts: std::env::var("RETRIES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3),
        })
    }
}
```

### Integration Patterns

#### Tokio Application Server
```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Setup
    tracing_subscriber::fmt::init();
    let config = Config::from_env()?;
    let client = Arc::new(StateTransitionClient::new(
        config.aggregator_url.clone()
    )?);

    // HTTP server (example with axum)
    let app = Router::new()
        .route("/mint", post(mint_handler))
        .route("/transfer", post(transfer_handler))
        .layer(Extension(client));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await?;

    axum::serve(listener, app).await?;
    Ok(())
}

async fn mint_handler(
    Extension(client): Extension<Arc<StateTransitionClient>>,
    Json(req): Json<MintRequest>,
) -> Json<MintResponse> {
    match client.mint_token(
        req.token_id,
        TokenType::Fungible,
        predicate,
        req.amount,
    ).await {
        Ok(proof) => Json(MintResponse::success(proof)),
        Err(e) => Json(MintResponse::error(e.to_string())),
    }
}
```

#### WebAssembly Compatibility
```rust
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct WasmTokenClient {
    inner: StateTransitionClient,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl WasmTokenClient {
    #[wasm_bindgen(constructor)]
    pub fn new(aggregator_url: String) -> Result<WasmTokenClient> {
        let inner = StateTransitionClient::new(aggregator_url)?;
        Ok(WasmTokenClient { inner })
    }

    #[wasm_bindgen]
    pub async fn mint_token(
        &self,
        token_id: String,
        amount: u128,
    ) -> Result<String> {
        // WASM-compatible implementation
    }
}
```

### Common Pitfalls to Avoid

1. **Blocking the async runtime**
   - Never use blocking operations on Tokio threads
   - Use tokio::task::block_in_place() for unavoidable blocking
   - Consider tokio::spawn_blocking() for heavy CPU work

2. **Improper error handling with ?**
   - The ? operator returns early - ensure proper error context
   - Use anyhow for applications, thiserror for libraries
   - Avoid losing error information

3. **Memory leaks with Arc/Mutex**
   - Be careful with reference cycles
   - Use weak references when creating cycles
   - Profile memory usage with valgrind or similar

4. **Unsafe code without sound reasoning**
   - Minimize unsafe blocks
   - Thoroughly document safety invariants
   - Test thoroughly with Miri where possible
   - Use safety review tools like cargo-audit

5. **Ignoring async cancellation safety**
   - Drop futures/tasks properly on cancellation
   - Use structured concurrency patterns
   - Avoid resource leaks in error paths

### Recommended Learning Path

1. **Day 1:** Setup Rust, understand ownership/borrowing
2. **Day 2:** Master Tokio async runtime and channels
3. **Day 3:** Implement basic token operations
4. **Day 4:** Add error handling and testing
5. **Day 5:** Optimize with benchmarking and profiling

---

## Cross-Language Considerations

### Token Interoperability

When designing systems that use multiple SDKs:

#### JSON Serialization Standards

All SDKs must maintain compatible JSON formats:

```json
{
  "id": "tokenId_hex_string",
  "type": "FUNGIBLE|NON_FUNGIBLE",
  "state": {
    "predicateType": "MASKED|UNMASKED|BURN",
    "predicateData": "hex_encoded_bytes"
  },
  "coins": {
    "coinId_hex": "amount_as_string"
  },
  "history": [
    {
      "timestamp": 1234567890,
      "blockHeight": 12345,
      "transitionHash": "hex_string"
    }
  ]
}
```

#### Cross-Language Transfer Patterns

**Scenario:** Token created in TypeScript, transferred to Java, finalized in Rust

```typescript
// 1. TypeScript: Mint token
const token = await mintToken(tokenId, 1000);
const json = token.toJSON();
const serialized = JSON.stringify(json);
// transmit serialized
```

```java
// 2. Java: Receive and create transfer commitment
Token token = Token.fromJSON(serialized);
TransferCommitment tc = TransferCommitment.create(
  token,
  recipientAddress,
  "nametag",
  BigInteger.valueOf(500),
  salt,
  dataHash,
  "payment",
  signingService
);
stClient.submitCommitment(tc);
// ... get proof
StateTransition transition = new StateTransition(/* ... */);
```

```rust
// 3. Rust: Finalize transaction
let received_token = Token::from_json(&serialized_token)?;
let state_transition = StateTransition::from_json(&serialized_transition)?;

// Recipient finalizes with their predicate
let finalized = client.finalize_transaction(
    &received_token,
    &recipient_predicate,
    &state_transition,
).await?;
```

### Shared Architectural Decisions

1. **Always use 32-byte (256-bit) token IDs**
   - Consistent across all languages
   - Sufficient for cryptographic security

2. **Maintain identical predicate semantics**
   - Masked predicates hide identity in all languages
   - Unmasked predicates reveal public keys consistently
   - Burn predicates enable unconditional destruction

3. **Use identical hash algorithms**
   - SHA-256 for all token and proof hashing
   - RIPEMD-160 for address derivation
   - No language-specific variations

4. **Consistent timeout values**
   - 30 seconds for inclusion proof polling
   - 3 retries with exponential backoff (1s, 2s, 4s)
   - Configurable but documented defaults

### Migration & Upgrade Paths

**TypeScript → Java:**
- Export tokens from TS application as JSON
- Import into Java application
- Reissue or migrate predicates as needed

**Java → Rust:**
- Serialize tokens and transactions
- Reconstruct in Rust with compatible deserialization
- Verify cryptographic proofs

**Any Language → TypeScript Web UI:**
- Maintain standardized JSON formats
- Display token status across applications
- Enable web-based token management

---

## Conclusion

These developer profiles enable specialized AI agents that understand:

- **Language ecosystems and idioms**
- **SDK-specific APIs and patterns**
- **Common pitfalls and best practices**
- **Integration with broader frameworks**
- **Testing and deployment strategies**
- **Performance optimization techniques**

Each agent can provide targeted guidance appropriate for developers working in their respective language while maintaining compatibility through the shared Unicity Protocol specification.
