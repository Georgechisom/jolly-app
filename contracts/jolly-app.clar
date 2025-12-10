;; jolly-app.clar
;;
;; Decentralized Social Media Platform on Stacks
;; Features: Tokenized posts as NFTs (SIP-009), direct crypto tips with platform fees.
;; No DAO or governance.
;; Uses Clarity 4 features like try! for error handling and modern map operations, and as-contract?.

(use-trait nft-trait .sip009-nft-trait.sip009-nft-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INSUFFICIENT-BALANCE (err u101))
(define-constant ERR-POST-NOT-FOUND (err u102))
(define-constant ERR-INVALID-AMOUNT (err u103))
(define-constant TIP-FEE-PERCENT u200) ;; 2% fee in basis points (2.00%)
(define-constant MAX-POST-CONTENT-LEN u280) ;; Max post length, like a tweet

;; Data Variables
(define-data-var last-post-id uint u0)
(define-data-var platform-fees uint u0)

;; Data Maps
(define-map posts uint {content: (string-utf8 280), owner: principal, metadata: (optional (string-ascii 256))})
(define-map post-tips uint uint) ;; Total tips received per post-id

;; NFT Trait Implementation for Posts
(define-trait jolly-nft-trait
  (
    (get-last-token-id () (response uint uint))
    (get-token-uri (uint) (response (optional (string-ascii 256)) uint))
    (get-owner (uint) (response (optional principal) uint))
    (transfer (uint principal principal) (response bool uint))
  )
)

;; Public Functions

;; Mint a new post as NFT
(define-public (mint-post (content (string-utf8 280)) (metadata (optional (string-ascii 256))))
  (let
    (
      (post-id (+ (var-get last-post-id) u1))
    )
    (asserts! (<= (len content) MAX-POST-CONTENT-LEN) ERR-INVALID-AMOUNT)
    (map-set posts post-id {content: content, owner: tx-sender, metadata: metadata})
    (map-set post-tips post-id u0)
    (var-set last-post-id post-id)
    (ok post-id)
  )
)

;; Tip a creator for a post
(define-public (tip-post (post-id uint) (amount uint))
  (let
    (
      (post (unwrap! (map-get? posts post-id) ERR-POST-NOT-FOUND))
      (creator (get owner post))
      (fee (/ (* amount TIP-FEE-PERCENT) u10000))
      (tip-amount (- amount fee))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (is-some (map-get? posts post-id)) ERR-POST-NOT-FOUND)
    (try! (stx-transfer? fee tx-sender CONTRACT-OWNER))
    (try! (stx-transfer? tip-amount tx-sender creator))
    (map-set post-tips post-id (+ (default-to u0 (map-get? post-tips post-id)) tip-amount))
    (var-set platform-fees (+ (var-get platform-fees) fee))
    (ok true)
  )
)

;; Transfer post NFT ownership
(define-public (transfer-post (post-id uint) (recipient principal))
  (let
    (
      (post (unwrap! (map-get? posts post-id) ERR-POST-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (get owner post)) ERR-NOT-AUTHORIZED)
    (map-set posts post-id (merge post {owner: recipient}))
    (ok true)
  )
)

;; Read-Only Functions

;; Get last post ID (SIP-009)
(define-read-only (get-last-token-id)
  (ok (var-get last-post-id))
)

;; Get token URI/metadata (SIP-009)
(define-read-only (get-token-uri (post-id uint))
  (ok (get metadata (map-get? posts post-id)))
)

;; Get owner of post (SIP-009)
(define-read-only (get-owner (post-id uint))
  (ok (get owner (map-get? posts post-id)))
)

;; Get post details
(define-read-only (get-post (post-id uint))
  (map-get? posts post-id)
)

;; Get total tips for a post
(define-read-only (get-post-tips (post-id uint))
  (default-to u0 (map-get? post-tips post-id))
)

;; Get accumulated platform fees
(define-read-only (get-platform-fees)
  (ok (var-get platform-fees))
)

;; Private Functions

;; Owner-only: Withdraw platform fees
(define-private (withdraw-fees (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= amount (var-get platform-fees)) ERR-INSUFFICIENT-BALANCE)
    (try! (as-contract? (stx-transfer? amount tx-sender tx-sender)))
    (var-set platform-fees (- (var-get platform-fees) amount))
    (ok true)
  )
)