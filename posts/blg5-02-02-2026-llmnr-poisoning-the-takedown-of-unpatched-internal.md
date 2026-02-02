### LLMNR Poisoning: The Takedown of Unpatched Internal Networks

***

The foundational layer of any internal network is its naming resolution service. For decades, the ubiquitous Domain Name System (DNS) has been the cornerstone, but when DNS fails or a host query falls outside its domain, Windows systems fall back to two highly vulnerable protocols: Local Link Multicast Name Resolution (LLMNR) and NetBIOS Name Service (NBT-NS). Designed for simplicity and peer-to-peer discovery on small, isolated subnets, these protocols operate without authentication or validation, making them a critical point of failure—and a potent entry vector—for attackers seeking to compromise an internal network.

This analysis delves into the mechanics of LLMNR/NBT-NS poisoning, outlines the use of the industry-standard attack tool \`Responder.py\`, and presents a comprehensive guide to detection and robust mitigation strategies necessary to secure enterprise environments.

### The Network Fallback: A Fatal Flaw

LLMNR (UDP port 5355) and NBT-NS (UDP port 137) function as local link protocols. They allow a host to resolve a name to an IP address by multicasting a query to every other device on the same subnet. This is the crucial design flaw:

1.  **DNS Failure:** A Windows client attempts to reach a resource (e.g., a file share, a web service) but fails to resolve the hostname via standard DNS.
2.  **Multicast Query:** The client broadcasts an LLMNR or NBT-NS request, essentially shouting, "Who is \`\\TARGETSERVER\`?" to the entire local network segment.
3.  **Lack of Authentication:** Any machine on the subnet can answer the query. There is no cryptographic mechanism or validation required for a host to assert, "I am \`\\TARGETSERVER\`, my IP is X.X.X.X."

A malicious actor can exploit this trust vacuum by immediately flooding the network with a spoofed response. Since the client is programmed to accept the first valid-looking response, the attacker's machine is now the authoritative source for the non-existent or unreachable host.

### Technical Breakdown: The Responder.py Playbook

The attack is standardized and highly effective, primarily leveraging the Python-based tool, \`Responder.py\`. This tool automates the process of listening for these unauthenticated name resolution broadcasts and responding with malicious intent.

#### 1. Setup and Listening

The attacker, having established a foothold on the internal network (even a low-privilege host), initiates Responder:

\`\`\`bash
sudo responder -I <interface> -f -w
\`\`\`

*   \`-I <interface>\`: Specifies the listening network interface (e.g., \`eth0\`).
*   \`-f\`: Enables Fingerprint mode, which passively gathers information.
*   \`-w\`: Enables the WPAD (Web Proxy Auto-Discovery) rogue server, a related attack vector that often runs in conjunction.

Responder instantly begins monitoring UDP 5355 (LLMNR) and UDP 137 (NBT-NS).

#### 2. The Poisoning

When a client queries for a hostname that Responder is listening for, the tool immediately responds to the client's multicast query with its own IP address. The client now believes the attacker's machine is the legitimate target server.

#### 3. Authentication and Capture

Believing it has the correct IP, the client attempts to establish a connection using the protocol relevant to the requested resource. For file shares, this is typically Server Message Block (SMB); for web services, it might be HTTP.

Crucially, the client, expecting to talk to a legitimate server, automatically attempts to authenticate using the user’s credentials through the NTLM (NT Lan Manager) challenge-response protocol. The attacker's Responder instance, acting as the fake server, handles the connection attempt:

*   **SMB/HTTP Challenge:** Responder issues an NTLM challenge to the client.
*   **Response Capture:** The client responds by encrypting the challenge using a one-way hash of the user's password (the NTLMv2 hash). This hash is the critical payload.
*   **No Authentication Needed:** The attacker does not need to complete the authentication handshake or know the original password. Responder is purely a hash-capturing service. It logs the username, the IP address of the victim, and the captured NTLMv2 hash.

Captured hashes (e.g., \`$NETNTLMv2$USER::TARGET:CHALLENGE:RESPONSE:\`) are then taken offline. Modern password cracking tools like Hashcat or John the Ripper, often utilizing massive rainbow tables or dictionary attacks combined with powerful GPUs, can quickly crack weak, common, or dictionary passwords. Once cracked, the attacker has the cleartext credentials, enabling lateral movement and privilege escalation across the network.

### Mitigation Strategies: Hardening the Internal Perimeter

The most effective defense against LLMNR/NBT-NS poisoning is to eliminate the protocols entirely. This vulnerability thrives on a design that predates modern security requirements, and its continued presence in an enterprise environment is a significant liability.

#### 1. Disable LLMNR and NBT-NS via GPO

This is the paramount mitigation step. Both protocols should be disabled network-wide via Group Policy Objects (GPOs) in Active Directory.

*   **Disable LLMNR:**
    *   Navigate to: **Computer Configuration** > **Administrative Templates** > **Network** > **DNS Client**.
    *   Set **"Turn Off Multicast Name Resolution"** to **Enabled**.
*   **Disable NBT-NS (NetBIOS over TCP/IP):**
    *   This is typically managed per-network adapter. Use GPO to script the setting or manually configure the adapter's TCP/IP advanced settings.
    *   Under **WINS** tab, select **"Disable NetBIOS over TCP/IP"**.

If these protocols are disabled, the client will fail to resolve the name and will typically return a definitive error rather than initiating a vulnerable broadcast.

#### 2. Enforce SMB Signing

While disabling LLMNR/NBT-NS stops the *poisoning*, enforcing SMB signing mitigates the risk associated with a successful capture. SMB signing requires both the client and the server to cryptographically sign every SMB packet. This prevents Man-in-the-Middle (MitM) relay attacks, where an attacker captures the hash and immediately uses it to authenticate to a different target (Relay).

*   **GPO Path:** **Computer Configuration** > **Windows Settings** > **Security Settings** > **Local Policies** > **Security Options**.
*   Set **"Microsoft network client: Digitally sign communications (always)"** to **Enabled**.
*   Set **"Microsoft network server: Digitally sign communications (always)"** to **Enabled**.

#### 3. Network Segmentation and Firewalling

LLMNR and NBT-NS are designed for local link resolution. By aggressively segmenting the network, you limit the blast radius of any successful poisoning attempt. An attacker on one VLAN should not be able to poison a client on another. Implement firewall rules to block UDP traffic on ports 137, 138, and 5355 between segments where these services are not explicitly required (which should be none).

### Detection and Threat Hunting

Even with a strong mitigation plan, organizations must maintain an active detection strategy to catch instances where LLMNR poisoning may still occur due to misconfiguration or lapse in policy enforcement.

#### 1. Network Traffic Analysis

Security Information and Event Management (SIEM) systems should monitor network traffic for indicators of compromise (IOCs):

*   **Excessive Multicast Responses:** Legitimate LLMNR/NBT-NS traffic involves many queries but only one legitimate response (from the target). Detecting multiple simultaneous responses to a single query—especially from an unexpected host—is a clear sign of Responder being active.
*   **Source Correlation:** Correlate LLMNR/NBT-NS responses with the MAC address of the source. If the same MAC is repeatedly sending spoofed responses, it should be flagged for investigation.
*   **Port Monitoring:** Flag any device listening or actively communicating on UDP 137, 138, and 5355 that is *not* a designated DNS/WINS server.

#### 2. Host and Log Monitoring

*   **Logon Type 3 Auditing:** Monitor Active Directory for successful NTLM (Logon Type 3, Network) authentications immediately following a failed name resolution event. While normal, a sudden spike in NTLM logons, especially from new source IPs, can indicate a threat actor rapidly moving through the network using captured credentials.
*   **EDR Solutions:** Modern Endpoint Detection and Response (EDR) tools often have rules to detect the behavior of tools like Responder, particularly when they start promiscuously listening on network interfaces for multicast traffic.

### Conclusion

LLMNR and NBT-NS poisoning remains a high-value, low-effort attack vector. In networks where DNS is reliable, these protocols are redundant and exist only as a dangerous legacy fallback. An unpatched, unsegmented internal network is a target-rich environment where an attacker can transition from a low-privilege foothold to domain compromise in minutes, simply by leveraging a 20-year-old design flaw. By aggressively disabling these protocols, enforcing strong SMB signing, and maintaining rigorous network visibility, enterprises can neutralize this foundational threat and significantly raise the operational cost for any internal adversary.