;; TruthChain V3 - Complete Upgrade: All v1 Features + BNS Support
;; This is the definitive version combining v1 functionality with v2 BNS storage

;; Contract Owner
(define-constant CONTRACT-OWNER tx-sender)

;; Error Codes
(define-constant ERR-HASH-EXISTS (err u100))
(define-constant ERR-INVALID-HASH (err u101))
(define-constant ERR-INVALID-CONTENT-TYPE (err u102))
(define-constant ERR-UNAUTHORIZED (err u103))
(define-constant ERR-HASH-NOT-FOUND (err u104))

;; Content Types
(define-constant CONTENT-TYPE-BLOG-POST "blog_post")
(define-constant CONTENT-TYPE-PAGE "page")
(define-constant CONTENT-TYPE-MEDIA "media")
(define-constant CONTENT-TYPE-DOCUMENT "document")
(define-constant CONTENT-TYPE-TWEET "tweet")

;; Data Variables
(define-data-var total-registrations uint u0)
(define-data-var contract-active bool true)

;; Main Content Registry (with BNS support)
(define-map content-registry
  { hash: (buff 32) }
  {
    author: principal,
    bns-name: (optional (string-ascii 64)),
    block-height: uint,
    time-stamp: uint,
    content-type: (string-ascii 32),
    registration-id: uint
  }
)

;; Author Content Index
(define-map author-content
  { author: principal, registration-id: uint }
  { hash: (buff 32) }
)

;; Private Functions
(define-private (is-valid-content-type (content-type (string-ascii 32)))
  (or 
    (is-eq content-type CONTENT-TYPE-BLOG-POST)
    (is-eq content-type CONTENT-TYPE-PAGE)
    (is-eq content-type CONTENT-TYPE-MEDIA)
    (is-eq content-type CONTENT-TYPE-DOCUMENT)
    (is-eq content-type CONTENT-TYPE-TWEET)
  )
)

(define-private (is-valid-hash (hash (buff 32)))
  (is-eq (len hash) u32)
)

;; Main Registration Function with BNS Support
(define-public (register-content-with-bns 
    (hash (buff 32)) 
    (content-type (string-ascii 32))
    (bns-name (optional (string-ascii 64))))
  (let
    (
      (current-registrations (var-get total-registrations))
      (new-registration-id (+ current-registrations u1))
      (current-block stacks-block-height)
    )
    ;; Validation
    (asserts! (var-get contract-active) ERR-UNAUTHORIZED)
    (asserts! (is-valid-hash hash) ERR-INVALID-HASH)
    (asserts! (is-valid-content-type content-type) ERR-INVALID-CONTENT-TYPE)
    (asserts! (is-none (map-get? content-registry { hash: hash })) ERR-HASH-EXISTS)
    
    ;; Register content with BNS
    (map-set content-registry
      { hash: hash }
      {
        author: tx-sender,
        bns-name: bns-name,
        block-height: current-block,
        time-stamp: current-block,
        content-type: content-type,
        registration-id: new-registration-id
      }
    )
    
    ;; Add to author index
    (map-set author-content
      { author: tx-sender, registration-id: new-registration-id }
      { hash: hash }
    )
    
    ;; Update counter
    (var-set total-registrations new-registration-id)
    
    ;; Return success
    (ok {
      registration-id: new-registration-id,
      hash: hash,
      author: tx-sender,
      bns-name: bns-name,
      block-height: current-block,
      timestamp: current-block
    })
  )
)

;; Backward Compatibility: Register without BNS
(define-public (register-content (hash (buff 32)) (content-type (string-ascii 32)))
  (register-content-with-bns hash content-type none)
)

;; Verify Content (returns full data including BNS)
(define-read-only (verify-content (hash (buff 32)))
  (match (map-get? content-registry { hash: hash })
    registration-data (ok registration-data)
    ERR-HASH-NOT-FOUND
  )
)

;; Check if Hash Exists
(define-read-only (hash-exists (hash (buff 32)))
  (is-some (map-get? content-registry { hash: hash }))
)

;; Get Content by Author and Registration ID
(define-read-only (get-author-content (author principal) (registration-id uint))
  (match (map-get? author-content { author: author, registration-id: registration-id })
    hash-data 
      (match (map-get? content-registry { hash: (get hash hash-data) })
        content-data (ok content-data)
        ERR-HASH-NOT-FOUND
      )
    ERR-HASH-NOT-FOUND
  )
)

;; Get Total Registrations
(define-read-only (get-total-registrations)
  (ok (var-get total-registrations))
)

;; Get Registration Count (alias for compatibility)
(define-read-only (get-registration-count)
  (ok (var-get total-registrations))
)

;; Get Contract Stats
(define-read-only (get-contract-stats)
  (ok {
    total-registrations: (var-get total-registrations),
    contract-active: (var-get contract-active),
    contract-owner: CONTRACT-OWNER
  })
)

;; Batch Verify (up to 10 hashes)
(define-read-only (batch-verify (hashes (list 10 (buff 32))))
  (ok (map verify-content-simple hashes))
)

(define-private (verify-content-simple (hash (buff 32)))
  {
    hash: hash,
    exists: (hash-exists hash)
  }
)

;; Admin: Toggle Contract Status
(define-public (toggle-contract-status)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set contract-active (not (var-get contract-active)))
    (ok (var-get contract-active))
  )
)

;; Verify Registration by ID
(define-read-only (get-registration-by-id (registration-id uint))
  (if (and (> registration-id u0) (<= registration-id (var-get total-registrations)))
    (ok registration-id)
    ERR-HASH-NOT-FOUND
  )
)

;; Get Content Types
(define-read-only (get-content-types)
  (ok {
    blog-post: CONTENT-TYPE-BLOG-POST,
    page: CONTENT-TYPE-PAGE,
    media: CONTENT-TYPE-MEDIA,
    document: CONTENT-TYPE-DOCUMENT,
    tweet: CONTENT-TYPE-TWEET
  })
)
