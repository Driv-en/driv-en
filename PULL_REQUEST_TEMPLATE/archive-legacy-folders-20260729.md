# Archive legacy developer bid folders

This PR moves the legacy developer bid folders (/nda, /qanda, /v1-bid, /bidders) into /archive/.

These folders are no longer needed for the live Driv-en platform.

No functional code changes.

## Reviewer checklist
- [ ] Confirm archive copies exist at /archive/nda, /archive/qanda, /archive/v1-bid, /archive/bidders.
- [ ] Confirm originals (root /nda, /qanda, /v1-bid, /bidders) are removed in this PR (look for deletions in the diff).
- [ ] Run a quick repo-wide search for references to the moved paths and verify none require path updates:
  - `git grep -n "nda/" || true`
  - `git grep -n "qanda/" || true`
  - `git grep -n "v1-bid/" || true`
  - `git grep -n "bidders/" || true`
- [ ] Verify site/build/CI: run a local build and smoke-test or check the Pages preview after merge.
- [ ] Confirm protected paths were not modified: /website/, /public/, /scripts/, /includes/, /assets/, server.js, and root marketing pages.

## File summary
- nda/
  - nda/index.html -> archive/nda/index.html
  - nda/nda.pdf -> archive/nda/nda.pdf
- qanda/
  - qanda/index.html -> archive/qanda/index.html
  - qanda/QandA.pdf -> archive/qanda/QandA.pdf
- v1-bid/
  - v1-bid/index.html -> archive/v1-bid/index.html
  - v1-bid/Driv-en v1.0 - Developer Bid Packet.pdf -> archive/v1-bid/Driv-en v1.0 - Developer Bid Packet.pdf
  - v1-bid/Official-Bid-Form.pdf -> archive/v1-bid/Official-Bid-Form.pdf
  - v1-bid/Q&A-Addendum - Updated 3-17-26.pdf -> archive/v1-bid/Q&A-Addendum - Updated 3-17-26.pdf
- bidders/
  - bidders/index.html -> archive/bidders/index.html
  - bidders/BidSheet.docx -> archive/bidders/BidSheet.docx
  - bidders/RFP.pdf -> archive/bidders/RFP.pdf
