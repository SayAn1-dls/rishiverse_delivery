# Frequently Asked Questions

## Q: Why is my order stuck in pending?
A: The order may not have been assigned to an agent yet. Check the admin panel for unassigned orders.

## Q: Why am I getting a 401 on the API?
A: Your session may have expired. Log out and log in again to refresh your token.

## Q: The app is slow on first load. Why?
A: Render free-tier spins down after inactivity. First request after idle wakes the server — takes 30-60 seconds.

## Q: How do I add a new delivery agent?
A: Create a user account with the `agent` role via the admin panel or directly in MongoDB.

## Q: Can I run this locally?
A: Yes. Clone the repo, copy `.env.example` to `.env.local`, fill in the values, and run `yarn dev`.
