# The Silent Snare: Deconstructing LLMNR and NBT-NS Poisoning

**Introduction**

In the landscape of modern enterprise networks, local name resolution protocols are foundational yet often overlooked security gaps. Link-Local Multicast Name Resolution (LLMNR) and NetBIOS Name Service (NBT-NS) are fallback mechanisms designed for host identification when standard DNS fails. While convenient for peer-to-peer discovery in small networks, within a larger, less-segmented domain, these protocols introduce a critical, near-ubiquitous vulnerability: name resolution poisoning. This attack capitalizes on the protocols’ unauthenticated, broadcast nature to facilitate Man-in-the-Middle (MITM) and credential harvesting operations. For the red team operator, LLMNR/NBT-NS poisoning is a low-effort, high-reward technique for initial domain compromise. For the defender, understanding its mechanics is the first step toward effective mitigation and network hardening.

**Protocol Mechanics and Intent**

LLMNR (RFC 4795) and NBT-NS are designed for local, flat network environments. When a host attempts to resolve a hostname but the primary DNS server fails to provide a resolution (e.g., the name is misspelled or is for a non-existent internal service), the client falls back to broadcasting a query across the local subnet.

For LLMNR, this multicast query is sent on UDP port 5355. For NBT-NS, the broadcast uses UDP port 137. The fundamental flaw lies in their operation:

1.  **Broadcast Nature:** Queries are sent to *all* hosts on the link.
2.  **First Responder Wins:** Any host can answer the query. There is no mechanism for authentication, verification, or challenge-response to ensure the responder is the legitimate owner of the requested name.

The protocols are designed for resilience and automatic discovery, prioritizing convenience over security. This design makes them inherently vulnerable to impersonation, as the first malicious response received by the requesting client is immediately accepted and trusted.

**The Attack Vector: Name Resolution Poisoning**

The attack is startlingly simple and highly effective, often executed using tools like Responder. The malicious actor positions a listening station on the network segment. When a client broadcasts a name resolution query for a non-existent resource (e.g., a file share named `\\nonexistent-server\data`), the attacker's tool detects the broadcast.

The poisoning process unfolds as follows:

1.  **Query Interception:** The client requests a name, say `SERVER-XYZ`.
2.  **Impersonation:** The attacker, realizing this query has gone unanswered by DNS, immediately sends a unicast response back to the querying client, claiming to be `SERVER-XYZ`.
3.  **Redirection:** The attacker's response contains the attacker’s own IP address as the resolution for the requested hostname.
4.  **Connection Attempt & Authentication:** The client accepts this resolution and, believing the attacker is the legitimate server, attempts to establish a connection. Critically, if the client was attempting to access a resource (e.g., a file share, a web service), it will automatically initiate a challenge-response authentication protocol, typically **NTLMv2**, against the attacker's IP.
5.  **Hash Capture:** The attacker’s listening service, often a fraudulent SMB or HTTP service within the poisoning tool, captures the NTLMv2 hash transmitted by the client. The connection is then typically dropped.

**The Value Proposition: NTLMv2 Hash Compromise**

The true severity of this vulnerability is not merely the denial of a resource, but the automated capture of the victim's authentication material. An NTLMv2 hash, while not the user’s cleartext password, is a cryptographically derived one-way function that can be subjected to offline dictionary and brute-force attacks.

The strength of the captured hash depends on the victim's password complexity, but even complex hashes are vulnerable to modern cracking infrastructure. Furthermore, even if the hash is not immediately cracked, it can be leveraged in **Pass-the-Hash (PtH)** or **Relay** attacks.

-   **Pass-the-Hash:** If the captured hash belongs to a local administrator or a service account, it can often be used directly to authenticate to other systems on the network (lateral movement) without ever needing to recover the cleartext password.
-   **NTLM Relay (SmbRelayX):** A more advanced variant involves relaying the hash (or the authentication challenge) to another legitimate server (e.g., an Active Directory domain controller or a critical file server) where the victim user has high-level permissions. This allows the attacker to force the victim to authenticate to the attacker, who then simultaneously authenticates to the target server on the victim's behalf, achieving session takeover or code execution. This is particularly potent when the victim is a Domain Administrator.

**Strategic Mitigation and Defense**

Mitigating LLMNR/NBT-NS poisoning requires a multi-layered approach focused on disabling the attack surface and controlling hash usage.

1.  **Disable LLMNR/NBT-NS:** The most effective defense is to disable both protocols via Group Policy (GPO) or local policy settings. Windows clients can operate perfectly well without these fallbacks, relying solely on DNS.
2.  **Network Segmentation:** Deploying network access control (NAC) and strict firewall rules between subnets prevents broadcasts from crossing security boundaries, limiting the attack blast radius.
3.  **Block Ports:** Filter or block inbound traffic to UDP 137, UDP 5355, and TCP/UDP 445 (SMB) at the host level where possible, and strictly at the segment boundary.
4.  **Credential Hardening:** Enforce strong, long passwords to resist offline cracking of captured NTLMv2 hashes. Implement the principle of least privilege, ensuring no local administrator account is also a Domain Administrator.

**Conclusion**

LLMNR and NBT-NS poisoning remain staple techniques for internal penetration testers because they exploit a protocol design flaw that is often left unaddressed. By disabling these vestigial protocols and implementing strong credential and network policies, organizations can effectively close one of the simplest and most potent initial footholds in an internal network attack chain.