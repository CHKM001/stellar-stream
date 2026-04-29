# Contributing to StellarStream

Thank you for your interest in contributing to StellarStream! This guide will help you get started with our development process.

## Development Setup

1. Clone the repository
2. Install dependencies: `npm run install:all`
3. Run the development environment: `npm run dev`

## Testing

### Backend Tests
Run `npm run test` in the `backend/` directory.

### Contract Tests
Run `cargo test` in the `contracts/` directory.

#### Snapshot Testing
We use `insta` for snapshot testing of contract events.  
Snapshot files are located in `contracts/test_snapshots/`.

**To update snapshots:**
If you change event structures and need to update the snapshots, run:


```bash
cargo insta review