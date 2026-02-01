# Kerberos: The Technical Foundation of Windows Authentication

## Introduction to the Protocol

Kerberos is a network authentication protocol that works on the basis of **tickets** to allow nodes communicating over a non-secure network to prove their identity to one another securely. It is the default authentication mechanism for Microsoft Windows domains, as well as many other enterprise systems. The primary goal is to provide **mutual authentication**, ensuring both the user and the service are who they claim to be.

## The Three Pillars of Kerberos

The Kerberos system relies on three core components, collectively known as the Key Distribution Center (KDC):

1.  **Authentication Server (AS):** Validates the user's credentials (usually a password hash) and issues the Ticket-Granting Ticket (TGT).
2.  **Ticket-Granting Service (TGS):** Issues a Service Ticket (ST) to the client, allowing access to a specific application service.
3.  **Database:** Securely stores all user and service secrets (long-term keys).

## The Authentication Process (The Ticket Flow)

Kerberos authentication is a multi-step process involving the client, the AS, and the TGS:

1.  **AS Exchange (TGT Request):**
    *   **Client to AS:** Client sends its username (plaintext) to the AS, encrypted with its password hash.
    *   **AS to Client:** If credentials match, the AS sends back a **Ticket-Granting Ticket (TGT)**, encrypted with the TGS's secret key. The TGT serves as proof of identity for the TGS.

2.  **TGS Exchange (Service Ticket Request):**
    *   **Client to TGS:** The client presents the TGT (which it cannot decrypt) and sends a request for a Service Ticket for a specific service (e.g., a file server).
    *   **TGS to Client:** The TGS decrypts the TGT, validates the client's identity, and issues a **Service Ticket (ST)**, encrypted with the target service's secret key.

3.  **Client/Server Exchange:**
    *   **Client to Server:** The client sends the Service Ticket to the target server.
    *   **Server:** The server decrypts the ST using its own secret key, validates the ticket, and grants the client access.

This ticket-based system ensures that the client never has to send its password hash over the network to any service other than the AS, greatly reducing the risk of credential compromise.