<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds the 10-article curriculum for Computer Networks & Web Protocols.
 * Idempotent (updateOrCreate by slug).
 */
class ComputerNetworksArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $topic = ArticleTopic::where('slug', 'computer-networks')->first();

        if (! $topic) {
            $this->command?->error("Computer Networks & Web Protocols article topic not found. Run ArticleTopicSeeder first.");
            return;
        }

        $author = User::where('email', 'priya@mellow.ai')->first()
            ?? User::where('role', User::ROLE_SUPERADMIN)->first()
            ?? User::first();

        if (! $author) {
            $this->command?->error("No valid author found to associate with articles.");
            return;
        }

        $articles = [
            [
                'slug' => 'life-of-a-packet-typing-url-to-page-render',
                'title' => 'The Life of a Packet: What Really Happens When You Type google.com',
                'excerpt' => 'The ultimate software engineering interview question deconstructed: hardware interrupts, OS socket buffers, DNS recursion, ARP broadcasting, BGP routing, TCP handshake, TLS negotiation, and DOM paint tree rendering.',
                'display_order' => 1,
                'content' => $this->lifeOfAPacketTypingUrlToPageRenderArticle(),
            ],
            [
                'slug' => 'tcp-three-way-handshake-flow-and-congestion-control',
                'title' => 'TCP Three-Way Handshake, Flow Control, and Congestion Control',
                'excerpt' => 'TCP turns an unreliable, packet-dropping IP network into a reliable, ordered stream. Understand sequence numbers, TCP window sizing, head-of-line blocking, and congestion avoidance algorithms like CUBIC and BBR.',
                'display_order' => 2,
                'content' => $this->tcpThreeWayHandshakeFlowAndCongestionControlArticle(),
            ],
            [
                'slug' => 'udp-vs-tcp-low-latency-webrtc-and-gaming',
                'title' => 'UDP vs. TCP: When Low Latency Trumps Guaranteed Delivery',
                'excerpt' => 'Why do multiplayer games, DNS, live video streaming, and HTTP/3 run over UDP instead of TCP? Compare TCP retransmission delays against UDP\'s fire-and-forget datagram model and WebRTC architectures.',
                'display_order' => 3,
                'content' => $this->udpVsTcpLowLatencyWebrtcAndGamingArticle(),
            ],
            [
                'slug' => 'tls-1-3-handshake-and-public-key-cryptography',
                'title' => 'TLS 1.3 Handshake, Public-Key Cryptography, and Zero-RTT Resumption',
                'excerpt' => 'How does HTTPS encrypt petabytes of web traffic securely across hostile public Wi-Fi? Understand asymmetric Diffie-Hellman key exchange, symmetric AES-GCM ciphers, certificate validation, and 1-RTT vs 0-RTT handshakes.',
                'display_order' => 4,
                'content' => $this->tls13HandshakeAndPublicKeyCryptographyArticle(),
            ],
            [
                'slug' => 'evolution-of-web-protocols-http1-http2-http3',
                'title' => 'The Evolution of Web Protocols: HTTP/1.1 vs. HTTP/2 vs. HTTP/3 (QUIC)',
                'excerpt' => 'From plaintext ASCII commands to binary multiplexing and UDP-based QUIC streams. Analyze pipelining limitations, HPACK header compression, stream concurrency, and why HTTP/3 abandons TCP entirely.',
                'display_order' => 5,
                'content' => $this->evolutionOfWebProtocolsHttp1Http2Http3Article(),
            ],
            [
                'slug' => 'dns-resolution-hierarchy-anycast-routing',
                'title' => 'DNS Resolution Hierarchy: Recursive Resolvers, Root Servers, and Anycast',
                'excerpt' => 'DNS is the phonebook of the internet. Discover how hierarchical tree resolution maps domain names, how TTL caching works, how Anycast routing defends against massive DDoS attacks, and how DNS-over-HTTPS (DoH) protects privacy.',
                'display_order' => 6,
                'content' => $this->dnsResolutionHierarchyAnycastRoutingArticle(),
            ],
            [
                'slug' => 'websockets-and-server-sent-events-sse',
                'title' => 'WebSockets and Server-Sent Events (SSE): Persistent Full-Duplex Web Channels',
                'excerpt' => 'Polling a REST API every second wastes bandwidth and destroys battery life. Compare HTTP Long Polling, unidirectional Server-Sent Events (SSE), and bidirectional full-duplex WebSockets for real-time applications.',
                'display_order' => 7,
                'content' => $this->websocketsAndServerSentEventsSseArticle(),
            ],
            [
                'slug' => 'reverse-proxies-nat-traversal-load-balancing',
                'title' => 'Reverse Proxies, NAT Traversal, and Load Balancing: NGINX, HAProxy, and Envoy',
                'excerpt' => 'Forward vs reverse proxies, Network Address Translation (NAT), and modern edge gateways. Learn how NGINX handles static files, how HAProxy balances TCP/HTTP, and how Envoy powers dynamic cloud-native service meshes.',
                'display_order' => 8,
                'content' => $this->reverseProxiesNatTraversalLoadBalancingArticle(),
            ],
            [
                'slug' => 'cors-csp-and-web-security-headers',
                'title' => 'CORS, Content Security Policy (CSP), and Essential Web Security Headers',
                'excerpt' => 'The Same-Origin Policy is the browser\'s bedrock security wall, but APIs must share resources across origins. Master CORS preflight OPTIONS requests, CSP directives against XSS, and HSTS header protection.',
                'display_order' => 9,
                'content' => $this->corsCspAndWebSecurityHeadersArticle(),
            ],
            [
                'slug' => 'network-diagnostics-wireshark-tcpdump-traceroute',
                'title' => 'Network Diagnostics: Wireshark, tcpdump, netstat, and traceroute Mastery',
                'excerpt' => 'When production servers drop packets or experience 500ms latency spikes, application logs are blind. Master deep packet inspection using tcpdump, Wireshark filters, traceroute ICMP TTL expiration, and netstat socket analysis.',
                'display_order' => 10,
                'content' => $this->networkDiagnosticsWiresharkTcpdumpTracerouteArticle(),
            ],
        ];

        foreach ($articles as $data) {
            $content = $data['content'];
            Article::updateOrCreate(
                ['slug' => $data['slug']],
                [
                    'article_topic_id' => $topic->id,
                    'title' => $data['title'],
                    'excerpt' => $data['excerpt'],
                    'content' => $content,
                    'icon' => null,
                    'status' => Article::STATUS_PUBLISHED,
                    'display_order' => $data['display_order'],
                    'reading_time_minutes' => Article::estimateReadingTimeMinutes($content),
                    'created_by' => $author->id,
                    'published_at' => now(),
                ]
            );
        }
    }

    private function lifeOfAPacketTypingUrlToPageRenderArticle(): string
    {
        return <<<'MARKDOWN'
"What happens when you type google.com into your browser and press Enter?"

This is the quintessential systems engineering interview question because it touches every layer of modern computing: hardware interrupts, operating system network stacks, routing protocols, cryptography, and rendering engines.

---

## 1. Physical Input and the Operating System Stack

1. **Hardware Keyboard Interrupt:** Pressing Enter generates an electrical circuit signal sent to the keyboard controller. The controller fires an interrupt request (IRQ) to the CPU.
2. **OS Keyboard Driver:** The Linux kernel or Windows HID driver decodes the scancode into an Enter key event, forwarding it to the browser's focused process.
3. **URL Parsing and HSTS Check:** The browser parses the string. It checks its internal **HSTS (HTTP Strict Transport Security)** preloaded list to verify if `google.com` requires HTTPS immediately, skipping unencrypted HTTP port 80.

---

## 2. Name Resolution: The DNS Hierarchy

Before opening a TCP socket, the browser must convert `google.com` to an IP address (e.g., `142.250.190.46`):
1. **Browser Cache & OS Cache:** Checks Chrome DNS cache, then OS `hosts` file and local resolver cache.
2. **Recursive DNS Resolver (ISP or 1.1.1.1):**
   - Queries a **Root Name Server** (`.`): Returns `.com` TLD name servers.
   - Queries **TLD Name Server** (`.com`): Returns Google's authoritative name servers.
   - Queries **Authoritative Name Server** (`ns1.google.com`): Returns the A/AAAA record with a TTL.

---

## 3. Link Layer: ARP and Routing

With the destination IP known:
1. **Subnet Routing:** The OS compares the destination IP against its local subnet mask. Since Google is outside the local network, the packet must go to the **Default Gateway (Router)**.
2. **ARP (Address Resolution Protocol):** The OS broadcasts an ARP request on the local Ethernet/Wi-Fi link: *"Who has 192.168.1.1? Tell my MAC address."*
3. **BGP (Border Gateway Protocol):** The packet travels through the ISP, across autonomous systems (AS) via fiber cables and internet exchange points (IXPs) routed by BGP.

---

## 4. Transport & Security: TCP and TLS 1.3

1. **TCP 3-Way Handshake:** `SYN` -> `SYN-ACK` -> `ACK` (1 round trip time).
2. **TLS 1.3 Handshake:** Client and server exchange Diffie-Hellman ephemeral keys in a single round trip (1-RTT), establishing symmetric AES-GCM session keys.

---

## 5. Application Layer: HTTP Request and DOM Rendering

1. **HTTP/2 GET Request:** The browser sends an encrypted HTTP/2 frame requesting `/`.
2. **Server Response:** Google's frontend proxy terminates TLS, queries backend index clusters, and streams back gzipped HTML.
3. **Browser Engine (Blink/V8):**
   - Parses HTML tokens to construct the **DOM (Document Object Model)** tree.
   - Parses CSS to construct the **CSSOM** tree.
   - Merges both into the **Render Tree**, computes layout geometry, and rasterizes pixels to the GPU display buffer.

---

## Key Takeaways

1. Modern networks traverse 5 distinct layers: Physical, Link (ARP/MAC), Network (IP/BGP), Transport (TCP), and Application (TLS/HTTP).
2. HSTS eliminates vulnerable plaintext redirects to port 80.
3. TLS 1.3 reduces cryptographic setup overhead to a single round-trip.
MARKDOWN;
    }

    private function tcpThreeWayHandshakeFlowAndCongestionControlArticle(): string
    {
        return <<<'MARKDOWN'
The Internet Protocol (IP) provides **best-effort delivery**: packets can be dropped, delayed, corrupted, or delivered out of order. **TCP (Transmission Control Protocol)** sits on top of IP to provide a reliable, ordered, error-checked stream of bytes between applications.

---

## 1. The 3-Way Handshake and Sequence Numbers

Before transferring data, client and server must agree on random **Initial Sequence Numbers (ISN)**:

```
Client (CLOSED)                                Server (LISTEN)
     |                                                |
     | ------------ SYN (Seq=X) ------------------->  | (SYN_RCVD)
     |                                                |
     | <----------- SYN-ACK (Seq=Y, Ack=X+1) ------- |
     |                                                |
     | ------------ ACK (Seq=X+1, Ack=Y+1) ---------> | (ESTABLISHED)
     v                                                v
(ESTABLISHED)
```

> **Why random ISNs?** If sequence numbers started at 0 every time, packets delayed from an old closed connection could be accepted as valid by a newly opened connection, corrupting data.

---

## 2. Flow Control: The Sliding Window

Flow control prevents a fast sender from overwhelming a slow receiver's buffer:
- The receiver advertises its available buffer size in every TCP header as the **Receive Window (`rwnd`)**.
- If the receiver's application is slow, `rwnd` shrinks.
- If `rwnd = 0`, the sender **must stop transmitting** until the receiver sends a window update.

---

## 3. Congestion Control: Protecting the Shared Internet

While Flow Control protects the receiver, **Congestion Control** protects the shared network routers from traffic collapse:
- The sender maintains a **Congestion Window (`cwnd`)**.
- The maximum bytes in flight is bounded by:
  $$\text{In-Flight Bytes} = \min(\text{rwnd}, \text{cwnd})$$

### Algorithms:
1. **Slow Start:** Starts at a small `cwnd` (e.g., 10 packets) and doubles every round trip ($O(2^n)$) until reaching `ssthresh`.
2. **Congestion Avoidance (CUBIC):** Scales linearly or cubically to probe available bandwidth.
3. **Google BBR (Bottleneck Bandwidth and RTT):** Measures maximum delivery rate and minimum round-trip time instead of treating packet drops as congestion signals.

---

## Key Takeaways

1. TCP guarantees order and reliability through sequence numbers and acknowledgments.
2. Flow Control (`rwnd`) prevents receiver buffer overflow; Congestion Control (`cwnd`) prevents network saturation.
3. TCP Head-of-Line blocking means a single dropped packet stalls the entire connection.
MARKDOWN;
    }

    private function udpVsTcpLowLatencyWebrtcAndGamingArticle(): string
    {
        return <<<'MARKDOWN'
In computer networking, engineers are taught that TCP is "reliable" and UDP is "unreliable". This makes UDP sound like a broken protocol that should be avoided.

In reality, UDP (User Datagram Protocol) is the deliberate choice for applications where **timeliness is more important than completeness**.

---

## 1. Comparing the Protocol Headers

| Header Feature | TCP Header | UDP Header |
| :--- | :--- | :--- |
| **Size** | 20–60 bytes | **8 bytes fixed** |
| **Connection State** | Stateful (handshake, sequence nums) | **Stateless (connectionless)** |
| **Retransmissions** | Automatic on packet loss | None |
| **Ordering** | Enforced (buffers until missing packet arrives) | None (packets processed in arrival order) |
| **Flow/Congestion Control** | Mandatory in OS kernel | None |

---

## 2. Why Multiplayer Games and Video Streaming Hate TCP

Consider a competitive first-person shooter running at 60 frames per second:
1. Packet #100 contains the player's position at $t=100\text{ms}$.
2. Packet #100 is dropped by a router.
3. Packet #101 arrives with the player's position at $t=116\text{ms}$.

### Under TCP:
TCP **blocks** Packet #101 from reaching the game engine until Packet #100 is retransmitted and acknowledged. By the time Packet #100 arrives 150ms later, the player has already moved! The data is completely stale and useless!

### Under UDP:
The game engine drops Packet #100 without waiting, immediately renders the fresh coordinates from Packet #101, and moves on with zero latency spike.

---

## 3. WebRTC and Modern Media Streaming

WebRTC (used by Discord, Zoom, Google Meet) uses UDP for real-time audio and video:
- Runs **SRTP (Secure Real-Time Transport Protocol)** over UDP.
- Tolerates 1–2% packet loss by interpolating audio with AI or displaying slight video compression artifacts rather than buffering.

---

## Key Takeaways

1. TCP enforces ordering at the cost of Head-of-Line blocking and retransmission latency.
2. UDP has an ultra-lightweight 8-byte header and zero handshake overhead.
3. Use UDP for real-time video, gaming, DNS queries, and modern HTTP/3 transport.
MARKDOWN;
    }

    private function tls13HandshakeAndPublicKeyCryptographyArticle(): string
    {
        return <<<'MARKDOWN'
Whenever you open a bank website, your credentials travel through dozens of intermediary routers, Wi-Fi hotspots, and ISP switches. **TLS (Transport Layer Security)** ensures three cryptographic guarantees:
- **Confidentiality:** Eavesdroppers cannot read the plaintext data.
- **Integrity:** Data cannot be modified or tampered with in transit.
- **Authentication:** Verifies that you are communicating with the genuine server, not an imposter.

---

## 1. The Two Halves of Cryptography

TLS achieves both security and high performance by combining two cryptographic paradigms:

1. **Asymmetric (Public-Key) Cryptography:** Slow, CPU-intensive. Used **only during the initial handshake** to authenticate the server certificate and securely agree on a shared secret without sending it over the wire.
2. **Symmetric Cryptography (AES-GCM / ChaCha20-Poly1305):** Blazingly fast, hardware-accelerated on modern CPUs. Once the shared secret is established, 100% of the actual HTTP payload is encrypted symmetrically.

---

## 2. TLS 1.2 vs. TLS 1.3: Speed and Security Upgrades

In TLS 1.2, completing a secure handshake required **two full round trips (2-RTT)** before any application data could be sent.
TLS 1.3 (RFC 8446) completely overhauled the protocol:

```
Client                                                   Server
  |                                                        |
  | --- ClientHello (Key Share: Client Public DH) --------> |
  |                                                        | (Computes shared secret)
  | <--- ServerHello (Key Share: Server Public DH) ------- | (Sends Certificate + EncryptedExtensions)
  |                                                        |
  | (Computes shared secret)                               |
  | --- [Encrypted Application Data HTTP GET] -----------> | (1-RTT Completed!)
```

### Key TLS 1.3 Innovations:
- **1-RTT Handshake:** Reduces connection latency by 50%.
- **Removed Deprecated Insecure Algorithms:** Banned RSA key exchange, MD5, SHA-1, RC4, and CBC ciphers.
- **Forward Secrecy:** Enforces Ephemeral Diffie-Hellman (`ECDHE`). Even if an attacker steals the server's private key years later, they cannot decrypt recorded historical traffic!
- **0-RTT Resumption:** Returning clients can send encrypted data in their very first packet.

---

## Key Takeaways

1. Asymmetric cryptography negotiates keys; symmetric ciphers encrypt the payload.
2. TLS 1.3 reduces handshake latency from 2-RTT down to 1-RTT.
3. Forward Secrecy ensures that compromised private keys cannot decrypt past sessions.
MARKDOWN;
    }

    private function evolutionOfWebProtocolsHttp1Http2Http3Article(): string
    {
        return <<<'MARKDOWN'
The World Wide Web was built on HTTP. Over the last 30 years, HTTP has evolved from a simple text protocol designed to transfer static HTML documents into a multiplexed binary streaming engine.

---

## 1. HTTP/1.1 and Head-of-Line (HoL) Blocking

Released in 1997, HTTP/1.1 introduced **Keep-Alive**: reusing a single TCP connection for multiple requests.
However, HTTP/1.1 suffered from **Application-Layer Head-of-Line Blocking**:
- Requests on a single TCP connection had to be answered **sequentially in strict FIFO order**.
- If Request #1 (e.g., a slow database report) took 5 seconds, Requests #2 through #10 were completely stalled.
- **The Browser Workaround:** Browsers opened **up to 6 parallel TCP connections** per domain, putting heavy load on web servers.

---

## 2. HTTP/2: Binary Framing and True Multiplexing

Standardized in 2015, HTTP/2 solved application-layer HoL blocking:
- **Binary Framing Layer:** Replaces plaintext ASCII with binary frames (HEADERS, DATA, SETTINGS).
- **Stream Multiplexing:** Thousands of independent, bidirectional request/response streams can be interleaved concurrently over a **single TCP connection**.
- **HPACK Compression:** Compresses repetitive HTTP headers (cookies, user-agents) across requests using stateful differential tables.

```
HTTP/2 Single TCP Connection:
[Stream 1: Header] [Stream 3: Data] [Stream 1: Data] [Stream 5: Header]
```

---

## 3. Why HTTP/2 Failed on Mobile: Transport-Layer HoL Blocking

Although HTTP/2 eliminated *application-layer* blocking, it was still constrained by **TCP**:
- Because all streams share a single TCP socket, if just **one packet is dropped** over lossy mobile Wi-Fi, the TCP kernel buffer stops delivering *all* subsequent packets until the dropped packet is retransmitted.
- In high-packet-loss environments, HTTP/2 can actually be **slower than HTTP/1.1**!

---

## 4. HTTP/3: Built on QUIC over UDP

HTTP/3 completely discards TCP in favor of **QUIC (Quick UDP Internet Connections)** running over UDP:
- **Independent Streams:** Packet loss on Stream A has zero effect on Stream B!
- **Connection Migration:** If a mobile phone switches from Wi-Fi to 5G cellular, the connection does not drop! QUIC uses a 64-bit **Connection ID** rather than the IP/Port 4-tuple.

---

## Key Takeaways

1. HTTP/1.1 was limited by sequential FIFO head-of-line blocking.
2. HTTP/2 introduced binary multiplexing and HPACK over a single TCP connection.
3. HTTP/3 uses QUIC over UDP to eliminate transport-layer packet-loss stalls and enable seamless connection migration.
MARKDOWN;
    }

    private function dnsResolutionHierarchyAnycastRoutingArticle(): string
    {
        return <<<'MARKDOWN'
The Domain Name System (DNS) is one of the oldest and most resilient distributed databases in the world. It maps human-friendly hostnames (`aptrun.com`) to machine-routable IP addresses (`104.21.58.12`).

Understanding DNS caching, record types, and Anycast routing is essential for debugging domain routing and configuring global high-availability deployments.

---

## 1. The DNS Tree Hierarchy

DNS resolution operates as a distributed tree of authoritative servers:

```
                           . (Root Servers - 13 IP Clusters)
                            /        |        \
                         .com       .org       .edu (TLD Servers)
                         /           |           \
                   google.com   wikipedia.org   mit.edu (Authoritative Servers)
```

### The 4 Actors in DNS Lookup:
1. **DNS Recurser (Resolver):** Operated by ISPs or public providers (`8.8.8.8`, `1.1.1.1`). Acts as the client's librarian, querying downstream servers recursively.
2. **Root Name Server:** Directs the resolver to the appropriate Top-Level Domain (TLD) servers based on extension (`.com`).
3. **TLD Name Server:** Directs resolver to the Authoritative servers for the specific domain.
4. **Authoritative Name Server:** Holds the genuine DNS records (A, AAAA, CNAME, MX, TXT) configured by the domain owner.

---

## 2. Common DNS Record Types

- **A Record:** Maps hostname to IPv4 address (`aptrun.com -> 192.0.2.1`).
- **AAAA Record:** Maps hostname to IPv6 address.
- **CNAME (Canonical Name):** Alias pointing one domain name to another (`www.aptrun.com -> aptrun.com`). Cannot exist at the apex/root domain.
- **MX Record:** Mail Exchange server directing domain emails.
- **TXT Record:** Arbitrary text used for domain verification, SPF, DKIM, and SSL issuance.

---

## 3. Anycast Routing: Defending the Root

There are only **13 named root server IP addresses** in the world (`a.root-servers.net` to `m.root-servers.net`). If there were only 13 physical computers, a single DDoS attack would knock the entire internet offline!

DNS utilizes **BGP Anycast Routing**:
- The exact same IP address (e.g., `198.41.0.4`) is announced by **hundreds of distinct physical data centers worldwide**.
- Global BGP routers automatically route packets to the **topologically closest data center**.
- If an attacker launches a massive DDoS flood in Europe, only the local European Anycast pop absorbs the traffic, leaving the rest of the world unaffected.

---

## Key Takeaways

1. DNS lookups traverse Root -> TLD -> Authoritative servers.
2. Respect Time-To-Live (TTL): low TTL allows fast failover; high TTL reduces DNS query latency.
3. Anycast routing provides global high-availability and DDoS resilience for critical infrastructure.
MARKDOWN;
    }

    private function websocketsAndServerSentEventsSseArticle(): string
    {
        return <<<'MARKDOWN'
Traditional HTTP follows a strict **request-response** lifecycle: the client asks, the server answers, and the connection goes idle. But for real-time dashboards, multiplayer games, collaborative editors, and chat apps, the server must be able to push data to clients spontaneously.

---

## 1. The Real-Time Evolution: From Polling to WebSockets

### Short Polling:
Client queries `GET /messages` every 2 seconds via `setInterval()`.
*Flaw:* 99% of requests return empty arrays, wasting mobile battery and server CPU cycles.

### Long Polling:
Client sends `GET /messages`. The server **holds the request open** until new data arrives or a timeout occurs. Once responded, the client immediately initiates a new request.
*Flaw:* High connection churn, overhead of re-sending HTTP headers on every message.

---

## 2. Server-Sent Events (SSE): Unidirectional Streaming

SSE (standardized in HTML5 via the `EventSource` API) provides **unidirectional, server-to-client streaming** over standard HTTP:
- Client makes a standard HTTP request with `Accept: text/event-stream`.
- Server keeps connection open and streams text frames formatted as `data: {...}\n\n`.
- **Pros:** Built-in automatic reconnection, works through all standard HTTP proxies and firewalls without special upgrades, ideal for LLM AI token streaming (ChatGPT) and live stock tickers!

---

## 3. WebSockets: Full-Duplex Bidirectional TCP Channels

WebSockets (`ws://` and `wss://`) provide **true full-duplex communication** over a persistent TCP socket:

```
1. Handshake: Client sends HTTP request with:
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Key: ...
2. Server responds: HTTP 101 Switching Protocols
3. Protocol transitions to lightweight binary/text frames with only 2–6 bytes of header overhead!
```

| Dimension | Server-Sent Events (SSE) | WebSockets |
| :--- | :--- | :--- |
| **Direction** | Server -> Client only | Bidirectional (Full Duplex) |
| **Protocol** | Standard HTTP/1.1 or HTTP/2 | Custom WebSocket protocol |
| **Data Types** | UTF-8 Text only | Text and raw Binary bytes |
| **Firewall Friendliness**| High (standard HTTP) | Moderate (some proxies block ws upgrades) |
| **Ideal Use Cases** | LLM token streaming, notifications, dashboards | Multiplayer gaming, live chat, whiteboards |

---

## Key Takeaways

1. Use SSE for server-to-client streaming (AI responses, status feeds) due to HTTP simplicity and auto-reconnection.
2. Use WebSockets for high-frequency bidirectional exchanges (gaming, collaborative editing).
3. Always implement heartbeat ping/pong frames to detect dead socket connections.
MARKDOWN;
    }

    private function reverseProxiesNatTraversalLoadBalancingArticle(): string
    {
        return <<<'MARKDOWN'
In modern web architectures, client requests almost never connect directly to an application server (Node.js, Go, Python). Instead, they land on a **Reverse Proxy**.

---

## 1. Forward Proxy vs. Reverse Proxy

- **Forward Proxy:** Sits in front of **clients**. Hides client IP addresses, filters outbound traffic, and bypasses geoblocking (e.g., corporate office proxies, VPNs).
- **Reverse Proxy:** Sits in front of **servers**. Hides origin server IP addresses, terminates TLS, caches static assets, and balances incoming load across backend pools.

```
Client ----> [ Forward Proxy ] ----> Internet ----> [ Reverse Proxy ] ----> Backend App
(Hides Client IP)                                 (Hides Origin Servers)
```

---

## 2. Comparing the Big Three: NGINX, HAProxy, and Envoy

### NGINX (The Web Engine)
- Event-driven, asynchronous worker process architecture.
- Excels at static file serving, SSL/TLS termination, HTTP request routing, and gzip/brotli compression.
- Configuration is predominantly static files (`nginx.conf`).

### HAProxy (High Availability Proxy)
- Highly specialized for extreme performance Layer 4 (TCP) and Layer 7 load balancing.
- Renowned for rock-solid connection queuing, advanced health checks, and stats socket telemetry.

### Envoy (Cloud-Native Service Proxy)
- Written in C++ by Lyft; designed for microservices and Kubernetes.
- Fully dynamic configuration via discovery APIs (xDS): can reload routes, endpoints, and clusters without restarting!
- Native support for gRPC, HTTP/2, HTTP/3, and distributed tracing.

---

## Key Takeaways

1. Reverse proxies protect backend application servers from direct internet exposure.
2. Offload SSL termination, rate limiting, and gzip compression to the proxy layer.
3. Use NGINX for edge ingress and static serving; use Envoy for dynamic microservice service meshes.
MARKDOWN;
    }

    private function corsCspAndWebSecurityHeadersArticle(): string
    {
        return <<<'MARKDOWN'
The **Same-Origin Policy (SOP)** is the most fundamental security boundary in web browsers: a web page from `bank.com` is forbidden from reading cookies, localStorage, or API responses from `attacker.com`.

Two origins are identical if and only if their **Scheme, Hostname, and Port** match:
- `https://aptrun.com:443` vs `http://aptrun.com:80` -> **Different** (Scheme mismatch)
- `https://api.aptrun.com` vs `https://aptrun.com` -> **Different** (Subdomain mismatch)

---

## 1. Cross-Origin Resource Sharing (CORS)

When a Single Page App on `app.aptrun.com` requests an API on `api.aptrun.com`, the browser blocks the response unless the server explicitly grants permission via **CORS headers**.

### Simple Requests vs. Preflight Requests:
If a request contains custom headers (`Authorization`) or methods other than `GET`, `POST`, `HEAD`, the browser sends a **Preflight `OPTIONS` request**:

```http
OPTIONS /v1/user HTTP/1.1
Origin: https://app.aptrun.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization, content-type
```

### The Server's Approval:
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.aptrun.com
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Credentials: true
```

> **The Dangerous Wildcard:** Never return `Access-Control-Allow-Origin: *` alongside `Access-Control-Allow-Credentials: true`! Browsers reject this combination, and it exposes sensitive data to malicious origins.

---

## 2. Content Security Policy (CSP)

A Content Security Policy restricts where scripts, images, and styles can be loaded from, neutralizing Cross-Site Scripting (XSS) attacks:
```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted-cdn.com; object-src 'none';
```

---

## Key Takeaways

1. The Same-Origin Policy isolates web domains by scheme, host, and port.
2. CORS allows controlled cross-origin exceptions via validated server response headers.
3. Use CSP to block inline script execution and defend against XSS attacks.
MARKDOWN;
    }

    private function networkDiagnosticsWiresharkTcpdumpTracerouteArticle(): string
    {
        return <<<'MARKDOWN'
When production latency spikes or connections hang mysteriously, application log statements (`log.Println("connecting...")`) tell you that something failed, but not **why**.

Mastering low-level networking tools allows you to look directly at the wire, decode raw packets, and diagnose connection resets, DNS failures, and MTU fragmentation issues.

---

## 1. `traceroute`: How Packet Paths are Mapped

How does `traceroute 8.8.8.8` discover every router between your laptop and Google?

By exploiting the **IP Time-To-Live (TTL)** field!
1. Packet #1 sent with **`TTL = 1`**. The very first router decrements TTL to 0, drops the packet, and sends back an **ICMP Time Exceeded** packet, revealing its IP address!
2. Packet #2 sent with **`TTL = 2`**. Router #1 forwards it; Router #2 drops it and returns its IP.
3. Repeats incrementally until reaching the target host.

---

## 2. Capturing Traffic with `tcpdump`

`tcpdump` is the standard command-line packet analyzer for Linux production servers:

```bash
# Capture 100 packets on port 443 with human-readable timestamps:
tcpdump -i eth0 -n -c 100 port 443

# Capture only TCP SYN packets (incoming connection requests):
tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0'

# Save packets to a file for analysis in Wireshark:
tcpdump -i eth0 -w trace.pcap port 80 or port 443
```

---

## 3. Deep Analysis in Wireshark

Wireshark provides visual inspection and stream reconstruction of `.pcap` files:
- **Follow TCP Stream:** Reassembles fragmented IP packets into the exact HTTP or plaintext conversation stream.
- **Display Filters:**
  - `tcp.analysis.retransmission`: Highlights network packet loss and degraded links.
  - `http.response.code >= 500`: Filters server errors.
  - `dns.time > 0.1`: Highlights slow DNS queries.

---

## Key Takeaways

1. `traceroute` maps internet hops by exploiting ICMP Time-To-Live expirations.
2. Use `tcpdump` to capture non-intrusive network traces on headless production servers.
3. Inspect TCP retransmissions and TLS handshakes using Wireshark display filters.
MARKDOWN;
    }
}
