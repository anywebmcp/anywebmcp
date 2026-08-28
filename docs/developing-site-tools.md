# Developing site tools

For each operation in a new or existing website integration, choose the implementation in this order:

1. **Official API:** Use it when it works with the user's existing website session. Do not require the user to create an API token, OAuth app, or separate credentials.
   - Test whether the API works using safe, read-only operations before relying on it.
2. **Browser UI:** Otherwise, implement the operation through the website's normal browser flow using the DOM and page interactions.
   - Prefer selectors and tokens that are least likely to change due to user customization or website updates.
3. **Internal API:** If the UI approach is not practical, inspect the requests made by the website and use its internal endpoints with the existing session.

Prefer the earliest viable option. Keep authentication inside the user's current login, and document any selectors, internal endpoints, or other site-specific assumptions that may change.
