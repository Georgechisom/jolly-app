;; jolly-app.clar
;;
;; Decentralized Social Media Platform on Stacks
;; Features: Tokenized posts as NFTs (SIP-009), direct crypto tips with platform fees.

;; Constants
(define-data-var contract-owner principal 'SP000000000000000000002Q6VF78)
(define-data-var contract-principal principal 'SP000000000000000000002Q6VF78)
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-AMOUNT (err u101))
(define-constant ERR-POST-NOT-FOUND (err u102))
(define-constant ERR-INSUFFICIENT-BALANCE (err u103))
(define-constant MAX-POST-CONTENT-LEN u500)

;; Data Variables
(define-data-var last-post-id uint u0)
(define-data-var platform-fees uint u0)

;; Data Maps
(define-map posts 
  uint 
  {
    content: (string-utf8 500),
    owner: principal,
    metadata: (optional (string-ascii 170)),
    timestamp: uint
  }
)

(define-map post-tips uint uint)

;; Read-only functions
(define-read-only (get-post (post-id uint))
  (map-get? posts post-id)
)

(define-read-only (get-post-tips (post-id uint))
  (default-to u0 (map-get? post-tips post-id))
)

(define-read-only (get-last-post-id)
  (ok (var-get last-post-id))
)

;; SIP-009 NFT Standard Functions
(define-read-only (get-last-token-id)
  (ok (var-get last-post-id))
)

(define-read-only (get-token-uri (post-id uint))
  (ok (get metadata (map-get? posts post-id)))
)

(define-read-only (get-owner (post-id uint))
  (ok (get owner (map-get? posts post-id)))
)

(define-read-only (get-platform-fees)
  (ok (var-get platform-fees))
)

(define-read-only (get-contract-owner)
  (ok (var-get contract-owner))
)

;; Allow deployer to initialize the contract owner once: only allowed if
;; contract-owner is the placeholder sentinel address.
(define-public (init-owner (owner principal) (contract-p principal))
  (begin
    (asserts! (is-eq (var-get contract-owner) 'SP000000000000000000002Q6VF78) ERR-NOT-AUTHORIZED)
    (var-set contract-owner owner)
    (var-set contract-principal contract-p)
    (ok true)
  )
)

;; Helper to return current owner as a value
(define-private (owner-or-err)
  (ok (var-get contract-owner))
)

;; Public functions
(define-public (create-post (content (string-utf8 500)) (metadata (optional (string-ascii 170))))
  (let
    (
      (post-id (+ (var-get last-post-id) u1))
      (current-time stacks-block-time)
      (final-metadata (match metadata 
        provided-meta (some provided-meta)
        (some (unwrap-panic (to-ascii? tx-sender)))
      ))
    )
    (asserts! (<= (len content) MAX-POST-CONTENT-LEN) ERR-INVALID-AMOUNT)
    (map-set posts post-id {
      content: content, 
      owner: tx-sender, 
      metadata: final-metadata, 
      timestamp: current-time
    })
    (map-set post-tips post-id u0)
    (var-set last-post-id post-id)
    (ok post-id)
  )
)

(define-public (tip-post (post-id uint) (amount uint))
  (let
    (
      (post (unwrap! (map-get? posts post-id) ERR-POST-NOT-FOUND))
      (post-owner (get owner post))
      (current-tips (default-to u0 (map-get? post-tips post-id)))
      ;; Calculate 5% platform fee
      (platform-fee (/ (* amount u5) u100))
      (owner-amount (- amount platform-fee))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    ;; Transfer tip amount minus fee to post owner
    (try! (stx-transfer? owner-amount tx-sender post-owner))
    (let ((contract-princ (var-get contract-principal)))
      (try! (stx-transfer? platform-fee tx-sender contract-princ))
    )
    ;; Update platform fees accounting (cumulative)
    (var-set platform-fees (+ (var-get platform-fees) platform-fee))
    ;; Update post tips
    (map-set post-tips post-id (+ current-tips amount))
    (ok true)
  )
)

(define-public (delete-post (post-id uint))
  (let
    (
      (post (unwrap! (map-get? posts post-id) ERR-POST-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (get owner post)) ERR-NOT-AUTHORIZED)
    (map-delete posts post-id)
    (map-delete post-tips post-id)
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

;; Update post content (owner only)
(define-public (update-post (post-id uint) (new-content (string-utf8 500)))
  (let
    (
      (post (unwrap! (map-get? posts post-id) ERR-POST-NOT-FOUND))
      (current-time stacks-block-time)
    )
    (asserts! (is-eq tx-sender (get owner post)) ERR-NOT-AUTHORIZED)
    (asserts! (<= (len new-content) MAX-POST-CONTENT-LEN) ERR-INVALID-AMOUNT)
    (map-set posts post-id (merge post {content: new-content, timestamp: current-time}))
    (ok true)
  )
)

;; Owner-only: Withdraw platform fees
(define-public (withdraw-fees (amount uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (asserts! (<= amount (var-get platform-fees)) ERR-INSUFFICIENT-BALANCE)
    (var-set platform-fees (- (var-get platform-fees) amount))
    (ok true)
  )
)


;; Batch create multiple posts (efficient for multiple posts)
(define-public (batch-create-posts (posts-list (list 10 {content: (string-utf8 500), metadata: (optional (string-ascii 170))})))
  (let
    (
      (results (map create-single-post-internal posts-list))
    )
    (ok results)
  )
)

;; Internal helper for batch creation
(define-private (create-single-post-internal (post-data {content: (string-utf8 500), metadata: (optional (string-ascii 170))}))
  (let
    (
      (post-id (+ (var-get last-post-id) u1))
      (current-time stacks-block-time)
      (content (get content post-data))
      (metadata (get metadata post-data))
      (final-metadata (match metadata 
        provided-meta (some provided-meta)
        (some (unwrap-panic (to-ascii? tx-sender)))
      ))
    )
    (map-set posts post-id {
      content: content, 
      owner: tx-sender, 
      metadata: final-metadata, 
      timestamp: current-time
    })
    (map-set post-tips post-id u0)
    (var-set last-post-id post-id)
    post-id
  )
)

;; Get multiple posts at once
(define-read-only (get-posts-batch (post-ids (list 20 uint)))
  (ok (map get-post post-ids))
)

;; Check if user is post owner
(define-read-only (is-post-owner (post-id uint) (user principal))
  (match (map-get? posts post-id)
    post (ok (is-eq user (get owner post)))
    (ok false)
  )
)

;; Get post with tips in one call
(define-read-only (get-post-with-tips (post-id uint))
  (match (map-get? posts post-id)
    post (ok {
      post: post,
      tips: (default-to u0 (map-get? post-tips post-id))
    })
    ERR-POST-NOT-FOUND
  )
)

;; Initialize
(begin
  (var-set last-post-id u0)
  (var-set platform-fees u0)
)