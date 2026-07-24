# Self-Healing Backend Operations

## Local Docker testbed boundary

The managing system can mount `/var/run/docker.sock` only in the controlled local dissertation testbed. That socket grants powerful control over the local Docker engine; application allowlisting reduces accidental action scope but is not a production-safe security boundary.

Production deployment must replace this adapter with an authenticated restricted executor API that applies least-privilege target authorization, idempotency, execution deadlines and complete audit records before invoking an allowlisted Docker or Kubernetes operation.
