# The Stealthy Persistence of LLMNR and NBT-NS Poisoning

## Introduction: The Legacy Protocols and Their Inherent Flaw

In modern enterprise networks, the Domain Name System (DNS) is the authoritative mechanism for name resolution. Yet, most Microsoft Windows environments—and many other operating systems—retain two legacy, non-DNS protocols for localized name resolution: Link-Local Multicast Name Resolution (LLMNR) and NetBIOS Name Service (NBT-NS). These protocols were designed to ensure name resolution continuity on a local subnet when a DNS server is unavailable, a condition often encountered in small networks or during system failure. Paradoxically, their simple, unauthenticated broadcast nature transforms them from benevolent backup mechanisms into significant, easily exploitable attack vectors. The inherent security vulnerability in both LLMNR and NBT-NS stems from their reliance on a first-responder-wins trust model, which is exploited in what is commonly termed "poisoning" or "spoofing" attacks.

## Mechanism of Attack: The First-Responder-Wins Vulnerability

LLMNR and NBT-NS operate by sending multicast (LLMNR) or broadcast (NBT-NS) queries to the local network when a standard DNS query fails. When a host attempts to resolve a name—for instance, a file share or a printer—and the DNS lookup times out, the operating system defaults to querying the local subnet: "Does anyone know the IP address for 'SERVER-PRINTER-01'?"

The poisoning attack catalyzes on this process. An attacker-controlled machine, which has been placed on the local subnet (often achieved through a physical connection or a compromised initial endpoint), continuously monitors for these broadcast queries. Upon detecting a query, the attacker’s machine immediately sends a spoofed response, claiming to be the requested resource.

### The Attack Flow

1.  **Host Initiates Query:** A user attempts to access `\\unknown-server` or `http://web-app-dev`.
2.  **DNS Fails:** Standard DNS lookup fails or times out.
3.  **LLMNR/NBT-NS Broadcast:** The host broadcasts a query to the local subnet (e.g., multicast IP `224.0.0.252` for LLMNR).
4.  **Attacker Responds:** The attacker, running a tool like Responder, intercepts the query and, crucially, responds *before* the legitimate machine (if one exists) or any other machine on the network. The response declares, "I am `unknown-server`, and my IP address is `192.168.1.10` (the attacker's machine)."
5.  **Host Connects:** The querying host accepts this spoofed response and attempts to establish the connection with the attacker's IP address.
6.  **Authentication Handshake:** The querying host, believing it is connecting to a legitimate resource (e.g., an SMB file share), automatically attempts to authenticate using its cached credentials. This initiates a challenge-response authentication handshake, typically utilizing the NTLM or NTLMv2 protocol.

## The Paydirt: Capturing NTLM Hashes

The objective of LLMNR/NBT-NS poisoning is not to facilitate a Man-in-the-Middle connection to the actual resource, but rather to force an authentication attempt against the attacker’s server. Tools such as Responder are purpose-built to execute the spoofing and then, critically, to capture the resulting NTLM hash.

When a Windows machine attempts NTLM authentication, it does not send the user’s cleartext password. Instead, it sends the username and a cryptographically-derived hash of the user's password, along with a randomly generated challenge and a response. The captured data is typically the NTLMv2 "hash," which is actually a concatenation of the username, the domain name, the server challenge, and the NTLMv2 client response. The full structure is:

`username::domain:challenge:NTLMv2_client_response:session_key`

This hash is the central prize for the attacker. While the NTLMv2 protocol is significantly more robust than its NTLMv1 predecessor, its primary weakness in this context is its susceptibility to **offline brute-force or dictionary cracking**. Since the attacker possesses all the necessary components (the hash and the challenge), they can dedicate vast computational resources (high-end GPUs or cloud infrastructure) to crack the password without generating any further network traffic or alerting security monitoring systems.

### Post-Exploitation: The Pass-the-Hash Vector

Even if the password cannot be fully cracked, the NTLMv2 hash itself can often be used for immediate lateral movement across the network through a **Pass-the-Hash (PtH)** attack. If the target machine is a server or another machine that has not been patched against PtH vulnerabilities, the attacker can inject the stolen hash into their own session and authenticate to other services (like SMB, RDP, or WinRM) as the legitimate user without ever knowing the plaintext password. This is particularly effective if the captured account belongs to an administrative or service principal, granting the attacker high-privilege access across the domain.

## Mitigation Strategies: From Protocol Disabling to Network Segmentation

The defense against LLMNR/NBT-NS poisoning is multi-layered, but the most effective strategies involve disabling the protocols and enforcing modern security standards.

### 1. Disabling LLMNR and NBT-NS

Since these protocols are intended only as fallbacks and their functionality is entirely superseded by a correctly configured DNS infrastructure, the most direct mitigation is to disable them globally via Group Policy Object (GPO).

*   **LLMNR Disabling (GPO):**
    *   Navigate to `Computer Configuration -> Administrative Templates -> Network -> DNS Client`.
    *   Set **Turn Off Link-Local Multicast Name Resolution** to **Enabled**.
*   **NBT-NS Disabling (Network Adapter Settings):**
    *   For each network adapter, under the IPv4 properties, go to the **WINS** tab, and select **Disable NetBIOS over TCP/IP**. This must be consistently applied across all relevant endpoints.

It is critical to ensure that a robust DNS configuration is in place before disabling these protocols to avoid legitimate service disruptions.

### 2. Enforcing SMB Signing

The success of the attack often relies on the host attempting an SMB connection. **Server Message Block (SMB) Signing** enforces cryptographic signing of all SMB traffic. If SMB Signing is mandatory on the requested resource, the client's connection attempt to the attacker's machine will fail the handshake, as the attacker cannot generate a valid signature for the spoofed server. This is a crucial defense-in-depth measure, as it prevents the NTLM challenge-response from completing successfully against a non-compliant server.

### 3. Network Segmentation and Isolation

Since LLMNR and NBT-NS are limited to the local broadcast domain, the attack can only succeed if the attacker is on the same Layer 2 subnet as the target. Strategic network segmentation, especially the implementation of **Network Access Control (NAC)** and VLAN segregation, can significantly limit the blast radius of a successful poisoning event. Restricting endpoints to small, isolated VLANs ensures that an attacker's initial breach only exposes a minimal set of user hashes, preventing the immediate compromise of high-value targets in adjacent segments.

## Conclusion

LLMNR and NBT-NS poisoning remains a prominent and persistent threat in penetration testing and real-world breaches due to the protocols' inherently insecure design and their default enablement in Windows environments. While LLMNR and NBT-NS solved a network continuity problem decades ago, their continued use introduces an unnecessary and high-impact lateral movement vector. By implementing a focused strategy that prioritizes disabling the protocols, enforcing modern security features like SMB Signing, and rigorously applying network segmentation, organizations can effectively close this enduring and stealthy avenue of attack, significantly bolstering their overall defensive posture against credential theft.