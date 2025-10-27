import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initializeDatabase } from './database.js';
import { JotRepository } from './repository.js';

describe('JotRepository', () => {
  let testDir: string;
  let dbPath: string;
  let repository: JotRepository;

  before(() => {
    testDir = mkdtempSync(join(tmpdir(), 'jot-test-'));
    dbPath = join(testDir, 'test.db');
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    const db = initializeDatabase(dbPath);
    // Clear all tables
    db.exec('DELETE FROM metadata');
    db.exec('DELETE FROM tags');
    db.exec('DELETE FROM jots');
    db.exec('DELETE FROM contexts');
    repository = new JotRepository(db);
  });

  describe('Context Management', () => {
    it('should create a new context', () => {
      const context = repository.upsertContext('test-context', 'test-repo', 'main');

      assert.ok(context.id, 'should have an id');
      assert.strictEqual(context.name, 'test-context');
      assert.strictEqual(context.repository, 'test-repo');
      assert.strictEqual(context.branch, 'main');
      assert.strictEqual(context.jotCount, 0);
    });

    it('should reuse existing context', () => {
      const context1 = repository.upsertContext('test-context', 'repo1', 'main');
      const context2 = repository.upsertContext('test-context', 'repo2', 'dev');

      assert.strictEqual(context1.id, context2.id, 'should have same id');
      // upsert doesn't update, just returns existing
      assert.strictEqual(context2.repository, 'repo1', 'should keep original repository');
      assert.strictEqual(context2.branch, 'main', 'should keep original branch');
    });

    it('should get context by id', () => {
      const created = repository.upsertContext('test-context');
      const retrieved = repository.getContext(created.id);

      assert.ok(retrieved, 'should retrieve context');
      assert.strictEqual(retrieved!.id, created.id);
      assert.strictEqual(retrieved!.name, 'test-context');
    });

    it('should get context by name', () => {
      repository.upsertContext('test-context');
      const retrieved = repository.getContextByName('test-context');

      assert.ok(retrieved, 'should retrieve context');
      assert.strictEqual(retrieved!.name, 'test-context');
    });

    it('should list all contexts', () => {
      repository.upsertContext('context1');
      repository.upsertContext('context2');
      repository.upsertContext('context3');

      const contexts = repository.listContexts();

      assert.strictEqual(contexts.length, 3);
    });

    it('should delete context and its jots', () => {
      const context = repository.upsertContext('test-context');
      repository.createJot(context.id, 'test message', null, [], {});

      const deleted = repository.deleteContext(context.id);

      assert.ok(deleted, 'should delete context');
      assert.strictEqual(repository.getContext(context.id), null);
    });
  });

  describe('Jot Management', () => {
    let contextId: string;

    beforeEach(() => {
      const context = repository.upsertContext('test-context');
      contextId = context.id;
    });

    it('should create a jot', () => {
      const jot = repository.createJot(
        contextId,
        'test message',
        Date.now() + 1000000,
        ['tag1', 'tag2'],
        { key: 'value' }
      );

      assert.ok(jot.id, 'should have an id');
      assert.strictEqual(jot.message, 'test message');
      assert.strictEqual(jot.contextId, contextId);
      assert.strictEqual(jot.tags.length, 2);
      assert.ok(jot.tags.includes('tag1'));
      assert.ok(jot.tags.includes('tag2'));
      assert.strictEqual(jot.metadata.key, 'value');
    });

    it('should create permanent jot with null expiration', () => {
      const jot = repository.createJot(contextId, 'permanent', null, [], {});

      assert.strictEqual(jot.expiresAt, null);
    });

    it('should get jot by id', () => {
      const created = repository.createJot(contextId, 'test', null, [], {});
      const retrieved = repository.getJot(created.id);

      assert.ok(retrieved);
      assert.strictEqual(retrieved!.id, created.id);
      assert.strictEqual(retrieved!.message, 'test');
    });

    it('should list jots for context', () => {
      repository.createJot(contextId, 'jot1', null, [], {});
      repository.createJot(contextId, 'jot2', null, [], {});

      const jots = repository.searchJots({ contextId });

      assert.strictEqual(jots.length, 2);
    });

    it('should delete jot', () => {
      const jot = repository.createJot(contextId, 'test', null, [], {});

      const deleted = repository.deleteJot(jot.id);

      assert.ok(deleted);
      assert.strictEqual(repository.getJot(jot.id), null);
    });

    it('should update jot message', () => {
      const jot = repository.createJot(contextId, 'original message', null, [], {});

      const updated = repository.updateJot(jot.id, { message: 'updated message' });

      assert.ok(updated);
      assert.strictEqual(updated!.message, 'updated message');
      assert.strictEqual(updated!.id, jot.id);
    });

    it('should update jot tags', () => {
      const jot = repository.createJot(contextId, 'test', null, ['old-tag'], {});

      const updated = repository.updateJot(jot.id, { tags: ['new-tag1', 'new-tag2'] });

      assert.ok(updated);
      assert.strictEqual(updated!.tags.length, 2);
      assert.ok(updated!.tags.includes('new-tag1'));
      assert.ok(updated!.tags.includes('new-tag2'));
      assert.ok(!updated!.tags.includes('old-tag'));
    });

    it('should update jot expiration', () => {
      const jot = repository.createJot(contextId, 'test', null, [], {});
      const newExpiry = Date.now() + 5000000;

      const updated = repository.updateJot(jot.id, { expiresAt: newExpiry });

      assert.ok(updated);
      assert.strictEqual(updated!.expiresAt, newExpiry);
    });

    it('should update jot metadata', () => {
      const jot = repository.createJot(contextId, 'test', null, [], { old: 'value' });

      const updated = repository.updateJot(jot.id, { metadata: { new: 'metadata' } });

      assert.ok(updated);
      assert.strictEqual(updated!.metadata.new, 'metadata');
      assert.strictEqual(updated!.metadata.old, undefined);
    });

    it('should update multiple jot fields at once', () => {
      const jot = repository.createJot(contextId, 'original', Date.now() + 1000000, ['tag1'], {});

      const updated = repository.updateJot(jot.id, {
        message: 'updated message',
        expiresAt: null,
        tags: ['new-tag'],
        metadata: { key: 'value' },
      });

      assert.ok(updated);
      assert.strictEqual(updated!.message, 'updated message');
      assert.strictEqual(updated!.expiresAt, null);
      assert.strictEqual(updated!.tags.length, 1);
      assert.ok(updated!.tags.includes('new-tag'));
      assert.strictEqual(updated!.metadata.key, 'value');
    });

    it('should return null when updating non-existent jot', () => {
      const updated = repository.updateJot('non-existent-id', { message: 'test' });

      assert.strictEqual(updated, null);
    });

    it('should update context jot count', () => {
      repository.createJot(contextId, 'jot1', null, [], {});
      repository.createJot(contextId, 'jot2', null, [], {});

      const context = repository.getContext(contextId);

      assert.strictEqual(context!.jotCount, 2);
    });
  });

  describe('Search', () => {
    let contextId: string;

    beforeEach(() => {
      const context = repository.upsertContext('test-context');
      contextId = context.id;
    });

    it('should search by full-text query', () => {
      repository.createJot(contextId, 'authentication implementation', null, [], {});
      repository.createJot(contextId, 'database migration', null, [], {});
      repository.createJot(contextId, 'authentication bugfix', null, [], {});

      const results = repository.searchJots({ query: 'authentication' });

      assert.strictEqual(results.length, 2);
    });

    it('should filter by context', () => {
      const context2 = repository.upsertContext('other-context');

      repository.createJot(contextId, 'message1', null, [], {});
      repository.createJot(context2.id, 'message2', null, [], {});

      const results = repository.searchJots({ contextId });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].message, 'message1');
    });

    it('should filter by tags', () => {
      repository.createJot(contextId, 'msg1', null, ['bug'], {});
      repository.createJot(contextId, 'msg2', null, ['feature'], {});
      repository.createJot(contextId, 'msg3', null, ['bug', 'urgent'], {});

      const results = repository.searchJots({ tags: ['bug'] });

      assert.strictEqual(results.length, 2);
    });

    it('should filter by date range', () => {
      const now = Date.now();
      const yesterday = now - 24 * 60 * 60 * 1000;
      const tomorrow = now + 24 * 60 * 60 * 1000;

      repository.createJot(contextId, 'old', null, [], {});

      const results = repository.searchJots({
        fromDate: yesterday,
        toDate: tomorrow,
      });

      assert.strictEqual(results.length, 1);
    });

    it('should exclude expired jots by default', () => {
      const past = Date.now() - 1000;

      repository.createJot(contextId, 'expired', past, [], {});
      repository.createJot(contextId, 'active', null, [], {});

      const results = repository.searchJots({});

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].message, 'active');
    });

    it('should include expired jots when requested', () => {
      const past = Date.now() - 1000;

      repository.createJot(contextId, 'expired', past, [], {});
      repository.createJot(contextId, 'active', null, [], {});

      const results = repository.searchJots({ includeExpired: true });

      assert.strictEqual(results.length, 2);
    });

    it('should limit results', () => {
      repository.createJot(contextId, 'jot1', null, [], {});
      repository.createJot(contextId, 'jot2', null, [], {});
      repository.createJot(contextId, 'jot3', null, [], {});

      const results = repository.searchJots({ limit: 2 });

      assert.strictEqual(results.length, 2);
    });
  });

  describe('Expiration', () => {
    let contextId: string;

    beforeEach(() => {
      const context = repository.upsertContext('test-context');
      contextId = context.id;
    });

    it('should delete expired jots', () => {
      const past = Date.now() - 1000;
      const future = Date.now() + 1000000;

      repository.createJot(contextId, 'expired', past, [], {});
      repository.createJot(contextId, 'active', future, [], {});
      repository.createJot(contextId, 'permanent', null, [], {});

      const deleted = repository.deleteExpiredJots();

      assert.strictEqual(deleted, 1);
      assert.strictEqual(repository.searchJots({ contextId, includeExpired: false }).length, 2);
    });

    it('should get jots expiring soon', () => {
      const soon = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 days
      const later = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 days

      repository.createJot(contextId, 'expiring-soon', soon, [], {});
      repository.createJot(contextId, 'expiring-later', later, [], {});
      repository.createJot(contextId, 'permanent', null, [], {});

      const expiring = repository.getExpiringSoon(3);

      assert.strictEqual(expiring.length, 1);
      assert.strictEqual(expiring[0].message, 'expiring-soon');
    });
  });
});
