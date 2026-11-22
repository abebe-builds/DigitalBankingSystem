/**
 * Shared teardown — runs LAST (alphabetically after auth, db, health, migrations, rbac, security).
 *
 * With --test-force-exit the runner force-exits after all tests finish,
 * so we don't need to manually drain the pool or close the session store.
 * This file exists as a placeholder to mark the intended teardown boundary.
 * If pool.end() is needed in future (e.g. for a non-force-exit run), add it back here.
 */
