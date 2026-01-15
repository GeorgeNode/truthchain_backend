;; TruthChain V2 - Content Registration with BNS Identity
;; Stores content hash + BNS name for permanent identity preservation

;; Data Variables
(define-data-var registration-count uint u0)

;; Data Maps
(define-map content-registry
  { content-hash: (buff 32) }
  {
    author: principal,
    bns-name: (optional (string-ascii 64)),
    content-type: (string-ascii 20),
    time-stamp: uint,
    block-height: uint,
    registration-id: uint
  }
)

;; Register content with BNS name
(define-public (register-content-with-bns 
    (content-hash (buff 32))
    (content-type (string-ascii 20))
    (bns-name (optional (string-ascii 64))))
  (let
    (
      (registration-id (+ (var-get registration-count) u1))
      (caller tx-sender)
    )
    ;; Check if content already registered
    (asserts! (is-none (map-get? content-registry { content-hash: content-hash }))
      (err u100))
    
    ;; Store registration with BNS name
    (map-set content-registry
      { content-hash: content-hash }
      {
        author: caller,
        bns-name: bns-name,
        content-type: content-type,
        time-stamp: stacks-block-height,
        block-height: stacks-block-height,
        registration-id: registration-id
      }
    )
    
    ;; Increment counter
    (var-set registration-count registration-id)
    
    (ok registration-id)
  )
)

;; Verify content and get full details including BNS
(define-read-only (verify-content (content-hash (buff 32)))
  (match (map-get? content-registry { content-hash: content-hash })
    registration (ok registration)
    (err u404)
  )
)

;; Backward compatibility: Register without BNS
(define-public (register-content 
    (content-hash (buff 32))
    (content-type (string-ascii 20)))
  (register-content-with-bns content-hash content-type none)
)

;; Check if hash exists
(define-read-only (hash-exists (content-hash (buff 32)))
  (is-some (map-get? content-registry { content-hash: content-hash }))
)

;; Get registration count
(define-read-only (get-registration-count)
  (ok (var-get registration-count))
)
