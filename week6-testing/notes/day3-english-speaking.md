# W6 Day 3 · Technical English Speaking

## Topic

Validating an end-to-end authentication and reporting flow

## Speaking Script

Today I validated a full-stack authentication and reporting flow instead of only checking that the UI loaded. An admin first logged in and received a JWT containing the user ID. The browser stored the token and attached it as a Bearer token when requesting two protected reports. In development, Vite proxied those requests to the Express server. Express verified the token, then looked up the user's current role in MongoDB. This separation matters because authentication proves identity, while authorization decides whether that identity may access an admin-only resource. I observed three outcomes: no token stopped at authentication with 401, a valid member token stopped at authorization with 403, and an admin token reached the aggregation layer and returned 200. The page then rendered the monthly sales and customer spending reports. These results gave me evidence for the complete cross-layer contract, not just a successful login.

## Speaking Check

- Word count: 145
- Estimated speaking time: about 60–67 seconds at 130–145 words per minute
- Tone check: conversational engineering explanation with observed results and clear responsibility boundaries
- Pronunciation: authentication /aw-then-ti-KAY-shun/; authorization /aw-thuh-ri-ZAY-shun/; aggregation /ag-ri-GAY-shun/
