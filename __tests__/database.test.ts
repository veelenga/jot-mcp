import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initializeDatabase } from '../src/database.js';

describe('Database', () => {
  let testDir: string;
  let dbPath: string;

  before(() => {
    testDir = mkdtempSync(join(tmpdir(), 'jot-test-'));
    dbPath = join(testDir, 'test.db');
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should initialize database with correct schema', () => {
    const db = initializeDatabase(dbPath);

    // Check contexts table
    const contexts = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contexts'").get();
    assert.ok(contexts, 'contexts table should exist');

    // Check jots table
    const jots = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='jots'").get();
    assert.ok(jots, 'jots table should exist');

    // Check tags table
    const tags = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'").get();
    assert.ok(tags, 'tags table should exist');

    // Check metadata table
    const metadata = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'").get();
    assert.ok(metadata, 'metadata table should exist');

    // Check FTS table
    const fts = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='jots_fts'").get();
    assert.ok(fts, 'jots_fts table should exist');

    db.close();
  });

  it('should create indexes', () => {
    const db = initializeDatabase(dbPath);

    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    ).all() as any[];

    assert.ok(indexes.length > 0, 'should have indexes');

    db.close();
  });

  it('should handle multiple initializations safely', () => {
    const db1 = initializeDatabase(dbPath);
    const db2 = initializeDatabase(dbPath);

    assert.ok(db1, 'first initialization should succeed');
    assert.ok(db2, 'second initialization should succeed');

    db1.close();
    db2.close();
  });
});
