# Security Specification for SketchFlow

## 1. System Invariants
- Only verified Admin users authenticated via Firebase Auth can modify products or update system settings.
- The default admin email is bootstrapped from the user request (`jotsingh122010@gmail.com`) into Firestore `admin_settings/primary`, allowing the admin to securely update/transfer this email without hardcoding it in the code.
- Resetting or changing the admin email requires either an active authenticated admin session or a valid recovery key stored securely in Firestore.
- Public visitors can submit session ping metrics and read products, but cannot modify, overwrite, or delete products or tamper with admin settings.

## 2. The Dirty Dozen Payloads (Targeting Firestore)
1. **Unauthenticated Admin Settings Write**: An anonymous client tries to overwrite `/admin_settings/primary` with their own email. (Denied: Only verified admin can write).
2. **Product Overwrite by Visitor**: An unauthenticated user tries to delete or modify `/products/{id}`. (Denied: Write requires admin auth).
3. **Invalid Product Schema Injection**: Admin or attacker sends product with oversized payload (> 2MB) or missing required fields. (Denied: Schema validation helper checks required keys and length).
4. **Id Poisoning Attack**: An attacker sends path parameter `/products/../../etc`. (Denied: `isValidId()` guards all document path IDs).
5. **Visitor Impersonation / Data Injection**: Attacker attempts to update another visitor's session without matching ID.
6. **Email Spoofing Attack**: Attacker signs in with an unverified email claiming to be the admin. (Denied: `request.auth.token.email_verified == true` required or matching Firestore admin record).
7. **Privilege Escalation**: User creates a document in `/admins/{uid}` granting themselves `superadmin`. (Denied: `/admins` writes restricted to existing superadmin).
8. **Shadow Field Injection**: Writing unexpected fields like `isSuperUser: true` into product documents. (Denied: `affectedKeys().hasOnly()` and strict key whitelist).
9. **Oversized String DoS**: Sending a 500KB title in product creation. (Denied: `maxLength` bounds enforced).
10. **Timestamp Tampering**: Sending fake past or future timestamps for `createdAt`. (Denied: `request.time` enforcement).
11. **Malicious Recovery Key Wipe**: Trying to set empty `recoveryKey` in admin settings. (Denied: Minimum size check on recoveryKey).
12. **Blanket Query Scraping**: Attempting an unrestricted list without appropriate rules. (Denied: explicitly scoped rules).
