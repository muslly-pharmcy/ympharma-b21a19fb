# Local Tesseract OCR preview for purchase invoices (Windows only)

This feature **extracts text for human review** from the authenticated user's existing `invoice-uploads` object. It never writes ledger entries, changes inventory, creates purchase orders, or converts OCR text into asserted quantities/prices. The existing cloud vision analysis and guarded draft-PO flow remain separate.

## Architecture

1. Signed upload to Supabase `invoice-uploads` through the normal authenticated invoice scanner.
2. The user explicitly chooses **استخراج محلي بالعربية والإنجليزية**.
3. TanStack server function `analyzeLocalOcrInvoice` enforces authentication, owner/admin role, and `assertOwnVisionObject` on the exact private upload path.
4. The **Windows-hosted** app server downloads only that validated image, enforces an 8 MB limit and PNG/JPEG magic bytes, and sends the bytes to `http://127.0.0.1:47861/ocr` with the server-side bearer token.
5. The bridge normalizes the image and invokes `D:\OCR\Tesseract-OCR\tesseract.exe` with `-l ara+eng --psm 3`. Only untrusted raw text returns to the review UI. No posting or automatic draft creation occurs.

## Windows setup

On `DESKTOP-1FQSBIE`, the bridge files are deployed outside the Git repo:

- `D:\OCR\bridge\ocr_bridge.py` — loopback-only Python service (Pillow + Tesseract).
- `D:\OCR\bridge\token.txt` — a random token; **never commit this file**.
- `D:\OCR\Tesseract-OCR\tesseract.exe` and `tessdata\ara.traineddata`, `eng.traineddata`.

The **server-side** `.env.local` must contain:

```dotenv
YMPHARMA_LOCAL_OCR_TOKEN=<a-long-random-value-matching-D:\OCR\bridge\token.txt>
```

Do not put the token in a `VITE_` environment variable or expose it to browser code. Use the app server on the **same Windows computer** as the OCR bridge. Start the bridge with the Python environment having Pillow installed, then start the YmPharma server. Access is limited to the loopback interface; **do not bind the bridge to 0.0.0.0 or open a firewall port**.

## Constraints / deployment

- Cloudflare Workers, Vercel and other cloud servers **cannot directly access the Windows drive D:** or loopback services on the owner's computer. In those environments the OCR preview returns an unavailable message and the existing cloud-vision flow continues unchanged.
- For mobile/iPad use, a separate authenticated server-to-server architecture would be required. Never expose the bearer-token bridge directly to remote browsers.
- The bridge requires the Windows machine to be powered on, and may require starting after reboot unless it is registered as a trusted local service.
- Output is a human-readable text preview, not validated invoice entities. The original image remains the source of truth.
- A failed local OCR request must not bypass RLS, tenant isolation, approval controls, or atomic draft-processing rules.

## Acceptance

- Tesseract Arabic/English recognition works on D independently.
- Bridge rejects missing/wrong bearer tokens and malformed/oversized images.
- A signed-in admin/owner can OCR only a private invoice object belonging to their own user prefix.
- The scanner displays text with a **review-only** warning and does not initiate any financial change.
- CI must pass before merging this feature branch. Do not deploy or merge before review.
